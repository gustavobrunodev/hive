import { createHash } from 'crypto'
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseDiff, type GitDiff } from './gitParse'
import type { ProcessRunner, ProcessStreamChunk } from './processRunner'

/**
 * The shadow-git snapshot engine behind Agent Change Review (M11, design.md §2,
 * ACR-C2). A **private, app-managed git object store** — its own `GIT_DIR` and
 * `GIT_INDEX_FILE` under `userData/checkpoints/<sha1(ws)>/`, with the workspace
 * as `GIT_WORK_TREE` — used purely as a fast, race-free, content-addressed
 * snapshot + diff engine. It is **invisible to and independent of the user's
 * `.git`** (their repo/index are never touched), and works even outside a repo.
 *
 * Why a shadow git and not per-file `git diff --no-index`: capturing a file's
 * *pre-image* requires knowing its content **before** the agent writes it. The
 * only race-free, adapter-agnostic source of pre-images is a turn-start
 * whole-tree baseline, and a shadow git makes that baseline incremental (git
 * re-hashes only files whose size/mtime changed) and gives diff/checkout/apply
 * for free. See context.md ACR-C2.
 *
 * Everything runs the system `git` through the injected `ProcessRunner` (the
 * same DI as `GitService`), so this file stays Electron-free and unit-testable
 * against a throwaway workspace + throwaway store (real git in temp dirs, the
 * M10 `gitService`/`bmadCli.e2e` precedent).
 */

/** Thrown when a shadow-git command exits non-zero (mirrors `GitError`, kept local so the shadow store never leaks as the user's git). */
export class CheckpointError extends Error {
  code: number | null
  stderr: string
  command: string

  constructor(code: number | null, stderr: string, command: string) {
    super(stderr.trim() || `git exited with code ${code ?? 'unknown'}`)
    this.name = 'CheckpointError'
    this.code = code
    this.stderr = stderr
    this.command = command
  }
}

/** One path that differs between a baseline tree and the current work tree. */
export interface CheckpointChange {
  /** Workspace-relative POSIX path. */
  path: string
  /** `created` (absent in baseline), `modified`, or `deleted` (absent now). */
  status: 'created' | 'modified' | 'deleted'
  /** Parsed pre-image→now diff for this one path (hunks / binary / tooLarge). */
  diff: GitDiff
}

export interface CheckpointServiceDeps {
  processRunner: ProcessRunner
  /**
   * The Electron `userData` directory (injected so tests point it at a temp
   * dir — mirrors how `configStore`/`gitService` take their paths/runner). The
   * shadow store lives under `<userDataDir>/checkpoints/<sha1(ws)>/`.
   */
  userDataDir: string
}

export interface CheckpointService {
  /**
   * Records a **baseline tree** of the workspace and returns its git tree OID
   * (ACR-R1.1). Lazily inits the private store on first use. `git add -A`
   * refreshes the isolated index to the current work tree, then `git
   * write-tree` writes a dangling tree object (no commit needed — the OID is
   * the handle). Incremental: git only re-hashes changed files.
   */
  snapshot(ws: string): Promise<string>
  /**
   * The set of paths that differ between `ref` (a baseline tree OID) and the
   * current work tree, each with its parsed diff (ACR-R1.2). Refreshes the
   * index (`add -A`) so files the agent *created* are included; renames are
   * split into delete+create (`--no-renames`, design §8).
   */
  diffToWorkTree(ws: string, ref: string): Promise<CheckpointChange[]>
  /**
   * The content of `path` at `ref` (the pre-turn bytes), or `null` when the
   * path did not exist at `ref` (i.e. the agent created it). Used by revert and
   * the inline "before" pane.
   */
  fileAtRef(ws: string, ref: string, path: string): Promise<string | null>
  /**
   * Restores `path` to its `ref` state on disk (ACR-R1.6): created → delete
   * (it never existed pre-turn); modified/deleted → `git checkout <ref> --
   * <path>` writes the pre-turn bytes back into the work tree.
   */
  revertPath(ws: string, ref: string, path: string): Promise<void>
  /**
   * Reverse-applies one hunk's `patch` to `path` on disk (`git apply -R
   * --unidiff-zero`), leaving every other hunk untouched (ACR-R3.1). The patch
   * is built by `gitParse.buildHunkPatch` (T3/T4); this is the apply primitive.
   */
  applyReverseHunk(ws: string, path: string, patch: string): Promise<void>
}

/** Heavy dirs / noise kept out of every snapshot so `add -A` stays cheap (OQ2, design §2). The workspace's own `.gitignore` is honored automatically on top of this. */
const EXCLUDES = [
  '.git/',
  'node_modules/',
  'dist/',
  'out/',
  'coverage/',
  '.playwright-mcp/',
  '*.log'
]

/** Cap (bytes) beyond which a per-file diff is reported `tooLarge` rather than parsed (mirrors `gitService.DIFF_CAP_BYTES`). */
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
 * Creates the `CheckpointService`. All git runs through the injected runner with
 * an explicit shadow env (`GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE`) so the
 * user's git is never touched. Every method takes the workspace root explicitly
 * (no hidden "current repo" state), mirroring `gitService`/`fsService`.
 */
export function createCheckpointService(deps: CheckpointServiceDeps): CheckpointService {
  const { processRunner, userDataDir } = deps

  /** Per-workspace paths of the private store. Keyed by the sha1 of the absolute workspace path (collision-free, OQ1). */
  function storeFor(ws: string): { store: string; gitDir: string; indexFile: string } {
    const key = createHash('sha1').update(ws).digest('hex')
    const store = join(userDataDir, 'checkpoints', key)
    return { store, gitDir: join(store, 'git'), indexFile: join(store, 'index') }
  }

  /**
   * Runs one git command against the shadow store and returns stdout, throwing
   * `CheckpointError` on a non-zero exit. `GIT_DIR`/`GIT_WORK_TREE`/
   * `GIT_INDEX_FILE` isolate every operation from the user's git;
   * `core.quotepath=false` keeps non-ASCII paths literal; `GIT_TERMINAL_PROMPT=0`
   * never hangs on a prompt (the store is local — there's nothing to prompt for).
   */
  async function git(ws: string, args: string[]): Promise<string> {
    const { gitDir, indexFile } = storeFor(ws)
    const handle = processRunner.run('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: ws,
      env: {
        GIT_DIR: gitDir,
        GIT_WORK_TREE: ws,
        GIT_INDEX_FILE: indexFile,
        GIT_TERMINAL_PROMPT: '0'
      }
    })
    const { stdout, stderr, code } = await collect(handle)
    if (code !== 0) {
      throw new CheckpointError(code, stderr, `git ${args.join(' ')}`)
    }
    return stdout
  }

  /** Lazily inits the private store (first snapshot): `git init` at the shadow `GIT_DIR` + the heavy-dir `info/exclude`. Idempotent. */
  function ensureInit(ws: string): void {
    const { store, gitDir } = storeFor(ws)
    if (existsSync(gitDir)) return
    mkdirSync(store, { recursive: true })
    // `git init` honors GIT_DIR, so the object db is created at the shadow path,
    // never in the workspace. Run synchronously via the exclude write below —
    // but init itself must go through git; callers await snapshot which awaits
    // this through `git(...)`, so ensureInit only prepares the filesystem and
    // the actual `git init` is issued by the caller. Keep it simple: create the
    // dir tree, the caller's first `git init` populates it.
    mkdirSync(join(gitDir, 'info'), { recursive: true })
  }

  /** Writes `info/exclude` with the heavy-dir excludes (idempotent — overwrites). */
  function writeExclude(ws: string): void {
    const { gitDir } = storeFor(ws)
    writeFileSync(join(gitDir, 'info', 'exclude'), EXCLUDES.join('\n') + '\n')
  }

  /** True once the store has been `git init`-ed (its object db exists). */
  function isInitialized(ws: string): boolean {
    const { gitDir } = storeFor(ws)
    return existsSync(join(gitDir, 'HEAD'))
  }

  async function initStore(ws: string): Promise<void> {
    if (isInitialized(ws)) return
    ensureInit(ws)
    await git(ws, ['init', '-q'])
    writeExclude(ws)
  }

  async function snapshot(ws: string): Promise<string> {
    await initStore(ws)
    await git(ws, ['add', '-A'])
    return (await git(ws, ['write-tree'])).trim()
  }

  /** Refreshes the isolated index to the current work tree so created files are seen. */
  async function refreshIndex(ws: string): Promise<void> {
    await git(ws, ['add', '-A'])
  }

  async function diffToWorkTree(ws: string, ref: string): Promise<CheckpointChange[]> {
    await refreshIndex(ws)
    // `--cached` compares the (just-refreshed) index to the baseline tree, so
    // created files (now staged by `add -A`) are included; `--no-renames`
    // splits a rename into delete+create (design §8, simplest correct behavior).
    const nameStatus = await git(ws, [
      'diff',
      '--cached',
      '--name-status',
      '--no-renames',
      '-z',
      ref
    ])
    const changes: CheckpointChange[] = []
    const fields = nameStatus.split('\0')
    for (let i = 0; i < fields.length; i++) {
      const code = fields[i]
      if (code === '') continue
      const path = fields[++i]
      changes.push({ path, status: statusFromCode(code), diff: await diffPath(ws, ref, path) })
    }
    return changes
  }

  /** Parsed diff of one path, baseline `ref` → now (via the refreshed index). */
  async function diffPath(ws: string, ref: string, path: string): Promise<GitDiff> {
    const out = await git(ws, ['diff', '--cached', '--no-renames', ref, '--', path])
    if (out.length > DIFF_CAP_BYTES) return parseDiff('', { tooLarge: true })
    return parseDiff(out)
  }

  async function fileAtRef(ws: string, ref: string, path: string): Promise<string | null> {
    try {
      return await git(ws, ['show', `${ref}:${path}`])
    } catch {
      // Absent at the baseline (the agent created it) → no pre-image.
      return null
    }
  }

  async function revertPath(ws: string, ref: string, path: string): Promise<void> {
    const pre = await fileAtRef(ws, ref, path)
    if (pre === null) {
      // Created this turn — it never existed pre-turn, so revert = delete on
      // disk. Best-effort (it may already be gone).
      try {
        unlinkSync(join(ws, path))
      } catch {
        // already absent
      }
      // Drop it from the isolated index too so a later snapshot is clean.
      await git(ws, ['rm', '--cached', '--ignore-unmatch', '--', path])
      return
    }
    // Modified/deleted → write the baseline bytes back into the work tree.
    await git(ws, ['checkout', ref, '--', path])
  }

  async function applyReverseHunk(ws: string, _path: string, patch: string): Promise<void> {
    // `_path` (part of the interface signature) is embedded in the patch's own
    // `---`/`+++` headers, so the raw-patch primitive doesn't need it directly;
    // T4 layers a `GitDiffHunk`-taking overload that uses it to build the patch.
    // `git apply` reads the patch from a file (the injected ProcessRunner closes
    // stdin), mirroring how `gitService.commit` passes its message via `-F`.
    // `--unidiff-zero` allows zero-context hunks; `-R` reverse-applies (reject).
    const patchFile = join(
      tmpdir(),
      `hive-hunk-${Date.now()}-${Math.random().toString(36).slice(2)}.patch`
    )
    writeFileSync(patchFile, patch)
    try {
      await git(ws, ['apply', '-R', '--unidiff-zero', patchFile])
    } finally {
      try {
        unlinkSync(patchFile)
      } catch {
        // best-effort temp cleanup
      }
    }
  }

  return { snapshot, diffToWorkTree, fileAtRef, revertPath, applyReverseHunk }
}

/**
 * Maps a `diff --name-status` code (first char) to a review status. With
 * `--no-renames --cached` the only codes git emits are `A`/`M`/`D`/`T` — `A`
 * created, `D` deleted, everything else (`M`, and the rare typechange `T`)
 * modified.
 */
function statusFromCode(code: string): CheckpointChange['status'] {
  const c = code[0]
  if (c === 'A') return 'created'
  if (c === 'D') return 'deleted'
  return 'modified'
}

/** Test-only: removes a workspace's whole shadow store (used by tests to reset between cases). Not part of the public interface. */
export function purgeCheckpointStore(userDataDir: string, ws: string): void {
  const key = createHash('sha1').update(ws).digest('hex')
  rmSync(join(userDataDir, 'checkpoints', key), { recursive: true, force: true })
}
