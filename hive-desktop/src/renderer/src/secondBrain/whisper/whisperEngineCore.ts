import {
  configureWhisperEnv,
  installLoadMeter,
  loadPercent,
  weightsLoaded,
  type TransformersEnv
} from './whisperEnv'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisperWorkerProtocol'

/**
 * Everything the transcription worker actually does, with the worker taken out.
 *
 * The split is the same one `micCapture` makes against WebAudio: the file that
 * touches the platform (`whisper.worker.ts`) is a dozen lines of wiring, and
 * the rules worth asserting — build once and reuse, download-free because the
 * client already did it, fp32 on WASM because the quantized decoder cannot
 * create a session there, progress measured off the byte stream rather than
 * requested, partial text forwarded as it decodes — live here, where a unit
 * test can reach them without a `Worker`, a `WebAssembly` runtime or a
 * multi-megabyte library.
 */

/** The pipeline callable, plus the tokenizer the streamer needs. */
export type AsrPipeline = ((
  audio: Float32Array,
  options: Record<string, unknown>
) => Promise<{ text?: string }>) & { tokenizer: unknown }

export interface TransformersModule {
  pipeline: (task: string, repo: string, options: Record<string, unknown>) => Promise<AsrPipeline>
  env: TransformersEnv
  WhisperTextStreamer: new (
    tokenizer: unknown,
    options: { callback_function?: (text: string) => void }
  ) => unknown
}

export interface WhisperEngineDeps {
  /** Dynamically imports `@huggingface/transformers`. */
  loadLibrary: () => Promise<TransformersModule>
  /** Sends one message back to the client. */
  post: (message: WhisperWorkerResponse) => void
}

export interface WhisperEngineCore {
  /** Runs one request to completion. Never throws — failures are posted. */
  handle: (request: WhisperWorkerRequest) => Promise<void>
}

export function createWhisperEngineCore(deps: WhisperEngineDeps): WhisperEngineCore {
  let libraryPromise: Promise<TransformersModule> | null = null
  /**
   * The renderer's own base URL, carried on every request.
   *
   * It cannot be derived from `self.location`: the bundler emits the worker
   * into `assets/`, so resolving `ort/` against the worker's own URL would look
   * for the ONNX glue one directory too deep — a mistake whose only symptom is
   * "no available backend found", minutes into a first take.
   */
  let baseHref = ''
  /** The warm pipeline, keyed by `model:variant:device` — a switch rebuilds. */
  let current: { key: string; asr: AsrPipeline } | null = null

  /**
   * The library, imported once and lazily. Lazily because the import is a
   * multi-megabyte chunk: a worker spawned on intent should cost a thread, not
   * a parse, until something is actually asked of it.
   */
  const library = async (): Promise<TransformersModule> => {
    if (libraryPromise === null) {
      libraryPromise = deps.loadLibrary().then((module) => {
        configureWhisperEnv(module.env, baseHref)
        return module
      })
    }
    return libraryPromise
  }

  /**
   * Builds the pipeline, or hands back the warm one.
   *
   * Progress is measured off the library's own `fetch` rather than requested:
   * passing `progress_callback` makes Transformers.js v4 probe every weight
   * file with a second, never-read GET (see `installLoadMeter`). `warming` is
   * the phase after the last byte — building an ONNX session is tens of seconds
   * of silent CPU work, and a UI sitting on "100 %" through it looks hung.
   */
  const ensurePipeline = async (
    id: number,
    model: string,
    variant: string,
    device: string
  ): Promise<AsrPipeline> => {
    const key = `${model}:${variant}:${device}`
    if (current !== null && current.key === key) return current.asr

    const { pipeline, env } = await library()
    deps.post({ type: 'phase', id, phase: { status: 'loading', pct: 0 } })
    const uninstall = installLoadMeter(env, (files) => {
      deps.post({
        type: 'phase',
        id,
        phase: weightsLoaded(files)
          ? { status: 'warming' }
          : { status: 'loading', pct: loadPercent(files) }
      })
    })
    try {
      const asr = await pipeline('automatic-speech-recognition', model, {
        device,
        // fp32 is the guaranteed path: the quantized decoder cannot create a
        // session on onnxruntime-web's WASM backend at all (T2 spike).
        dtype: variant === 'q8' ? 'q8' : 'fp32'
      })
      current = { key, asr }
      return asr
    } finally {
      // Put the library's own fetch back, so a failed load cannot leave the
      // meter installed on top of it.
      uninstall()
    }
  }

  const transcribe = async (
    request: Extract<WhisperWorkerRequest, { type: 'transcribe' }>
  ): Promise<void> => {
    const { id, model, variant, device, language, pcm } = request
    const asr = await ensurePipeline(id, model, variant, device)
    const { WhisperTextStreamer } = await library()

    deps.post({ type: 'phase', id, phase: { status: 'transcribing' } })
    const streamer = new WhisperTextStreamer(asr.tokenizer, {
      callback_function: (text: string) => deps.post({ type: 'partial', id, text })
    })
    const result = await asr(pcm, {
      language,
      task: 'transcribe',
      // Chunked long-audio inference: bounded memory on a long recording, and —
      // now that partials are forwarded — a steady trickle of text out of one.
      chunk_length_s: 30,
      stride_length_s: 5,
      streamer
    })
    deps.post({ type: 'done', id, text: (result.text ?? '').trim() })
  }

  return {
    handle: async (request) => {
      baseHref = request.baseHref
      try {
        if (request.type === 'warm') {
          await ensurePipeline(request.id, request.model, request.variant, request.device)
          deps.post({ type: 'done', id: request.id, text: '' })
        } else {
          await transcribe(request)
        }
      } catch (error) {
        deps.post({
          type: 'error',
          id: request.id,
          message: error instanceof Error ? error.message : String(error)
        })
      } finally {
        deps.post({ type: 'phase', id: request.id, phase: { status: 'idle' } })
      }
    }
  }
}
