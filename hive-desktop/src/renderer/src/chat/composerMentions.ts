/**
 * Pure logic for the composer's `#` workspace-file mentions
 * (chat-attachments): token detection at the caret, fuzzy filtering of the
 * workspace file list, insertion of a picked path, extraction of valid
 * references at submit time, and segmentation for the highlight backdrop.
 * No DOM, no IPC — `Chat` owns the wiring; this module owns the rules.
 */

/** An open `#` mention being typed: `start` is the index of the `#` itself. */
export interface MentionQuery {
  start: number
  query: string
}

/** Characters that end a mention token. Mirrors what a path can't contain mid-reference. */
const TOKEN_BOUNDARY = /[\s#]/

/**
 * Finds the `#` mention token the caret is currently inside, or `null`.
 * A token opens at a `#` that starts the value or follows whitespace (so
 * `tema #escuro` triggers but `c#` in prose doesn't), and runs to the caret
 * with no whitespace or second `#` in between.
 */
export function mentionQueryAt(value: string, caret: number): MentionQuery | null {
  const upToCaret = value.slice(0, caret)
  const hash = upToCaret.lastIndexOf('#')
  if (hash === -1) return null
  if (hash > 0 && !/\s/.test(upToCaret[hash - 1])) return null
  const query = upToCaret.slice(hash + 1)
  if (TOKEN_BOUNDARY.test(query)) return null
  return { start: hash, query }
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
  const inserted = `#${path} `
  const next = value.slice(0, mention.start) + inserted + value.slice(caret)
  return { value: next, caret: mention.start + inserted.length }
}

const MENTION_RESULT_LIMIT = 8

/** Case/accent-insensitive normalization shared by filtering and matching. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

/**
 * Ranks workspace files against the mention query. Score tiers (best first):
 * basename prefix → basename substring → path substring → path subsequence.
 * Ties break by path depth (shallow first), then shorter path, then
 * alphabetical — the file the user most likely means floats to the top with
 * the fewest keystrokes. An empty query lists shallow files first.
 */
export function filterMentionFiles(
  files: string[],
  query: string,
  limit: number = MENTION_RESULT_LIMIT
): string[] {
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
  return scored.slice(0, limit).map((entry) => entry.path)
}

/** One run of composer text for the highlight backdrop: a valid mention token or plain text. */
export interface MentionSegment {
  text: string
  mention: boolean
}

/** Matches candidate `#path` tokens: `#` at start/after-whitespace, then non-space/non-`#` chars. */
const MENTION_TOKEN_PATTERN = /(^|\s)#([^\s#]+)/g

/**
 * Splits `value` into segments, marking `#path` tokens that reference a real
 * workspace file (`knownFiles`). Only verified paths highlight — a stray
 * `#hashtag` stays plain text, so the pill is an honest "this file exists"
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

/** Unique workspace-relative paths of every valid `#` reference in `text`, in order of appearance. */
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
