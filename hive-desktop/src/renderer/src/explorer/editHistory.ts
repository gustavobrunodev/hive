/**
 * The editor's undo history, owned by the app instead of by the text field.
 *
 * ## Why this exists
 *
 * A `<textarea>` comes with undo for free, and for a single mounted field that
 * is the right answer — it is the platform's, it knows about IME and
 * autocorrect, and nothing here would beat it. But the browser's stack lives
 * on the *element*, and this editor's element does not survive the things a
 * user does to a document: toggling Visualizar unmounts the field and mounts a
 * rendering in its place, and a `.csv` swaps the field for a grid. Come back to
 * the text and the field is new, its history empty — Ctrl+Z does nothing, and
 * ten minutes of edits have no way back. That is the defect this replaces.
 *
 * So the history follows the *document*, not the widget: it lives beside the
 * draft, in the viewer, and both surfaces write into it. Reading and editing
 * the same artifact is one activity (see `FileViewer.selectMode`), and an undo
 * stack that survives switching between them is the other half of that promise.
 *
 * ## What counts as one undo
 *
 * Not one keystroke — nobody wants to press Ctrl+Z forty times to take back a
 * sentence. A run of typing coalesces into a single entry until something
 * breaks it: a pause, a change of direction (typing then deleting), a newline,
 * or an edit too big to have been typed (a paste). That is the rule every text
 * editor converged on, and it is what makes the first Ctrl+Z land where the
 * user expects.
 */

/** One point in the document's life: its text, and where the caret was. */
export interface EditSnapshot {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** A typing run stays one undo step for this long after the last keystroke. */
const COALESCE_MS = 500

/**
 * How far back the history goes.
 *
 * A cap, because this is per open file and a long session can otherwise keep
 * every intermediate state of a large document alive. Deep enough that hitting
 * it means "you have been editing for hours", not "you pasted twice".
 */
const MAX_ENTRIES = 400

/** What an edit did to the text — a change of direction breaks the coalescing run. */
type EditKind = 'insert' | 'delete' | 'replace'

function kindOf(before: string, after: string): EditKind {
  if (after.length > before.length) return 'insert'
  if (after.length < before.length) return 'delete'
  return 'replace'
}

/** A newline is a natural boundary: an undo should take back a line, not a paragraph. */
function crossedALine(before: string, after: string): boolean {
  return countNewlines(before) !== countNewlines(after)
}

function countNewlines(text: string): number {
  let count = 0
  for (let at = 0; at < text.length; at += 1) {
    if (text.charCodeAt(at) === 10) count += 1
  }
  return count
}

export class EditHistory {
  /** Every committed state, oldest first. `entries[0]` is the file as it was loaded. */
  private entries: EditSnapshot[]
  /** Where in `entries` the draft currently is — undo walks down, redo walks up. */
  private index = 0
  private lastAt = 0
  private lastKind: EditKind | null = null

  constructor(baseline: string) {
    this.entries = [{ value: baseline, selectionStart: 0, selectionEnd: 0 }]
  }

  /** Throws the history away and starts again from `baseline` (a reload from disk is a different document). */
  reset(baseline: string): void {
    this.entries = [{ value: baseline, selectionStart: 0, selectionEnd: 0 }]
    this.index = 0
    this.lastAt = 0
    this.lastKind = null
  }

  get canUndo(): boolean {
    return this.index > 0
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1
  }

  /** The state the draft is currently at, per this history. */
  get current(): EditSnapshot {
    return this.entries[this.index] as EditSnapshot
  }

  /**
   * Takes note of an edit.
   *
   * `now` is passed in rather than read from the clock so the coalescing rule
   * is testable without faking time — the caller (a change handler) always has
   * a timestamp to hand.
   */
  record(next: EditSnapshot, now: number = Date.now()): void {
    const previous = this.current
    if (next.value === previous.value) {
      // Same text, new caret: keep the caret (it is where an undo should
      // return you) but do not spend an undo step on a click.
      this.entries[this.index] = next
      return
    }
    const kind = kindOf(previous.value, next.value)
    const sizeDelta = Math.abs(next.value.length - previous.value.length)
    const lineBreak = crossedALine(previous.value, next.value)
    const separate =
      this.lastKind === null ||
      kind !== this.lastKind ||
      now - this.lastAt > COALESCE_MS ||
      sizeDelta > 1 ||
      lineBreak

    this.lastAt = now
    // A newline both ends the run it lands in and refuses to start a new one:
    // Enter is a boundary on *both* sides, so the line you just closed is one
    // undo away and the line you are starting is another.
    this.lastKind = lineBreak ? null : kind

    if (separate) {
      // Anything that was ahead of us is gone the moment a new edit lands —
      // the future you did not take is not a future any more.
      this.entries = this.entries.slice(0, this.index + 1)
      this.entries.push(next)
      if (this.entries.length > MAX_ENTRIES) this.entries.shift()
      this.index = this.entries.length - 1
      return
    }
    this.entries[this.index] = next
  }

  /** One step back, or `null` when there is nothing left to take back. */
  undo(): EditSnapshot | null {
    if (!this.canUndo) return null
    this.index -= 1
    // The next keystroke starts its own entry: continuing to coalesce into
    // the one we just walked back to would rewrite history instead of adding to it.
    this.lastKind = null
    return this.current
  }

  /** One step forward, or `null` when there is nothing to put back. */
  redo(): EditSnapshot | null {
    if (!this.canRedo) return null
    this.index += 1
    this.lastKind = null
    return this.current
  }
}
