import type { ProcessRunner, ProcessStreamChunk } from './processRunner'
import { parseStatusV2, type GitStatus } from './gitParse'

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
}

/** Collects a finished process's full stdout/stderr and exit code. */
async function collect(
  handle: { output: AsyncIterable<ProcessStreamChunk>; exitCode: Promise<{ code: number | null }> }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
      env: { GIT_TERMINAL_PROMPT: '0' }
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
    return parseStatusV2(out)
  }

  return { detect, init, status }
}
