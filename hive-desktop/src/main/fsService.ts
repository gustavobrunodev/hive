import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  watch,
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
 * Creates the `FsService` (R5.1–R5.4, design.md §2). Every method takes the
 * workspace `root` explicitly (rather than binding to one at construction
 * time) so a single instance can be reused across workspace switches — it
 * has no `electron` dependency and needs no injected fakes for testing,
 * unlike `WorkspaceService`'s `DialogLike`.
 */
export function createFsService(): FsService {
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

  return { listTree, readFile, watchWorkspace }
}
