import type { WhisperModelId, WhisperVariant } from './whisperIds'

/**
 * The wire between the renderer and the transcription worker — types only, so
 * both sides are compiled against one contract and neither drags the other's
 * runtime along (the worker must never import React; the client must never
 * import Transformers.js).
 *
 * **Why there is a worker at all**, measured in the real built app on
 * 2026-08-25 (`tools/spikes/whisperThread.mjs`, and STATE.md): running the
 * pipeline on the renderer's main thread produced **zero animation frames for
 * the entire 10 s transcription**. Not "janky" — frozen. Which means every word
 * the queue had already transcribed was sitting in React state that could not
 * paint until the queue went idle, i.e. until the user stopped talking. The
 * streaming design was right and invisible: the thread it streamed on was the
 * one that had to draw it.
 *
 * ORT's own `wasm.proxy` worker was tried first and does not start under this
 * app's CSP/`file://` origin ("no available backend found. ERR: [wasm]"), so
 * the offload is ours: a same-origin **module** worker, which
 * `tools/spikes/whisperWorker.probe.mjs` proved can boot from `file://`, read
 * weights over the privileged `hive-model:` scheme, and leave the main thread
 * at a 19 ms worst frame while transcribing.
 */

/** What the client asks the worker to do. */
export type WhisperWorkerRequest =
  /**
   * Build (or reuse) the pipeline and stop. The pre-warm, as an explicit
   * message rather than a tenth of a second of fake silence pushed through
   * `transcribe` — the old trick both cost a real inference pass and, worse,
   * occupied the single pipeline slot the first real phrase then queued behind.
   */
  | {
      type: 'warm'
      id: number
      model: WhisperModelId
      variant: WhisperVariant
      device: string
      baseHref: string
    }
  | {
      type: 'transcribe'
      id: number
      model: WhisperModelId
      variant: WhisperVariant
      device: string
      language: string
      /**
       * `document.baseURI`, which only the main thread knows. The worker
       * resolves the same-origin ORT assets against it — its own URL points
       * one directory too deep once the bundler emits it into `assets/`.
       */
      baseHref: string
      /** 16 kHz mono PCM. Transferred, not copied — see `transferOf`. */
      pcm: Float32Array
    }

/** What the worker says back. Every message carries the request it belongs to. */
export type WhisperWorkerResponse =
  /** Load/warm/transcribe progress, so the UI's caption stays honest. */
  | { type: 'phase'; id: number; phase: WhisperWorkerPhase }
  /**
   * Text decoded **so far** for this request (SB-R4.x, the streaming half).
   * Whisper emits tokens as it decodes; the spike measured the first one at
   * ~1.8 s into a run whose full result took 2.2 s, which is the difference
   * between "it is working" and "it is hung".
   */
  | { type: 'partial'; id: number; text: string }
  | { type: 'done'; id: number; text: string }
  | { type: 'error'; id: number; message: string }
  /** Posted once at module scope, so the client knows the worker is alive. */
  | { type: 'ready'; id: 0 }

/**
 * The worker's own view of what it is doing. A subset of `WhisperPhase`: the
 * download belongs to main and never reaches the worker, so `downloading` is
 * not in here — the client owns that half and merges the two.
 */
export type WhisperWorkerPhase =
  | { status: 'loading'; pct: number }
  | { status: 'warming' }
  | { status: 'transcribing' }
  | { status: 'idle' }

/**
 * The PCM buffer to hand over rather than copy.
 *
 * A 15 s segment is 960 kB; structured-cloning it per segment is a copy the
 * take pays for at exactly the moment it is busiest. Transferring costs
 * nothing — and is safe here precisely because the queue **retains its own
 * copy for retries** (`transcriptionQueue`'s `Item.pcm`), so the buffer this
 * detaches is a slice made for the trip.
 */
export function transferOf(request: WhisperWorkerRequest): Transferable[] {
  return request.type === 'transcribe' ? [request.pcm.buffer as ArrayBuffer] : []
}
