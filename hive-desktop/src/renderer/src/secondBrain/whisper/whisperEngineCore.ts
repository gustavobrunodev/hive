import {
  configureWhisperEnv,
  installLoadMeter,
  loadPercent,
  weightsLoaded,
  type TransformersEnv
} from './whisperEnv'
import { isMemoryFailure } from './whisperWorkerProtocol'
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
) => Promise<{ text?: string }>) & {
  tokenizer: unknown
  /**
   * Releases the ONNX sessions. Optional because a test double has none — but
   * on the real pipeline it is the only way the weights ever leave the WASM
   * heap, and that heap only ever grows.
   */
  dispose?: () => Promise<void>
}

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

/**
 * Whisper's own input window. Every model in the family sees exactly 30 s of
 * mel frames per forward pass — shorter audio is padded up to it, which is why
 * a 2 s phrase and a 9 s one cost nearly the same.
 */
export const WHISPER_WINDOW_S = 30

/** Sample rate every request arrives at, fixed by `micCapture` and `audio.ts`. */
const SAMPLE_RATE = 16_000

/**
 * Whether to ask for the chunked long-audio path, for audio of `samples`.
 *
 * Chunking is how a 40-minute recording transcribes in bounded memory, and it
 * was being asked for unconditionally. On a dictated phrase that is not free:
 * the chunked path builds its own strided buffers and runs the post-processing
 * that stitches overlapping windows back together, all to produce exactly one
 * window's worth of output. Under WASM — one thread, an fp32 model, and a heap
 * that only grows — that surplus is the difference between a take that lasts
 * and "failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc".
 *
 * Audio that genuinely exceeds the window still gets chunked, unchanged.
 */
export function chunkingFor(samples: number): Record<string, number> {
  return samples > WHISPER_WINDOW_S * SAMPLE_RATE
    ? { chunk_length_s: WHISPER_WINDOW_S, stride_length_s: 5 }
    : {}
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

    // A switch replaces the pipeline, and the outgoing one has to be told to
    // go: its ONNX sessions live in a WebAssembly memory that grows and never
    // shrinks, so dropping the reference frees the JS handle and leaves ~1 GB
    // of fp32 weights sitting in the heap the next session has to allocate out
    // of. That is the arithmetic behind "std::bad_alloc" after a model change.
    if (current !== null) {
      const outgoing = current.asr
      current = null
      await outgoing.dispose?.().catch(() => {
        // A pipeline that will not dispose is not a reason to refuse to build
        // the next one — the heap is the thing at risk, and it is already lost.
      })
    }

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
      ...chunkingFor(pcm.length),
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
        const message = error instanceof Error ? error.message : String(error)
        const memory = isMemoryFailure(message)
        // An exhausted heap is not a bad segment, it is a bad *worker*: ORT's
        // allocator never gives memory back, so every later run fails the same
        // way. Dropping the pipeline here is the half this side can do; the
        // client reads `kind` and replaces the whole thread, which is the half
        // that actually works.
        if (memory) current = null
        deps.post({
          type: 'error',
          id: request.id,
          message,
          ...(memory ? { kind: 'memory' as const } : {})
        })
      } finally {
        deps.post({ type: 'phase', id: request.id, phase: { status: 'idle' } })
      }
    }
  }
}
