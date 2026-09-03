/**
 * Turning the file paths an agent *says* into files you can open.
 *
 * ## The gap this closes
 *
 * An agent's reply is full of paths — "criei `src/main/foo.ts`", "ajustei o
 * teste em src/main/foo.test.ts:42" — and every one of them was dead text.
 * The user's report: the editor is right there, the agent just named the file,
 * and the only way to reach it is to read the path, remember it, and go hunt
 * for it in the tree. Cursor, Copilot and Claude Desktop all make that name a
 * link; Hive did not.
 *
 * ## The rule: a path is a link only when the file exists
 *
 * Everything here hangs off an **oracle** — the set of workspace-relative
 * POSIX paths that really are on disk. Nothing becomes a link on the strength
 * of *looking* like a path, because the failure modes of guessing are the two
 * worst outcomes available: a link that opens nothing (worse than plain text)
 * and a link on something that was never a path at all (`v1.2.3`, `README` in
 * a sentence, an npm package name). Matching against what exists makes both
 * impossible, and it costs one `Set.has`.
 *
 * Three spellings resolve, because all three are what agents actually write:
 *
 *  - a workspace-relative path (`src/main/foo.ts`, `./src/main/foo.ts`),
 *  - an absolute path inside the workspace (the CLIs report these constantly),
 *  - a **bare filename**, but only when exactly one workspace file has it.
 *    `package.json` is one file and a fine link; `index.ts` is forty and stays
 *    text, because a link that might open the wrong file is not a link.
 *
 * A trailing `:42` / `:42:7` is peeled off before the lookup and kept for the
 * label — that suffix is how every compiler in the world writes a location,
 * and dropping it from the *text* would edit what the agent said.
 *
 * Pure and DOM-free: `Markdown` renders what this decides (see
 * `ui/markdown.tsx`), and `useWorkspaceFiles` keeps the oracle current.
 */

/** Decides whether a path candidate names a real workspace file. */
export interface PathOracle {
  /** Workspace-relative POSIX paths that exist, or `null` for "not loaded yet" (nothing links). */
  has(candidate: string): string | null
}

/** One piece of a text run: prose, or a path the user can open. */
export type PathSegment =
  | { kind: 'text'; text: string }
  | {
      kind: 'path'
      /** Exactly what the agent wrote, including any `:line` — the label. */
      text: string
      /** The workspace-relative POSIX path to open. */
      path: string
      /** The 1-based line the agent pointed at, when it named one. */
      line?: number
    }

/**
 * Candidates in a text run.
 *
 * Deliberately permissive — the oracle is what rejects — but not *unbounded*:
 * the token must contain a dot or a slash, or it would match every word in
 * every sentence and turn the whole reply into lookups. Windows separators are
 * accepted because the CLIs on that platform report them.
 */
const CANDIDATE =
  /[A-Za-z]:[\\/][^\s`'"()[\]{}<>,;]+|[^\s`'"()[\]{}<>,;]*[./\\][^\s`'"()[\]{}<>,;]+/g

/** Trailing punctuation a sentence leaves stuck to a path: `foo.ts.` / `foo.ts),` / `foo.ts:`. */
const TRAILING = /[.,;:!?)\]}'"]+$/

/** `src/a.ts:42:7` → the path and the line. */
const LOCATION = /^(.*?):(\d+)(?::\d+)?$/

/**
 * Splits one text run into prose and openable paths.
 *
 * Returns a single text segment when nothing resolved, so a caller can skip
 * rebuilding a node that did not change — which is most of them.
 */
export function splitFilePaths(text: string, oracle: PathOracle): PathSegment[] {
  const segments: PathSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(CANDIDATE)) {
    const raw = match[0]
    const start = match.index
    // Trailing sentence punctuation belongs to the sentence, not to the path —
    // but only strip what a lookup then justifies.
    const trimmed = raw.replace(TRAILING, '')
    const resolved = resolvePath(trimmed, oracle)
    if (resolved === null) continue
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) })
    segments.push({ kind: 'path', text: trimmed, ...resolved })
    cursor = start + trimmed.length
  }
  if (segments.length === 0) return [{ kind: 'text', text }]
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

/** One candidate → the file it opens plus the line it pointed at, or `null`. */
export function resolvePath(
  candidate: string,
  oracle: PathOracle
): { path: string; line?: number } | null {
  const location = LOCATION.exec(candidate)
  // `C:\Users\…` is a drive letter, not a line number.
  const bare = location && location[1].length > 1 ? location[1] : candidate
  const line = location && location[1].length > 1 ? Number(location[2]) : undefined
  const path = oracle.has(bare)
  if (path === null) return null
  return line === undefined ? { path } : { path, line }
}

/**
 * Builds the oracle over a workspace's file list.
 *
 * The bare-filename index is built once per list rather than searched per
 * candidate: a reply can name a dozen paths and a workspace can hold tens of
 * thousands of files, and a linear scan per candidate is the difference
 * between free and visible.
 */
export function createPathOracle(workspace: string, files: readonly string[]): PathOracle {
  const exact = new Set(files)
  /** basename → the single file with it, or `null` once a second one shows up. */
  const unique = new Map<string, string | null>()
  for (const file of files) {
    const name = file.slice(file.lastIndexOf('/') + 1)
    unique.set(name, unique.has(name) ? null : file)
  }
  const root = normalizeSeparators(workspace).replace(/\/+$/, '')

  return {
    has(candidate: string): string | null {
      const normalized = normalizeSeparators(candidate).replace(/^\.\//, '')
      if (normalized === '') return null
      if (exact.has(normalized)) return normalized
      // An absolute path the CLI reported: only ever inside this workspace.
      if (root !== '' && normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
        const relative = normalized.slice(root.length + 1)
        return exact.has(relative) ? relative : null
      }
      if (normalized.includes('/')) return null
      return unique.get(normalized) ?? null
    }
  }
}

/** Windows separators to POSIX — the only shape the rest of this app addresses files by. */
function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/')
}
