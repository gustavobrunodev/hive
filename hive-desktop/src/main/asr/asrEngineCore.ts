import type {
  AsrEnginePhase,
  AsrFailureKind,
  AsrModelPaths,
  AsrWorkerRequest,
  AsrWorkerResponse
} from './asrWorkerProtocol'

/**
 * Everything the ASR utility process actually does, with the process taken out.
 *
 * The split is the one `whisperEngineCore` made against its `Worker`, kept for
 * the same reason: the file that touches the platform (`asrWorker.ts`) is a
 * dozen lines of wiring, and the rules worth asserting — build one recognizer
 * and reuse it, drop it when it has been idle, refuse audio too short to
 * decode, classify a missing weight differently from a crashed addon — live
 * here, where a unit test can reach them without loading a 652 MB encoder or a
 * native `.node` binary.
 */

/** The slice of `sherpa-onnx-node` this uses, injected so tests need no addon. */
export interface SherpaStream {
  acceptWaveform: (wave: { sampleRate: number; samples: Float32Array }) => void
}

export interface SherpaRecognizer {
  createStream: () => SherpaStream
  decode: (stream: SherpaStream) => void
  getResult: (stream: SherpaStream) => { text: string }
}

export interface SherpaModule {
  OfflineRecognizer: new (config: Record<string, unknown>) => SherpaRecognizer
}

export interface AsrEngineDeps {
  /** Loads the native addon. Lazily, so a process that never transcribes never pays. */
  loadAddon: () => SherpaModule
  /** Sends one message back to main. */
  post: (message: AsrWorkerResponse) => void
  /** True when every path in the set exists on disk. */
  filesExist: (paths: AsrModelPaths) => boolean
  /** Wall clock, injected so the idle rule is testable without waiting. */
  now?: () => number
}

export interface AsrEngineCore {
  /** Runs one request to completion. Never throws — failures are posted. */
  handle: (request: AsrWorkerRequest) => void
  /** Drops the recognizer if it has gone unused for `IDLE_EVICT_MS`. */
  sweep: () => void
}

/** Sample rate everything upstream delivers, fixed by `micCapture` and `audio.ts`. */
export const SAMPLE_RATE = 16_000

/** Mel bins the NeMo Parakeet export expects. Not a knob — the model's own shape. */
export const FEATURE_DIM = 80

/**
 * Audio shorter than this is answered with `''` instead of being decoded.
 *
 * A transducer fed a fragment does not fail, which is the problem: it emits a
 * plausible token for whatever it heard, so a click or a breath between phrases
 * becomes a word the user never said. The live pass offers the open phrase
 * repeatedly as it grows (`livePass.ts`), so this bound is hit routinely rather
 * than exceptionally — it is the guard that keeps those early offers silent
 * instead of inventive.
 */
export const MIN_DECODE_SAMPLES = SAMPLE_RATE / 5 // 200 ms

/**
 * How long a built recognizer survives with nothing asked of it.
 *
 * Measured in the spike on 2026-09-01: the int8 Parakeet weights settle at
 * **~1 GB resident**, and building them costs ~1.8 s. Neither figure is
 * negotiable on its own, so the design has to choose which one the user pays,
 * and when. Holding the session forever spends a gigabyte on someone who
 * dictated one sentence this morning; rebuilding per phrase spends 1.8 s on
 * every phrase. Five minutes is the seam: a dictation session is a burst of
 * phrases seconds apart, so within a session nothing rebuilds, and a user who
 * has moved on gets the gigabyte back.
 */
export const IDLE_EVICT_MS = 5 * 60 * 1000

/** Keys a built recognizer to the exact configuration that produced it. */
function keyOf(paths: AsrModelPaths, threads: number): string {
  return `${paths.encoder}|${paths.decoder}|${paths.joiner}|${paths.tokens}|${threads}`
}

/** The recognizer config, as one place so `warm` and `transcribe` cannot drift. */
export function recognizerConfig(paths: AsrModelPaths, threads: number): Record<string, unknown> {
  return {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: FEATURE_DIM },
    modelConfig: {
      transducer: { encoder: paths.encoder, decoder: paths.decoder, joiner: paths.joiner },
      tokens: paths.tokens,
      // The NeMo export is a token-and-duration transducer; naming it is what
      // selects sherpa's TDT decode loop rather than a plain RNN-T one.
      modelType: 'nemo_transducer',
      numThreads: threads,
      provider: 'cpu',
      debug: false
    },
    // Greedy, deliberately. Modified beam search buys a little accuracy for a
    // multiple of the time, and this engine's whole reason for existing is that
    // a dictated phrase comes back before the speaker has finished the next one.
    decodingMethod: 'greedy_search'
  }
}

/** Missing weights and a broken addon are different problems for the user. */
export function failureKind(error: unknown, filesPresent: boolean): AsrFailureKind {
  if (!filesPresent) return 'model'
  const text = error instanceof Error ? error.message : String(error)
  return text.trim() === '' ? 'unknown' : 'runtime'
}

export function createAsrEngineCore(deps: AsrEngineDeps): AsrEngineCore {
  const now = deps.now ?? Date.now
  let addon: SherpaModule | null = null
  let current: { key: string; recognizer: SherpaRecognizer } | null = null
  let lastUsed = 0

  const phase = (next: AsrEnginePhase): void => deps.post({ type: 'phase', phase: next })

  const fail = (id: number, error: unknown, filesPresent: boolean): void => {
    const message = error instanceof Error ? error.message : String(error)
    phase({ status: 'error', message })
    deps.post({ type: 'error', id, message, kind: failureKind(error, filesPresent) })
  }

  /** Builds or returns the recognizer for this configuration. */
  const recognizerFor = (paths: AsrModelPaths, threads: number): SherpaRecognizer => {
    const key = keyOf(paths, threads)
    if (current !== null && current.key === key) {
      lastUsed = now()
      return current.recognizer
    }
    phase({ status: 'loading' })
    if (addon === null) addon = deps.loadAddon()
    const recognizer = new addon.OfflineRecognizer(recognizerConfig(paths, threads))
    current = { key, recognizer }
    lastUsed = now()
    return recognizer
  }

  const handle = (request: AsrWorkerRequest): void => {
    if (request.type === 'evict') {
      current = null
      phase({ status: 'idle' })
      return
    }

    const present = deps.filesExist(request.paths)
    try {
      if (!present) throw new Error(`model files missing: ${request.paths.encoder}`)

      if (request.type === 'warm') {
        recognizerFor(request.paths, request.threads)
        phase({ status: 'ready' })
        deps.post({ type: 'done', id: request.id, text: '' })
        return
      }

      // Too short to be a word. Answered before the recognizer is even asked
      // for, so an idle engine is not built by a click between phrases.
      if (request.pcm.length < MIN_DECODE_SAMPLES) {
        deps.post({ type: 'done', id: request.id, text: '' })
        return
      }

      const recognizer = recognizerFor(request.paths, request.threads)
      phase({ status: 'transcribing' })
      const stream = recognizer.createStream()
      stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: request.pcm })
      recognizer.decode(stream)
      const text = recognizer.getResult(stream).text.trim()
      lastUsed = now()
      phase({ status: 'ready' })
      deps.post({ type: 'done', id: request.id, text })
    } catch (error) {
      fail(request.id, error, present)
    }
  }

  const sweep = (): void => {
    if (current === null) return
    if (now() - lastUsed < IDLE_EVICT_MS) return
    current = null
    phase({ status: 'idle' })
  }

  return { handle, sweep }
}
