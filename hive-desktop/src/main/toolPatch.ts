/**
 * The patch a file-editing tool is *about* to apply, turned into something a
 * transcript can draw (agent-patch AP-C1).
 *
 * ## Why this exists
 *
 * The CLI already tells us everything: a `tool_use` block for `Edit` carries
 * `old_string` and `new_string` verbatim, `Write` carries the whole `content`,
 * `MultiEdit` carries the list. Until now `cliAdapterCore` read one field off
 * that input — the path — flattened it to a status line, and dropped the rest
 * on the floor. So the user watched *Editando chat/Chat.tsx* scroll past with
 * no way to know whether the agent had renamed a variable or rewritten the
 * file, and had to wait for the turn to end and open the review panel to find
 * out. The answer was in the stream the whole time.
 *
 * ## Why the diff is computed here and not in the renderer
 *
 * Two reasons, and the second is the real one:
 *
 * 1. **The renderer can't read the workspace.** Line numbers are the
 *    difference between "here is a snippet" and "here is line 119 of the file
 *    you have open", and they only exist if you can see the file the edit
 *    lands in. Main can; the sandboxed renderer can't.
 * 2. **The payload has to be bounded before it crosses IPC.** A `Write` of a
 *    4000-line file is a 4000-line `content` string. Sending that per tool
 *    call, per turn, to be diffed on the UI thread is how a transcript starts
 *    dropping frames. Diffing here means what crosses the wire is the change
 *    (capped at {@link MAX_PATCH_LINES}), not the file.
 *
 * ## Timing: this runs *before* the tool does
 *
 * `tool_use` blocks arrive on the completed `assistant` message, which the CLI
 * emits before it executes the call — and, when the tool needs permission,
 * before it even asks. So the file `readSource` returns is the pre-edit one,
 * which is exactly the image the diff needs, and the patch is on screen while
 * the approval card is still waiting for an answer. "Here is what I am about
 * to write to your file, yes or no" is a better question than "may I run
 * Edit".
 *
 * The trade is one bounded synchronous read per file-editing call
 * ({@link MAX_SOURCE_BYTES}); everything else here is arithmetic. `readSource`
 * is injected so this module stays pure and testable off the disk.
 */

/** How a file is being changed — the verb the header says, and the shape of the body. */
export type PatchOp = 'create' | 'edit' | 'rewrite'

/** A run of characters inside a changed line, flagged as the part that actually differs. */
export interface PatchSpan {
  text: string
  changed: boolean
}

export interface PatchLine {
  type: 'add' | 'del' | 'ctx'
  text: string
  /**
   * The line number to show: the *new* file's for `add`/`ctx`, the *old*
   * file's for `del` — one column, the way `git`'s own inline view reads.
   * `null` when the patch is unanchored (see {@link ToolPatch.anchored}).
   */
  no: number | null
  /**
   * Word-level breakdown, present only when this line pairs with its
   * counterpart on the other side closely enough for the comparison to mean
   * something. Absent means "read the whole line as changed".
   */
  spans?: PatchSpan[]
}

/** One contiguous region of change, with its surrounding context lines. */
export interface PatchHunk {
  lines: PatchLine[]
}

export interface ToolPatch {
  op: PatchOp
  /** The file being changed, as the tool named it (absolute, from the CLI). */
  path: string
  adds: number
  dels: number
  hunks: PatchHunk[]
  /**
   * Lines the transport cap dropped. The UI says so rather than silently
   * showing a partial patch as if it were the whole one.
   */
  truncated?: number
  /**
   * `true` when the diff was taken against the real file, so `no` is a real
   * line number. `false` when the file couldn't be read or the tool's
   * `old_string` didn't match it — the change is still shown, without numbers,
   * because a snippet with no coordinates still answers "what is changing".
   */
  anchored: boolean
}

/** The tools whose input describes a file change. Mirrors `cliAdapterCore`'s `FILE_EDIT_TOOLS`. */
const PATCH_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

/** Context lines kept around each changed run — the `git` default, and it reads right at chat width. */
const CONTEXT = 3

/**
 * Total emitted lines across every hunk. A rewrite of a large file is a real
 * thing an agent does; shipping all of it to the renderer is not.
 */
const MAX_PATCH_LINES = 600

/** Above this, the file isn't read at all and the patch degrades to unanchored. */
export const MAX_SOURCE_BYTES = 2_000_000

/**
 * Ceiling on the LCS table. Beyond it the changed region is reported as a
 * straight replacement (every old line out, every new line in) instead of
 * spending O(n·m) finding the prettiest alignment inside a block nobody is
 * going to read line-by-line anyway.
 */
const MAX_LCS_CELLS = 250_000

/** Ceiling on the word-level pass, which is the same algorithm at a finer grain. */
const MAX_WORD_TOKENS = 400

/**
 * How alike two lines must be before the word-level highlight is drawn. Below
 * it the "changed" spans degenerate into the whole line with a few shared
 * commas lit up, which reads as confetti rather than as a diff.
 */
const MIN_PAIR_SIMILARITY = 0.34

/** Reads a file for the pre-edit image, or `null` for missing/too large/unreadable. */
export type ReadSource = (path: string) => string | null

/**
 * Builds the patch for one `tool_use` input, or `undefined` when this tool
 * doesn't change a file (or changes nothing at all — an `Edit` whose
 * `new_string` equals its `old_string` gets no block rather than an empty one).
 */
export function buildToolPatch(
  name: string,
  input: Record<string, unknown> | undefined,
  readSource: ReadSource
): ToolPatch | undefined {
  if (!input || !PATCH_TOOLS.has(name)) return undefined
  const path = stringAt(input, 'file_path') ?? stringAt(input, 'notebook_path')
  if (path === undefined) return undefined

  const built =
    name === 'Write'
      ? fromWrite(input, path, readSource)
      : name === 'NotebookEdit'
        ? fromNotebookEdit(input, path)
        : fromEdits(input, path, name, readSource)

  if (!built || (built.adds === 0 && built.dels === 0)) return undefined
  return built
}

/** `Write`: the new content is the whole file, so the old image is whatever is there now. */
function fromWrite(
  input: Record<string, unknown>,
  path: string,
  readSource: ReadSource
): ToolPatch | undefined {
  const content = stringAt(input, 'content')
  if (content === undefined) return undefined
  const source = readSource(path)
  // Anchored either way: a rewrite diffs against the real file, and a brand-new
  // file's numbers are simply 1..n of the content about to be written.
  return assemble(
    path,
    source === null ? 'create' : 'rewrite',
    source === null ? [] : splitLines(source),
    splitLines(content),
    true
  )
}

/**
 * `Edit` / `MultiEdit`: apply the edits to the file we can see, then diff the
 * two images. Replaying them in order is what makes a `MultiEdit` whose second
 * edit touches text the first one produced come out right — diffing each
 * `old_string`→`new_string` pair on its own would show the intermediate state
 * as if it were the final one.
 *
 * When the file can't be read, or an `old_string` doesn't match it (the agent
 * is working from a stale read, which is exactly when the user most wants to
 * see what it thinks it is replacing), the pair itself is still a diff — just
 * one with no coordinates.
 */
function fromEdits(
  input: Record<string, unknown>,
  path: string,
  name: string,
  readSource: ReadSource
): ToolPatch | undefined {
  const edits = name === 'MultiEdit' ? editList(input) : singleEdit(input)
  if (edits.length === 0) return undefined

  const source = readSource(path)
  if (source !== null) {
    const applied = applyEdits(source, edits)
    if (applied !== null) {
      return assemble(path, 'edit', splitLines(source), splitLines(applied), true)
    }
  }
  // Unanchored fallback: the edits' own before/after, concatenated.
  const before = edits.map((edit) => edit.oldString).join('\n')
  const after = edits.map((edit) => edit.newString).join('\n')
  return assemble(path, 'edit', splitLines(before), splitLines(after), false)
}

/**
 * `NotebookEdit` names a cell, not a byte range, so there is no file image to
 * diff against — the notebook on disk is JSON, and the cell's old source is
 * not in the tool's input. The new source is, and showing it as an insertion
 * is the honest reading of what is about to exist.
 */
function fromNotebookEdit(input: Record<string, unknown>, path: string): ToolPatch | undefined {
  const source = stringAt(input, 'new_source')
  if (source === undefined) return undefined
  return assemble(path, 'edit', [], splitLines(source), false)
}

interface EditPair {
  oldString: string
  newString: string
  replaceAll: boolean
}

function singleEdit(input: Record<string, unknown>): EditPair[] {
  const oldString = stringAt(input, 'old_string')
  const newString = stringAt(input, 'new_string')
  if (oldString === undefined && newString === undefined) return []
  return [
    {
      oldString: oldString ?? '',
      newString: newString ?? '',
      replaceAll: input.replace_all === true
    }
  ]
}

function editList(input: Record<string, unknown>): EditPair[] {
  const raw = input.edits
  if (!Array.isArray(raw)) return []
  const edits: EditPair[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const [pair] = singleEdit(entry as Record<string, unknown>)
    if (pair) edits.push(pair)
  }
  return edits
}

/** Replays the edits against the source, or `null` the moment one doesn't match. */
function applyEdits(source: string, edits: EditPair[]): string | null {
  let text = source
  for (const edit of edits) {
    if (edit.oldString === '') return null
    const at = text.indexOf(edit.oldString)
    if (at === -1) return null
    text = edit.replaceAll
      ? text.split(edit.oldString).join(edit.newString)
      : text.slice(0, at) + edit.newString + text.slice(at + edit.oldString.length)
  }
  return text
}

/** Diff → hunks → word spans → counts, with the transport cap applied last. */
function assemble(
  path: string,
  op: PatchOp,
  oldLines: string[],
  newLines: string[],
  anchored: boolean
): ToolPatch {
  const lines = diffLines(oldLines, newLines)
  const hunks = toHunks(lines, CONTEXT)
  for (const hunk of hunks) markChangedWords(hunk)

  let adds = 0
  let dels = 0
  for (const line of lines) {
    if (line.type === 'add') adds += 1
    else if (line.type === 'del') dels += 1
  }

  const { hunks: capped, truncated } = capHunks(hunks, MAX_PATCH_LINES)
  const patch: ToolPatch = { op, path, adds, dels, hunks: capped, anchored }
  if (!anchored) for (const hunk of capped) for (const line of hunk.lines) line.no = null
  if (truncated > 0) patch.truncated = truncated
  return patch
}

/**
 * The line-level diff.
 *
 * Common prefix and suffix come off first, which is not just an optimisation:
 * a one-line change in a 3000-line file leaves a region of two, and the LCS
 * that follows is instant. It also keeps the alignment stable — without the
 * trim, an LCS is free to match a `}` near the top of the file with a `}` near
 * the bottom and produce a technically-minimal diff that reads as nonsense.
 */
export function diffLines(oldLines: string[], newLines: string[]): PatchLine[] {
  let prefix = 0
  const maxPrefix = Math.min(oldLines.length, newLines.length)
  while (prefix < maxPrefix && oldLines[prefix] === newLines[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < maxPrefix - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const midOld = oldLines.slice(prefix, oldLines.length - suffix)
  const midNew = newLines.slice(prefix, newLines.length - suffix)

  const lines: PatchLine[] = []
  let oldNo = 1
  let newNo = 1
  for (let i = 0; i < prefix; i += 1) {
    lines.push({ type: 'ctx', text: oldLines[i], no: newNo })
    oldNo += 1
    newNo += 1
  }

  for (const op of diffRegion(midOld, midNew)) {
    if (op.type === 'del') {
      lines.push({ type: 'del', text: op.text, no: oldNo })
      oldNo += 1
    } else if (op.type === 'add') {
      lines.push({ type: 'add', text: op.text, no: newNo })
      newNo += 1
    } else {
      lines.push({ type: 'ctx', text: op.text, no: newNo })
      oldNo += 1
      newNo += 1
    }
  }

  for (let i = 0; i < suffix; i += 1) {
    lines.push({ type: 'ctx', text: newLines[newLines.length - suffix + i], no: newNo })
    oldNo += 1
    newNo += 1
  }
  return lines
}

interface RegionOp {
  type: 'add' | 'del' | 'ctx'
  text: string
}

/**
 * LCS over the trimmed region, or a straight replacement when the table would
 * be too big to be worth building.
 */
function diffRegion(oldLines: string[], newLines: string[]): RegionOp[] {
  if (oldLines.length === 0 && newLines.length === 0) return []
  if (oldLines.length === 0) return newLines.map((text) => ({ type: 'add' as const, text }))
  if (newLines.length === 0) return oldLines.map((text) => ({ type: 'del' as const, text }))
  if (oldLines.length * newLines.length > MAX_LCS_CELLS) {
    return [
      ...oldLines.map((text) => ({ type: 'del' as const, text })),
      ...newLines.map((text) => ({ type: 'add' as const, text }))
    ]
  }

  const rows = oldLines.length + 1
  const cols = newLines.length + 1
  const table = new Uint32Array(rows * cols)
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        oldLines[i] === newLines[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)])
    }
  }

  const ops: RegionOp[] = []
  let i = 0
  let j = 0
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: 'ctx', text: oldLines[i] })
      i += 1
      j += 1
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      ops.push({ type: 'del', text: oldLines[i] })
      i += 1
    } else {
      ops.push({ type: 'add', text: newLines[j] })
      j += 1
    }
  }
  while (i < oldLines.length) {
    ops.push({ type: 'del', text: oldLines[i] })
    i += 1
  }
  while (j < newLines.length) {
    ops.push({ type: 'add', text: newLines[j] })
    j += 1
  }
  return ops
}

/**
 * Groups changed lines into hunks with `context` lines on each side, splitting
 * whenever the untouched gap between two changes is wide enough that joining
 * them would ship a page of unrelated code.
 */
export function toHunks(lines: PatchLine[], context: number): PatchHunk[] {
  const changed: number[] = []
  for (let i = 0; i < lines.length; i += 1) if (lines[i].type !== 'ctx') changed.push(i)
  if (changed.length === 0) return []

  const ranges: Array<[number, number]> = []
  let start = Math.max(0, changed[0] - context)
  let end = Math.min(lines.length - 1, changed[0] + context)
  for (const index of changed.slice(1)) {
    if (index - context <= end + 1) {
      end = Math.min(lines.length - 1, index + context)
    } else {
      ranges.push([start, end])
      start = Math.max(0, index - context)
      end = Math.min(lines.length - 1, index + context)
    }
  }
  ranges.push([start, end])

  return ranges.map(([from, to]) => ({ lines: lines.slice(from, to + 1) }))
}

/** Applies the transport cap, reporting how many lines were dropped. */
function capHunks(hunks: PatchHunk[], max: number): { hunks: PatchHunk[]; truncated: number } {
  let total = 0
  for (const hunk of hunks) total += hunk.lines.length
  if (total <= max) return { hunks, truncated: 0 }

  const capped: PatchHunk[] = []
  let budget = max
  for (const hunk of hunks) {
    if (budget <= 0) break
    capped.push({ lines: hunk.lines.slice(0, budget) })
    budget -= Math.min(budget, hunk.lines.length)
  }
  return { hunks: capped, truncated: total - max }
}

/**
 * The word-level pass — what turns *removidos/adicionados* into *alterados*.
 *
 * Inside a hunk, a run of removed lines immediately followed by a run of added
 * ones is almost always the same lines rewritten, so they are paired by
 * position and compared word by word. Only close-enough pairs get spans: a
 * genuinely different line highlighted against an unrelated one lights up
 * every shared bracket and comma, which is worse than no highlight at all.
 */
function markChangedWords(hunk: PatchHunk): void {
  const lines = hunk.lines
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== 'del') {
      i += 1
      continue
    }
    let delEnd = i
    while (delEnd < lines.length && lines[delEnd].type === 'del') delEnd += 1
    let addEnd = delEnd
    while (addEnd < lines.length && lines[addEnd].type === 'add') addEnd += 1

    const pairs = Math.min(delEnd - i, addEnd - delEnd)
    for (let k = 0; k < pairs; k += 1) {
      const removed = lines[i + k]
      const added = lines[delEnd + k]
      if (similarity(removed.text, added.text) < MIN_PAIR_SIMILARITY) continue
      const [before, after] = diffWords(removed.text, added.text)
      if (before !== null && after !== null) {
        removed.spans = before
        added.spans = after
      }
    }
    i = addEnd > delEnd ? addEnd : delEnd
  }
}

/**
 * A cheap "are these the same line, edited?" score: shared **tokens** over the
 * longer token count, whitespace excluded.
 *
 * Deliberately not a real edit distance, and deliberately not per-character.
 * Character overlap is the obvious cheap metric and it is the wrong one — two
 * unrelated lines of the same language share their spaces and their vowels, so
 * `import { readFileSync } from "fs"` scored 0.39 against
 * `export const MAX = 12` and got the full word-mark treatment: nearly every
 * token lit up, which is confetti, not a diff. At the token grain that same
 * pair shares nothing and scores 0, while `const a = 1` / `const a = 2` still
 * scores 0.83.
 */
export function similarity(a: string, b: string): number {
  const left = words(a)
  const right = words(b)
  const longest = Math.max(left.length, right.length)
  if (longest === 0) return 1
  const counts = new Map<string, number>()
  for (const token of left) counts.set(token, (counts.get(token) ?? 0) + 1)
  let shared = 0
  for (const token of right) {
    const remaining = counts.get(token) ?? 0
    if (remaining > 0) {
      shared += 1
      counts.set(token, remaining - 1)
    }
  }
  return shared / longest
}

/** The line's non-whitespace tokens, at the same grain the word diff compares at. */
function words(text: string): string[] {
  return (text.match(WORD_PATTERN) ?? []).filter((token) => token.trim() !== '')
}

/** Words, whitespace runs and single punctuation marks — the grain a reader compares at. */
const WORD_PATTERN = /\s+|[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu

/**
 * Token-level LCS between two lines. Returns the spans for each side, or
 * `[null, null]` when the lines are too long to be worth the table (a minified
 * bundle line is not something a word highlight helps anyone read).
 */
export function diffWords(a: string, b: string): [PatchSpan[] | null, PatchSpan[] | null] {
  const left = a.match(WORD_PATTERN) ?? []
  const right = b.match(WORD_PATTERN) ?? []
  if (left.length > MAX_WORD_TOKENS || right.length > MAX_WORD_TOKENS) return [null, null]

  const cols = right.length + 1
  const table = new Uint32Array((left.length + 1) * cols)
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        left[i] === right[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)])
    }
  }

  const before: PatchSpan[] = []
  const after: PatchSpan[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      push(before, left[i], false)
      push(after, right[j], false)
      i += 1
      j += 1
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      push(before, left[i], true)
      i += 1
    } else {
      push(after, right[j], true)
      j += 1
    }
  }
  while (i < left.length) {
    push(before, left[i], true)
    i += 1
  }
  while (j < right.length) {
    push(after, right[j], true)
    j += 1
  }
  return [before, after]
}

/** Appends a token, merging into the previous span when it carries the same flag. */
function push(spans: PatchSpan[], text: string, changed: boolean): void {
  const last = spans[spans.length - 1]
  if (last && last.changed === changed) last.text += text
  else spans.push({ text, changed })
}

/**
 * Splits into lines without inventing a trailing empty one: a file ending in
 * `\n` has as many lines as it has non-empty entries, and the phantom would
 * show up in the diff as a spurious added blank.
 */
function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

function stringAt(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' ? value : undefined
}
