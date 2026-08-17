/**
 * Pure logic for the composer's `@` workspace-file mentions
 * (chat-attachments): token detection at the caret, fuzzy filtering of the
 * workspace file list, insertion of a picked path, extraction of valid
 * references at submit time, and segmentation for the highlight backdrop.
 * No DOM, no IPC — `Chat` owns the wiring; this module owns the rules.
 *
 * The trigger is `@` — the same glyph Claude Code, Cursor and every editor
 * quick-open the user already knows use for "point at a file". It used to be
 * `#`, which collided with Markdown headings and hashtags in ordinary prose;
 * `@` only opens after whitespace, so `contato@exemplo.com` stays an e-mail.
 */

/** An open `@` mention being typed: `start` is the index of the `@` itself. */
export interface MentionQuery {
  start: number
  query: string
}

/** The mention sigil, in one place: the trigger, the inserted prefix and the pill's first glyph. */
export const MENTION_SIGIL = '@'

/** Characters that end a mention token. Mirrors what a path can't contain mid-reference. */
const TOKEN_BOUNDARY = /[\s@]/

/**
 * Finds the `@` mention token the caret is currently inside, or `null`.
 * A token opens at an `@` that starts the value or follows whitespace (so
 * `veja @docs` triggers but the `@` in `contato@exemplo.com` doesn't), and
 * runs to the caret with no whitespace or second `@` in between.
 */
export function mentionQueryAt(value: string, caret: number): MentionQuery | null {
  const upToCaret = value.slice(0, caret)
  const sigil = upToCaret.lastIndexOf(MENTION_SIGIL)
  if (sigil === -1) return null
  if (sigil > 0 && !/\s/.test(upToCaret[sigil - 1])) return null
  const query = upToCaret.slice(sigil + 1)
  if (TOKEN_BOUNDARY.test(query)) return null
  return { start: sigil, query }
}

/**
 * Replaces the open mention token with the picked path plus a trailing
 * space, returning the new value and where the caret lands.
 */
export function insertMention(
  value: string,
  mention: MentionQuery,
  caret: number,
  path: string
): { value: string; caret: number } {
  const inserted = `${MENTION_SIGIL}${path} `
  const next = value.slice(0, mention.start) + inserted + value.slice(caret)
  return { value: next, caret: mention.start + inserted.length }
}

const MENTION_RESULT_LIMIT = 8

/**
 * Case/accent-insensitive normalization shared by filtering and match
 * highlighting. Folds **per character** rather than over the whole string so
 * the result stays index-aligned with the input \u2014 `matchRanges` reports
 * offsets into the original label, and `"a\u00e7\u00e3o"`'s decomposed cedilla would
 * otherwise shift every offset after it by one.
 */
function normalize(text: string): string {
  let out = ''
  // Indexed (not `for\u2026of`): iterating by code point would fold a surrogate
  // pair into a single slot and break the length invariant below.
  for (let i = 0; i < text.length; i += 1) {
    const folded = text[i]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    // A char that folds away entirely (a lone combining mark) or expands
    // (`\u00df` \u2192 `ss`) keeps exactly its one slot, so `out.length === text.length`
    // holds for every input.
    out += folded === '' ? text[i] : folded[0]
  }
  return out
}

function basenameOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

/** True when every char of `needle` appears in `haystack` in order (fuzzy subsequence). */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return false
}

/** A ranked page of mention matches plus how many matched in total (before `limit`). */
export interface MentionMatches {
  items: string[]
  /** Every file that matched, not just the ones shown — the menu says so when it truncates. */
  total: number
}

/**
 * `rankMentionFiles`, keeping only the ranked page — the shape most callers
 * (and every ranking test) want.
 */
export function filterMentionFiles(
  files: string[],
  query: string,
  limit: number = MENTION_RESULT_LIMIT
): string[] {
  return rankMentionFiles(files, query, limit).items
}

/**
 * Ranks workspace files against the mention query. Score tiers (best first):
 * basename prefix → basename substring → path substring → path subsequence.
 * Ties break by path depth (shallow first), then shorter path, then
 * alphabetical — the file the user most likely means floats to the top with
 * the fewest keystrokes. An empty query lists shallow files first.
 *
 * `total` counts every match, so the menu can admit it is showing a page of a
 * larger set instead of silently cutting at `limit` — the difference between
 * "your file isn't here" and "keep typing".
 */
export function rankMentionFiles(
  files: string[],
  query: string,
  limit: number = MENTION_RESULT_LIMIT
): MentionMatches {
  const needle = normalize(query)
  const scored: Array<{ path: string; score: number; depth: number }> = []
  for (const path of files) {
    const normPath = normalize(path)
    const normBase = normalize(basenameOf(path))
    let score: number
    if (needle === '') {
      score = 0
    } else if (normBase.startsWith(needle)) {
      score = 4
    } else if (normBase.includes(needle)) {
      score = 3
    } else if (normPath.includes(needle)) {
      score = 2
    } else if (isSubsequence(needle, normPath)) {
      score = 1
    } else {
      continue
    }
    scored.push({ path, score, depth: path.split('/').length })
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.depth - b.depth ||
      a.path.length - b.path.length ||
      a.path.localeCompare(b.path)
  )
  return { items: scored.slice(0, limit).map((entry) => entry.path), total: scored.length }
}

/**
 * Slices of a label the query matched, as `[start, end)` offsets into the
 * original string. The mention menu paints these so a row explains itself:
 * the user sees *why* `src/renderer/app.tsx` answered `srapp`.
 */
export interface MatchRange {
  start: number
  end: number
}

/**
 * Where `query` matched inside `text` — a contiguous run when the query is a
 * substring, otherwise the individual characters of the fuzzy subsequence
 * (greedy left-to-right, the same walk `isSubsequence` uses to accept the
 * row, so the highlight can never disagree with the ranking). Adjacent
 * characters merge into one range so a substring hit paints as one run
 * instead of N one-character marks. Empty query → no ranges.
 */
export function matchRanges(text: string, query: string): MatchRange[] {
  const needle = normalize(query)
  if (needle === '') return []
  const hay = normalize(text)
  const at = hay.indexOf(needle)
  if (at !== -1) return [{ start: at, end: at + needle.length }]
  const ranges: MatchRange[] = []
  let i = 0
  for (let index = 0; index < hay.length && i < needle.length; index += 1) {
    if (hay[index] !== needle[i]) continue
    const last = ranges[ranges.length - 1]
    if (last && last.end === index) last.end = index + 1
    else ranges.push({ start: index, end: index + 1 })
    i += 1
  }
  // A partial walk means this label doesn't actually contain the subsequence;
  // report nothing rather than a misleading half-highlight.
  return i === needle.length ? ranges : []
}

/** One run of a menu label: matched by the query, or not. */
export interface HighlightPart {
  text: string
  match: boolean
}

/**
 * Splits one *slice* of a ranked path — its directory line or its file name —
 * into matched and unmatched runs, given ranges measured against the whole
 * path and the slice's `offset` into it.
 *
 * Ranges are computed once over the full path (never per part), so what the
 * menu paints is exactly what earned the row its rank: a query that matched
 * across the slash lights up on both lines, and one that matched only the
 * folder never fakes a highlight on the file name.
 */
export function highlightParts(
  text: string,
  ranges: readonly MatchRange[],
  offset: number = 0
): HighlightPart[] {
  const parts: HighlightPart[] = []
  let cursor = 0
  for (const range of ranges) {
    const start = Math.max(range.start - offset, 0)
    const end = Math.min(range.end - offset, text.length)
    if (end <= start || end <= cursor) continue
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    parts.push({ text: text.slice(Math.max(start, cursor), end), match: true })
    cursor = end
  }
  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), match: false })
  }
  return parts
}

/** One run of composer text for the highlight backdrop: a valid mention token or plain text. */
export interface MentionSegment {
  text: string
  mention: boolean
}

/** Matches candidate `@path` tokens: `@` at start/after-whitespace, then non-space/non-`@` chars. */
const MENTION_TOKEN_PATTERN = /(^|\s)@([^\s@]+)/g

/**
 * Splits `value` into segments, marking `@path` tokens that reference a real
 * workspace file (`knownFiles`). Only verified paths highlight — a stray
 * `@fulano` stays plain text, so the pill is an honest "this file exists"
 * signal. Segments always concatenate back to `value` exactly (the backdrop
 * alignment contract).
 */
export function mentionSegments(value: string, knownFiles: ReadonlySet<string>): MentionSegment[] {
  const segments: MentionSegment[] = []
  let cursor = 0
  MENTION_TOKEN_PATTERN.lastIndex = 0
  for (const match of value.matchAll(MENTION_TOKEN_PATTERN)) {
    if (!knownFiles.has(match[2])) continue
    const tokenStart = match.index + match[1].length
    const tokenEnd = tokenStart + 1 + match[2].length
    if (tokenStart > cursor)
      segments.push({ text: value.slice(cursor, tokenStart), mention: false })
    segments.push({ text: value.slice(tokenStart, tokenEnd), mention: true })
    cursor = tokenEnd
  }
  if (cursor < value.length || segments.length === 0) {
    segments.push({ text: value.slice(cursor), mention: false })
  }
  return segments
}

/** Unique workspace-relative paths of every valid `@` reference in `text`, in order of appearance. */
export function extractMentions(text: string, knownFiles: ReadonlySet<string>): string[] {
  const found: string[] = []
  for (const segment of mentionSegments(text, knownFiles)) {
    if (!segment.mention) continue
    const path = segment.text.slice(1)
    if (!found.includes(path)) found.push(path)
  }
  return found
}

/** Compact pt-BR-agnostic byte size for attachment chip metas — "2,3 KB", "640 B", "1,2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace('.', ',')
  return `${rounded} ${units[unit]}`
}
