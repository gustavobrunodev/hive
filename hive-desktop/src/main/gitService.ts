import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ProcessRunner, ProcessStreamChunk } from './processRunner'
import {
  parseBranches,
  parseDiff,
  parseLog,
  parseNumstat,
  parseStashList,
  parseStatusV2,
  type GitBranches,
  type GitCommit,
  type GitDiff,
  type GitNumstatEntry,
  type GitStash,
  type GitStatus
} from './gitParse'

// Re-export the parsed data types so preload/renderer import git types from
// one place (mirrors fsService re-exporting documentReader's types).
export type {
  GitStatus,
  GitFileChange,
  GitCommit,
  GitBranch,
  GitBranches,
  GitStash,
  GitNumstatEntry,
  GitDiff,
  GitDiffHunk,
  GitDiffLine
} from './gitParse'

/**
 * Thrown when a git command exits non-zero. `stderr` is preserved verbatim so
 * the renderer can surface git's real message (G3 — truthful, never swallowed;
 * design.md §3.4). `code` is `null` when git never spawned (binary missing —
 * GIT-R1.5). No credentials ever reach `command`/`stderr`: Hive never handles
 * them (D-GIT-1), and git redacts secrets in the remote URLs it prints.
 */
export class GitError extends Error {
  code: number | null
  stderr: string
  command: string

  constructor(code: number | null, stderr: string, command: string) {
    super(stderr.trim() || `git exited with code ${code ?? 'unknown'}`)
    this.name = 'GitError'
    this.code = code
    this.stderr = stderr
    this.command = command
  }
}

/** What `detect` reports about the active workspace (GIT-R1). */
export interface GitDetectResult {
  isRepo: boolean
  /** Absolute repo top-level (git resolves an enclosing repo from `cwd`, GIT-R1.4), or `null`. */
  root: string | null
  /** `true` when the `git` binary itself couldn't be run (GIT-R1.5). */
  gitMissing: boolean
}

export interface GitServiceDeps {
  processRunner: ProcessRunner
  /** Moves an absolute path to the OS trash — injected (main/index.ts passes `shell.trashItem`) so this file stays Electron-free. Used by `discard` for untracked files (never `clean -f`, GIT-R3.3). */
  trashItem: (absolutePath: string) => Promise<void>
}

export interface GitService {
  /** Is `workspace` inside a git work tree? Resolves the enclosing repo root (GIT-R1). */
  detect(workspace: string): Promise<GitDetectResult>
  /** `git init` in `workspace` (GIT-R1.2). Serialized. */
  init(workspace: string): Promise<void>
  /** Parsed `status --porcelain=v2 --branch -z` (GIT-R2). A read — runs directly. */
  status(workspace: string): Promise<GitStatus>
  /** Stages the given paths (`add -- …`, GIT-R3). Serialized. */
  stage(workspace: string, paths: string[]): Promise<void>
  /** Unstages the given paths (`restore --staged -- …`, GIT-R3). Serialized. */
  unstage(workspace: string, paths: string[]): Promise<void>
  /**
   * Discards the given paths (GIT-R3.3): a tracked path is restored to HEAD
   * (`restore --staged --worktree`); an **untracked** path is sent to the OS
   * trash (recoverable), never `clean -f`. Serialized.
   */
  discard(workspace: string, paths: string[]): Promise<void>
  /**
   * Commits (GIT-R5). The message is written to a temp file and passed via
   * `-F` (safe for multi-line/large messages, no stdin dependency). `stageAll`
   * runs `add -A` first ("preparar tudo e commitar"); `amend` amends HEAD.
   * Resolves the new commit hash.
   */
  commit(
    workspace: string,
    message: string,
    opts?: { amend?: boolean; stageAll?: boolean }
  ): Promise<{ hash: string }>
  /** Local + remote branches with current/ahead/behind (GIT-R6). A read. */
  branches(workspace: string): Promise<GitBranches>
  /** `switch -c <name> [from]` — branch from HEAD (or `from`) and check out (GIT-R6.4). */
  createBranch(workspace: string, name: string, from?: string): Promise<void>
  /** `switch <ref>` — git's dirty-tree refusal surfaces as a `GitError` (GIT-R6.3). */
  checkout(workspace: string, ref: string): Promise<void>
  /** `branch -m <from> <to>` (GIT-R6.4). */
  renameBranch(workspace: string, from: string, to: string): Promise<void>
  /** `branch -d` (or `-D` when `force`) (GIT-R6.4). */
  deleteBranch(workspace: string, name: string, force?: boolean): Promise<void>
  /** `fetch` — refresh remote-tracking refs (GIT-R7). */
  fetch(workspace: string): Promise<void>
  /** `pull --ff` — an auth/conflict failure surfaces git's real stderr (GIT-R7, D-GIT-1). */
  pull(workspace: string): Promise<void>
  /** `push`, or `push -u origin <current>` when `setUpstream` ("Publicar branch", GIT-R7.3). */
  push(workspace: string, opts?: { setUpstream?: boolean }): Promise<void>
  /** Sync = pull then push (GIT-R7). */
  sync(workspace: string): Promise<void>
  /** Commit history, newest first; scope to one `file`, page with `skip`/`limit` (GIT-R8). A read. */
  log(
    workspace: string,
    opts?: { file?: string; skip?: number; limit?: number }
  ): Promise<GitCommit[]>
  /** Unified diff of `path` — `working` (worktree vs index) or `staged` (index vs HEAD) (GIT-R4). A read. */
  diff(workspace: string, path: string, side: GitDiffSide): Promise<GitDiff>
  /** A commit's changed files + full patch (GIT-R8.2). A read. */
  commitDiff(workspace: string, hash: string): Promise<GitCommitDiff>
  /** Conflicted paths, derived from status (GIT-R9). A read. */
  conflicts(workspace: string): Promise<GitConflict[]>
  /**
   * Resolves a whole conflicted file and stages it (GIT-R9.2): `current`
   * (`checkout --ours`), `incoming` (`checkout --theirs`), or `both` (strips
   * the conflict markers, keeping both sides).
   */
  resolveConflict(workspace: string, path: string, choice: GitConflictChoice): Promise<void>
  /** `merge --continue` — concludes the merge with the prepared message (GIT-R9.3). */
  mergeContinue(workspace: string): Promise<void>
  /** `merge --abort` — unwinds the in-progress merge (GIT-R9.3). */
  mergeAbort(workspace: string): Promise<void>
  /** `stash push [-u] [-m <message>]` — the tree returns clean (GIT-R10). */
  stash(workspace: string, opts?: { message?: string; untracked?: boolean }): Promise<void>
  /** `stash list --format` (GIT-R10.2). A read. */
  stashList(workspace: string): Promise<GitStash[]>
  /** `stash apply` (or `pop`) `stash@{index}` (GIT-R10.2). */
  stashApply(workspace: string, index: number, pop?: boolean): Promise<void>
  /** `stash drop stash@{index}` (GIT-R10.2). */
  stashDrop(workspace: string, index: number): Promise<void>
}

/** `stash@{N}` ref for a stash index. */
function stashRef(index: number): string {
  return `stash@{${index}}`
}

/** Which side of a working-tree change a diff shows (GIT-R4). */
export type GitDiffSide = 'working' | 'staged'

/** One conflicted path (GIT-R9). The renderer parses the on-disk markers for the block-level UI. */
export interface GitConflict {
  path: string
}

/** How to resolve a whole conflicted file (GIT-R9.2). */
export type GitConflictChoice = 'current' | 'incoming' | 'both'

/** `commitDiff`'s result — a commit's changed files (numstat) + its full patch. */
export interface GitCommitDiff {
  files: GitNumstatEntry[]
  diff: GitDiff
}

/** The for-each-ref format feeding `parseBranches` (refname, short oid, upstream, track, HEAD marker). */
const BRANCH_FORMAT =
  '%(refname)%1f%(objectname:short)%1f%(upstream:short)%1f%(upstream:track)%1f%(HEAD)'

/** The log pretty-format feeding `parseLog` (full hash, short hash, author, ISO date, subject). */
const LOG_FORMAT = '%H%x1f%h%x1f%an%x1f%aI%x1f%s'

/** Cap (bytes) beyond which a diff is reported as `tooLarge` rather than parsed/shipped (GIT-R4 perf). */
const DIFF_CAP_BYTES = 2_000_000

/** Collects a finished process's full stdout/stderr and exit code. */
async function collect(handle: {
  output: AsyncIterable<ProcessStreamChunk>
  exitCode: Promise<{ code: number | null }>
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  let stdout = ''
  let stderr = ''
  for await (const chunk of handle.output) {
    if (chunk.stream === 'stdout') stdout += chunk.data
    else stderr += chunk.data
  }
  const { code } = await handle.exitCode
  return { stdout, stderr, code }
}

/**
 * Creates the `GitService` (design.md §3). Drives the system `git` binary
 * through the injected `ProcessRunner` (Agent's Discretion / D-GIT engine —
 * NOT simple-git/isomorphic-git), so credential-helper/SSH behavior comes free
 * and satisfies D-GIT-1 with zero secret-handling code. Every method takes the
 * workspace root explicitly (no hidden "current repo" state), mirroring
 * `fsService`.
 */
export function createGitService(deps: GitServiceDeps): GitService {
  const { processRunner } = deps

  // Per-repo FIFO queue: every *mutating* op chains onto the previous one for
  // the same root so concurrent invocations can't race the index/`index.lock`
  // (GIT-R14.2). Reads (`status`, `diff`, `log`) skip the queue. The stored
  // promise swallows rejections so one failed op doesn't wedge the chain,
  // while the returned promise still rejects to its own caller.
  const queues = new Map<string, Promise<unknown>>()
  function enqueue<T>(root: string, fn: () => Promise<T>): Promise<T> {
    const prev = queues.get(root) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    queues.set(
      root,
      next.then(
        () => undefined,
        () => undefined
      )
    )
    return next
  }

  /**
   * Runs one git command in `cwd` and returns its stdout, throwing `GitError`
   * on a non-zero exit. `-c core.quotepath=false` keeps non-ASCII paths
   * literal (never octal-escaped); `GIT_TERMINAL_PROMPT=0` makes any op that
   * would prompt for credentials fail fast instead of hanging, so the renderer
   * can show git's real error (D-GIT-1).
   */
  async function git(args: string[], opts: { cwd: string }): Promise<string> {
    const handle = processRunner.run('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: opts.cwd,
      // GIT_TERMINAL_PROMPT=0 → fail fast instead of hanging on a credential
      // prompt (D-GIT-1). GIT_EDITOR=true → merge --continue / any commit that
      // would open an editor concludes non-interactively with the prepared
      // message rather than hanging on a tty we don't have.
      env: { GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' }
    })
    const { stdout, stderr, code } = await collect(handle)
    if (code !== 0) {
      throw new GitError(code, stderr, `git ${args.join(' ')}`)
    }
    return stdout
  }

  async function detect(workspace: string): Promise<GitDetectResult> {
    try {
      const inside = (await git(['rev-parse', '--is-inside-work-tree'], { cwd: workspace })).trim()
      if (inside !== 'true') return { isRepo: false, root: null, gitMissing: false }
      const root = (await git(['rev-parse', '--show-toplevel'], { cwd: workspace })).trim()
      return { isRepo: true, root, gitMissing: false }
    } catch (err) {
      // `code === null` means git never spawned (binary missing) — a distinct,
      // teachable state (GIT-R1.5), not merely "not a repo".
      const gitMissing = err instanceof GitError && err.code === null
      return { isRepo: false, root: null, gitMissing }
    }
  }

  function init(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['init'], { cwd: workspace })
    })
  }

  async function status(workspace: string): Promise<GitStatus> {
    const out = await git(['status', '--porcelain=v2', '--branch', '-z'], { cwd: workspace })
    const parsed = parseStatusV2(out)
    // MERGE_HEAD present ⇒ a merge is mid-flight (needs continue/abort, GIT-R9.3).
    // `rev-parse --verify` exits non-zero when the ref is absent → GitError → false.
    try {
      await git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { cwd: workspace })
      parsed.mergeInProgress = true
    } catch {
      parsed.mergeInProgress = false
    }
    return parsed
  }

  function stage(workspace: string, paths: string[]): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['add', '--', ...paths], { cwd: workspace })
    })
  }

  function unstage(workspace: string, paths: string[]): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['restore', '--staged', '--', ...paths], { cwd: workspace })
    })
  }

  function discard(workspace: string, paths: string[]): Promise<void> {
    return enqueue(workspace, async () => {
      // Classify the requested paths so untracked files go to the trash (never
      // hard-deleted) while tracked files are reverted to HEAD (GIT-R3.3).
      const out = await git(['status', '--porcelain=v2', '-z', '--', ...paths], { cwd: workspace })
      const untracked = new Set(
        parseStatusV2(out)
          .changes.filter((c) => c.isUntracked)
          .map((c) => c.path)
      )
      for (const path of paths) {
        if (untracked.has(path)) await deps.trashItem(join(workspace, path))
      }
      const tracked = paths.filter((path) => !untracked.has(path))
      if (tracked.length > 0) {
        await git(['restore', '--staged', '--worktree', '--', ...tracked], { cwd: workspace })
      }
    })
  }

  function commit(
    workspace: string,
    message: string,
    opts?: { amend?: boolean; stageAll?: boolean }
  ): Promise<{ hash: string }> {
    return enqueue(workspace, async () => {
      if (opts?.stageAll) {
        await git(['add', '-A'], { cwd: workspace })
      }
      const messageFile = join(
        tmpdir(),
        `hive-commit-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
      )
      writeFileSync(messageFile, message)
      try {
        const args = ['commit', '-F', messageFile]
        if (opts?.amend) args.push('--amend')
        await git(args, { cwd: workspace })
      } finally {
        try {
          unlinkSync(messageFile)
        } catch {
          // best-effort temp cleanup
        }
      }
      const hash = (await git(['rev-parse', 'HEAD'], { cwd: workspace })).trim()
      return { hash }
    })
  }

  async function branches(workspace: string): Promise<GitBranches> {
    const out = await git(
      ['for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/heads', 'refs/remotes'],
      { cwd: workspace }
    )
    return parseBranches(out)
  }

  function createBranch(workspace: string, name: string, from?: string): Promise<void> {
    return enqueue(workspace, async () => {
      const args = ['switch', '-c', name]
      if (from) args.push(from)
      await git(args, { cwd: workspace })
    })
  }

  function checkout(workspace: string, ref: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['switch', ref], { cwd: workspace })
    })
  }

  function renameBranch(workspace: string, from: string, to: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['branch', '-m', from, to], { cwd: workspace })
    })
  }

  function deleteBranch(workspace: string, name: string, force?: boolean): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['branch', force ? '-D' : '-d', name], { cwd: workspace })
    })
  }

  function fetch(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['fetch'], { cwd: workspace })
    })
  }

  function pull(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['pull', '--ff'], { cwd: workspace })
    })
  }

  function push(workspace: string, opts?: { setUpstream?: boolean }): Promise<void> {
    return enqueue(workspace, async () => {
      if (opts?.setUpstream) {
        const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspace })).trim()
        await git(['push', '-u', 'origin', branch], { cwd: workspace })
      } else {
        await git(['push'], { cwd: workspace })
      }
    })
  }

  function sync(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['pull', '--ff'], { cwd: workspace })
      await git(['push'], { cwd: workspace })
    })
  }

  async function log(
    workspace: string,
    opts?: { file?: string; skip?: number; limit?: number }
  ): Promise<GitCommit[]> {
    const args = ['log', `--pretty=format:${LOG_FORMAT}`, '-z']
    if (opts?.skip) args.push(`--skip=${opts.skip}`)
    if (opts?.limit) args.push(`-n`, String(opts.limit))
    if (opts?.file) args.push('--', opts.file)
    const out = await git(args, { cwd: workspace })
    return parseLog(out)
  }

  async function diff(workspace: string, path: string, side: GitDiffSide): Promise<GitDiff> {
    const args = ['diff']
    if (side === 'staged') args.push('--staged')
    args.push('--', path)
    const out = await git(args, { cwd: workspace })
    if (out.length > DIFF_CAP_BYTES) return parseDiff('', { tooLarge: true })
    return parseDiff(out)
  }

  async function commitDiff(workspace: string, hash: string): Promise<GitCommitDiff> {
    // `--format=` suppresses the commit header so `show` yields only the
    // numstat / patch body the parsers expect.
    const numstat = await git(['show', hash, '--numstat', '--format=', '-z'], { cwd: workspace })
    const patch = await git(['show', hash, '--format='], { cwd: workspace })
    const parsedDiff =
      patch.length > DIFF_CAP_BYTES ? parseDiff('', { tooLarge: true }) : parseDiff(patch)
    return { files: parseNumstat(numstat), diff: parsedDiff }
  }

  async function conflicts(workspace: string): Promise<GitConflict[]> {
    const st = await status(workspace)
    return st.changes.filter((c) => c.isConflict).map((c) => ({ path: c.path }))
  }

  function resolveConflict(
    workspace: string,
    path: string,
    choice: GitConflictChoice
  ): Promise<void> {
    return enqueue(workspace, async () => {
      if (choice === 'current') {
        await git(['checkout', '--ours', '--', path], { cwd: workspace })
      } else if (choice === 'incoming') {
        await git(['checkout', '--theirs', '--', path], { cwd: workspace })
      } else {
        // "Aceitar ambos": drop the three conflict-marker lines, keeping both
        // sides' content in place, then stage the resolved file.
        const abs = join(workspace, path)
        const kept = readFileSync(abs, 'utf-8')
          .split('\n')
          .filter((line) => !/^(<<<<<<<|=======|>>>>>>>)/.test(line))
          .join('\n')
        writeFileSync(abs, kept)
      }
      await git(['add', '--', path], { cwd: workspace })
    })
  }

  function mergeContinue(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['merge', '--continue'], { cwd: workspace })
    })
  }

  function mergeAbort(workspace: string): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['merge', '--abort'], { cwd: workspace })
    })
  }

  function stash(
    workspace: string,
    opts?: { message?: string; untracked?: boolean }
  ): Promise<void> {
    return enqueue(workspace, async () => {
      const args = ['stash', 'push']
      if (opts?.untracked) args.push('-u')
      if (opts?.message) args.push('-m', opts.message)
      await git(args, { cwd: workspace })
    })
  }

  async function stashList(workspace: string): Promise<GitStash[]> {
    const out = await git(['stash', 'list', '--format=%gd%x1f%s'], { cwd: workspace })
    return parseStashList(out)
  }

  function stashApply(workspace: string, index: number, pop?: boolean): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['stash', pop ? 'pop' : 'apply', stashRef(index)], { cwd: workspace })
    })
  }

  function stashDrop(workspace: string, index: number): Promise<void> {
    return enqueue(workspace, async () => {
      await git(['stash', 'drop', stashRef(index)], { cwd: workspace })
    })
  }

  return {
    detect,
    init,
    status,
    stage,
    unstage,
    discard,
    commit,
    branches,
    createBranch,
    checkout,
    renameBranch,
    deleteBranch,
    fetch,
    pull,
    push,
    sync,
    log,
    diff,
    commitDiff,
    conflicts,
    resolveConflict,
    mergeContinue,
    mergeAbort,
    stash,
    stashList,
    stashApply,
    stashDrop
  }
}
