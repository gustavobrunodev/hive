/**
 * Segment text → the field's next value and caret (VP-R2.2).
 *
 * Pure, and deliberately ignorant of textareas: it takes a value and a
 * selection, returns a value and a caret. That is what lets the same rules
 * serve the chat composer today and any other field later (VP-R5.1/5.5).
 *
 * The rules exist because Whisper hands back a *phrase*, not a keystroke
 * stream, and it never knows what came before it. Left alone, a segment lands
 * as "revisa oarquivo", "revisa o  arquivo" or "lista , e mais" — small,
 * constant, and exactly the kind of defect that makes dictated text feel
 * machine-made.
 *
 * Deliberately NOT done: *lowering* a segment's leading capital mid-sentence.
 * There is no way to tell Whisper's reflexive capital from a real proper noun,
 * and turning someone's name into "amelia" is worse than a stray capital. It is
 * logged as a deferred idea rather than guessed at here.
 */

export interface JoinResult {
  /** The field's next value. */
  value: string
  /** Where the caret goes: immediately after the inserted run. */
  caret: number
  /** The inserted run, `[start, end)`, for the landing mark (VP-R2.3). */
  range: [number, number]
}

/** Sentence-ending marks after which the next segment starts a new sentence. */
const SENTENCE_END = /[.!?…]["')\]]?\s*$/
/** Leading punctuation that must hug the previous word, never take a space. */
const LEADING_PUNCTUATION = /^[,.;:!?)\]}…%'"]/

/** Uppercases the first character, leaving the rest of the segment alone. */
function capitalizeFirst(text: string): string {
  // `Array.from` (not `text[0]`) so an accented or astral first character is
  // one unit — "ótimo" and an emoji both survive.
  const [first, ...rest] = Array.from(text)
  return first.toUpperCase() + rest.join('')
}

/**
 * Splices `text` into `value` over `[selectionStart, selectionEnd)`, fixing the
 * spacing and capitalization at the seam.
 *
 * A selection is replaced rather than appended to — the user selected it to get
 * rid of it, and the first segment of a take is the one that acts on that.
 */
export function joinTranscript(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string
): JoinResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const incoming = text.trim()

  // An empty segment is a no-op, caret untouched: a take with a silent stretch
  // must not nudge the caret or mark an empty run as "just arrived".
  if (incoming === '') {
    return { value, caret: end, range: [end, end] }
  }

  const before = value.slice(0, start)
  const after = value.slice(end)

  const leadSpace =
    before !== '' && !/\s$/.test(before) && !LEADING_PUNCTUATION.test(incoming) ? ' ' : ''
  // The right-hand seam matters too: dictating into the middle of a draft that
  // continues with a word would otherwise weld them together ("Oláabc").
  const trailSpace =
    after !== '' && !/^\s/.test(after) && !LEADING_PUNCTUATION.test(after) ? ' ' : ''

  // Capitalize when this segment opens the field, or opens a new sentence.
  const opensSentence = before.trim() === '' || SENTENCE_END.test(before)
  const body = opensSentence ? capitalizeFirst(incoming) : incoming

  const insertStart = before.length + leadSpace.length
  const insertEnd = insertStart + body.length

  return {
    value: `${before}${leadSpace}${body}${trailSpace}${after}`,
    // Right after the words that arrived — in front of the space added for the
    // text that follows, so the next segment continues where this one stopped.
    caret: insertEnd,
    range: [insertStart, insertEnd]
  }
}
