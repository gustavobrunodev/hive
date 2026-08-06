import { mentionSegments } from './composerMentions'

/**
 * The composer's highlight backdrop, composed from everything that wants to
 * paint under the text: `#` file mentions, and the run a dictated segment just
 * landed (VP-R2.3).
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
  /** A `#path` token that resolves to a real workspace file. */
  mention: boolean
  /** Part of the run a dictated segment just inserted. */
  fresh: boolean
}

/**
 * Splits `value` into runs marked with the mention and freshly-inserted flags.
 *
 * `freshRange` is `[start, end)` in `value`'s own offsets, or `null` when
 * nothing has just arrived. It is clamped rather than trusted: the range comes
 * from a transcription that resolved asynchronously, and the user may have
 * edited the field in between — a stale range must degrade to marking less,
 * never to shifting the backdrop.
 */
export function composerBackdrop(
  value: string,
  knownFiles: ReadonlySet<string>,
  freshRange: readonly [number, number] | null
): BackdropSegment[] {
  const fresh = clampRange(freshRange, value.length)
  const segments: BackdropSegment[] = []
  let offset = 0

  for (const segment of mentionSegments(value, knownFiles)) {
    const start = offset
    const end = offset + segment.text.length
    offset = end

    if (fresh === null || fresh[1] <= start || fresh[0] >= end) {
      push(segments, segment.text, segment.mention, false)
      continue
    }

    // The fresh range cuts across this run: emit up to three pieces, so the
    // mark follows the inserted characters exactly and not the token they
    // happen to sit in.
    const cutStart = Math.max(start, fresh[0])
    const cutEnd = Math.min(end, fresh[1])
    push(segments, value.slice(start, cutStart), segment.mention, false)
    push(segments, value.slice(cutStart, cutEnd), segment.mention, true)
    push(segments, value.slice(cutEnd, end), segment.mention, false)
  }

  // An empty composer still needs one run: the backdrop element must exist to
  // stay aligned with the textarea's own empty first line.
  if (segments.length === 0) segments.push({ text: '', mention: false, fresh: false })
  return segments
}

function push(segments: BackdropSegment[], text: string, mention: boolean, fresh: boolean): void {
  if (text !== '') segments.push({ text, mention, fresh })
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
