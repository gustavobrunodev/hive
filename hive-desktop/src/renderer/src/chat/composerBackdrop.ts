import { mentionSegments } from './composerMentions'

/**
 * The composer's highlight backdrop, composed from everything that wants to
 * paint under the text: `@` file mentions, the leading `/command` when it names
 * something real, and the run a dictated segment just landed (VP-R2.3).
 *
 * It lives in `chat/` rather than in `dictation/` on purpose. The dictation
 * module may not import from `chat/` (VP-R5.1) — that boundary is what keeps
 * the hook reusable — so the composition happens on the Chat side, taking the
 * range as a plain pair of offsets. Dictation never learns that mentions exist.
 *
 * **The contract is unforgiving and it is the reason this is a tested pure
 * function:** the segments must concatenate back to `value` character for
 * character. The backdrop is a transparent mirror layered under the real
 * textarea glyphs, so a single character of drift shifts every highlight after
 * it out of alignment with the text it is supposed to be marking.
 */

/** One run of composer text, carrying every flag that wants to paint it. */
export interface BackdropSegment {
  text: string
  /** A `@path` token that resolves to a real workspace file. */
  mention: boolean
  /** Part of the run a dictated segment just inserted. */
  fresh: boolean
  /**
   * The leading `/command` token, when it names a real skill or built-in
   * (chat-slash-commands).
   *
   * Its own flag rather than a second kind of `mention` because the two are
   * different claims about the line — "this names a file that exists" against
   * "this line *is* an invocation" — and they are drawn differently for that
   * reason. Sharing one flag would have made them share a pill, which is
   * exactly the confusion the token exists to remove.
   */
  command: boolean
  /**
   * Part of the provisional run dictation is still revising (VP-R2.9).
   *
   * Distinct from `fresh` and not a stronger version of it: `fresh` is a
   * 600 ms glance at text that has arrived and is staying, this is a standing
   * mark on text that has *not* arrived and may be rewritten a second from now.
   * Confusing the two would tell the user their words are final while the
   * engine is still choosing them.
   */
  preview: boolean
}

/**
 * Splits `value` into runs marked with the mention, freshly-inserted and
 * provisional flags.
 *
 * Each range is `[start, end)` in `value`'s own offsets, or `null`. They are
 * clamped rather than trusted: a range comes from a transcription that resolved
 * asynchronously, and the user may have edited the field in between — a stale
 * range must degrade to marking less, never to shifting the backdrop.
 */
export function composerBackdrop(
  value: string,
  knownFiles: ReadonlySet<string>,
  freshRange: readonly [number, number] | null,
  previewRange: readonly [number, number] | null = null,
  commandRange: readonly [number, number] | null = null
): BackdropSegment[] {
  const marks = [
    clampRange(freshRange, value.length),
    clampRange(previewRange, value.length),
    clampRange(commandRange, value.length)
  ]
  const segments: BackdropSegment[] = []
  let offset = 0

  for (const segment of mentionSegments(value, knownFiles)) {
    const start = offset
    const end = offset + segment.text.length
    offset = end

    // Every mark boundary that falls strictly inside this run becomes a cut, so
    // a mark follows the characters it covers exactly and not the token they
    // happen to sit in. Sorted and de-duplicated, because two marks may share
    // an edge and a zero-length piece would be dropped anyway.
    const cuts = [start, end]
    for (const mark of marks) {
      if (mark === null) continue
      for (const edge of mark) if (edge > start && edge < end) cuts.push(edge)
    }
    cuts.sort((a, b) => a - b)

    for (let i = 0; i < cuts.length - 1; i += 1) {
      const from = cuts[i]
      const to = cuts[i + 1]
      push(
        segments,
        value.slice(from, to),
        segment.mention,
        covers(marks[0], from, to),
        covers(marks[1], from, to),
        covers(marks[2], from, to)
      )
    }
  }

  // An empty composer still needs one run: the backdrop element must exist to
  // stay aligned with the textarea's own empty first line.
  if (segments.length === 0) {
    segments.push({ text: '', mention: false, command: false, fresh: false, preview: false })
  }
  return segments
}

/** Does `mark` cover the whole piece `[from, to)`? The cuts guarantee all-or-nothing. */
function covers(mark: readonly [number, number] | null, from: number, to: number): boolean {
  return mark !== null && mark[0] <= from && mark[1] >= to
}

function push(
  segments: BackdropSegment[],
  text: string,
  mention: boolean,
  fresh: boolean,
  preview: boolean,
  command: boolean
): void {
  if (text !== '') segments.push({ text, mention, command, fresh, preview })
}

/** A usable `[start, end)` inside `value`, or `null` if it marks nothing. */
function clampRange(
  range: readonly [number, number] | null,
  length: number
): readonly [number, number] | null {
  if (range === null) return null
  const start = Math.max(0, Math.min(range[0], length))
  const end = Math.max(0, Math.min(range[1], length))
  return end > start ? [start, end] : null
}
