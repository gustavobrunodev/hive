import { useCallback, useEffect, useRef, useState } from 'react'
import { engineErrorCopy } from '../asr/enginePhase'
import { createLivePass, type LivePass, type LivePassConfig } from './livePass'
import { applyPreview, previewText, type PreviewRun } from './previewRun'
import type { Draft } from './segmenter'
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

export interface DictationSink {
  /** Segments queued or in flight. A count, never guessed words (D-VP-8). */
  pending: number
  /**
   * The words of the segment being transcribed right now, as they decode.
   * Shown by the transport, never written into the field — see `QueueState`.
   */
  partial: string
  /** The last unresolved failure, visible while capture continues (VP-R4.4). */
  failure: string | null
  /** Hands a finished segment over. Does not interrupt capture (VP-R2.1). */
  enqueue: (index: number, pcm: Float32Array) => void
  /**
   * Offers the phrase still being spoken, so it can be transcribed live
   * (VP-R2.9). Called on every tick; the pacing rules are `livePass`'s.
   *
   * Only ever runs while the queue is idle. A real segment is the transcript
   * and a live pass is a guess about it — spending the one pipeline slot on the
   * guess would delay the words it is guessing at.
   */
  offerDraft: (draft: Draft | null) => void
  /**
   * `[start, end)` of the provisional run in the field, or `null`.
   *
   * The composer paints it differently: text that is going to be revised has to
   * look like it, or the user starts editing words that are about to be
   * replaced under their hands.
   */
  previewRange: readonly [number, number] | null
  /** Re-runs the failed segments with the audio they captured (VP-R4.4). */
  retry: () => void
  /** Drops everything, in-flight results included (VP-R1.5). */
  clear: () => void
  /**
   * True while any work remains — the drain condition `finish` waits on.
   *
   * The live pass is deliberately **not** counted. It answers to nothing: no
   * queue change follows it, so a take waiting on one would wait forever. And
   * it has nothing left to say by then — `finish` flushes the open phrase into
   * a real segment, which covers the same audio and writes the text that stays.
   */
  busy: () => boolean
  /**
   * Drops the live pass in flight, keeping the provisional text it produced.
   *
   * Called when the take ends: the guess stays on screen until the segment's
   * own pass replaces it, which is a far better last frame than a field that
   * blanks and refills.
   */
  stopLive: () => void
  /**
   * The queue's pending count *right now*.
   *
   * `pending` above is React state, so it only reflects a change after the next
   * render — and the transport's count is published from inside a capture
   * callback that runs before that render. Reading it live is what keeps the
   * count truthful instead of one tick behind.
   */
  count: () => number
  /**
   * The queue's unresolved failure *right now*.
   *
   * Live for the same reason `count` is, and the reason is not symmetry. The
   * autostop reaches `finish` through the capture callback registered when the
   * microphone opened, so every value that closure read from React state is
   * frozen at that moment — and `failure` is always `null` then, because
   * nothing has been transcribed yet. A take that ended by itself after a
   * failure therefore reported no failure at all: silence where an error and
   * its retry belonged, while pressing Concluir on the identical take reported
   * it properly. Measured against a packaged build on 2026-09-02.
   */
  failureNow: () => string | null
  /**
   * Warms the engine in the background, on intent (D-VP-6).
   *
   * `blocked` used to mean "a take is live, don't take the pipeline slot",
   * because warming meant pushing fake audio through `transcribe`. It no longer
   * does: the engine has a real `warm` that builds the session and returns, the
   * worker chains it behind whatever is running, and a warm that is already
   * done is free. So it stays as a *policy* flag — the model gate passes `true`
   * while no model is installed, where warming would mean starting a download
   * nobody agreed to.
   */
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
  onChange?: (state: QueueState) => void,
  /** How the live pass is paced (VP-R2.9). Threaded through from `DictationDeps`. */
  livePassConfig?: LivePassConfig
): DictationSink {
  const [pending, setPending] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const [partial, setPartial] = useState('')
  const [previewRange, setPreviewRange] = useState<readonly [number, number] | null>(null)

  const queueRef = useRef<TranscriptionQueue | null>(null)
  const liveRef = useRef<LivePass | null>(null)
  /** Where the provisional text currently sits in the field. */
  const runRef = useRef<PreviewRun | null>(null)
  /** The engine's running text for the segment already cut and in flight. */
  const settledRef = useRef('')
  /** The live pass's text for the phrase still being spoken. */
  const openRef = useRef('')

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

  /**
   * Puts the provisional text into the field, or takes the final text's place.
   *
   * One function for both because they are the same edit: whatever is
   * provisional right now comes out, and `text` goes in where it was. The only
   * difference is whether a run is left behind for the next guess to replace —
   * which is exactly what `commit` decides.
   */
  const writeInto = useCallback((text: string, commit: boolean): void => {
    const applied = applyPreview(targetRef.current.read(), runRef.current, text, commit)
    runRef.current = applied.run
    setPreviewRange(applied.run?.range ?? null)
    targetRef.current.write({ ...applied.write, preview: !commit })
  }, [])

  /** Re-renders the provisional run from its two sources (see `previewText`). */
  const renderPreview = useCallback((): void => {
    writeInto(previewText(settledRef.current, openRef.current), false)
  }, [writeInto])

  const queue = useCallback((): TranscriptionQueue => {
    if (queueRef.current === null) {
      queueRef.current = createTranscriptionQueue({
        transcribe: (pcm, onPartial) =>
          engineRef.current.transcribe(pcm, { onPartial }).catch((error: unknown) => {
            // The queue stores a failure as a *sentence the user reads*, so the
            // translation happens here rather than in the transport.
            //
            // The case this used to special-case was the WASM heap running out,
            // where "tente de novo" was actively bad advice because retrying
            // could not work until something else changed. Native ONNX Runtime
            // gives the memory back, so retrying is honest advice again and the
            // remaining translation is the ordinary one.
            throw new Error(engineErrorCopy(error instanceof Error ? error.message : String(error)))
          }),
        insert: (text) => {
          // The guess this segment's audio produced is done being a guess.
          // Cleared *before* the commit, so the write that lands the real text
          // is not also re-rendering the partial it replaces.
          settledRef.current = ''
          writeInto(text, true)
        },
        onChange: (state) => {
          setPending(state.pending)
          setFailure(state.failure)
          setPartial(state.partial)
          if (state.partial !== settledRef.current) {
            settledRef.current = state.partial
            renderPreview()
          }
          onChangeRef.current?.(state)
        }
      })
    }
    return queueRef.current
  }, [renderPreview, writeInto])

  /** Mirrored like the engine: the live pass outlives the render that built it. */
  const livePassConfigRef = useRef(livePassConfig)
  useEffect(() => {
    livePassConfigRef.current = livePassConfig
  }, [livePassConfig])

  const live = useCallback((): LivePass => {
    if (liveRef.current === null) {
      liveRef.current = createLivePass({
        transcribe: (pcm, onPartial) => engineRef.current.transcribe(pcm, { onPartial }),
        onText: (text) => {
          if (text === openRef.current) return
          openRef.current = text
          renderPreview()
        },
        config: livePassConfigRef.current
      })
    }
    return liveRef.current
  }, [renderPreview])

  return {
    pending,
    failure,
    partial,
    previewRange,
    enqueue: useCallback((index, pcm) => queue().enqueue(index, pcm), [queue]),
    offerDraft: useCallback(
      (draft) => {
        // The queue owns the pipeline while it has work: a live pass queued
        // behind a real segment delays the very words it is previewing.
        if (queueRef.current?.busy() === true) return
        live().offer(draft)
      },
      [live]
    ),
    retry: useCallback(() => queueRef.current?.retry(), []),
    clear: useCallback(() => {
      queueRef.current?.clear()
      liveRef.current?.reset()
      // Not `writeInto('')` — a discard rewinds the whole field from its own
      // snapshot, and a take that is starting has nothing to take back.
      runRef.current = null
      settledRef.current = ''
      openRef.current = ''
      setPreviewRange(null)
      setPending(0)
      setFailure(null)
      setPartial('')
    }, []),
    busy: useCallback(() => queueRef.current?.busy() ?? false, []),
    stopLive: useCallback(() => liveRef.current?.reset(), []),
    count: useCallback(() => queueRef.current?.state().pending ?? 0, []),
    failureNow: useCallback(() => queueRef.current?.state().failure ?? null, []),
    prewarm: useCallback((blocked: boolean) => {
      if (blocked) return
      // Idempotence lives in the engine, which is process-wide: warming from
      // here, from another surface, or from a take already under way are all
      // the same one build.
      void engineRef.current.warm().catch(() => {
        // A failed pre-warm is not the user's problem — they have not asked for
        // anything yet. The real attempt will surface its own error.
      })
    }, [])
  }
}
