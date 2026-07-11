import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
  type FSWatcher
} from 'fs'
import { isAbsolute, join, relative, resolve, sep } from 'path'

/**
 * A single entry in a workspace's folder structure (R5.1). `path` is always
 * POSIX-style (forward slashes) and relative to the workspace root, e.g.
 * `"docs/prd.md"` — independent of host OS separators, so renderer code
 * (T12) never has to think about platform differences. `children` is only
 * present on directories.
 */
export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

/** One filesystem change under a watched workspace root (R5.3). */
export interface FsChangeEvent {
  type: 'add' | 'change' | 'unlink'
  /** POSIX-style path relative to the workspace root, same convention as `TreeNode.path`. */
  path: string
}

/** `statFile`'s return shape — the mtime/size baseline used for edit-conflict detection (FM-R2.3). */
export interface EntryMeta {
  mtimeMs: number
  size: number
}

/**
 * Thrown by write operations that hit a naming conflict. `code` is a
 * discriminable tag so callers (IPC/renderer) can branch without parsing the
 * message: `'CONFLICT'` when a create/move/import target already exists and
 * `overwrite` wasn't requested; `'STALE'` when a save's `expectedMtimeMs`
 * baseline no longer matches the on-disk file (T4 — saveFile's job; the
 * class lives here so T4 can reuse it without T3 depending on T4).
 */
export class ConflictError extends Error {
  code: 'CONFLICT' | 'STALE'

  constructor(code: 'CONFLICT' | 'STALE', message: string) {
    super(message)
    this.name = 'ConflictError'
    this.code = code
  }
}

export interface FsService {
  /**
   * Lists the folder structure under `relativePath` (default: the workspace
   * root itself), recursively. Throws if `relativePath` resolves outside `root`.
   */
  listTree(root: string, relativePath?: string): TreeNode[]
  /** Reads a file's contents as UTF-8 text. Throws if `relativePath` resolves outside `root`. */
  readFile(root: string, relativePath: string): string
  /**
   * Watches `root` for add/change/unlink events, calling `onChange` for each
   * one. Returns a stop function that tears down the underlying watcher.
   */
  watchWorkspace(root: string, onChange: (event: FsChangeEvent) => void): () => void

  /** Stats a file for the edit baseline (FM-R2.3). Throws if `relativePath` resolves outside `root` or isn't a file. */
  statFile(root: string, relativePath: string): EntryMeta
  /**
   * Creates an empty file (FM-R1.1). Throws `ConflictError{code:'CONFLICT'}`
   * if the target already exists and `opts.overwrite` isn't `true`.
   */
  createFile(root: string, relativePath: string, opts?: { overwrite?: boolean }): void
  /** Creates a directory, recursive (FM-R1.2). No-op-safe if it already exists. */
  createDirectory(root: string, relativePath: string): void
  /**
   * Renames/moves a file or directory within the workspace (FM-R4). Both
   * `fromRel` and `toRel` are `resolveSafe`-checked. Throws
   * `ConflictError{code:'CONFLICT'}` if `toRel` already exists and
   * `opts.overwrite` isn't `true`.
   */
  move(root: string, fromRel: string, toRel: string, opts?: { overwrite?: boolean }): void
  /** Does a workspace-relative path already exist? (conflict pre-check, FM-R7) */
  exists(root: string, relativePath: string): boolean
  /** Deletes to the OS trash (FM-R3). Async — the injected `trashItem` is async. */
  trash(root: string, relativePath: string): Promise<void>
}

/**
 * Resolves `relativePath` against `root` and rejects any result that escapes
 * `root` (R1.3, R5.4) — this is the one security-critical check every
 * `FsService` method routes through.
 *
 * Deliberately uses `path.relative(root, resolved)` rather than a
 * `resolved.startsWith(root)` string check: the naive string-prefix version
 * is famously wrong (`/workspace-evil` passes a naive
 * `startsWith('/workspace')` check against root `/workspace`). `relative()`
 * instead yields a real filesystem relationship — escaping shows up as a
 * result starting with `..` (or, for a relative path handed a foreign
 * absolute target, an absolute result) — which the check below rejects.
 * Both `root` and `relativePath` are resolved before deriving that
 * relationship, so `..`-traversal and absolute-path overrides are both
 * caught the same way.
 */
function resolveSafe(root: string, relativePath: string): string {
  const rootAbs = resolve(root)
  const targetAbs = resolve(rootAbs, relativePath)
  const rel = relative(rootAbs, targetAbs)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace root: ${relativePath}`)
  }
  return targetAbs
}

/** Joins a POSIX-style relative path (or `'.'`) with a child name, POSIX-style regardless of host OS. */
function joinRelative(base: string, name: string): string {
  return base === '.' ? name : `${base}/${name}`
}

/**
 * Lists one directory's entries as `TreeNode`s, recursing into subdirectories.
 * `dirAbs` is a resolved, already-validated absolute path; `relBase` is its
 * POSIX-style path relative to the workspace root (`'.'` for the root itself).
 *
 * Symlinks are resolved via `realpathSync` and checked against `rootAbs` the
 * same way `resolveSafe` checks explicit paths — a symlink that escapes the
 * workspace root is silently excluded from the tree (rather than throwing,
 * since one bad symlink shouldn't fail listing the rest of a real directory).
 * Broken symlinks are excluded too.
 */
function listDir(rootAbs: string, dirAbs: string, relBase: string): TreeNode[] {
  const entries = readdirSync(dirAbs, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryAbs = join(dirAbs, entry.name)
    const entryRel = joinRelative(relBase, entry.name)
    let isDirectory = entry.isDirectory()

    if (entry.isSymbolicLink()) {
      let real: string
      try {
        real = realpathSync(entryAbs)
      } catch {
        continue // broken symlink — skip
      }
      const relFromRoot = relative(rootAbs, real)
      if (relFromRoot === '..' || relFromRoot.startsWith(`..${sep}`) || isAbsolute(relFromRoot)) {
        continue // symlink escapes the workspace root — skip
      }
      isDirectory = statSync(real).isDirectory()
    } else if (!entry.isFile() && !entry.isDirectory()) {
      continue // sockets, fifos, etc. — not meaningful in a file tree
    }

    if (isDirectory) {
      nodes.push({
        name: entry.name,
        path: entryRel,
        type: 'directory',
        children: listDir(rootAbs, entryAbs, entryRel)
      })
    } else {
      nodes.push({ name: entry.name, path: entryRel, type: 'file' })
    }
  }

  return nodes
}

/**
 * Validates the final path segment of a create/rename target (FM-R1.3),
 * before it ever reaches `resolveSafe` — an empty name, a name embedding a
 * path separator, or a `.`/`..` segment gets a clear, specific error here
 * rather than surfacing as a generic "escapes workspace root".
 */
function assertValidName(relativePath: string): void {
  // Splitting on both separators and taking the last segment means the
  // segment itself can never contain '/' or '\' — no need for a separate
  // `.includes()` check, and `split` on any string (including `''`) always
  // yields at least one element, so `name` is always defined.
  const segments = relativePath.split(/[/\\]/)
  const name = segments[segments.length - 1]
  if (name === '' || name === '.' || name === '..') {
    throw new Error(`Invalid name: ${relativePath}`)
  }
}

/** Dependencies `createFsService` can have injected, keeping `fsService.ts` itself Electron-free. */
export interface FsServiceDeps {
  /** Moves an absolute path to the OS trash — `main/index.ts` injects `shell.trashItem`. */
  trashItem?: (absolutePath: string) => Promise<void>
}

/**
 * Creates the `FsService` (R5.1–R5.4, design.md §2). Every method takes the
 * workspace `root` explicitly (rather than binding to one at construction
 * time) so a single instance can be reused across workspace switches — it
 * has no `electron` dependency and needs no injected fakes for testing,
 * unlike `WorkspaceService`'s `DialogLike`. The one exception is `trash`
 * (design §1 C2): trashing routes through `deps.trashItem`, DI'd here so
 * this file never imports `electron` while still being testable with a fake.
 */
export function createFsService(deps?: FsServiceDeps): FsService {
  function listTree(root: string, relativePath = '.'): TreeNode[] {
    const rootAbs = resolve(root)
    const dirAbs = resolveSafe(rootAbs, relativePath)
    return listDir(rootAbs, dirAbs, relativePath === '.' ? '.' : relativePath)
  }

  function readFile(root: string, relativePath: string): string {
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    const stat = statSync(targetAbs)
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${relativePath}`)
    }
    return readFileSync(targetAbs, 'utf-8')
  }

  function watchWorkspace(root: string, onChange: (event: FsChangeEvent) => void): () => void {
    const rootAbs = resolve(root)

    // fs.watch's callback gives us `eventType` ('rename' | 'change') and a
    // `filename` relative to the watched directory (POSIX-style already on
    // Linux/macOS; normalized below just in case). 'rename' covers both
    // creation and deletion, so we disambiguate by checking whether the path
    // still exists at the time the event fires.
    function handleRawEvent(eventType: string, filename: string | null): void {
      if (!filename) return // some platforms/events omit the filename — nothing usable to report
      const relPath = filename.split(sep).join('/')
      const type: FsChangeEvent['type'] =
        eventType === 'change' ? 'change' : existsSync(join(rootAbs, filename)) ? 'add' : 'unlink'
      onChange({ type, path: relPath })
    }

    let watcher: FSWatcher
    try {
      // Recursive watch of the whole workspace tree in one go. Verified
      // working on this codebase's target platform (Linux, Node 22.22.1) —
      // Node's `fs.watch recursive` support on Linux (backed by a manual
      // inotify walk, not a single recursive syscall) landed well before
      // that version. Kept in a try/catch anyway: `recursive` is documented
      // by Node as not supported on every platform/kernel, and a
      // synchronous throw here shouldn't take down the whole app.
      watcher = watch(rootAbs, { recursive: true }, handleRawEvent)
    } catch {
      // Fallback for a platform where recursive watching isn't available:
      // watch only the root directory itself (non-recursive). This means
      // changes inside subdirectories won't be reported — an acceptable MVP
      // limitation per T11's spec, rather than reaching for a new dependency.
      watcher = watch(rootAbs, { recursive: false }, handleRawEvent)
    }

    return () => watcher.close()
  }

  function statFile(root: string, relativePath: string): EntryMeta {
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    const stat = statSync(targetAbs)
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${relativePath}`)
    }
    return { mtimeMs: stat.mtimeMs, size: stat.size }
  }

  function createFile(root: string, relativePath: string, opts?: { overwrite?: boolean }): void {
    assertValidName(relativePath)
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    if (existsSync(targetAbs) && !opts?.overwrite) {
      throw new ConflictError('CONFLICT', `Already exists: ${relativePath}`)
    }
    writeFileSync(targetAbs, '')
  }

  function createDirectory(root: string, relativePath: string): void {
    assertValidName(relativePath)
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    // recursive: true is itself no-op-safe if the directory already exists.
    mkdirSync(targetAbs, { recursive: true })
  }

  function move(
    root: string,
    fromRel: string,
    toRel: string,
    opts?: { overwrite?: boolean }
  ): void {
    assertValidName(toRel)
    const rootAbs = resolve(root)
    const fromAbs = resolveSafe(rootAbs, fromRel)
    const toAbs = resolveSafe(rootAbs, toRel)
    if (existsSync(toAbs) && !opts?.overwrite) {
      throw new ConflictError('CONFLICT', `Already exists: ${toRel}`)
    }
    try {
      renameSync(fromAbs, toAbs)
    } catch (err) {
      // EXDEV: source and destination are on different filesystems/devices —
      // renameSync can't do an atomic move across them. Unlikely within a
      // single workspace root, but cheap to handle correctly: copy then
      // remove the original.
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        cpSync(fromAbs, toAbs, { recursive: true, force: true })
        rmSync(fromAbs, { recursive: true, force: true })
      } else {
        throw err
      }
    }
  }

  function exists(root: string, relativePath: string): boolean {
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    return existsSync(targetAbs)
  }

  async function trash(root: string, relativePath: string): Promise<void> {
    if (!deps?.trashItem) {
      throw new Error('trash: no trashItem dependency injected')
    }
    const rootAbs = resolve(root)
    const targetAbs = resolveSafe(rootAbs, relativePath)
    await deps.trashItem(targetAbs)
  }

  return {
    listTree,
    readFile,
    watchWorkspace,
    statFile,
    createFile,
    createDirectory,
    move,
    exists,
    trash
  }
}
