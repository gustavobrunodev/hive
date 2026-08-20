import { useCallback, useRef, useState } from 'react'
import { configureWhisperEnv, type TransformersEnv } from './whisperEnv'

/** Bridge-derived types (the renderer never imports `src/main/*`). */
type WhisperBridge = Window['hive']['whisper']
export type WhisperModelId = Parameters<WhisperBridge['modelStatus']>[0]
export type WhisperVariant = Parameters<WhisperBridge['downloadModel']>[1]

/**
 * What the UI needs to render an honest progress caption.
 *
 * `warming` is the state whose absence made transcription *look* broken: once
 * every model file has been read the engine still has to build an ONNX
 * session, which on the WASM backend is tens of seconds of silent CPU work.
 * Without a phase for it the UI sat on "Preparando o modelo… 100%" and then
 * said nothing at all — the exact dead air a user reads as a hang.
 */
export type WhisperPhase =
  | { status: 'idle' }
  | { status: 'downloading'; pct: number; file: string }
  | { status: 'loading'; pct: number }
  | { status: 'warming' }
  | { status: 'transcribing' }
  | { status: 'error'; message: string }

/** The transcription pipeline callable, as Transformers.js returns it. */
type AsrPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>
) => Promise<{ text?: string }>

/**
 * The pieces of the outside world this hook touches, injected so the whole
 * orchestration — device pick, download-before-load, language default — is
 * unit-testable without loading the real multi-megabyte WASM library.
 */
export interface WhisperDeps {
  /** Dynamically imports `@huggingface/transformers`. */
  loadLibrary: () => Promise<{
    pipeline: (task: string, repo: string, options: Record<string, unknown>) => Promise<AsrPipeline>
    env: TransformersEnv
  }>
  /** True when a real WebGPU adapter is available. */
  hasWebGpu: () => Promise<boolean>
  /** Document base URL, for resolving the same-origin ORT asset directory. */
  baseHref: () => string
}

/**
 * Is a *real* WebGPU adapter available?
 *
 * `navigator.gpu` alone is not proof — the T2 spike found it truthy in a
 * headless Electron run where no adapter exists at all — so this awaits
 * `requestAdapter()` and treats a null (or throwing) adapter as no-WebGPU,
 * which sends the pipeline down the WASM path that always works.
 */
export async function probeWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    return (await gpu.requestAdapter()) != null
  } catch {
    return false
  }
}

/** The real browser-backed dependencies. */
export function browserWhisperDeps(): WhisperDeps {
  return {
    loadLibrary: () =>
      import('@huggingface/transformers') as unknown as ReturnType<WhisperDeps['loadLibrary']>,
    hasWebGpu: probeWebGpu,
    baseHref: () => document.baseURI
  }
}

export interface WhisperEngine {
  phase: WhisperPhase
  /**
   * Transcribes 16 kHz mono Float32 PCM, downloading and warming the model
   * first if needed. Resolves to the transcript text.
   */
  transcribe: (
    pcm: Float32Array,
    options?: { model?: WhisperModelId; language?: string }
  ) => Promise<string>
  reset: () => void
}

/** D-SB-6: the squad works in pt-BR, so Portuguese is the default. */
export const DEFAULT_LANGUAGE = 'portuguese'
/** D-SB-4: `base` is the default model. */
export const DEFAULT_MODEL: WhisperModelId = 'base'

/** What `modelStatus` reports back — the part the precision rule reads. */
interface LocalModel {
  downloaded: boolean
  variant: WhisperVariant | null
}

/**
 * Which precision to run, given the device and what is already on disk.
 *
 * **Weights already on the machine win — if this device can run them.** The
 * three bundled models ship as fp32 (D-SB-8), and fp32 runs on WebGPU perfectly
 * well, so a WebGPU machine uses the copy that is already here rather than
 * downloading a ~4x smaller q8 to save nothing anyone asked to save.
 *
 * The reverse is **not** symmetric, and that asymmetry is the whole rule: the
 * quantized decoder cannot create a session on onnxruntime-web's WASM backend
 * at all ("MatMulNBits … Missing required scale", T2 spike). So a q8 copy left
 * over from a WebGPU run is unusable on CPU and must be re-fetched as fp32
 * rather than "reused" into a failure.
 *
 * Pure, so both directions are asserted without a pipeline or a device.
 */
export function chooseVariant(webgpu: boolean, present: LocalModel): WhisperVariant {
  const usable =
    present.downloaded && (webgpu ? present.variant !== null : present.variant === 'fp32')
  if (usable && present.variant !== null) return present.variant
  return webgpu ? 'q8' : 'fp32'
}

/**
 * Runs Whisper locally in the renderer (SB-R4.1/4.2/4.4).
 *
 * Ordering is the load-bearing part: a model that isn't on disk is **downloaded
 * through main first** (the renderer has no network access — it reads model
 * bytes back over the `hive-model:` protocol), and only then handed to
 * Transformers.js. Loading first would fault on a missing file.
 *
 * Device/precision follow the T2 spike: WebGPU when a real adapter answers,
 * else WASM/CPU — and **`fp32` on WASM**, because the quantized decoder cannot
 * create a session on onnxruntime-web's WASM backend (STATE.md). The warmed
 * pipeline is cached per model+variant so a second transcription is instant.
 */
export function useWhisper(deps: WhisperDeps = browserWhisperDeps()): WhisperEngine {
  const [phase, setPhase] = useState<WhisperPhase>({ status: 'idle' })
  const pipelineRef = useRef<{ key: string; asr: AsrPipeline } | null>(null)

  const reset = useCallback(() => setPhase({ status: 'idle' }), [])

  const ensureDownloaded = useCallback(
    async (model: WhisperModelId, variant: WhisperVariant): Promise<void> => {
      const status = await window.hive.whisper.modelStatus(model)
      if (status.downloaded && status.variant === variant) return

      await new Promise<void>((resolve, reject) => {
        // `unsubscribe` may not be assigned yet when the terminal event arrives:
        // nothing stops `downloadModel` from invoking the callback synchronously
        // (an already-complete download, a future in-process implementation).
        // Deferring teardown through a flag avoids a temporal-dead-zone crash on
        // that path instead of relying on the callback always being async.
        const handle: { off?: () => void } = {}
        let settled = false
        const teardown = (): void => {
          settled = true
          handle.off?.()
        }

        handle.off = window.hive.whisper.downloadModel(model, variant, (event) => {
          if (event.type === 'progress') {
            const pct = event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0
            setPhase({ status: 'downloading', pct, file: event.file })
          } else if (event.type === 'done') {
            teardown()
            resolve()
          } else {
            teardown()
            reject(new Error(event.message))
          }
        })

        // The stream already finished synchronously — tear down now that we
        // actually hold the unsubscribe handle.
        if (settled) handle.off()
      })
    },
    []
  )

  const transcribe = useCallback(
    async (
      pcm: Float32Array,
      options: { model?: WhisperModelId; language?: string } = {}
    ): Promise<string> => {
      const model = options.model ?? DEFAULT_MODEL
      const language = options.language ?? DEFAULT_LANGUAGE

      try {
        const webgpu = await deps.hasWebGpu()
        const device = webgpu ? 'webgpu' : 'wasm'
        const present = await window.hive.whisper.modelStatus(model)
        const variant = chooseVariant(webgpu, present)

        await ensureDownloaded(model, variant)

        const key = `${model}:${variant}`
        let asr = pipelineRef.current?.key === key ? pipelineRef.current.asr : null

        if (!asr) {
          setPhase({ status: 'loading', pct: 0 })
          const { pipeline, env } = await deps.loadLibrary()
          configureWhisperEnv(env, deps.baseHref())
          // Per-file progress, averaged — the library reports each weight file
          // separately and they interleave, so reporting the last event's
          // percentage alone made the bar jump backwards. Capped at 99 while
          // files are still arriving: "100%" is a promise the next phase has
          // to keep, and claiming it early is what made the wait feel broken.
          const seen = new Set<string>()
          const finished = new Set<string>()
          const pctByFile = new Map<string, number>()
          const publish = (): void => {
            const values = [...pctByFile.values()]
            const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
            setPhase({ status: 'loading', pct: Math.min(99, Math.round(mean)) })
          }
          asr = await pipeline('automatic-speech-recognition', model, {
            device,
            dtype: variant === 'q8' ? 'q8' : 'fp32',
            progress_callback: (progress: {
              status?: string
              progress?: number
              file?: string
            }) => {
              const file = progress.file
              if (file === undefined) return
              if (progress.status === 'initiate') {
                seen.add(file)
              } else if (progress.status === 'progress') {
                pctByFile.set(file, progress.progress ?? 0)
                publish()
              } else if (progress.status === 'done') {
                finished.add(file)
                pctByFile.set(file, 100)
                // Everything announced has arrived, so whatever happens next is
                // session/graph work, not I/O. Say so.
                if (seen.size > 0 && finished.size >= seen.size) setPhase({ status: 'warming' })
                else publish()
              }
            }
          })
          pipelineRef.current = { key, asr }
        }

        setPhase({ status: 'transcribing' })
        const result = await asr(pcm, {
          language,
          task: 'transcribe',
          // Chunked long-audio inference: keeps memory bounded and lets the UI
          // stay responsive on a long recording (design §4.1, edge case).
          chunk_length_s: 30,
          stride_length_s: 5
        })

        setPhase({ status: 'idle' })
        return (result.text ?? '').trim()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setPhase({ status: 'error', message })
        throw error
      }
    },
    [deps, ensureDownloaded]
  )

  return { phase, transcribe, reset }
}
