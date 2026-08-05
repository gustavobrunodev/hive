import { useCallback, useEffect, useRef, useState } from 'react'
import { joinTranscript } from './transcriptJoin'
import {
  createTranscriptionQueue,
  type QueueState,
  type TranscriptionQueue
} from './transcriptionQueue'
import type { DictationEngine, DictationTarget } from './useDictation'

/**
 * The **text half** of dictation: segments in, words at the caret (VP-R2.2–2.5,
 * VP-R3.1–3.5, VP-R4.4).
 *
 * Split from `useDictation` along the same seam the task list itself drew — the
 * audio half owns the microphone and the phases, this owns the queue and the
 * writing. It exists as its own hook for a plain reason: together they were one
 * 200-line function, which is precisely the sprawl the project's lint ceiling
 * exists to catch.
 *
 * Everything here is one thin React wrapper over `transcriptionQueue.ts`, which
 * holds the actual ordering and failure rules and is tested without React.
 */

/**
 * A tenth of a second of silence: enough for the pipeline to download, build its
 * session and cache itself — which is the whole point of pre-warming — while
 * being obviously not a take.
 */
const PREWARM_PCM_SAMPLES = 1600

export interface DictationSink {
  /** Segments queued or in flight. A count, never guessed words (D-VP-8). */
  pending: number
  /** The last unresolved failure, visible while capture continues (VP-R4.4). */
  failure: string | null
  /** Hands a finished segment over. Does not interrupt capture (VP-R2.1). */
  enqueue: (index: number, pcm: Float32Array) => void
  /** Re-runs the failed segments with the audio they captured (VP-R4.4). */
  retry: () => void
  /** Drops everything, in-flight results included (VP-R1.5). */
  clear: () => void
  /** True while any work remains — the drain condition `finish` waits on. */
  busy: () => boolean
  /**
   * The queue's pending count *right now*.
   *
   * `pending` above is React state, so it only reflects a change after the next
   * render — and the transport's count is published from inside a capture
   * callback that runs before that render. Reading it live is what keeps the
   * count truthful instead of one tick behind.
   */
  count: () => number
  /** Warms the engine in the background, on intent only (D-VP-6). */
  prewarm: (blocked: boolean) => void
}

export function useDictationSink(
  engine: DictationEngine,
  target: DictationTarget,
  /**
   * Called on every queue state change. This is the seam the *phase* settles
   * through: it is a subscription to an external system, which is where React
   * wants a `setState` to live — deriving the same transition in an effect
   * instead means setting state during render-commit and cascading renders, and
   * the project's lint rules reject it outright.
   */
  onChange?: (state: QueueState) => void
): DictationSink {
  const [pending, setPending] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)

  const queueRef = useRef<TranscriptionQueue | null>(null)
  const prewarmedRef = useRef(false)

  /**
   * The engine and the target are mirrored into refs because the queue outlives
   * any one render: it is created once and keeps calling back for the whole
   * take, so closing over either would pin it to the render that built it.
   */
  const engineRef = useRef(engine)
  const targetRef = useRef(target)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    engineRef.current = engine
    targetRef.current = target
    onChangeRef.current = onChange
  }, [engine, onChange, target])

  const queue = useCallback((): TranscriptionQueue => {
    if (queueRef.current === null) {
      queueRef.current = createTranscriptionQueue({
        transcribe: (pcm) => engineRef.current.transcribe(pcm),
        insert: (text) => {
          const { value, selectionStart, selectionEnd } = targetRef.current.read()
          targetRef.current.write(joinTranscript(value, selectionStart, selectionEnd, text))
        },
        onChange: (state) => {
          setPending(state.pending)
          setFailure(state.failure)
          onChangeRef.current?.(state)
        }
      })
    }
    return queueRef.current
  }, [])

  return {
    pending,
    failure,
    enqueue: useCallback((index, pcm) => queue().enqueue(index, pcm), [queue]),
    retry: useCallback(() => queueRef.current?.retry(), []),
    clear: useCallback(() => {
      queueRef.current?.clear()
      setPending(0)
      setFailure(null)
    }, []),
    busy: useCallback(() => queueRef.current?.busy() ?? false, []),
    count: useCallback(() => queueRef.current?.state().pending ?? 0, []),
    prewarm: useCallback((blocked: boolean) => {
      // Never while a take is live: it would occupy the single serial pipeline
      // slot the take itself needs.
      if (prewarmedRef.current || blocked) return
      prewarmedRef.current = true
      void engineRef.current.transcribe(new Float32Array(PREWARM_PCM_SAMPLES)).catch(() => {
        // A failed pre-warm is not the user's problem — they have not asked for
        // anything yet. The real attempt will surface its own error.
        prewarmedRef.current = false
      })
    }, [])
  }
}
