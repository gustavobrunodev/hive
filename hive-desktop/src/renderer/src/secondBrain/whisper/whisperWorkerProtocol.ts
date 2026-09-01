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
      /** 16 kHz mono PCM — a copy the client made for the trip; see `transferOf`. */
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
  /**
   * `kind: 'memory'` is not a nicer label for the same failure — it changes
   * what the client does next. See `isMemoryFailure`.
   */
  | { type: 'error'; id: number; message: string; kind?: 'memory' }
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
 * nothing — **provided the buffer is one made for the trip**.
 *
 * That proviso used to be a comment claiming the queue kept its own copy. It
 * did not: `transcriptionQueue` retains the very array it enqueued, which is
 * the array that gets transferred, and after the trip that array is detached.
 * Nothing noticed until something failed — and the retry that failure exists
 * for posted the detached buffer straight back, turning one bad segment into
 * "Failed to execute 'postMessage' on 'Worker': An ArrayBuffer is detached"
 * for the rest of the take. The copy now happens in `whisperClient`, where
 * every caller gets it, and this function is what consumes it.
 */
export function transferOf(request: WhisperWorkerRequest): Transferable[] {
  return request.type === 'transcribe' ? [request.pcm.buffer as ArrayBuffer] : []
}

/**
 * Is this failure the WASM heap running out, rather than something about the
 * audio?
 *
 * It matters because the two need opposite responses. An ordinary error is
 * retryable as-is; an exhausted heap is not — onnxruntime's allocator is inside
 * a WebAssembly memory that only grows, so once a run has failed to allocate,
 * every later run in that worker fails the same way. The only real fix is a new
 * worker, which is what the client does when it sees this.
 *
 * The strings are the ones onnxruntime-web and V8 actually produce; the ORT one
 * arrives wrapped ("failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE:
 * std::bad_alloc"), so this matches on substrings rather than equality.
 */
export function isMemoryFailure(message: string): boolean {
  const lowered = message.toLowerCase()
  return (
    lowered.includes('bad_alloc') ||
    lowered.includes('out of memory') ||
    // `\b` and not a substring: "room", "zoom" and "bloom" are not failures.
    /\boom\b/.test(lowered) ||
    lowered.includes('memory access out of bounds') ||
    lowered.includes('array buffer allocation failed') ||
    lowered.includes('failed to allocate')
  )
}
