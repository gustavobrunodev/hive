import type {
  AsrEnginePhase,
  AsrFailureKind,
  AsrModelPaths,
  AsrWorkerRequest,
  AsrWorkerResponse
} from './asrWorkerProtocol'

/**
 * Main's supervisor for the ASR utility process (M29).
 *
 * The process is forked **lazily and re-forked after a crash**, and both halves
 * of that matter. Lazily, because a user who never dictates should never pay
 * for a Node process; re-forked, because a native addon that dies takes every
 * in-flight phrase with it and the only honest recovery is a new process —
 * the same conclusion the Whisper client reached about its WASM heap, arrived
 * at from the opposite direction (there, the heap could not be given back; here
 * the process simply is not there any more).
 */

/** The slice of Electron's `UtilityProcess` this needs, injected for tests. */
export interface AsrChild {
  postMessage: (message: unknown) => void
  on: (event: 'message' | 'exit', listener: (payload: never) => void) => void
  kill: () => void
}

export class AsrError extends Error {
  readonly kind: AsrFailureKind
  constructor(message: string, kind: AsrFailureKind) {
    super(message)
    this.name = 'AsrError'
    this.kind = kind
  }
}

export interface AsrEngineDeps {
  /** Forks the worker entry. */
  fork: () => AsrChild
  /** The `require` specifier the worker should use for the native addon. */
  specifier: () => string
  /**
   * Absolute paths to the installed model, or `null` when it is not downloaded.
   *
   * Read per request rather than captured, so a model that lands mid-session
   * makes the very next phrase work without anything being rebuilt.
   */
  paths: () => AsrModelPaths | null
  /** ONNX Runtime intra-op threads for this machine. */
  threads: () => number
}

export interface AsrEngine {
  phase: () => AsrEnginePhase
  /** Subscribes to phase changes. Returns the unsubscribe. */
  subscribe: (listener: (phase: AsrEnginePhase) => void) => () => void
  /** Builds the session ahead of time. Idempotent; a second call joins the first. */
  warm: () => Promise<void>
  /** Transcribes 16 kHz mono Float32 PCM. */
  transcribe: (pcm: Float32Array) => Promise<string>
  /** Drops the session and its ~1 GB of weights. */
  evict: () => void
  /** Tears the process down. */
  dispose: () => void
}

export function createAsrEngine(deps: AsrEngineDeps): AsrEngine {
  let child: AsrChild | null = null
  let nextId = 1
  let current: AsrEnginePhase = { status: 'idle' }
  const listeners = new Set<(phase: AsrEnginePhase) => void>()
  const pending = new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void }>()
  let warming: Promise<void> | null = null

  const setPhase = (next: AsrEnginePhase): void => {
    current = next
    for (const listener of listeners) listener(next)
  }

  /** Fails every request the dead process was carrying. */
  const abortPending = (message: string): void => {
    const carried = [...pending.values()]
    pending.clear()
    for (const entry of carried) entry.reject(new AsrError(message, 'runtime'))
  }

  const spawn = (): AsrChild => {
    const next = deps.fork()
    next.postMessage({ type: 'configure', specifier: deps.specifier() })
    next.on('message', ((event: { data: AsrWorkerResponse }) => {
      const message = event.data
      if (message.type === 'phase') {
        setPhase(message.phase)
        return
      }
      const entry = pending.get(message.id)
      if (entry === undefined) return
      pending.delete(message.id)
      if (message.type === 'done') entry.resolve(message.text)
      else entry.reject(new AsrError(message.message, message.kind))
    }) as (payload: never) => void)
    next.on('exit', (() => {
      child = null
      warming = null
      abortPending('the transcription process stopped')
      setPhase({ status: 'error', message: 'the transcription process stopped' })
    }) as (payload: never) => void)
    return next
  }

  const send = (build: (id: number, paths: AsrModelPaths) => AsrWorkerRequest): Promise<string> => {
    const paths = deps.paths()
    if (paths === null) {
      // Not an error the user should see as a failure — it is the state a fresh
      // install is in, and the gate above this turns it into an offer.
      return Promise.reject(new AsrError('no model installed', 'model'))
    }
    if (child === null) child = spawn()
    const id = nextId++
    const request = build(id, paths)
    return new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      try {
        child?.postMessage(request)
      } catch (error) {
        pending.delete(id)
        reject(new AsrError(error instanceof Error ? error.message : String(error), 'runtime'))
      }
    })
  }

  return {
    phase: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    warm: () => {
      // Shared rather than queued: a pre-warm on intent and a first phrase
      // arriving together must not build two sessions — that was the exact
      // defect `whisperClient` was created to fix, and it costs 1.8 s here.
      warming ??= send((id, paths) => ({
        type: 'warm',
        id,
        paths,
        threads: deps.threads()
      }))
        .then(() => undefined)
        .catch((error: unknown) => {
          warming = null
          throw error
        })
      return warming
    },
    transcribe: (pcm) =>
      send((id, paths) => ({
        type: 'transcribe',
        id,
        paths,
        threads: deps.threads(),
        pcm
      })),
    evict: () => {
      if (child === null) return
      warming = null
      child.postMessage({ type: 'evict', id: nextId++ } satisfies AsrWorkerRequest)
    },
    dispose: () => {
      abortPending('the transcription process was stopped')
      child?.kill()
      child = null
      warming = null
      listeners.clear()
    }
  }
}
