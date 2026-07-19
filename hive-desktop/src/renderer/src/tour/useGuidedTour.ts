import { useCallback, useEffect, useState } from 'react'

/** localStorage key marking the guided tour as seen (set on skip AND finish). */
const TOUR_SEEN_KEY = 'hive.tourSeen'

/** Whether this is the user's first time on the work UI (tour not yet seen). Storage failures (private mode) read as "seen" — never trap the user in an overlay because storage is flaky. */
function tourNotSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === null
  } catch {
    return false
  }
}

/** Write failures (quota, private mode) are swallowed — worst case the tour re-offers itself next launch. */
function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}

/**
 * First-access gating for the guided tour: opens once, a beat after the
 * caller reports the screen is `ready` (anchors on screen), and persists
 * "seen" on close — skip and finish alike. `replay` reopens it on demand
 * (profile sheet), seen flag or not. Kept apart from `GuidedTour.tsx` so
 * that file only exports a component (react-refresh/only-export-components).
 */
export function useGuidedTour(ready: boolean): {
  open: boolean
  close: () => void
  replay: () => void
} {
  const [pending, setPending] = useState(tourNotSeen)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!pending || !ready) return
    const timer = window.setTimeout(() => {
      setPending(false)
      setOpen(true)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [pending, ready])

  const close = useCallback(() => {
    setOpen(false)
    markTourSeen()
  }, [])

  const replay = useCallback(() => setOpen(true), [])

  return { open, close, replay }
}
