import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs, {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { claudeCacheSlug } from './mcpLogParse'
import {
  claudeCacheRoot,
  createMcpLogService,
  nearestExistingDir,
  type McpLogService
} from './mcpLogService'

/**
 * `McpLogService` unit tests against a real temp cache directory laid out
 * exactly like the CLI's (`<cache>/<slug(cwd)>/mcp-logs-<server>/<iso>.jsonl`),
 * same on-disk approach as `mcpService.test.ts`. The watcher tests drive
 * `fs.watch` for real rather than faking it — the thing worth proving is that
 * appending to a live log file produces exactly the appended entries, and a
 * fake would prove only that the fake works.
 */

let cacheRoot: string
let workspace: string
let service: McpLogService

/** Absolute path of a server's log directory inside the fake cache. */
function logDir(server: string): string {
  return join(cacheRoot, claudeCacheSlug(workspace), `mcp-logs-${server}`)
}

/** One CLI log line, JSON-encoded. */
function line(payload: Record<string, unknown>, at = '2026-08-06T16:41:18.361Z'): string {
  return `${JSON.stringify({ timestamp: at, sessionId: 's1', cwd: workspace, ...payload })}\n`
}

/** Writes a whole connection file for `server`. */
function writeLog(server: string, file: string, lines: string[]): string {
  const dir = logDir(server)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, file)
  writeFileSync(path, lines.join(''), 'utf8')
  return path
}

/** Polls until `predicate` holds or the budget runs out — fs.watch has no ready signal. */
async function eventually(predicate: () => boolean, budgetMs = 3000): Promise<void> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  expect(predicate(), 'condition never became true within the budget').toBe(true)
}

/**
 * Writes a dangling symlink into a server's log directory: `readdir` lists it,
 * `stat` throws ENOENT following it. That is the real shape of the race the
 * service's stat guards exist for (a file removed between listing and reading)
 * and it needs no module mocking to produce.
 */
function writeDanglingLog(server: string, file: string): string {
  const dir = logDir(server)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, file)
  symlinkSync(join(dir, 'target-that-does-not-exist.jsonl'), path)
  return path
}

beforeEach(() => {
  cacheRoot = mkdtempSync(join(tmpdir(), 'hive-mcplog-cache-'))
  workspace = mkdtempSync(join(tmpdir(), 'hive-mcplog-ws-'))
  service = createMcpLogService({ cacheRoot })
})

afterEach(() => {
  rmSync(cacheRoot, { recursive: true, force: true })
  rmSync(workspace, { recursive: true, force: true })
})

describe('claudeCacheRoot', () => {
  it('follows env-paths on linux, honouring XDG_CACHE_HOME', () => {
    expect(claudeCacheRoot('linux', { XDG_CACHE_HOME: '/xdg' }, '/home/u')).toBe(
      '/xdg/claude-cli-nodejs'
    )
    expect(claudeCacheRoot('linux', {}, '/home/u')).toBe('/home/u/.cache/claude-cli-nodejs')
  })

  it('uses the macOS caches directory', () => {
    expect(claudeCacheRoot('darwin', {}, '/Users/ana')).toBe(
      '/Users/ana/Library/Caches/claude-cli-nodejs'
    )
  })

  it('uses LOCALAPPDATA with the env-paths Cache suffix on Windows', () => {
    expect(claudeCacheRoot('win32', { LOCALAPPDATA: 'C:\\l' }, 'C:\\u')).toBe(
      join('C:\\l', 'claude-cli-nodejs', 'Cache')
    )
    expect(claudeCacheRoot('win32', {}, 'C:\\u')).toBe(
      join('C:\\u', 'AppData', 'Local', 'claude-cli-nodejs', 'Cache')
    )
  })

  it('defaults its arguments to the running process', () => {
    expect(claudeCacheRoot()).toContain('claude-cli-nodejs')
  })
})

describe('McpLogService.sources', () => {
  it('returns nothing when the CLI has never run in this workspace', async () => {
    await expect(service.sources(workspace)).resolves.toEqual([])
  })

  it('lists one entry per mcp-logs directory, most recently active first', async () => {
    // mtimes are stamped explicitly: a sleep between writes is not enough on a
    // filesystem whose timestamp resolution is coarser than the gap.
    const older = writeLog('pencil', '2026-08-01T00-00-00-000Z.jsonl', [line({ debug: 'a' })])
    writeLog('playwright', '2026-08-02T00-00-00-000Z.jsonl', [line({ debug: 'b' })])
    const newest = writeLog('playwright', '2026-08-03T00-00-00-000Z.jsonl', [line({ debug: 'c' })])
    utimesSync(older, new Date(1_000_000), new Date(1_000_000))
    utimesSync(newest, new Date(9_000_000), new Date(9_000_000))

    const sources = await service.sources(workspace)
    expect(sources.map((source) => source.server)).toEqual(['playwright', 'pencil'])
    expect(sources[0]).toMatchObject({ files: 2, dir: logDir('playwright') })
    expect(sources[0].lastActivityAt).toBeGreaterThan(0)
  })

  it('ignores directories that are not mcp-logs-<name>', async () => {
    mkdirSync(join(cacheRoot, claudeCacheSlug(workspace), 'other-cache'), { recursive: true })
    mkdirSync(join(cacheRoot, claudeCacheSlug(workspace), 'mcp-logs-'), { recursive: true })
    writeLog('real', 'a.jsonl', [line({ debug: 'x' })])
    expect((await service.sources(workspace)).map((source) => source.server)).toEqual(['real'])
  })

  it('reports an empty log directory with no activity rather than skipping it', async () => {
    mkdirSync(logDir('quiet'), { recursive: true })
    await expect(service.sources(workspace)).resolves.toEqual([
      { server: 'quiet', dir: logDir('quiet'), files: 0, lastActivityAt: null }
    ])
  })
})

describe('McpLogService.read', () => {
  it('returns nothing for a workspace with no cache', async () => {
    await expect(service.read(workspace)).resolves.toEqual([])
  })

  it('parses every server, oldest entry first', async () => {
    writeLog('pencil', 'a.jsonl', [
      line({ debug: 'Calling MCP tool: get_app_state' }, '2026-08-06T10:00:02.000Z')
    ])
    writeLog('playwright', 'b.jsonl', [
      line({ debug: 'Starting connection with timeout of 30000ms' }, '2026-08-06T10:00:01.000Z')
    ])

    const entries = await service.read(workspace)
    expect(entries.map((entry) => entry.server)).toEqual(['playwright', 'pencil'])
    expect(entries[1]).toMatchObject({ kind: 'tool-call', tool: 'get_app_state' })
  })

  it('limits to one server when asked', async () => {
    writeLog('pencil', 'a.jsonl', [line({ debug: 'x' })])
    writeLog('playwright', 'b.jsonl', [line({ debug: 'y' })])
    const entries = await service.read(workspace, { server: 'pencil' })
    expect(entries).toHaveLength(1)
    expect(entries[0].server).toBe('pencil')
  })

  it('keeps the newest entries when the budget is smaller than the history', async () => {
    writeLog(
      'pencil',
      'a.jsonl',
      Array.from({ length: 10 }, (_unused, index) =>
        line({ debug: `n${index}` }, `2026-08-06T10:00:0${index}.000Z`)
      )
    )
    const entries = await service.read(workspace, { limit: 3 })
    expect(entries.map((entry) => entry.text)).toEqual(['n7', 'n8', 'n9'])
  })

  it('spends the budget across servers rather than on the chattiest one', async () => {
    writeLog(
      'loud',
      'a.jsonl',
      Array.from({ length: 50 }, (_unused, index) => line({ debug: `loud${index}` }))
    )
    writeLog('quiet', 'b.jsonl', [line({ debug: 'quiet0' })])
    const entries = await service.read(workspace, { limit: 5 })
    expect(entries.some((entry) => entry.server === 'quiet')).toBe(true)
  })

  it('reads newer files before older ones', async () => {
    writeLog('pencil', '2026-08-01T00-00-00-000Z.jsonl', [
      line({ debug: 'old' }, '2026-08-01T00:00:00.000Z')
    ])
    writeLog('pencil', '2026-08-09T00-00-00-000Z.jsonl', [
      line({ debug: 'new' }, '2026-08-09T00:00:00.000Z')
    ])
    const entries = await service.read(workspace, { limit: 1 })
    expect(entries.map((entry) => entry.text)).toEqual(['new'])
  })

  it('survives a file that disappears between listing and reading', async () => {
    const path = writeLog('pencil', 'a.jsonl', [line({ debug: 'x' })])
    rmSync(path)
    await expect(service.read(workspace)).resolves.toEqual([])
  })

  it('skips a non-jsonl file in the log directory', async () => {
    mkdirSync(logDir('pencil'), { recursive: true })
    writeFileSync(join(logDir('pencil'), 'notes.txt'), 'not a log', 'utf8')
    await expect(service.read(workspace)).resolves.toEqual([])
  })

  it('handles an empty log file — a connection that produced no lines', async () => {
    writeLog('pencil', 'empty.jsonl', [])
    await expect(service.read(workspace)).resolves.toEqual([])
  })

  it('ignores an mcp-logs-* entry that is a file rather than a directory', async () => {
    mkdirSync(join(cacheRoot, claudeCacheSlug(workspace)), { recursive: true })
    writeFileSync(join(cacheRoot, claudeCacheSlug(workspace), 'mcp-logs-bogus'), 'x', 'utf8')
    writeLog('real', 'a.jsonl', [line({ debug: 'ok' })])
    const entries = await service.read(workspace)
    expect(entries.map((entry) => entry.server)).toEqual(['real'])
  })

  it('reports no activity for a source whose only file is unreadable', async () => {
    writeDanglingLog('pencil', 'dangling.jsonl')
    expect((await service.sources(workspace))[0].lastActivityAt).toBeNull()
  })

  it('skips an unreadable file rather than failing the whole read', async () => {
    writeDanglingLog('pencil', 'dangling.jsonl')
    writeLog('pencil', 'good.jsonl', [line({ debug: 'legivel' })])
    const entries = await service.read(workspace)
    expect(entries.map((item) => item.text)).toEqual(['legivel'])
  })
})

describe('createMcpLogService defaults', () => {
  it('falls back to the real CLI cache when no root is injected', async () => {
    // No assertion on contents — the machine may or may not have logs. What
    // matters is that the default root resolves and the call doesn't throw.
    await expect(createMcpLogService().sources('/definitely/not/a/workspace')).resolves.toEqual([])
  })
})

describe('McpLogService.watch', () => {
  it('streams only what is appended after the watch starts', async () => {
    const path = writeLog('playwright', 'live.jsonl', [line({ debug: 'history' })])
    const batches: string[][] = []
    const stop = service.watch(workspace, (entries) =>
      batches.push(entries.map((entry) => entry.text))
    )

    // Give `seed` a beat to record the current size before appending.
    await new Promise((resolve) => setTimeout(resolve, 150))
    appendFileSync(path, line({ debug: 'Calling MCP tool: browser_navigate' }), 'utf8')

    await eventually(() => batches.length > 0)
    stop()
    expect(batches.flat()).toEqual(['Calling MCP tool: browser_navigate'])
  })

  it('picks up a brand-new connection file from its first line', async () => {
    writeLog('playwright', 'old.jsonl', [line({ debug: 'history' })])
    const batches: string[][] = []
    const stop = service.watch(workspace, (entries) =>
      batches.push(entries.map((entry) => entry.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 150))

    writeLog('playwright', 'new.jsonl', [line({ debug: 'fresh connection' })])

    await eventually(() => batches.flat().includes('fresh connection'))
    stop()
    expect(batches.flat()).not.toContain('history')
  })

  it('re-reads a truncated file from the top rather than losing it', async () => {
    const path = writeLog('pencil', 'live.jsonl', [line({ debug: 'one' }), line({ debug: 'two' })])
    const seen: string[] = []
    const stop = service.watch(workspace, (entries) =>
      seen.push(...entries.map((entry) => entry.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 150))

    writeFileSync(path, line({ debug: 'rotated' }), 'utf8')

    await eventually(() => seen.includes('rotated'))
    stop()
  })

  it('resumes exactly where read() stopped, with no repeated rows', async () => {
    const path = writeLog('pencil', 'live.jsonl', [line({ debug: 'um' }), line({ debug: 'dois' })])
    const history = await service.read(workspace)
    expect(history).toHaveLength(2)

    const seen: string[] = []
    const stop = service.watch(workspace, (entries) =>
      seen.push(...entries.map((item) => item.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 150))
    appendFileSync(path, line({ debug: 'tres' }), 'utf8')

    await eventually(() => seen.includes('tres'))
    stop()
    // The two rows `read` already returned must not come back down the tail.
    expect(seen).toEqual(['tres'])
  })

  it('stops delivering after the disposer runs', async () => {
    const path = writeLog('pencil', 'live.jsonl', [line({ debug: 'x' })])
    const onBatch = vi.fn()
    const stop = service.watch(workspace, onBatch)
    await new Promise((resolve) => setTimeout(resolve, 150))
    stop()

    appendFileSync(path, line({ debug: 'after' }), 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('is a no-op disposer when the workspace has no cache directory at all', () => {
    const onBatch = vi.fn()
    const stop = service.watch(workspace, onBatch)
    expect(() => stop()).not.toThrow()
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('falls back to per-directory watchers where recursive is unsupported', async () => {
    // Node documents `recursive` as platform-dependent. The injected factory
    // stands in for a kernel that refuses it; everything below it is real.
    const refusesRecursive = createMcpLogService({
      cacheRoot,
      watchFactory: (path, options, onChange) => {
        if (options.recursive) throw new Error('recursive not supported')
        return fs.watch(path, { recursive: false }, onChange)
      }
    })

    const path = writeLog('pencil', 'live.jsonl', [line({ debug: 'history' })])
    const seen: string[] = []
    const stop = refusesRecursive.watch(workspace, (entries) =>
      seen.push(...entries.map((item) => item.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
    appendFileSync(path, line({ debug: 'via fallback' }), 'utf8')

    await eventually(() => seen.includes('via fallback'))
    stop()
  })

  it('watches nothing at all when no watcher can be created', () => {
    const noWatchers = createMcpLogService({
      cacheRoot,
      watchFactory: () => {
        throw new Error('nope')
      }
    })
    writeLog('pencil', 'a.jsonl', [line({ debug: 'x' })])
    const stop = noWatchers.watch(workspace, vi.fn())
    expect(() => stop()).not.toThrow()
  })

  it('keeps tailing the readable files when one in the directory is unreadable', async () => {
    writeDanglingLog('pencil', 'dangling.jsonl')
    const path = writeLog('pencil', 'live.jsonl', [line({ debug: 'history' })])
    const seen: string[] = []
    const stop = service.watch(workspace, (entries) =>
      seen.push(...entries.map((item) => item.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
    appendFileSync(path, line({ debug: 'apesar do link quebrado' }), 'utf8')

    await eventually(() => seen.includes('apesar do link quebrado'))
    stop()
  })

  /**
   * The defect this suite exists for. A workspace has no cache directory until
   * the CLI has run in it once — which is the ordinary state of a console
   * opened on a fresh workspace, and precisely when someone is watching. The
   * old `attach` returned early on a missing root and never tried again, so
   * the agent would run, the CLI would create the directory and fill it, and
   * the dock stayed empty for the rest of the session.
   */
  it('starts tailing a workspace whose cache directory does not exist yet', async () => {
    // Nothing has ever run here: no slug directory, no server directories.
    expect(service.locate(workspace).exists).toBe(false)

    const seen: string[] = []
    const stop = service.watch(workspace, (entries) =>
      seen.push(...entries.map((item) => item.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Now the CLI runs for the first time and writes a whole connection file.
    writeLog('playwright', 'first.jsonl', [
      line({ debug: 'Starting connection with timeout of 30000ms' }),
      line({ debug: 'Calling MCP tool: browser_navigate' })
    ])

    await eventually(() => seen.includes('Calling MCP tool: browser_navigate'))
    stop()
  })

  it('picks up a server that connects for the first time mid-session', async () => {
    writeLog('pencil', 'a.jsonl', [line({ debug: 'history' })])
    const seen: string[] = []
    const stop = service.watch(workspace, (entries) =>
      seen.push(...entries.map((item) => item.text))
    )
    await new Promise((resolve) => setTimeout(resolve, 150))

    // A brand-new `mcp-logs-*` directory, not just a new file in a known one.
    writeLog('playwright', 'b.jsonl', [line({ debug: 'servidor novo' })])

    await eventually(() => seen.includes('servidor novo'))
    stop()
  })
})

describe('McpLogService.locate', () => {
  it('reports the derived directory and whether it is there yet', () => {
    const before = service.locate(workspace)
    expect(before.dir).toBe(join(cacheRoot, claudeCacheSlug(workspace)))
    expect(before.exists).toBe(false)

    writeLog('pencil', 'a.jsonl', [line({ debug: 'x' })])
    expect(service.locate(workspace).exists).toBe(true)
  })
})

describe('nearestExistingDir', () => {
  it('returns the path itself when it exists', () => {
    expect(nearestExistingDir(cacheRoot)).toBe(cacheRoot)
  })

  it('climbs to the closest ancestor that does exist', () => {
    expect(nearestExistingDir(join(cacheRoot, 'a', 'b', 'c'))).toBe(cacheRoot)
  })

  it('gives up at the filesystem root rather than looping forever', () => {
    // `dirname` is a fixed point at the root, so a path whose every component
    // is missing must terminate on the root itself (which exists) — the loop
    // guard is what this pins.
    expect(nearestExistingDir(join('/', 'definitely-not-here-hive-test'))).toBe('/')
  })
})
