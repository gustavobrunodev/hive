import { useCallback, useEffect, useRef, useState } from 'react'
import type { SkillBatch, SkillPhase, StudioSkillRequest } from './skillRun'
import type { StudioOperationError } from './screens'

/**
 * Design Studio (M18) — T6.2. One Skill run, from the click to the Commands.
 *
 * DS-R2's rule is that **no async wait is uncovered**, so `phase` is non-null
 * for exactly as long as a turn is in flight, and it is set to `'reading'`
 * synchronously on `start` rather than on the first event: an agent that takes
 * two seconds to say anything must not leave the stage looking idle.
 *
 * The failure is kept as a value, never thrown: `retryable: true` becomes a
 * button that calls `retry()`, which **re-runs the same request** (DS-R17 —
 * a retryable failure the user cannot actually retry is a nicer-sounding dead
 * end).
 */

export interface SkillRunState {
  /** Non-null exactly while a turn is running — the stage's "am I waiting?". */
  phase: SkillPhase | null
  /**
   * Which kind of run the state belongs to. The stage covers a generation and
   * the chat covers an iteration — without this, one turn would be announced
   * twice, in two live regions, which is noise for everyone and a duplicate
   * announcement for a screen reader.
   */
  kind: StudioSkillRequest['kind'] | null
  running: boolean
  error: StudioOperationError | null
  start: (request: StudioSkillRequest) => void
  /** Re-invokes the last request. A no-op before anything has run. */
  retry: () => void
  dismissError: () => void
}

export function useSkillRun(onBatch: (batch: SkillBatch) => void): SkillRunState {
  const [phase, setPhase] = useState<SkillPhase | null>(null)
  const [kind, setKind] = useState<StudioSkillRequest['kind'] | null>(null)
  const [error, setError] = useState<StudioOperationError | null>(null)
  const lastRequest = useRef<StudioSkillRequest | null>(null)
  const stop = useRef<(() => void) | null>(null)
  // The callback is read through a ref so `start` keeps a stable identity: it
  // is handed to buttons and effects, and a new function every render would
  // restart runs that are already in flight.
  const handler = useRef(onBatch)
  useEffect(() => {
    handler.current = onBatch
  }, [onBatch])

  const settle = useCallback(() => {
    setPhase(null)
    stop.current?.()
    stop.current = null
  }, [])

  const start = useCallback(
    (request: StudioSkillRequest) => {
      stop.current?.()
      lastRequest.current = request
      setError(null)
      setKind(request.kind)
      setPhase('reading')
      stop.current = window.hive.designStudio.runSkill(request, (event) => {
        if (event.type === 'status') setPhase(event.phase)
        if (event.type === 'failed') {
          setError(event.error)
          settle()
        }
        if (event.type === 'result') {
          settle()
          handler.current(event.batch)
        }
      })
    },
    [settle]
  )

  // A tab that goes away stops the run it started; otherwise main keeps
  // forwarding a turn into a listener nobody is reading.
  useEffect(() => () => stop.current?.(), [])

  return {
    phase,
    kind,
    running: phase !== null,
    error,
    start,
    retry: () => {
      if (lastRequest.current !== null) start(lastRequest.current)
    },
    dismissError: () => setError(null)
  }
}
