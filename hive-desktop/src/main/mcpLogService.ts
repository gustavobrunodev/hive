// Aliased: this module's own `watch` is the service method, and an unaliased
// import would be shadowed by it inside that function.
import { existsSync, watch as watchPath, type FSWatcher } from 'fs'
import { open, readdir, stat } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'

import { claudeCacheSlug, parseLogChunk, type McpLogEntry } from './mcpLogParse'

/**
 * `McpLogService` — the main-process half of the MCP console: read and tail
 * the Claude Code CLI's own per-server log files for a workspace.
 *
 * The CLI writes them to `<cache>/claude-cli-nodejs/<slug(cwd)>/mcp-logs-<server>/`,
 * one `<iso>.jsonl` file per connection attempt, while it runs a turn. Because
 * `cliAdapterCore` starts the CLI with `cwd: workspace`, the slug for the
 * workspace the app has open is exactly the directory to read — no extra
 * plumbing, and no second copy of the truth. `mcpLogParse.ts` turns each line
 * into a typed event; this module owns the filesystem around it:
 *
 *   - **`sources`** — which servers have logs at all, and when each last spoke.
 *     Note this is deliberately *not* limited to `.mcp.json`: the CLI also logs
 *     user- and enterprise-scoped servers, and "logs de qualquer MCP" means the
 *     console shows those too, flagged by the renderer as outside the catalog.
 *
 *   - **`read`** — recent history, newest file first until the entry budget is
 *     spent, returned oldest-first so the console reads top-to-bottom.
 *
 *   - **`watch`** — the live tail. Only *appended* bytes are parsed, so a turn
 *     in flight streams into the dock without re-sending the history `read`
 *     already delivered.
 *
 * `cacheRoot` is injected (the `createConfigStore`/`createMcpService`
 * convention) so the whole module is testable against a temp directory.
 */

/** One server that has logs in this workspace, with enough to render its rail entry. */
export interface McpLogSource {
  /** The server name, from its `mcp-logs-<server>` directory. */
  server: string
  /** Absolute path of that directory — the console's "abrir pasta" target. */
  dir: string
  /** How many connection files it has accumulated. */
  files: number
  /** Epoch ms of the most recent write, or null when the directory is empty. */
  lastActivityAt: number | null
}

/** What `read` accepts. Both fields are optional; the defaults suit the dock. */
export interface McpLogQuery {
  /** Limit to one server. Omit for every server in the workspace. */
  server?: string
  /** Maximum entries to return. Older ones are dropped first. */
  limit?: number
}

/**
 * Where this service reads a workspace's logs from — the console's way of
 * saying "I looked *here*" instead of showing an empty list.
 *
 * Worth its own IPC because the directory is derived, not configured, and the
 * derivation has a real failure mode: the CLI computes both halves of it
 * (cache root and slug) from *its own* platform and *its own* view of the
 * working directory. Drive the app from WSL against a `claude` installed with
 * Windows npm and the CLI writes to `%LOCALAPPDATA%` under a
 * `\\wsl.localhost\…` slug, while this service — a Linux process holding a
 * POSIX path — reads `~/.cache` under a `-home-…` slug. Neither side is wrong
 * and nothing throws; the console is simply, silently, pointed at a directory
 * that will never have anything in it. Showing the path turns that from a
 * mystery into a one-glance diagnosis.
 */
export interface McpLogLocation {
  /** The absolute directory this workspace's `mcp-logs-*` folders live under. */
  dir: string
  /** Whether it exists right now. False is the normal state before the CLI's first run. */
  exists: boolean
}

export interface McpLogService {
  /** Every server with logs for this workspace, most recently active first. */
  sources(workspace: string): Promise<McpLogSource[]>
  /** Recent entries, oldest-first, capped by `query.limit`. */
  read(workspace: string, query?: McpLogQuery): Promise<McpLogEntry[]>
  /** The directory this service reads for `workspace`, and whether it's there. */
  locate(workspace: string): McpLogLocation
  /**
   * Streams entries appended after this call. Returns a disposer; the callback
   * fires with a non-empty batch per filesystem change (debounced).
   */
  watch(workspace: string, onBatch: (entries: McpLogEntry[]) => void): () => void
}

const LOG_DIR_PREFIX = 'mcp-logs-'
const CLI_CACHE_DIR = 'claude-cli-nodejs'
const DEFAULT_LIMIT = 3000
/** fs.watch fires several times per write; coalesce before touching the disk. */
const WATCH_DEBOUNCE_MS = 120

/** Where a file's tail left off, so only appended bytes are re-parsed. */
interface Cursor {
  bytes: number
  lines: number
}

/**
 * The CLI's cache directory, following `env-paths` semantics — the same
 * convention that produces the `claude-cli-nodejs` name in the first place.
 */
export function claudeCacheRoot(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  if (platform === 'win32') {
    return join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), CLI_CACHE_DIR, 'Cache')
  }
  if (platform === 'darwin') {
    return join(home, 'Library', 'Caches', CLI_CACHE_DIR)
  }
  return join(env.XDG_CACHE_HOME ?? join(home, '.cache'), CLI_CACHE_DIR)
}

/** Reads `[start, end)` of a file as UTF-8. Returns '' when there's nothing to read. */
async function readSlice(path: string, start: number, end: number): Promise<string> {
  if (end <= start) return ''
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(end - start)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

/**
 * How a directory is watched. Injected alongside `cacheRoot` so the
 * platform-fallback path below is reachable in a test: Node documents
 * `recursive` as platform-dependent, and "what happens on a kernel that
 * refuses it" is not something the host platform will demonstrate on demand.
 */
export type WatchFactory = (
  path: string,
  options: { recursive: boolean },
  onChange: () => void
) => FSWatcher

/**
 * The nearest ancestor of `path` that exists right now (possibly `path`
 * itself), or null when even the filesystem root is unreachable.
 *
 * This is what lets the tail survive being started before the CLI has ever run
 * in a workspace: there is nothing to watch at the target, but there is always
 * something to watch *above* it, and that something is where the target will
 * appear.
 */
export function nearestExistingDir(path: string): string | null {
  let current = path
  for (;;) {
    if (existsSync(current)) return current
    const parent = dirname(current)
    // `dirname` is a fixed point at the root ('/' → '/', 'C:\' → 'C:\').
    if (parent === current) return null
    current = parent
  }
}

/**
 * Factory. `cacheRoot` defaults to the real CLI cache; tests pass a temp dir.
 * One instance per main process — it carries the tail cursors that let `watch`
 * pick up exactly where `read` stopped.
 */
export function createMcpLogService(
  deps: { cacheRoot?: string; watchFactory?: WatchFactory } = {}
): McpLogService {
  const cacheRoot = deps.cacheRoot ?? claudeCacheRoot()
  const watchFactory: WatchFactory = deps.watchFactory ?? watchPath
  /** file path -> how much of it has already been turned into entries. */
  const cursors = new Map<string, Cursor>()

  const workspaceRoot = (workspace: string): string => join(cacheRoot, claudeCacheSlug(workspace))

  /** The `mcp-logs-*` directories under a workspace's cache root, as (server, dir) pairs. */
  async function logDirs(workspace: string): Promise<{ server: string; dir: string }[]> {
    const root = workspaceRoot(workspace)
    let names: string[]
    try {
      names = await readdir(root)
    } catch {
      return [] // No cache directory yet — the CLI has never run here.
    }
    return names
      .filter((name) => name.startsWith(LOG_DIR_PREFIX) && name.length > LOG_DIR_PREFIX.length)
      .map((name) => ({ server: name.slice(LOG_DIR_PREFIX.length), dir: join(root, name) }))
  }

  /**
   * A directory's log files, newest last. Filenames are ISO timestamps, so a
   * lexicographic sort is chronological — cheaper and steadier than stat'ing
   * every file just to order them.
   */
  async function logFiles(dir: string): Promise<string[]> {
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return []
    }
    return names
      .filter((name) => name.endsWith('.jsonl'))
      .sort()
      .map((name) => join(dir, name))
  }

  async function sources(workspace: string): Promise<McpLogSource[]> {
    const dirs = await logDirs(workspace)
    const entries = await Promise.all(
      dirs.map(async ({ server, dir }) => {
        const files = await logFiles(dir)
        const newest = files.at(-1)
        let lastActivityAt: number | null = null
        if (newest !== undefined) {
          try {
            lastActivityAt = (await stat(newest)).mtimeMs
          } catch {
            lastActivityAt = null
          }
        }
        return { server, dir, files: files.length, lastActivityAt }
      })
    )
    return entries.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
  }

  /** Parses one whole file, remembering how far it got so `watch` can resume. */
  async function readWholeFile(path: string, server: string): Promise<McpLogEntry[]> {
    let size: number
    let mtimeMs: number
    try {
      const info = await stat(path)
      size = info.size
      mtimeMs = info.mtimeMs
    } catch {
      return []
    }
    const body = await readSlice(path, 0, size)
    const entries = parseLogChunk(body, {
      server,
      file: path,
      startLine: 0,
      fallbackAt: mtimeMs
    })
    cursors.set(path, { bytes: size, lines: body === '' ? 0 : body.split('\n').length - 1 })
    return entries
  }

  async function read(workspace: string, query: McpLogQuery = {}): Promise<McpLogEntry[]> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const dirs = (await logDirs(workspace)).filter(
      ({ server }) => query.server === undefined || server === query.server
    )

    // Walk every server's files newest-first together, so a chatty server can't
    // crowd a quiet one out of the budget entirely.
    const queues = await Promise.all(
      dirs.map(async ({ server, dir }) => ({ server, files: (await logFiles(dir)).reverse() }))
    )

    const collected: McpLogEntry[] = []
    let exhausted = false
    while (collected.length < limit && !exhausted) {
      exhausted = true
      for (const queue of queues) {
        const next = queue.files.shift()
        if (next === undefined) continue
        exhausted = false
        collected.push(...(await readWholeFile(next, queue.server)))
      }
    }

    collected.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    return collected.length > limit ? collected.slice(collected.length - limit) : collected
  }

  function watch(workspace: string, onBatch: (entries: McpLogEntry[]) => void): () => void {
    const root = workspaceRoot(workspace)
    let disposed = false
    let timer: NodeJS.Timeout | null = null
    const watchers: FSWatcher[] = []
    /**
     * Directories that already carry a watcher. `attach` runs after every
     * sweep, so this is what keeps it idempotent — and what lets a server
     * whose `mcp-logs-*` directory is created mid-session pick up a watcher of
     * its own on the non-recursive path.
     */
    const watched = new Set<string>()
    /** True once a recursive watcher took, which already covers every subdirectory. */
    let recursive = false
    /**
     * True once the recursive attempt threw. Without it the second pass would
     * see `root` already in `watched`, read that as "the recursive watcher
     * took" and stop attaching per-directory watchers to servers that appear
     * later — the exact gap this rework exists to close.
     */
    let recursiveRefused = false

    /** Parses whatever has been appended to every known file since the last sweep. */
    async function sweep(): Promise<void> {
      const dirs = await logDirs(workspace)
      const batch: McpLogEntry[] = []
      for (const { server, dir } of dirs) {
        for (const path of await logFiles(dir)) {
          let size: number
          let mtimeMs: number
          try {
            const info = await stat(path)
            size = info.size
            mtimeMs = info.mtimeMs
          } catch {
            continue // Removed between listing and stat — nothing to tail.
          }
          const cursor = cursors.get(path) ?? { bytes: 0, lines: 0 }
          // A shrunk file was rotated or truncated underneath us: re-read it whole.
          const from = size < cursor.bytes ? { bytes: 0, lines: 0 } : cursor
          if (size === from.bytes) continue
          const chunk = await readSlice(path, from.bytes, size)
          batch.push(
            ...parseLogChunk(chunk, {
              server,
              file: path,
              startLine: from.lines,
              fallbackAt: mtimeMs
            })
          )
          cursors.set(path, {
            bytes: size,
            lines: from.lines + (chunk === '' ? 0 : chunk.split('\n').length - 1)
          })
        }
      }
      // Re-attach before reporting: a sweep is exactly the moment a directory
      // that didn't exist a moment ago might, and the watcher that woke us
      // could have been the bootstrap one sitting on an ancestor.
      await attach()
      if (batch.length === 0 || disposed) return
      batch.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
      onBatch(batch)
    }

    function schedule(): void {
      if (disposed || timer !== null) return
      timer = setTimeout(() => {
        timer = null
        void sweep()
      }, WATCH_DEBOUNCE_MS)
    }

    /**
     * Seeds cursors at the current size for every file that exists now, so the
     * first sweep reports only what arrives *after* this call. Files the CLI
     * creates later have no cursor and are read from the top — which is what a
     * new connection should do.
     */
    async function seed(): Promise<void> {
      for (const { dir } of await logDirs(workspace)) {
        for (const path of await logFiles(dir)) {
          if (cursors.has(path)) continue
          try {
            cursors.set(path, { bytes: (await stat(path)).size, lines: 0 })
          } catch {
            // Vanished mid-seed; the sweep will treat it as new if it returns.
          }
        }
      }
      if (disposed) return
      await attach()
    }

    /** Adds one watcher, at most once per directory. Reports whether it took. */
    function watchDir(dir: string, options: { recursive: boolean }): boolean {
      if (watched.has(dir)) return true
      try {
        watchers.push(watchFactory(dir, options, schedule))
        watched.add(dir)
        return true
      } catch {
        // A directory we can't watch just won't tail; the rest still do.
        return false
      }
    }

    /**
     * Watches the workspace's whole cache subtree. Recursive watching is
     * documented by Node as platform-dependent (it works on this project's
     * Linux/Node 22 target, see `fsService.ts`), so a throw falls back to one
     * watcher per `mcp-logs-*` directory plus the root — together those catch
     * both appends to existing files and brand-new connection files.
     *
     * **Runs again after every sweep**, and that is the whole point. The
     * workspace's cache directory does not exist until the CLI has run there
     * once, so a console opened on a fresh workspace — the ordinary case, and
     * exactly when someone is watching hardest — used to find nothing to watch
     * and give up permanently: the agent would then run, the CLI would create
     * the directory and fill it, and the dock would sit empty until a manual
     * reload. Now the absence is watched too: a bootstrap watcher sits on the
     * nearest existing ancestor until the real directory appears, and each
     * pass upgrades whatever it can.
     */
    async function attach(): Promise<void> {
      if (disposed || recursive) return
      if (!existsSync(root)) {
        const ancestor = nearestExistingDir(root)
        if (ancestor !== null) watchDir(ancestor, { recursive: false })
        return
      }
      if (!recursiveRefused && watchDir(root, { recursive: true })) {
        recursive = true
        return
      }
      recursiveRefused = true
      // Per-directory fallback. `logDirs` is re-read on every pass, so a server
      // that connects for the first time mid-session gets its own watcher.
      watchDir(root, { recursive: false })
      for (const { dir } of await logDirs(workspace)) {
        if (disposed) return
        watchDir(dir, { recursive: false })
      }
    }

    void seed()

    return () => {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
      watchers.length = 0
      watched.clear()
    }
  }

  function locate(workspace: string): McpLogLocation {
    const dir = workspaceRoot(workspace)
    return { dir, exists: existsSync(dir) }
  }

  return { sources, read, locate, watch }
}
