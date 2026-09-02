/**
 * The message contract between main and the ASR utility process (M29).
 *
 * Pure, so both ends and their tests can import it without pulling in Electron
 * or the native addon — the same reason `whisperWorkerProtocol.ts` existed for
 * the `Worker` this replaces.
 */

/** Where the engine is. Mirrors the phase the renderer renders. */
export type AsrEnginePhase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'transcribing' }
  | { status: 'error'; message: string }

/** Everything needed to build one recognizer. Paths are absolute. */
export interface AsrModelPaths {
  encoder: string
  decoder: string
  joiner: string
  tokens: string
}

/**
 * Why a transcription failed, as a key the renderer turns into a sentence.
 *
 * `model` and `runtime` are worth separating because they are different things
 * to tell someone: a missing weight file is fixed by downloading it again, and
 * a crashed addon is fixed by trying again. The Whisper engine's taxonomy had a
 * `memory` kind whose advice was "choose a smaller model" — that kind goes away
 * with the WASM heap that produced it, and there is no smaller model to choose.
 */
export type AsrFailureKind = 'model' | 'runtime' | 'unknown'

export type AsrWorkerRequest =
  | { type: 'warm'; id: number; paths: AsrModelPaths; threads: number }
  | {
      type: 'transcribe'
      id: number
      paths: AsrModelPaths
      threads: number
      /** 16 kHz mono Float32 PCM. */
      pcm: Float32Array
    }
  /** Drops the recognizer and its ~1 GB of weights. See `asrEngineCore`. */
  | { type: 'evict'; id: number }

export type AsrWorkerResponse =
  | { type: 'phase'; phase: AsrEnginePhase }
  | { type: 'done'; id: number; text: string }
  | { type: 'error'; id: number; message: string; kind: AsrFailureKind }
