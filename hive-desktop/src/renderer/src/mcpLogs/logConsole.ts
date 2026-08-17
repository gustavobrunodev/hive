import { t } from '../i18n'

/**
 * Renderer-side mirrors of `main/mcpLogParse.ts` / `main/mcpLogService.ts`,
 * following the `ui/mcpForm.ts` convention: the renderer never imports main
 * source, so the shapes that cross IPC are restated here and stay structurally
 * assignable to what the preload bridge hands over.
 */

/** How loud an entry reads. Mirror of `main/mcpLogParse.ts`. */
export type McpLogLevel = 'error' | 'warn' | 'info' | 'debug'

/** What an entry is. Mirror of `main/mcpLogParse.ts`. */
export type McpLogKind =
  | 'connecting'
  | 'connected'
  | 'connect-failed'
  | 'capabilities'
  | 'tool-call'
  | 'tool-running'
  | 'tool-ok'
  | 'tool-failed'
  | 'closed'
  | 'reconnect'
  | 'transport'
  | 'shutdown'
  | 'exited'
  | 'stderr'
  | 'error'
  | 'notice'

/** One classified line of an MCP log file. Mirror of `main/mcpLogParse.ts`. */
export interface McpLogEntry {
  id: string
  server: string
  at: number
  level: McpLogLevel
  kind: McpLogKind
  text: string
  detail: string
  sessionId: string | null
  tool: string | null
  durationMs: number | null
  transport: string | null
  serverVersion: string | null
  raw: string
}

/** One server with logs in this workspace. Mirror of `main/mcpLogService.ts`. */
export interface McpLogSource {
  server: string
  dir: string
  files: number
  lastActivityAt: number | null
}

/** Where the console reads from. Mirror of `main/mcpLogService.ts`. */
export interface McpLogLocation {
  dir: string
  exists: boolean
}

/**
 * `logConsole` — everything the MCP console decides, with no React and no IPC:
 * which entries a filter admits, what the tallies say, how the stream breaks
 * into session bands, how long the longest call in view was, and the per-server
 * rollup the expanded console shows.
 *
 * It lives apart from `McpConsole.tsx` for the usual reason in this codebase:
 * these are the decisions whose failure modes are invisible on screen. A
 * filter that quietly drops a class of errors, a tally that disagrees with the
 * rows under it, or a duration bar scaled to the wrong maximum all *look*
 * fine. Tests can see them; a screenshot can't.
 */

/** The console's four views. `issues` is the one people reach for. */
export type LogFilterId = 'all' | 'tools' | 'connection' | 'issues'

/** Ordered as the segmented control renders them. */
export const LOG_FILTERS: LogFilterId[] = ['all', 'tools', 'connection', 'issues']

/** Kinds that describe a tool the agent invoked. */
const TOOL_KINDS = new Set<McpLogKind>(['tool-call', 'tool-running', 'tool-ok', 'tool-failed'])

/** Kinds that describe the connection itself rather than work done over it. */
const CONNECTION_KINDS = new Set<McpLogKind>([
  'connecting',
  'connected',
  'connect-failed',
  'capabilities',
  'closed',
  'reconnect',
  'transport',
  'shutdown',
  'exited'
])

/** Levels the `issues` view admits — anything the user might need to act on. */
const ISSUE_LEVELS = new Set<McpLogLevel>(['error', 'warn'])

/** True when `entry` belongs in the named view. */
export function matchesFilter(entry: McpLogEntry, filter: LogFilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'tools') return TOOL_KINDS.has(entry.kind)
  if (filter === 'connection') return CONNECTION_KINDS.has(entry.kind)
  return ISSUE_LEVELS.has(entry.level)
}

/**
 * Free-text match across everything visible on a row plus the detail block —
 * a stack trace the row keeps collapsed is exactly what someone pasting an
 * error message is searching for.
 */
export function matchesQuery(entry: McpLogEntry, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    entry.text.toLowerCase().includes(needle) ||
    entry.detail.toLowerCase().includes(needle) ||
    entry.server.toLowerCase().includes(needle) ||
    (entry.tool !== null && entry.tool.toLowerCase().includes(needle))
  )
}

/** What the console is showing: server scope, view, and search text. */
export interface LogQueryState {
  /** A server name, or null for every server. */
  server: string | null
  filter: LogFilterId
  search: string
}

/** Applies the whole query state in one pass, preserving order. */
export function applyQuery(entries: McpLogEntry[], query: LogQueryState): McpLogEntry[] {
  return entries.filter(
    (entry) =>
      (query.server === null || entry.server === query.server) &&
      matchesFilter(entry, query.filter) &&
      matchesQuery(entry, query.search)
  )
}

/**
 * The segmented control's tallies. Counted against the *server and search*
 * scope but not the view itself — otherwise every segment but the active one
 * would read zero, and the point of the tally is to say what switching would
 * show you.
 */
export function countByFilter(
  entries: McpLogEntry[],
  scope: Pick<LogQueryState, 'server' | 'search'>
): Record<LogFilterId, number> {
  const scoped = entries.filter(
    (entry) =>
      (scope.server === null || entry.server === scope.server) && matchesQuery(entry, scope.search)
  )
  return {
    all: scoped.length,
    tools: scoped.filter((entry) => matchesFilter(entry, 'tools')).length,
    connection: scoped.filter((entry) => matchesFilter(entry, 'connection')).length,
    issues: scoped.filter((entry) => matchesFilter(entry, 'issues')).length
  }
}

/** A run of consecutive entries from one CLI session. */
export interface LogGroup {
  /** The session's id, or null for entries the CLI logged without one. */
  sessionId: string | null
  /** When the run starts — the band's timestamp. */
  startedAt: number
  entries: McpLogEntry[]
}

/**
 * Breaks the stream into session bands. Consecutive runs, not a global
 * group-by: a session that comes back after another one interleaved should
 * read as two passages in time, which is how it happened, rather than being
 * folded into one block that lies about the order.
 */
export function groupBySession(entries: McpLogEntry[]): LogGroup[] {
  const groups: LogGroup[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (last && last.sessionId === entry.sessionId) {
      last.entries.push(entry)
      continue
    }
    groups.push({ sessionId: entry.sessionId, startedAt: entry.at, entries: [entry] })
  }
  return groups
}

/** Kinds whose duration is "how long the agent waited on this call". */
const TIMED_TOOL_KINDS = new Set<McpLogKind>(['tool-ok', 'tool-running', 'tool-failed'])

/** True when this row should draw a proportional duration bar. */
export function hasDurationBar(entry: McpLogEntry): boolean {
  return TIMED_TOOL_KINDS.has(entry.kind) && entry.durationMs !== null && entry.durationMs > 0
}

/**
 * The bar's full-scale value: the slowest call currently in view. Scaling to
 * the view rather than to a fixed ceiling is what makes the bars comparative —
 * the question is always "which of *these* calls was slow", and a fixed scale
 * would flatten a screen of fast calls into nothing.
 */
export function durationScale(entries: McpLogEntry[]): number {
  let max = 0
  for (const entry of entries) {
    if (hasDurationBar(entry) && entry.durationMs !== null && entry.durationMs > max) {
      max = entry.durationMs
    }
  }
  return max
}

/** One server's rollup for the expanded console's rail. */
export interface ServerStat {
  server: string
  /** Tool invocations seen in the loaded window. */
  calls: number
  /** Entries at error level. */
  errors: number
  /** The slowest timed call, in ms; null when nothing timed ran. */
  slowestMs: number | null
  /** Median timed call, in ms; null when nothing timed ran. */
  medianMs: number | null
  /** The most recent entry's time. */
  lastAt: number
  /** Whether the last connection event for this server was a successful connect. */
  live: boolean
  /**
   * Whether the last connection event was a *failure*. Not the negation of
   * `live`: a cleanly closed connection is neither live nor failed, and the
   * roster must not paint an ordinary end-of-turn shutdown as trouble.
   */
  lastFailed: boolean
}

/** The median of a non-empty sorted list, averaging the middle pair when even. */
function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/**
 * Per-server rollup over the loaded window, busiest-recent first. `live` reads
 * the *last* connection-shaped event rather than counting connects: a server
 * that connected ten times and then exited is not live, and the only event
 * that settles it is the most recent one.
 */
export function serverStats(entries: McpLogEntry[]): ServerStat[] {
  const byServer = new Map<string, McpLogEntry[]>()
  for (const entry of entries) {
    const bucket = byServer.get(entry.server)
    if (bucket) bucket.push(entry)
    else byServer.set(entry.server, [entry])
  }

  const stats: ServerStat[] = []
  for (const [server, group] of byServer) {
    const durations = group
      .filter((entry) => TIMED_TOOL_KINDS.has(entry.kind) && entry.durationMs !== null)
      .map((entry) => entry.durationMs as number)
      .sort((a, b) => a - b)
    const lastConnection = group.filter((entry) => CONNECTION_KINDS.has(entry.kind)).at(-1)
    stats.push({
      server,
      calls: group.filter((entry) => entry.kind === 'tool-call').length,
      errors: group.filter((entry) => entry.level === 'error').length,
      slowestMs: durations.length > 0 ? durations[durations.length - 1] : null,
      medianMs: durations.length > 0 ? median(durations) : null,
      lastAt: group.reduce((latest, entry) => Math.max(latest, entry.at), 0),
      live: lastConnection?.kind === 'connected' || lastConnection?.kind === 'capabilities',
      lastFailed: lastConnection?.kind === 'connect-failed'
    })
  }
  return stats.sort((a, b) => b.lastAt - a.lastAt)
}

/** `16:41:18` — wall-clock, seconds included, because ordering within a turn matters. */
export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/** `6 de ago., 16:41` — the session band's stamp. */
export function formatBandStamp(at: number): string {
  return new Date(at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const SECOND = 1000

/**
 * `12 ms` / `450 ms` / `1,4 s` / `34 s`.
 *
 * Deliberately not `chat/turnTiming.ts`'s `formatDuration`: that one floors
 * everything under a second to one decimal of a second, which is right for
 * turn timing and useless here — an MCP call is routinely 8 ms, and "0,0s"
 * says nothing. Milliseconds below a second, seconds above it.
 */
export function formatLatency(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0
  if (safe < SECOND) return t('mcpLogs.latencyMs', safe)
  const seconds = safe / SECOND
  return t('mcpLogs.latencySeconds', seconds.toFixed(seconds < 10 ? 1 : 0).replace('.', ','))
}

/**
 * How each kind becomes a sentence. Kinds absent from the table render their
 * own `text` — that's the right default for everything whose content *is* the
 * message (server stderr, a failure reason, an unrecognized CLI line), and it
 * means a kind added upstream degrades to "shown verbatim" rather than blank.
 */
const SENTENCE: Partial<Record<McpLogKind, (entry: McpLogEntry) => string>> = {
  connecting: () => t('mcpLogs.eventConnecting'),
  connected: (entry) => t('mcpLogs.eventConnected', entry.transport ?? ''),
  capabilities: (entry) =>
    entry.serverVersion !== null
      ? t('mcpLogs.eventCapabilities', entry.serverVersion)
      : t('mcpLogs.eventCapabilitiesPlain'),
  // A tool row leads with the tool's own name: it is the identifier the user
  // is scanning for, and the surrounding columns already say what happened.
  'tool-call': (entry) => entry.tool ?? entry.text,
  'tool-ok': (entry) => entry.tool ?? entry.text,
  'tool-running': (entry) => t('mcpLogs.eventToolRunning', entry.tool ?? ''),
  closed: () => t('mcpLogs.eventClosed'),
  reconnect: () => t('mcpLogs.eventReconnect'),
  shutdown: () => t('mcpLogs.eventShutdown'),
  exited: () => t('mcpLogs.eventExited')
}

/** The row's human sentence in pt-BR, built from the entry's typed facts. */
export function describeEntry(entry: McpLogEntry): string {
  return SENTENCE[entry.kind]?.(entry) ?? entry.text
}

/**
 * The short category word shown beside the time. Kept separate from the
 * sentence so the eye can scan one column for "what kind of thing is this"
 * without reading the prose next to it.
 */
export function categoryLabel(entry: McpLogEntry): string {
  if (TOOL_KINDS.has(entry.kind)) return t('mcpLogs.categoryTool')
  if (entry.kind === 'stderr') return t('mcpLogs.categoryStderr')
  if (CONNECTION_KINDS.has(entry.kind)) return t('mcpLogs.categoryConnection')
  return t('mcpLogs.categoryOther')
}
