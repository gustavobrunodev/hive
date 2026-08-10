/**
 * Design Studio (M18) — T5.7. The history keystrokes, as a pure reading of an
 * event (DS-R9).
 *
 * A function rather than an inline `if` inside the listener so the rule can be
 * asserted on its own: `Ctrl/Cmd+Z` undoes, the same with `Shift` redoes, and
 * everything else — `Alt+Z`, a bare `Z`, `Ctrl+Y` — is somebody else's
 * keystroke. *Where* it applies (only with focus inside the tab) is the
 * listener's job, not this function's; they are two separate rules and mixing
 * them into one condition is how one of them ends up untested.
 */

export type HistoryShortcut = 'undo' | 'redo' | null

/** The part of a `KeyboardEvent` the rule reads. */
export interface HistoryKey {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function historyShortcutFor(event: HistoryKey): HistoryShortcut {
  if (event.altKey) return null
  if (!event.ctrlKey && !event.metaKey) return null
  if (event.key.toLowerCase() !== 'z') return null
  return event.shiftKey ? 'redo' : 'undo'
}
