/**
 * The transcript split into "just arrived" and "already there" (SB-R5.6).
 *
 * Live dictation writes into a field the user is also editing by hand, and
 * without a mark those two are indistinguishable: text simply appears, and the
 * reader has to diff the paragraph against their memory of it to find what the
 * model added. The mark answers that in a glance and then gets out of the way.
 *
 * Pure, and ignorant of React: a value and a range in, three runs out. That is
 * what lets it be asserted exhaustively — including the boundary cases that
 * actually bite, like a range the model reported against a string the user has
 * since shortened.
 */

export interface TranscriptRun {
  text: string
  /** True for the run a segment just landed in. */
  fresh: boolean
}

/**
 * Splits `value` at `range`, dropping empty runs.
 *
 * A range that no longer fits the value is clamped rather than rejected: the
 * user can delete text between a segment landing and the mark expiring, and a
 * throw (or a silently wrong slice) there would be a crash in the middle of
 * someone dictating.
 */
export function transcriptRuns(
  value: string,
  range: readonly [number, number] | null
): TranscriptRun[] {
  const runs: TranscriptRun[] = []
  const push = (text: string, fresh: boolean): void => {
    if (text !== '') runs.push({ text, fresh })
  }

  if (range === null) {
    push(value, false)
  } else {
    const start = Math.max(0, Math.min(range[0], value.length))
    const end = Math.max(start, Math.min(range[1], value.length))
    push(value.slice(0, start), false)
    push(value.slice(start, end), true)
    push(value.slice(end), false)
  }

  // The mirror must always render at least one node, or an empty field's
  // backdrop collapses and the first character lands misaligned.
  if (runs.length === 0) runs.push({ text: '', fresh: false })
  return runs
}
