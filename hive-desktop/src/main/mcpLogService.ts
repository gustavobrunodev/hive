// Aliased: this module's own `watch` is the service method, and an unaliased
// import would be shadowed by it inside that function.
import { existsSync, watch as watchPath, type FSWatcher } from 'fs'
import { open, readdir, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

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

export interface McpLogService {
  /** Every server with logs for this workspace, most recently active first. */
  sources(workspace: string): Promise<McpLogSource[]>
  /** Recent entries, oldest-first, capped by `query.limit`. */
  read(workspace: string, query?: McpLogQuery): Promise<McpLogEntry[]>
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

    /**
     * Watches the workspace's whole cache subtree. Recursive watching is
     * documented by Node as platform-dependent (it works on this project's
     * Linux/Node 22 target, see `fsService.ts`), so a throw falls back to one
     * watcher per `mcp-logs-*` directory plus the root — together those catch
     * both appends to existing files and brand-new connection files.
     */
    async function attach(): Promise<void> {
      if (!existsSync(root)) return
      try {
        watchers.push(watchFactory(root, { recursive: true }, schedule))
        return
      } catch {
        // Fall through to per-directory watchers.
      }
      for (const dir of [root, ...(await logDirs(workspace)).map((entry) => entry.dir)]) {
        if (disposed) return
        try {
          watchers.push(watchFactory(dir, { recursive: false }, schedule))
        } catch {
          // A directory we can't watch just won't tail; the rest still do.
        }
      }
    }

    void seed()

    return () => {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
      watchers.length = 0
    }
  }

  return { sources, read, watch }
}
