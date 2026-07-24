import { useEffect, useState } from 'react'
import { computeGutter, type GutterMark } from './gutter'

/** Debounce (ms) for recomputing the gutter as the draft changes — off the keystroke path (GIT-R11.2). */
const GUTTER_DEBOUNCE_MS = 120

/**
 * Computes the editor gutter marks for a tracked file (git-management §6.4).
 * Fetches the HEAD baseline once per file via `git.fileAtHead`, then diffs it
 * against the live `draft` (debounced) so typing updates the gutter without
 * shelling out to git. Disabled (empty marks) outside a repo or for
 * non-editable views. A brand-new file (empty baseline) reads as all-added.
 */
export function useGutter(
  workspace: string,
  path: string,
  draft: string,
  enabled: boolean
): GutterMark[] {
  const [baseline, setBaseline] = useState<string | null>(null)
  const [marks, setMarks] = useState<GutterMark[]>([])

  // Fetch the HEAD baseline when the file (or enablement) changes.
  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      queueMicrotask(() => {
        if (!cancelled) setBaseline(null)
      })
      return () => {
        cancelled = true
      }
    }
    window.hive.git
      .fileAtHead(workspace, path)
      .then((content) => {
        if (!cancelled) setBaseline(content)
      })
      .catch(() => {
        if (!cancelled) setBaseline('')
      })
    return () => {
      cancelled = true
    }
  }, [workspace, path, enabled])

  // Recompute marks (debounced) whenever the baseline or draft changes. The
  // write lives in a timer callback, never synchronously in the effect body.
  useEffect(() => {
    if (baseline === null) {
      const id = setTimeout(() => setMarks([]), 0)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setMarks(computeGutter(baseline, draft)), GUTTER_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [baseline, draft])

  return marks
}
