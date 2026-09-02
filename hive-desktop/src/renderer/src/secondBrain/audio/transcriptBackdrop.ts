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
  /** True for the run the live pass is still revising (VP-R2.9). */
  preview: boolean
}

/**
 * Splits `value` at the marked ranges, dropping empty runs.
 *
 * A range that no longer fits the value is clamped rather than rejected: the
 * user can delete text between a segment landing and the mark expiring, and a
 * throw (or a silently wrong slice) there would be a crash in the middle of
 * someone dictating.
 *
 * The two marks never overlap in practice — provisional text becomes final by
 * being replaced, not by being re-flagged — but they are cut independently
 * rather than assumed apart, because an assumption like that is only ever one
 * refactor away from being false and silently misaligning the mirror.
 */
export function transcriptRuns(
  value: string,
  range: readonly [number, number] | null,
  previewRange: readonly [number, number] | null = null
): TranscriptRun[] {
  const marks = [clamp(range, value.length), clamp(previewRange, value.length)]
  const cuts = new Set<number>([0, value.length])
  for (const mark of marks) {
    if (mark === null) continue
    cuts.add(mark[0])
    cuts.add(mark[1])
  }

  const edges = [...cuts].sort((a, b) => a - b)
  const runs: TranscriptRun[] = []
  for (let i = 0; i < edges.length - 1; i += 1) {
    const [from, to] = [edges[i], edges[i + 1]]
    const text = value.slice(from, to)
    if (text === '') continue
    runs.push({ text, fresh: covers(marks[0], from, to), preview: covers(marks[1], from, to) })
  }

  // The mirror must always render at least one node, or an empty field's
  // backdrop collapses and the first character lands misaligned.
  if (runs.length === 0) runs.push({ text: '', fresh: false, preview: false })
  return runs
}

function clamp(
  range: readonly [number, number] | null,
  length: number
): readonly [number, number] | null {
  if (range === null) return null
  const start = Math.max(0, Math.min(range[0], length))
  const end = Math.max(start, Math.min(range[1], length))
  return end > start ? [start, end] : null
}

function covers(mark: readonly [number, number] | null, from: number, to: number): boolean {
  return mark !== null && mark[0] <= from && mark[1] >= to
}
