import { useCallback, useEffect, useRef, useState } from 'react'
import { browserCaptureDeps, CaptureFailure, startCapture, type Capture } from './micCapture'
import { useDictationSink } from './useDictationSink'
import { e2eStartCapture } from './e2eDictationSeam'
import type { QueueState } from './transcriptionQueue'
import {
  createSegmenter,
  DEFAULT_SEGMENTER_CONFIG,
  type SegmenterConfig,
  type SegmenterEvent
} from './segmenter'
import type { DictationPhase } from './phase'
import type { WhisperPhase } from '../secondBrain/whisper/useWhisper'

/**
 * Dictation as a hook: microphone in, text at the caret, in place (VP-R1).
 *
 * The field it dictates into is behind `DictationTarget`, and that indirection
 * is the whole of VP-R5.1 — the hook never imports from `chat/`, so wiring
 * "Perguntar à base", a commit message or a search box later is a wiring job
 * rather than a refactor. It also never imports from `src/main`; everything it
 * needs already crosses the bridge.
 */

/** The field being dictated into. Chat supplies one; any field can. */
export interface DictationTarget {
  /** Current value + selection of the field. */
  read(): { value: string; selectionStart: number; selectionEnd: number }
  /** Applies a join result; the field owns focus and caret restoration. */
  write(next: { value: string; caret: number; range: [number, number] }): void
}

/** The transcription engine, injected so the hook is testable without Whisper. */
export interface DictationEngine {
  /** The engine's own phase — real download/load progress (VP-R3.2). */
  phase: WhisperPhase
  /**
   * Transcribes 16 kHz mono PCM. Downloads and warms first if it must.
   * `onPartial` reports the running text as the engine decodes it.
   */
  transcribe: (pcm: Float32Array, options?: { onPartial?: (text: string) => void }) => Promise<string>
  /** Builds the session ahead of time. Idempotent, and shared app-wide. */
  warm: () => Promise<void>
}

export interface DictationDeps {
  startCapture: typeof startCapture
  createSegmenter: typeof createSegmenter
  config: SegmenterConfig
}

export function browserDictationDeps(): DictationDeps {
  // Under the E2E harness the microphone is a stand-in the test drives: real
  // audio cannot flow headless (see `e2eDictationSeam.ts`). Everything above
  // capture — segmenter, queue, join, transport — stays production code.
  const scripted = e2eStartCapture()
  return {
    startCapture: scripted ?? ((deps = browserCaptureDeps(), rate) => startCapture(deps, rate)),
    createSegmenter,
    config: DEFAULT_SEGMENTER_CONFIG
  }
}

export interface Dictation {
  phase: DictationPhase
  /** Live 0–1 levels for the meter. Empty when not capturing. */
  levels: number[]
  /**
   * The words of the phrase being transcribed right now, as they arrive.
   *
   * The transport shows them; the field never does (see `QueueState.partial`).
   * This is what closes the gap between finishing a phrase and seeing it: the
   * first piece lands about a second and a half into a segment, where the whole
   * segment takes several.
   */
  partial: string
  /** True while dictation owns the composer — drives the accent ring. */
  active: boolean
  /** Opens the microphone. Never waits on the engine (VP-R3.1, D-VP-5). */
  start: () => void
  /** Stops capture, flushes the trailing phrase, drains the queue (VP-R1.4). */
  finish: () => void
  /** Drops everything and rewinds the field (VP-R1.5, D-VP-9). */
  discard: () => void
  /**
   * The last unresolved segment failure. Carried alongside `phase` rather than
   * inside it: a failure mid-take must be visible *while capture continues*
   * (VP-R4.4), which a single phase value cannot express. Once the take is over
   * and the failure is still unresolved, it becomes the resting `error` phase.
   */
  failure: string | null
  /** Re-runs the failed segments, reusing their buffered audio (VP-R4.4). */
  retry: () => void
  /** Starts engine readiness in the background, on intent only (D-VP-6). */
  prewarm: () => void
}

/** How often the transport's clock and silence countdown are refreshed. */
const CLOCK_INTERVAL_MS = 250

/** Is the engine doing setup work rather than transcribing? */
function isPreparing(phase: WhisperPhase): boolean {
  return phase.status === 'downloading' || phase.status === 'loading' || phase.status === 'warming'
}

export function useDictation(
  target: DictationTarget,
  engine: DictationEngine,
  deps: DictationDeps = browserDictationDeps()
): Dictation {
  const [phase, setPhase] = useState<DictationPhase>({ status: 'idle' })
  const [levels, setLevels] = useState<number[]>([])

  const captureRef = useRef<Capture | null>(null)
  const segmenterRef = useRef<ReturnType<typeof createSegmenter> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  /**
   * The field exactly as it was before dictation started — value *and* caret.
   * D-VP-9: a bad take must never become manual cleanup.
   */
  const snapshotRef = useRef<{ value: string; selectionStart: number } | null>(null)
  /**
   * Generation counter. Every async continuation checks it before touching
   * state, so a take that was discarded while `getUserMedia` or `addModule` was
   * still resolving cannot come back to life and re-open the microphone.
   */
  const takeRef = useRef(0)
  /** True between the mic press and the capture actually opening. */
  const startingRef = useRef(false)
  /**
   * The engine's phase, mirrored into a ref rather than read from a closure.
   *
   * This is load-bearing: `capture.onTick` is registered once, so a
   * `publishPhase` that closed over `engine.phase` would freeze at whatever the
   * phase was when capture opened — and the phase that matters most, the 51 s
   * warm-up, always arrives *after* that. The clock interval re-publishes every
   * 250 ms, so the ref is read fresh.
   */
  const enginePhaseRef = useRef(engine.phase)
  useEffect(() => {
    enginePhaseRef.current = engine.phase
  }, [engine.phase])

  /**
   * How a stopped take ends (VP-R1.4): it shows the drain while work remains,
   * then settles into `idle` — or into `error` if a segment failed and was never
   * retried, so the failure and its retry survive the end of the take instead of
   * vanishing with it. Driven from the queue's own change callback rather than an
   * effect, because that is a subscription to an external system.
   */
  const settle = useCallback((state: QueueState) => {
    setPhase((current) => {
      if (current.status !== 'finalizing') return current
      if (state.pending > 0) return { status: 'finalizing', pending: state.pending }
      return state.failure !== null
        ? { status: 'error', kind: 'engine', message: state.failure }
        : { status: 'idle' }
    })
  }, [])

  /** The text half: the queue and the writing (VP-R2.3–2.5, VP-R3, VP-R4.4). */
  const sink = useDictationSink(engine, target, settle)

  /** Everything the hook owns that has to stop. Safe to call repeatedly. */
  const release = useCallback(() => {
    startingRef.current = false
    if (clockRef.current !== null) {
      clearInterval(clockRef.current)
      clockRef.current = null
    }
    captureRef.current?.stop()
    captureRef.current = null
    segmenterRef.current = null
    setLevels([])
  }, [])

  // A composer unmounted mid-take — a workspace or conversation change, a route
  // away — must not leave the OS microphone indicator lit (VP-R4.6).
  useEffect(() => {
    return () => {
      takeRef.current += 1
      release()
    }
  }, [release])

  const publishPhase = useCallback(() => {
    const segmenter = segmenterRef.current
    if (segmenter === null) return
    const silentMs = segmenter.silentMs()
    const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
    // Read live, not from React state: this runs inside a capture callback,
    // before the render that would have refreshed a state value.
    const pending = sink.count()
    const enginePhase = enginePhaseRef.current

    setPhase(
      isPreparing(enginePhase)
        ? { status: 'preparing', seconds, silentMs, pending, engine: enginePhase }
        : { status: 'listening', seconds, silentMs, pending }
    )
  }, [sink])

  const finish = useCallback(() => {
    const segmenter = segmenterRef.current
    // Concluir must not drop the phrase still being spoken (VP-R1.4).
    if (segmenter !== null) {
      for (const event of segmenter.flush()) {
        if (event.type === 'segment') sink.enqueue(event.index, event.pcm)
      }
    }
    release()

    // A take with nothing left to wait for ends here: no further queue change is
    // coming, so `settle` would never be called and the drain would hang on
    // screen forever.
    const pending = sink.count()
    if (pending === 0 && !sink.busy()) {
      setPhase(
        sink.failure !== null
          ? { status: 'error', kind: 'engine', message: sink.failure }
          : { status: 'idle' }
      )
      return
    }
    setPhase({ status: 'finalizing', pending })
  }, [release, sink])

  const discard = useCallback(() => {
    takeRef.current += 1
    // Every queued and in-flight segment goes, so a result that resolves after
    // the rewind cannot write into the composer (VP-R1.5).
    sink.clear()
    release()

    // The exact pre-dictation value AND caret. An empty range means no landing
    // mark — nothing arrived.
    const snapshot = snapshotRef.current
    if (snapshot !== null) {
      target.write({
        value: snapshot.value,
        caret: snapshot.selectionStart,
        range: [snapshot.selectionStart, snapshot.selectionStart]
      })
    }
    snapshotRef.current = null
    setPhase({ status: 'idle' })
  }, [release, sink, target])

  const handleEvents = useCallback(
    (events: SegmenterEvent[]) => {
      for (const event of events) {
        if (event.type === 'segment') {
          // Handed off without interrupting capture — the user may keep talking
          // straight through it (VP-R2.1).
          sink.enqueue(event.index, event.pcm)
        } else if (event.type === 'autostop') {
          // VP-R4.2 — never leave a microphone open indefinitely. The countdown
          // that preceded this is the transport's, driven by `silentMs`.
          finish()
          return
        }
      }
      publishPhase()
    },
    [finish, publishPhase, sink]
  )

  const start = useCallback(() => {
    if (captureRef.current !== null || startingRef.current) return
    startingRef.current = true
    const take = (takeRef.current += 1)

    snapshotRef.current = (() => {
      const { value, selectionStart } = target.read()
      return { value, selectionStart }
    })()
    sink.clear()
    startedAtRef.current = Date.now()
    // Pressing the microphone is the clearest statement of intent there is, so
    // the session starts building **now** rather than when the first phrase is
    // ready for it. Hover already warmed for pointer users; this covers the
    // keyboard, the shortcut, and the gate's remembered intent after a
    // download — the paths where the first phrase used to wait for the whole
    // build with nothing on screen to explain why.
    sink.prewarm(false)
    // Capture is announced as live *before* the engine is consulted: pressing
    // the microphone never waits on a download or a 51 s session build
    // (D-VP-5, measured in the T1 spike).
    setPhase({ status: 'listening', seconds: 0, silentMs: 0, pending: 0 })

    void deps
      .startCapture()
      .then((capture) => {
        // Discarded (or unmounted) while getUserMedia was still resolving.
        if (takeRef.current !== take) {
          capture.stop()
          return
        }
        startingRef.current = false
        captureRef.current = capture
        const segmenter = deps.createSegmenter(deps.config)
        segmenterRef.current = segmenter

        capture.onTick((tick) => handleEvents(segmenter.push(tick)))
        capture.onLevels(setLevels)

        clockRef.current = setInterval(publishPhase, CLOCK_INTERVAL_MS)
      })
      .catch((error: unknown) => {
        if (takeRef.current !== take) return
        release()
        // The draft is untouched — the failure costs the user nothing but the
        // press (VP-R4.3).
        setPhase({
          status: 'error',
          kind: error instanceof CaptureFailure ? error.kind : 'denied'
        })
      })
  }, [deps, handleEvents, publishPhase, release, sink, target])

  const retry = useCallback(() => {
    sink.retry()
    // A failed take rests in the `error` phase; retrying puts it back to
    // draining, so the transport stops offering the same button twice.
    setPhase((current) =>
      current.status === 'error' && current.kind === 'engine'
        ? { status: 'finalizing', pending: sink.count() }
        : current
    )
  }, [sink])

  return {
    phase,
    levels,
    partial: sink.partial,
    active: phase.status !== 'idle',
    start,
    finish,
    discard,
    failure: sink.failure,
    retry,
    // No longer refused mid-take: warming is a session build the worker chains
    // behind whatever is running, not a fake transcription competing for the
    // pipeline slot the take needs.
    prewarm: useCallback(() => sink.prewarm(false), [sink])
  }
}
