/**
 * Pure git-status helpers + the shared status→color vocabulary
 * (git-management M10, design.md §5.3/§7). Types are derived from the global
 * `window.hive.git` bridge surface (declared in preload/index.d.ts) rather
 * than imported across the main/renderer boundary — the codebase's convention
 * (Chat.tsx mirrors main types the same way). Kept pure so grouping, glyphs,
 * decorations and colors are unit-testable without a store or the DOM.
 */

/** Full parsed status (branch, ahead/behind, changes). */
export type GitStatus = Awaited<ReturnType<Window['hive']['git']['status']>>
/** One changed path. */
export type GitFileChange = GitStatus['changes'][number]
/** Parsed branch list. */
export type GitBranches = Awaited<ReturnType<Window['hive']['git']['branches']>>
/** One branch. */
export type GitBranch = GitBranches['branches'][number]
/** One commit record. */
export type GitCommit = Awaited<ReturnType<Window['hive']['git']['log']>>[number]
/** A parsed unified diff. */
export type GitDiff = Awaited<ReturnType<Window['hive']['git']['diff']>>
/** One diff hunk. */
export type GitDiffHunk = GitDiff['hunks'][number]
/** One diff line. */
export type GitDiffLine = GitDiffHunk['lines'][number]
/** One stash entry. */
export type GitStash = Awaited<ReturnType<Window['hive']['git']['stashList']>>[number]
/** One conflicted path. */
export type GitConflict = Awaited<ReturnType<Window['hive']['git']['conflicts']>>[number]
/** A commit's files + patch. */
export type GitCommitDiff = Awaited<ReturnType<Window['hive']['git']['commitDiff']>>
/** Which side of a working change a diff shows. */
export type GitDiffSide = 'working' | 'staged'

/** The semantic state a change is in — colored consistently everywhere (design.md §7). */
export type GitStatusKind =
  'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict' | 'ignored'

/** A tree/row decoration derived from a change (design.md §6.3). */
export interface GitDecoration {
  kind: GitStatusKind
  /** Single-letter glyph shown on the row (M/A/D/R/U/C/!). */
  letter: string
  /** The change has a staged (index) side — badge filled vs outline. */
  staged: boolean
  conflict: boolean
}

/** The change list split into its three VS Code groups (GIT-R2). */
export interface GitGroups {
  conflicts: GitFileChange[]
  staged: GitFileChange[]
  unstaged: GitFileChange[]
}

/** The effective single-char code for a change (worktree side wins, else index). */
function effectiveCode(change: GitFileChange): string {
  return change.worktree !== '.' ? change.worktree : change.index
}

/** The semantic state of a change (design.md §7 color table). */
export function statusKind(change: GitFileChange): GitStatusKind {
  if (change.isConflict) return 'conflict'
  if (change.isUntracked) return 'untracked'
  if (change.isIgnored) return 'ignored'
  switch (effectiveCode(change)) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
    case 'C':
      return 'renamed'
    default:
      return 'modified'
  }
}

/** The single-letter glyph for a change (M/A/D/R/U/C/!). */
export function statusLetter(change: GitFileChange): string {
  if (change.isConflict) return 'C'
  if (change.isUntracked) return 'U'
  if (change.isIgnored) return '!'
  return effectiveCode(change)
}

/** Maps a git state to its shared role-token CSS variable (both themes for free, §7). */
const KIND_VAR: Record<GitStatusKind, string> = {
  modified: '--wb-git-modified',
  added: '--wb-git-added',
  deleted: '--wb-git-deleted',
  renamed: '--wb-git-renamed',
  untracked: '--wb-git-added',
  conflict: '--wb-git-conflict',
  ignored: '--wb-git-ignored'
}

/** The CSS color for a git state — one vocabulary for change list, diff, decorations. */
export function gitStatusColor(kind: GitStatusKind): string {
  return `var(${KIND_VAR[kind]})`
}

/**
 * Splits a status into Merge / Staged / Changes groups (GIT-R2). A file that is
 * both staged and further edited (`AM`/`RM`) appears in **both** Staged and
 * Changes with its correct per-side code (GIT-R2.6). Ignored files are dropped.
 */
export function groupChanges(status: GitStatus | null): GitGroups {
  const groups: GitGroups = { conflicts: [], staged: [], unstaged: [] }
  if (!status) return groups
  for (const change of status.changes) {
    if (change.isIgnored) continue
    if (change.isConflict) {
      groups.conflicts.push(change)
      continue
    }
    if (change.isUntracked) {
      groups.unstaged.push(change)
      continue
    }
    if (change.index !== '.') groups.staged.push(change)
    if (change.worktree !== '.') groups.unstaged.push(change)
  }
  return groups
}

/** Total change count for the rail badge / status bar (conflicts + staged + unstaged rows). */
export function changeCount(status: GitStatus | null): number {
  const { conflicts, staged, unstaged } = groupChanges(status)
  return conflicts.length + staged.length + unstaged.length
}

/** A single side-by-side diff row: a deletion/context on the left, an addition/context on the right. */
export interface SplitRow {
  left: GitDiffLine | null
  right: GitDiffLine | null
}

/**
 * Aligns a hunk's lines into two columns for the side-by-side diff (§6.1):
 * consecutive deletions pair with the additions that follow them
 * (row i = del[i] | add[i]); context lines sit on both sides. Pure so the
 * alignment is unit-testable without the DOM.
 */
export function toSplitRows(lines: GitDiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let dels: GitDiffLine[] = []
  let adds: GitDiffLine[] = []

  const flush = (): void => {
    const n = Math.max(dels.length, adds.length)
    for (let i = 0; i < n; i++) {
      rows.push({ left: dels[i] ?? null, right: adds[i] ?? null })
    }
    dels = []
    adds = []
  }

  for (const line of lines) {
    if (line.type === 'del') dels.push(line)
    else if (line.type === 'add') adds.push(line)
    else {
      flush()
      rows.push({ left: line, right: line })
    }
  }
  flush()
  return rows
}

/**
 * The stable per-file hunk key, matching main's `gitParse.hunkId` exactly
 * (`index:oldStart:newStart`) so the renderer and main agree on which hunk a
 * per-hunk accept/reject targets (Agent Change Review, ACR-R3.1). Kept here
 * next to the diff-derived types the review surfaces already import.
 */
export function hunkKey(hunk: GitDiffHunk, index: number): string {
  return `${index}:${hunk.oldStart}:${hunk.newStart}`
}

/**
 * The set of folder paths that have at least one changed (non-ignored)
 * descendant — the explorer's folder rollup dot (design.md §6.3). Walks each
 * decorated path up to the root, collecting every ancestor directory.
 */
export function rollupChangedFolders(decorations: Map<string, GitDecoration>): Set<string> {
  const folders = new Set<string>()
  for (const [path, decoration] of decorations) {
    if (decoration.kind === 'ignored') continue
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'))
    }
  }
  return folders
}

/** Builds the path→decoration map the explorer tree consumes (design.md §6.3). */
export function buildDecorations(status: GitStatus | null): Map<string, GitDecoration> {
  const map = new Map<string, GitDecoration>()
  if (!status) return map
  for (const change of status.changes) {
    map.set(change.path, {
      kind: statusKind(change),
      letter: statusLetter(change),
      staged: change.index !== '.' && !change.isUntracked && !change.isIgnored,
      conflict: change.isConflict
    })
  }
  return map
}
