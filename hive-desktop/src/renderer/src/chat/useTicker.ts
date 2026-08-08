import { useEffect, useState } from 'react'

/**
 * A clock the transcript can read while something is running.
 *
 * Every live duration on screen — the turn's elapsed, each running step's —
 * derives from one `Date.now()`, so they can never disagree by a frame, and
 * one interval drives them all rather than one per row.
 *
 * ## Why half a second
 *
 * The readouts show whole seconds above a second (`formatDuration`), so a
 * faster tick would re-render the transcript for a number that didn't change.
 * Half a second keeps the visible second from ever lagging by more than half
 * of one, which is below what anyone can catch — and it is the same cadence
 * Claude Code's own elapsed counter runs at.
 *
 * The interval exists only while `active`; a settled transcript re-renders
 * exactly never.
 *
 * ## The first half-second of a turn
 *
 * The stored timestamp survives between live stretches, so the frame that
 * turns the clock back on still holds the reading from the last one until the
 * first tick. That reading is *older* than the new turn's start, and every
 * consumer clamps elapsed time at zero — so the worst it can produce is a
 * turn showing `0s` for up to half a second after it started, which is what
 * a stopwatch shows then anyway. Correcting it would mean reading the clock
 * during render, which is exactly the impurity that makes a render's output
 * depend on when it happened to run.
 */
const TICK_MS = 500

export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [active])

  return now
}
