/**
 * What a tool call *was*, and what it *answered* (agent-tool-details).
 *
 * ## The gap this fills
 *
 * The activity feed already says the agent *ran* something — `Rodou npm run
 * verify · 12s`. It never said **what** it ran past the first 96 characters of
 * the first line, and it never said **what came back at all**. So a command
 * that failed and a command that passed drew the same row, and the one thing a
 * user needs in order to trust (or stop) an agent — the evidence — lived only
 * in a terminal this app deliberately hides.
 *
 * Only the file-editing tools had an answer to this, because `toolPatch.ts`
 * reconstructs their diff. Every other tool — the shell, the searches, the web
 * fetches, every MCP call — was a dead end.
 *
 * ## What this module does
 *
 * It turns the two halves the CLI already streams into something a transcript
 * can render:
 *
 *  - the `tool_use.input` object → an ordered list of {@link ToolParam}, with
 *    the call's headline argument hoisted to the front and long values marked
 *    as blocks rather than table rows;
 *  - the `tool_result.content` → one capped {@link ToolOutput} string.
 *
 * ## Why it is capped here and not in the renderer
 *
 * These cross an IPC boundary and then live in memory for as long as the
 * conversation is open. A single `Read` of a large file returns hundreds of
 * kilobytes, and a turn makes dozens of calls; uncapped, one long session
 * would hold the workspace in the renderer's heap. The cap is applied at the
 * source, once, and is **reported** (`truncated`) rather than hidden — a
 * result cut short must never look whole.
 *
 * No UI strings live here: the main process holds none (R1.6). Keys travel as
 * the CLI's own field names and are translated on the other side.
 */

/** One argument of a tool call, ready to render. */
export interface ToolParam {
  /** The field name as the CLI's schema has it: `command`, `file_path`, `pattern`. */
  key: string
  /** The value, flattened to text (objects and arrays as indented JSON) and capped. */
  value: string
  /**
   * `true` when the value needs its own full-width block: it has line breaks,
   * or it is too long to sit in a two-column row without being ellipsized into
   * uselessness. The renderer draws blocks as code and the rest as a list.
   */
  block?: boolean
  /** Characters dropped off the end by {@link MAX_PARAM_CHARS}. Absent when whole. */
  truncated?: number
}

/** What a tool call returned, capped. */
export interface ToolOutput {
  /** The result text. Empty string is meaningful: the tool answered with nothing. */
  text: string
  /** Line count of the **whole** result, before capping — so a cut result still reports its true size. */
  lines: number
  /** Characters dropped off the end by {@link MAX_OUTPUT_CHARS}. Absent when whole. */
  truncated?: number
}

/** Per-value ceiling. Generous enough for a real command or a prompt, small enough that forty of them are still nothing. */
const MAX_PARAM_CHARS = 2000

/** How many arguments travel. Past this a call is being introspected, not read. */
const MAX_PARAMS = 14

/**
 * Result ceiling. A `Read` of a 3000-line file is ~120 kB; the panel shows a
 * dozen lines at a time and offers to grow, so anything past this is weight
 * with no reader.
 */
const MAX_OUTPUT_CHARS = 8000

/**
 * A value long enough that a two-column row would ellipsize it into nothing.
 * Roughly the width the details panel gives the value column.
 */
const BLOCK_CHARS = 72

/**
 * Fields whose whole point is the file's text. When the same call already
 * carries a {@link ToolPatch}, the diff renders them better than a wall of
 * quoted source ever could — and rendering both puts the same 200 lines on
 * screen twice, once with change marks and once without.
 */
const PATCH_FIELDS = new Set(['content', 'old_string', 'new_string', 'edits', 'new_source'])

/**
 * The order the eye wants: whatever the row's own summary is built from comes
 * first (so the panel opens on the thing the user clicked to see in full),
 * then the rest of the call in the schema's own order. Mirrors
 * `cliAdapterCore.ts`'s `toolDetailOf` — the two must agree, or the panel
 * leads with something the row never mentioned.
 */
const HEADLINE_KEYS = [
  'command',
  'file_path',
  'path',
  'pattern',
  'url',
  'query',
  'prompt',
  'description'
]

/** Flattens one input value to text. Objects and arrays travel as indented JSON — unreadable as one line, fine as a block. */
function flattenValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return null
  try {
    const json = JSON.stringify(value, null, 2)
    return typeof json === 'string' ? json : null
  } catch {
    // A value that won't serialize (a BigInt off a hand-rolled adapter) is
    // dropped rather than taking the whole panel down with it.
    return null
  }
}

/** Applies a character ceiling, reporting what it removed instead of hiding it. */
function cap(text: string, limit: number): { text: string; truncated?: number } {
  if (text.length <= limit) return { text }
  return { text: text.slice(0, limit), truncated: text.length - limit }
}

/**
 * The arguments of one tool call, in reading order.
 *
 * `hasPatch` is how a `Write` avoids printing the file it is writing twice:
 * the patch above already shows those lines, with change marks. Returns
 * `undefined` — not `[]` — when there is nothing to show, so the event stays
 * small and the renderer's "does this row open?" test is a plain presence
 * check.
 */
export function buildToolParams(
  input: Record<string, unknown> | undefined,
  hasPatch = false
): ToolParam[] | undefined {
  if (!input || typeof input !== 'object') return undefined
  const keys = Object.keys(input)
  const headline = HEADLINE_KEYS.find(
    (key) => keys.includes(key) && typeof input[key] === 'string' && input[key] !== ''
  )
  const ordered = headline === undefined ? keys : [headline, ...keys.filter((k) => k !== headline)]

  const params: ToolParam[] = []
  for (const key of ordered) {
    if (params.length >= MAX_PARAMS) break
    if (hasPatch && PATCH_FIELDS.has(key)) continue
    const flat = flattenValue(input[key])
    if (flat === null || flat.trim() === '') continue
    const { text, truncated } = cap(flat, MAX_PARAM_CHARS)
    const block = text.includes('\n') || text.length > BLOCK_CHARS
    params.push({
      key,
      value: text,
      ...(block ? { block: true } : {}),
      ...(truncated ? { truncated } : {})
    })
  }
  return params.length === 0 ? undefined : params
}

/**
 * The text of a `tool_result` block.
 *
 * The CLI sends `content` either as a plain string or as a list of content
 * blocks (the same shape a message body has), and a tool that returned an
 * image or a document contributes a block with no text at all. Those are
 * skipped rather than rendered as `[object Object]`: a panel that says nothing
 * came back is honest, and one that prints a JSON husk is not.
 *
 * Returns `undefined` only when there was nothing to read *at all*. A tool
 * that genuinely answered with an empty string returns an empty-text
 * `ToolOutput`, which is a different fact and the renderer says so.
 */
export function buildToolOutput(content: unknown): ToolOutput | undefined {
  const raw = readResultText(content)
  if (raw === null) return undefined
  const trimmed = raw.replace(/\s+$/, '')
  const lines = trimmed === '' ? 0 : trimmed.split('\n').length
  const { text, truncated } = cap(trimmed, MAX_OUTPUT_CHARS)
  return { text, lines, ...(truncated ? { truncated } : {}) }
}

function readResultText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
      continue
    }
    if (block === null || typeof block !== 'object') continue
    const text = (block as { text?: unknown }).text
    if (typeof text === 'string') parts.push(text)
  }
  return parts.length === 0 ? null : parts.join('\n')
}
