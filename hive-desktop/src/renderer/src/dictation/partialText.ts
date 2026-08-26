/**
 * The tail of the phrase being transcribed right now, trimmed to fit one line.
 *
 * Pure, and its own module, because the interesting part is a judgement rather
 * than a format: **the newest words matter and the oldest do not**. A partial
 * grows left to right, so clipping with `text-overflow: ellipsis` — which drops
 * the *end* — would freeze the visible text at whatever was decoded first and
 * leave the caller watching a line that never changes. Cutting from the front
 * keeps the line moving with the speaker, which is the whole point of showing
 * it.
 *
 * Trimmed to a word boundary when there is one nearby: a line starting
 * mid-word reads as corruption rather than as a window onto a longer sentence.
 */

/** Roughly one line of the transport at its narrowest. */
export const PARTIAL_MAX_CHARS = 96

export function partialTail(text: string, max: number = PARTIAL_MAX_CHARS): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  const tail = trimmed.slice(trimmed.length - max)
  const space = tail.indexOf(' ')
  // Only snap to a word boundary if one is close to the cut; a long unbroken
  // run (a URL, a code identifier) keeps its characters rather than losing most
  // of the line to a space that happens to sit near the end.
  const snapped = space > 0 && space < max / 3 ? tail.slice(space + 1) : tail
  return `…${snapped}`
}
