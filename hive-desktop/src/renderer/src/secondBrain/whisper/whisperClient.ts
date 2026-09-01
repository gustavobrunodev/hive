import type { WhisperModelId, WhisperVariant } from './whisperIds'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisperWorkerProtocol'
import { isMemoryFailure, transferOf } from './whisperWorkerProtocol'

/**
 * The app's **one** transcription engine — a module singleton in front of the
 * worker, not a hook.
 *
 * Being a singleton is half the fix. `useWhisper` used to hold the warm
 * pipeline in a `useRef`, which meant every surface that could dictate — the
 * chat composer, the ingestion sheet, "Perguntar à base" — owned a *separate*
 * one and paid the session build again on first use, and a surface that
 * unmounted took its warm pipeline with it. Worse, the pre-warm and the first
 * real phrase were two independent calls into that same cold ref, so hovering
 * the microphone and then speaking started **two** concurrent builds competing
 * for one core. Here the pipeline is process-wide, in-flight work is shared,
 * and warming from any surface warms the app.
 *
 * The other half is the thread. See `whisperWorkerProtocol.ts` for the
 * measurement that put it there.
 *
 * Downloads deliberately stay on this side: the worker has no `window.hive`,
 * and the download belongs to main anyway (M26). So the order is always
 * *resolve device → resolve variant → make sure the bytes are on disk → ask the
 * worker*.
 */

/** What the UI needs to render an honest caption. Mirrors `useWhisper`'s. */
export type WhisperPhase =
  | { status: 'idle' }
  | { status: 'downloading'; pct: number; file: string }
  | { status: 'loading'; pct: number }
  | { status: 'warming' }
  | { status: 'transcribing' }
  | { status: 'error'; message: string }

export interface TranscribeOptions {
  model?: WhisperModelId
  language?: string
  /**
   * Text decoded **so far**, as Whisper decodes it.
   *
   * The reason this exists at all: a finished segment is only reported when it
   * is finished, and a phrase spoken at normal speed takes seconds to decode.
   * Forwarding the partial turns that gap from dead air into visible progress —
   * the first piece arrives ~1.8 s into a run, measured in the real app.
   */
  onPartial?: (text: string) => void
}

/**
 * The engine ran out of memory.
 *
 * Its own type because the two surfaces that transcribe both have to say
 * something different about it than about a bad file: retrying changes nothing
 * until something *else* changes (a smaller model), and the raw
 * "std::bad_alloc" is not a sentence anyone can act on.
 */
export class WhisperMemoryError extends Error {
  constructor(readonly detail: string) {
    super(detail)
    this.name = 'WhisperMemoryError'
  }
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
 * **Weights already on the machine win — if this device can run them.** fp32
 * runs on WebGPU perfectly well, so a WebGPU machine uses the copy that is
 * already here rather than downloading a ~4x smaller q8 to save nothing anyone
 * asked to save.
 *
 * The reverse is **not** symmetric, and that asymmetry is the whole rule: the
 * quantized decoder cannot create a session on onnxruntime-web's WASM backend
 * at all ("MatMulNBits … Missing required scale", T2 spike). So a q8 copy left
 * over from a WebGPU run is unusable on CPU and must be re-fetched as fp32
 * rather than "reused" into a failure.
 */
export function chooseVariant(webgpu: boolean, present: LocalModel): WhisperVariant {
  const usable =
    present.downloaded && (webgpu ? present.variant !== null : present.variant === 'fp32')
  if (usable && present.variant !== null) return present.variant
  return webgpu ? 'q8' : 'fp32'
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

/** The seams a test replaces. Everything else here is the real logic. */
export interface WhisperClientDeps {
  /** Spawns the worker. Injected — `new Worker` is not a thing jsdom has. */
  spawn: () => Worker
  hasWebGpu: () => Promise<boolean>
  baseHref: () => string
}

export function browserClientDeps(): WhisperClientDeps {
  return {
    spawn: () =>
      // The bundler turns this into a same-origin module chunk. It must stay a
      // literal `new URL(..., import.meta.url)` — that exact shape is what
      // Vite recognizes; a computed path silently ships nothing.
      new Worker(new URL('./whisper.worker.ts', import.meta.url), {
        type: 'module',
        name: 'hive-whisper'
      }),
    hasWebGpu: probeWebGpu,
    baseHref: () => document.baseURI
  }
}

export interface WhisperClient {
  phase: () => WhisperPhase
  /** Subscribes to phase changes. Returns the unsubscribe. */
  subscribe: (listener: (phase: WhisperPhase) => void) => () => void
  /**
   * Builds the pipeline ahead of time. Idempotent and shared: a second call
   * while the first is still building waits on it instead of starting another.
   */
  warm: (model?: WhisperModelId) => Promise<void>
  transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Promise<string>
  /** Back to `idle` after an error the user has seen. */
  reset: () => void
  /** Tears the worker down. Tests only — the app keeps one for its lifetime. */
  dispose: () => void
}

/** One in-flight request, waiting for the worker to answer. */
interface Pending {
  resolve: (text: string) => void
  reject: (error: Error) => void
  onPartial?: (text: string) => void
  /** Pieces seen so far, so `onPartial` can report the running text. */
  text: string
}

export function createWhisperClient(deps: WhisperClientDeps = browserClientDeps()): WhisperClient {
  let worker: Worker | null = null
  /**
   * The warm in flight, if any, keyed by model.
   *
   * Sharing it is the point: pre-warm on hover, then a real phrase a second
   * later, must be one build. Cleared when it settles so a failed warm can be
   * retried by the next real request rather than poisoning the engine — and
   * cleared by `recycle` too, since a build recorded here belongs to a worker
   * that no longer exists.
   */
  let warming: { model: WhisperModelId; done: Promise<void> } | null = null
  let nextId = 1
  let phase: WhisperPhase = { status: 'idle' }
  const listeners = new Set<(phase: WhisperPhase) => void>()
  const pending = new Map<number, Pending>()

  const setPhase = (next: WhisperPhase): void => {
    phase = next
    for (const listener of listeners) listener(next)
  }

  /**
   * Throws the worker away, failing whatever was still waiting on it.
   *
   * `warming` is cleared with it: the pipeline it recorded lived in the thread
   * that just died, and leaving the record behind would make the next
   * transcription skip the build it now needs.
   */
  const recycle = (reason: Error): void => {
    const dying = worker
    worker = null
    warming = null
    for (const [id, waiting] of pending) {
      pending.delete(id)
      waiting.reject(reason)
    }
    dying?.terminate()
  }

  const ensureWorker = (): Worker => {
    if (worker !== null) return worker
    const spawned = deps.spawn()
    spawned.onmessage = (event: MessageEvent<WhisperWorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') return
      if (message.type === 'phase') {
        // A phase from a request nobody is waiting on any more is stale — a
        // discarded take must not keep the caption spinning.
        if (message.phase.status === 'idle' && pending.size > 0) return
        setPhase(message.phase)
        return
      }
      const waiting = pending.get(message.id)
      if (waiting === undefined) return
      if (message.type === 'partial') {
        waiting.text += message.text
        waiting.onPartial?.(waiting.text)
        return
      }
      pending.delete(message.id)
      if (message.type === 'done') {
        waiting.resolve(message.text)
        return
      }
      setPhase({ status: 'error', message: message.message })
      if (message.kind === 'memory') {
        // The heap is gone and it does not come back: WebAssembly memory grows
        // and never shrinks, so the next request in this worker fails exactly
        // as this one did. Replacing the thread is the only thing that frees
        // it — the next call spawns a fresh one and pays a session build,
        // which is a far better outcome than a take that can no longer
        // transcribe anything.
        recycle(new WhisperMemoryError(message.message))
        waiting.reject(new WhisperMemoryError(message.message))
        return
      }
      waiting.reject(new Error(message.message))
    }
    spawned.onerror = (event: ErrorEvent) => {
      const message = event.message || 'worker failed'
      setPhase({ status: 'error', message })
      for (const [id, waiting] of pending) {
        pending.delete(id)
        waiting.reject(new Error(message))
      }
    }
    worker = spawned
    return spawned
  }

  const send = (
    request: WhisperWorkerRequest,
    onPartial?: (text: string) => void
  ): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      pending.set(request.id, { resolve, reject, onPartial, text: '' })
      try {
        ensureWorker().postMessage(request, transferOf(request))
      } catch (error) {
        // A `postMessage` that throws leaves nobody to answer this id, so the
        // entry has to go with it — otherwise the map grows an orphan per
        // failure and `pending.size` (which gates the idle phase) never
        // returns to zero.
        pending.delete(request.id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })

  /**
   * Makes sure the weights are on disk before the worker is asked for a
   * pipeline.
   *
   * **It watches a download; it does not own one** (M26). The transfer belongs
   * to main and keeps running whether or not the surface that started it is
   * still on screen, so what happens here is a subscription plus a start.
   *
   * In practice this rarely runs: every recording surface passes through the
   * model gate first. It still matters for the one case the gate cannot cover —
   * a model on disk in the *other* precision, which this device cannot load.
   */
  const ensureDownloaded = async (
    model: WhisperModelId,
    variant: WhisperVariant
  ): Promise<void> => {
    const status = await window.hive.whisper.modelStatus(model)
    if (status.downloaded && status.variant === variant) return

    await new Promise<void>((resolve, reject) => {
      const off = window.hive.whisper.onDownloads((downloads) => {
        const current = downloads.find((download) => download.id === model)
        if (current === undefined || current.status !== 'downloading') return
        const pct = current.total > 0 ? Math.round((current.loaded / current.total) * 100) : 0
        setPhase({ status: 'downloading', pct, file: current.file })
      })
      const offSettled = window.hive.whisper.onDownloadSettled((settled) => {
        if (settled.id !== model) return
        off()
        offSettled()
        if (settled.status === 'done') resolve()
        else reject(new Error(settled.failure?.detail ?? settled.status))
      })
      void window.hive.whisper.startDownload(model, variant)
    })
  }

  /** device + variant + "the bytes are there" — everything the worker can't do. */
  const prepare = async (
    model: WhisperModelId
  ): Promise<{ variant: WhisperVariant; device: string }> => {
    const webgpu = await deps.hasWebGpu()
    const present = await window.hive.whisper.modelStatus(model)
    const variant = chooseVariant(webgpu, present)
    await ensureDownloaded(model, variant)
    return { variant, device: webgpu ? 'webgpu' : 'wasm' }
  }

  const warm = (model: WhisperModelId = DEFAULT_MODEL): Promise<void> => {
    if (warming !== null && warming.model === model) return warming.done
    const done = (async () => {
      const { variant, device } = await prepare(model)
      await send({ type: 'warm', id: nextId++, model, variant, device, baseHref: deps.baseHref() })
    })()
      .catch(() => {
        // A failed pre-warm is not the user's problem — they have not asked for
        // anything yet, and the real attempt will surface its own error.
        warming = null
      })
      .then(() => undefined)
    warming = { model, done }
    return done
  }

  const transcribe = async (
    pcm: Float32Array,
    options: TranscribeOptions = {}
  ): Promise<string> => {
    const model = options.model ?? DEFAULT_MODEL
    try {
      // A build already in flight is awaited rather than raced: the worker
      // would serialize them anyway, and waiting here keeps the phase honest.
      if (warming !== null && warming.model === model) await warming.done
      const { variant, device } = await prepare(model)
      const text = await send(
        {
          type: 'transcribe',
          id: nextId++,
          model,
          variant,
          device,
          language: options.language ?? DEFAULT_LANGUAGE,
          baseHref: deps.baseHref(),
          // A copy, because the trip **detaches** what it carries (see
          // `transferOf`). Callers keep their audio for a reason — the queue
          // retries failed segments with it, the live pass re-sends a growing
          // buffer — and handing the original over turned the first failure of
          // a take into "An ArrayBuffer is detached" for every attempt after
          // it. 960 kB per 15 s segment: the copy is cheaper than the defect by
          // any measure that matters.
          pcm: pcm.slice()
        },
        options.onPartial
      )
      // A successful transcription proves the pipeline is warm, so a later
      // pre-warm for the same model is a no-op instead of a second build.
      warming = { model, done: Promise.resolve() }
      return text
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPhase({ status: 'error', message })
      // A failure that never reached the worker's own handler — the library
      // throwing on import, `onerror` firing — can still be the heap. Same
      // rule, same recovery, so the caller sees one type either way.
      if (!(error instanceof WhisperMemoryError) && isMemoryFailure(message)) {
        const failure = new WhisperMemoryError(message)
        recycle(failure)
        throw failure
      }
      throw error
    }
  }

  return {
    phase: () => phase,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    warm,
    transcribe,
    reset: () => setPhase({ status: 'idle' }),
    dispose: () => {
      worker?.terminate()
      worker = null
      warming = null
      pending.clear()
    }
  }
}

/**
 * The app's engine. Created on first use so a renderer that never dictates
 * never spawns a thread, and shared by every surface that does.
 */
let shared: WhisperClient | null = null
export function whisperClient(): WhisperClient {
  if (shared === null) shared = createWhisperClient()
  return shared
}

/** Tests only: drops the shared instance so the next one is fresh. */
export function resetWhisperClient(): void {
  shared?.dispose()
  shared = null
}
