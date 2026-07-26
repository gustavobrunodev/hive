import { useCallback, useRef, useState } from 'react'
import { configureWhisperEnv, type TransformersEnv } from './whisperEnv'

/** Bridge-derived types (the renderer never imports `src/main/*`). */
type WhisperBridge = Window['hive']['whisper']
export type WhisperModelId = Parameters<WhisperBridge['modelStatus']>[0]
export type WhisperVariant = Parameters<WhisperBridge['downloadModel']>[1]

/** What the UI needs to render an honest progress caption. */
export type WhisperPhase =
  | { status: 'idle' }
  | { status: 'downloading'; pct: number; file: string }
  | { status: 'loading'; pct: number }
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
        // fp32 is mandatory on WASM (quantized decoder can't build a session);
        // WebGPU can take the ~4x smaller q8 weights.
        const variant: WhisperVariant = webgpu ? 'q8' : 'fp32'

        await ensureDownloaded(model, variant)

        const key = `${model}:${variant}`
        let asr = pipelineRef.current?.key === key ? pipelineRef.current.asr : null

        if (!asr) {
          setPhase({ status: 'loading', pct: 0 })
          const { pipeline, env } = await deps.loadLibrary()
          configureWhisperEnv(env, deps.baseHref())
          asr = await pipeline('automatic-speech-recognition', model, {
            device,
            dtype: variant === 'q8' ? 'q8' : 'fp32',
            progress_callback: (progress: { status?: string; progress?: number }) => {
              if (progress.status === 'progress') {
                setPhase({ status: 'loading', pct: Math.round(progress.progress ?? 0) })
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
