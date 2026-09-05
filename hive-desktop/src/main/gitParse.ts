/**
 * Pure parsers for git's machine-readable porcelain output (git-management,
 * design.md §2/§3.2). Split out from `gitService.ts` so every format-parsing
 * branch is unit-testable against captured real-git fixtures **without** a
 * `ProcessRunner` — no spawning, no temp repos, fully deterministic (T3,
 * design.md §10). `gitService.ts` re-exports these types so preload/renderer
 * import them from one place.
 *
 * All formats are chosen for parseability, never scraped from human output:
 * `status --porcelain=v2 --branch -z --untracked-files=all`,
 * `log --pretty=format:'…' -z`,
 * `for-each-ref --format='…%1f…'`, `stash list --format`, `diff --numstat -z`,
 * and unified `diff`. The `\x1f` (unit separator) and `\0` (NUL) delimiters
 * can't occur inside paths/subjects, so splitting on them is safe where a
 * space- or newline-split would break on paths/messages containing them.
 */

/** Unit separator (`%x1f` / `%1f`) — the in-record field delimiter for log/branch/stash formats. */
const US = '\x1f'

/** One changed path in the working tree / index (porcelain v2 entry). */
export interface GitFileChange {
  /** Workspace-relative POSIX path (git prints `/` with `core.quotepath=false`). */
  path: string
  /** Original path for a rename/copy (porcelain v2 `2` record's second field). */
  origPath?: string
  /** Staged-side (index) status char: `M A D R C T . ? !` (`.` = unmodified). */
  index: string
  /** Unstaged-side (worktree) status char, same alphabet. */
  worktree: string
  /** An unmerged (`u`) entry — needs conflict resolution. */
  isConflict: boolean
  /** An untracked (`?`) entry. */
  isUntracked: boolean
  /** An ignored (`!`) entry (only present when status is asked for `--ignored`). */
  isIgnored: boolean
}

/** Parsed `status --porcelain=v2 --branch -z` (design.md §3.2). */
export interface GitStatus {
  /** Current branch name, or `null` when HEAD is detached. */
  branch: string | null
  detached: boolean
  /** HEAD commit oid, or `null` on an unborn branch (fresh repo, no commits). */
  oid: string | null
  /** Upstream ref (e.g. `origin/main`), or `null` when the branch has none. */
  upstream: string | null
  /** Commits the local branch is ahead of its upstream. */
  ahead: number
  /** Commits behind its upstream. */
  behind: number
  /** Every changed/untracked/unmerged entry, in git's own order. */
  changes: GitFileChange[]
  /** A merge is in progress (MERGE_HEAD present) — set by the service, not the porcelain parser (GIT-R9.3). */
  mergeInProgress?: boolean
  /** Parsing stopped at the entry cap — `changes` is a prefix of the real list (see `parseStatusV2`'s `limit`). */
  truncated?: boolean
}

/** One commit record from `log --pretty=format:'%H%x1f%h%x1f%an%x1f%aI%x1f%s' -z`. */
export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  /** ISO-8601 author date (`%aI`). */
  date: string
  subject: string
}

/** One branch from `for-each-ref` over `refs/heads` + `refs/remotes`. */
export interface GitBranch {
  /** Short name (`main`, `origin/main`, `feature/x`). */
  name: string
  /** Short object id. */
  oid: string
  /** Short upstream ref, or `null`. */
  upstream: string | null
  isRemote: boolean
  /** `true` for the checked-out branch (the `%(HEAD)` `*` marker). */
  isHead: boolean
  ahead: number
  behind: number
  /** Upstream is gone (`[gone]`). */
  gone: boolean
}

/** Parsed branch list + the resolved current branch name. */
export interface GitBranches {
  branches: GitBranch[]
  current: string | null
}

/** One stash entry from `stash list --format='%gd%x1f%s'`. */
export interface GitStash {
  index: number
  /** The `stash@{N}` ref. */
  ref: string
  message: string
}

/** One `diff --numstat -z` record. `added`/`deleted` are `null` for a binary file. */
export interface GitNumstatEntry {
  added: number | null
  deleted: number | null
  path: string
  origPath?: string
  binary: boolean
}

/** One rendered diff line (unified). Line numbers are `null` on the side the line doesn't exist. */
export interface GitDiffLine {
  type: 'add' | 'del' | 'ctx'
  oldNo: number | null
  newNo: number | null
  text: string
}

/** One `@@ … @@` hunk. */
export interface GitDiffHunk {
  header: string
  oldStart: number
  newStart: number
  lines: GitDiffLine[]
}

/** A parsed unified diff (design.md §6.1 `DiffView` input). */
export interface GitDiff {
  hunks: GitDiffHunk[]
  binary: boolean
  /** Set (with empty `hunks`) when the diff was capped rather than parsed (large generated file). */
  tooLarge?: boolean
}

/** Builds a `GitFileChange` from a two-char XY code and optional flags. */
function makeChange(
  path: string,
  index: string,
  worktree: string,
  extra?: { origPath?: string; conflict?: boolean; untracked?: boolean; ignored?: boolean }
): GitFileChange {
  return {
    path,
    origPath: extra?.origPath,
    index,
    worktree,
    isConflict: extra?.conflict ?? false,
    isUntracked: extra?.untracked ?? false,
    isIgnored: extra?.ignored ?? false
  }
}

/** Applies a `# branch.*` porcelain-v2 header line to the status accumulator. */
function applyBranchHeader(rest: string, status: GitStatus): void {
  if (rest.startsWith('branch.oid ')) {
    const oid = rest.slice('branch.oid '.length)
    status.oid = oid === '(initial)' ? null : oid
  } else if (rest.startsWith('branch.head ')) {
    const head = rest.slice('branch.head '.length)
    if (head === '(detached)') status.detached = true
    else status.branch = head
  } else if (rest.startsWith('branch.upstream ')) {
    status.upstream = rest.slice('branch.upstream '.length) || null
  } else if (rest.startsWith('branch.ab ')) {
    const m = rest.slice('branch.ab '.length).match(/^\+(-?\d+) -(-?\d+)$/)
    if (m) {
      status.ahead = parseInt(m[1], 10)
      status.behind = parseInt(m[2], 10)
    }
  }
}

/**
 * Parses `git status --porcelain=v2 --branch -z --untracked-files=all`. Records
 * are NUL-separated; a rename (`2`) record is immediately followed by its
 * original path as the next NUL field, so the loop consumes two fields for it.
 * Path fields can contain spaces, so paths are taken as everything after the
 * fixed leading space-delimited tokens (8 for `1`, 9 for `2`, 10 for `u`)
 * rather than by a naive last-token split.
 *
 * Untracked entries are per **file** — the caller must pass
 * `--untracked-files=all`, otherwise git collapses a whole untracked directory
 * into one `? dir/` record and the change list shows the folder instead of the
 * files inside it. `opts.limit` caps how many entries are kept (branch headers
 * always survive, since porcelain v2 prints them first); hitting it sets
 * `truncated` so the UI can say the list is a prefix rather than silently
 * lying about the repo's size.
 */
export function parseStatusV2(output: string, opts?: { limit?: number }): GitStatus {
  const fields = output.split('\0')
  const status: GitStatus = {
    branch: null,
    detached: false,
    oid: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    changes: []
  }

  const limit = opts?.limit ?? Infinity

  for (let i = 0; i < fields.length; i++) {
    const line = fields[i]
    if (line === '') continue

    if (line.startsWith('# ')) {
      applyBranchHeader(line.slice(2), status)
      continue
    }

    if (status.changes.length >= limit) {
      status.truncated = true
      break
    }

    const type = line[0]
    if (type === '1') {
      const tokens = line.split(' ')
      const xy = tokens[1]
      const path = tokens.slice(8).join(' ')
      status.changes.push(makeChange(path, xy[0], xy[1]))
    } else if (type === '2') {
      const tokens = line.split(' ')
      const xy = tokens[1]
      const path = tokens.slice(9).join(' ')
      const origPath = fields[++i]
      status.changes.push(makeChange(path, xy[0], xy[1], { origPath }))
    } else if (type === 'u') {
      const tokens = line.split(' ')
      const xy = tokens[1]
      const path = tokens.slice(10).join(' ')
      status.changes.push(makeChange(path, xy[0], xy[1], { conflict: true }))
    } else if (type === '?') {
      status.changes.push(makeChange(line.slice(2), '?', '?', { untracked: true }))
    } else if (type === '!') {
      status.changes.push(makeChange(line.slice(2), '!', '!', { ignored: true }))
    }
  }

  return status
}

/** Parses `log --pretty=format:'%H%x1f%h%x1f%an%x1f%aI%x1f%s' -z` (NUL-separated records). */
export function parseLog(output: string): GitCommit[] {
  return output
    .split('\0')
    .filter((record) => record !== '')
    .map((record) => {
      const [hash, shortHash, author, date, subject] = record.split(US)
      return { hash, shortHash, author, date, subject: subject ?? '' }
    })
}

/** Parses a `for-each-ref` `upstream:track` value (`[ahead 2]`, `[behind 3]`, `[ahead 2, behind 3]`, `[gone]`, ``). */
function parseTrack(track: string): { ahead: number; behind: number; gone: boolean } {
  if (track === '[gone]') return { ahead: 0, behind: 0, gone: true }
  const ahead = track.match(/ahead (\d+)/)
  const behind = track.match(/behind (\d+)/)
  return {
    ahead: ahead ? parseInt(ahead[1], 10) : 0,
    behind: behind ? parseInt(behind[1], 10) : 0,
    gone: false
  }
}

/**
 * Parses `for-each-ref --format='%(refname)%1f%(objectname:short)%1f%(upstream:short)%1f%(upstream:track)%1f%(HEAD)'`
 * over `refs/heads` (+ `refs/remotes`). One ref per line, `\x1f`-delimited fields.
 */
export function parseBranches(output: string): GitBranches {
  const branches: GitBranch[] = []
  let current: string | null = null

  for (const line of output.split('\n')) {
    if (line === '') continue
    const [refname, oid, upstream, track, head] = line.split(US)
    const isRemote = refname.startsWith('refs/remotes/')
    const name = refname.replace(/^refs\/(heads|remotes)\//, '')
    const isHead = head === '*'
    const { ahead, behind, gone } = parseTrack(track ?? '')
    branches.push({ name, oid, upstream: upstream || null, isRemote, isHead, ahead, behind, gone })
    if (isHead) current = name
  }

  return { branches, current }
}

/** Parses `stash list --format='%gd%x1f%s'` — one stash per line, `ref \x1f message`. */
export function parseStashList(output: string): GitStash[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [ref, message] = line.split(US)
      const m = ref.match(/stash@\{(\d+)\}/)
      return { index: m ? parseInt(m[1], 10) : 0, ref, message: message ?? '' }
    })
}

/**
 * Parses `diff --numstat -z`. Each record is `added \t deleted \t path` then a
 * NUL; a **rename** has an empty path field and its original + new paths as the
 * two following NUL fields; a **binary** file reports `-` for both counts.
 */
export function parseNumstat(output: string): GitNumstatEntry[] {
  const fields = output.split('\0')
  const entries: GitNumstatEntry[] = []

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (field === '') continue
    const m = field.match(/^(-|\d+)\t(-|\d+)\t(.*)$/)
    if (!m) continue
    const [, addStr, delStr, path] = m
    const binary = addStr === '-'
    const added = binary ? null : parseInt(addStr, 10)
    const deleted = binary ? null : parseInt(delStr, 10)
    if (path === '') {
      // Rename/copy: the original + new paths follow as two NUL fields.
      const origPath = fields[++i]
      const newPath = fields[++i]
      entries.push({ added, deleted, path: newPath, origPath, binary })
    } else {
      entries.push({ added, deleted, path, binary })
    }
  }

  return entries
}

/**
 * Parses a unified `git diff` into hunks of typed lines with old/new line
 * numbers. File-header lines (`diff --git`, `index`, `---`, `+++`) before the
 * first `@@` are skipped; a binary diff sets `binary` (no hunks). Pass
 * `opts.tooLarge` to short-circuit an over-cap diff into a `tooLarge` marker
 * without walking it (design.md §6.1 large-diff late-load).
 */
export function parseDiff(output: string, opts?: { tooLarge?: boolean }): GitDiff {
  if (opts?.tooLarge) return { hunks: [], binary: false, tooLarge: true }

  const hunks: GitDiffHunk[] = []
  let current: GitDiffHunk | null = null
  let oldNo = 0
  let newNo = 0
  let binary = false

  for (const line of output.split('\n')) {
    if (line === '') continue // trailing split element / never a real context line (those are ' ')
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      binary = true
      continue
    }
    if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) {
        oldNo = parseInt(m[1], 10)
        newNo = parseInt(m[2], 10)
        current = { header: line, oldStart: oldNo, newStart: newNo, lines: [] }
        hunks.push(current)
      }
      continue
    }
    if (!current) continue // file headers before the first hunk
    if (line.startsWith('\\')) continue // "\ No newline at end of file"
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', oldNo: null, newNo: newNo++, text: line.slice(1) })
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'del', oldNo: oldNo++, newNo: null, text: line.slice(1) })
    } else {
      current.lines.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: line.slice(1) })
    }
  }

  return { hunks, binary }
}

/**
 * A stable, per-file key for one hunk (Agent Change Review, design.md §5, T3).
 * Derived from the hunk's position (`index`) plus its old/new start lines, so
 * main and renderer agree on which hunk a per-hunk accept/reject targets
 * (ACR-R3.1) without shipping object identity across the IPC boundary. Two
 * hunks in the same file can't share an old *and* new start, so this is unique
 * within a file; the leading index keeps it stable/ordered even if two hunks
 * somehow collided on both starts.
 */
export function hunkId(hunk: GitDiffHunk, index: number): string {
  return `${index}:${hunk.oldStart}:${hunk.newStart}`
}

/** Finds the hunk in `diff` whose `hunkId(...)` equals `id`, or `null`. */
export function findHunk(diff: GitDiff, id: string): GitDiffHunk | null {
  const index = diff.hunks.findIndex((h, i) => hunkId(h, i) === id)
  return index === -1 ? null : diff.hunks[index]
}

/**
 * Reconstructs a minimal, `git apply`-able unified patch for **one** hunk
 * (Agent Change Review, design.md §2/§5, T3) — the patch-math primitive behind
 * per-hunk accept/reject (ACR-R3.1). The body is rebuilt from the parsed typed
 * lines (` `/`-`/`+` prefixes) and the `@@` header is recomputed from the
 * actual line counts so it's self-consistent even if the original header
 * carried a section-heading suffix. `path` supplies the `---`/`+++` file
 * headers (a `GitDiff` doesn't record its own path — the file headers are
 * skipped during parsing).
 *
 * Applying this patch onto the pre-image reproduces the post-image; `-R`
 * reverse-applies it (the reject direction). Every hunk here carries real
 * context lines (git's default 3), so it applies unambiguously against the
 * full current file even when other hunks remain.
 */
export function buildHunkPatch(path: string, hunk: GitDiffHunk): string {
  let oldCount = 0
  let newCount = 0
  const body: string[] = []
  for (const line of hunk.lines) {
    if (line.type === 'ctx') {
      body.push(` ${line.text}`)
      oldCount++
      newCount++
    } else if (line.type === 'del') {
      body.push(`-${line.text}`)
      oldCount++
    } else {
      body.push(`+${line.text}`)
      newCount++
    }
  }
  const header = `@@ -${formatRange(hunk.oldStart, oldCount)} +${formatRange(hunk.newStart, newCount)} @@`
  return [`--- a/${path}`, `+++ b/${path}`, header, ...body, ''].join('\n')
}

/** Formats a unified-diff range: `start` when the count is 1, else `start,count` (git's own convention). */
function formatRange(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`
}
