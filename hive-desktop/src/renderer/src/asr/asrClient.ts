/**
 * The renderer's handle on the app's one transcription engine (M29).
 *
 * There is very little here, and the emptiness is the change. Its predecessor,
 * `whisperClient.ts`, was 418 lines because the renderer *was* the engine: it
 * probed for WebGPU, chose fp32 or q8 from that, checked whether those exact
 * bytes were on disk, started a download if they were not, spawned a `Worker`,
 * kept the warm pipeline, and replaced the whole worker when the WASM heap ran
 * out — because replacing it was the only way to get the memory back.
 *
 * All of that was compensation for running a 900 MB fp32 model on a single
 * WASM thread inside a sandboxed page. With inference in a native utility
 * process, none of those decisions belong to the renderer, so what is left is a
 * subscription and two calls.
 *
 * **One thing that disappeared rather than moved.** M28 had to add a
 * `pcm.slice()` here: the old client *transferred* the PCM to its worker, which
 * detaches the buffer, while `transcriptionQueue` retains the very same array
 * for its retries — so the first failure of a take turned "Tentar de novo" into
 * a second error, permanently. IPC structured-clones its arguments instead of
 * transferring them, so the caller's array is never detached and the copy is
 * not needed. The failure mode is gone, not guarded against.
 */

/**
 * Derived from the bridge rather than imported from `src/main` — the repo's
 * process-boundary rule, enforced by `moduleBoundaries.test.ts`. The renderer's
 * only contract with main is `window.hive`.
 */
export type AsrPhase = Parameters<Parameters<Window['hive']['asr']['onPhase']>[0]>[0]

export interface TranscribeOptions {
  /**
   * Text decoded **so far**.
   *
   * Kept in the signature, and deliberately never called. It existed because a
   * Whisper pass took seconds, so streaming tokens was the only way the gap
   * looked like progress; sherpa's offline recognizer decodes in one blocking
   * call and has nothing to stream. What replaced it is that the call is now
   * fast enough not to need it — a 5 s phrase comes back in about 400 ms — and
   * live text comes from `livePass` re-offering the growing phrase, which is
   * the mechanism that actually made dictation feel live (M28).
   */
  onPartial?: (text: string) => void
}

export interface AsrClient {
  phase: () => AsrPhase
  /** Subscribes to phase changes. Returns the unsubscribe. */
  subscribe: (listener: (phase: AsrPhase) => void) => () => void
  /** Builds the session ahead of time. Idempotent, and shared app-wide. */
  warm: () => Promise<void>
  transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Promise<string>
  /** Back to `idle` after an error the user has seen. */
  reset: () => void
}

/** The engine failed. Carries main's `kind` so copy can be specific. */
export class AsrClientError extends Error {
  readonly kind: string
  constructor(message: string, kind: string) {
    super(message)
    this.name = 'AsrClientError'
    this.kind = kind
  }
}

/** The `window.hive.asr` slice, injected so tests need no preload bridge. */
export type AsrBridge = Window['hive']['asr']

/**
 * `bridge` is a **getter**, not the bridge.
 *
 * The client is a module singleton that outlives any particular
 * `window.hive`, and capturing the object once couples it to whatever existed
 * at first use. That is a real coupling, not a theoretical one: it made the
 * engine unreachable for the rest of a test file the moment the harness
 * swapped `window.hive` — a stale reference that resolved, returned
 * `undefined`, and surfaced as `Cannot read properties of undefined (reading
 * 'catch')` from inside the pre-warm. Reading it per call has no cost and no
 * ordering to get wrong.
 */
export function createAsrClient(bridge: () => AsrBridge): AsrClient {
  let current: AsrPhase = { status: 'idle' }
  const listeners = new Set<(phase: AsrPhase) => void>()

  const publish = (next: AsrPhase): void => {
    current = next
    for (const listener of listeners) listener(next)
  }

  // Main broadcasts the phase to every window, so this subscription is opened
  // once for the module rather than per component: the engine's state is a fact
  // about the app, and a component that mounts late must not miss it.
  bridge().onPhase(publish)

  return {
    phase: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    warm: async () => bridge().warm(),
    transcribe: async (pcm) => bridge().transcribe(pcm),
    reset: () => {
      if (current.status === 'error') publish({ status: 'idle' })
    }
  }
}

let singleton: AsrClient | null = null

/**
 * The app's one client.
 *
 * A module singleton for the same reason its predecessor was: every surface
 * that dictates used to hold its own engine, so each one paid the session build
 * again, and a pre-warm racing a first phrase started two of them.
 */
export function asrClient(): AsrClient {
  singleton ??= createAsrClient(() => window.hive.asr)
  return singleton
}

/** Tests only — drops the singleton so the next call rebuilds it. */
export function resetAsrClient(): void {
  singleton = null
}
