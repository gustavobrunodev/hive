/**
 * `mcpLogParse` — the pure half of the MCP log module: turn one line of the
 * Claude Code CLI's own MCP log file into a typed event.
 *
 * The CLI keeps a per-server diagnostic log for every workspace it runs in,
 * under `<cache>/claude-cli-nodejs/<slug>/mcp-logs-<server>/<iso>.jsonl` — one
 * file per connection attempt, one JSON object per line:
 *
 * ```json
 * {"debug":"Calling MCP tool: browser_navigate","timestamp":"…","sessionId":"…","cwd":"…"}
 * {"error":"Server stderr: …","timestamp":"…","sessionId":"…","cwd":"…"}
 * ```
 *
 * That is the *real* record of an MCP server in use — every connection, every
 * tool call and how long it took, and everything the server wrote to stderr
 * while the agent was working. `mcpProbe.ts` only ever sees a one-shot
 * handshake we start ourselves; this is the agent's actual traffic.
 *
 * The CLI writes free text, so this module's job is to recover structure from
 * it: which of a dozen known sentences a line is (`kind`), how loud it should
 * read (`level`), and the facts worth showing on their own (`tool`,
 * `durationMs`, `transport`, `serverVersion`). Anything unrecognized still
 * becomes an entry — an unclassified line is `kind: 'notice'`, never dropped —
 * so a CLI release that reworks its wording degrades to "shown verbatim"
 * rather than to a blank console.
 *
 * Pure and I/O-free on purpose: `mcpLogService.ts` owns the filesystem, and
 * the whole classification table is unit-testable against real log fixtures.
 */

/** How loud an entry reads. Drives the console's colour and the level filter. */
export type McpLogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * What an entry *is*. The renderer builds its pt-BR sentence from this plus
 * the extracted facts, so the wording lives in i18n and not in the log parser.
 */
export type McpLogKind =
  /** The CLI started dialing the server. */
  | 'connecting'
  /** The server answered the handshake. Carries `transport` + `durationMs`. */
  | 'connected'
  /** The handshake failed. Carries the reason as `text`. */
  | 'connect-failed'
  /** Post-handshake capability report. Carries `serverVersion`. */
  | 'capabilities'
  /** The agent invoked a tool. Carries `tool`. */
  | 'tool-call'
  /** A tool is taking a while; the CLI checkpoints it. Carries `tool` + elapsed `durationMs`. */
  | 'tool-running'
  /** A tool returned. Carries `tool` + `durationMs`. */
  | 'tool-ok'
  /** A tool threw. Carries `tool` when the CLI named it, and the stack as `detail`. */
  | 'tool-failed'
  /** The connection ended. Carries `transport` + `durationMs` (how long it lived). */
  | 'closed'
  /** The cached connection was dropped, so the next call re-dials. */
  | 'reconnect'
  /** Transport plumbing — URL parsing, proxy setup, environment probing. */
  | 'transport'
  /** The CLI is signalling the child process to stop. */
  | 'shutdown'
  /** The child process is gone. */
  | 'exited'
  /** Something the server itself printed to stderr. */
  | 'stderr'
  /** An error the CLI reported that isn't one of the shapes above. */
  | 'error'
  /** Anything else — housekeeping, transport setup, or unrecognized wording. */
  | 'notice'

/** One classified line of an MCP log file. */
export interface McpLogEntry {
  /** Stable within a session: `<file>#<line ordinal>`. Used as the React key. */
  id: string
  /** The server this log belongs to, from its `mcp-logs-<server>` directory. */
  server: string
  /** Event time in epoch ms (the CLI's own `timestamp`, or the read time). */
  at: number
  level: McpLogLevel
  kind: McpLogKind
  /** The first line of the CLI's text — the summary, when there is no typed sentence. */
  text: string
  /** Everything after the first line: stacks, multi-line stderr. Empty when there is none. */
  detail: string
  /** The CLI session that produced this line — the console groups by it. */
  sessionId: string | null
  /** The tool name, for `tool-*` kinds. */
  tool: string | null
  /** Milliseconds, for kinds that report a duration. */
  durationMs: number | null
  /** `stdio` / `http` / `sse` / `unknown`, for connection kinds. */
  transport: string | null
  /** The server's self-reported `name vX.Y.Z`, from the capabilities line. */
  serverVersion: string | null
  /** The original JSON line, so the console can offer "copiar bruto". */
  raw: string
}

/** The classification result before it gets an id/server/timestamp. */
type Classified = Pick<
  McpLogEntry,
  'level' | 'kind' | 'text' | 'detail' | 'tool' | 'durationMs' | 'transport' | 'serverVersion'
>

/** The subset of the CLI's log-line JSON we read. */
interface RawLogLine {
  debug?: unknown
  error?: unknown
  timestamp?: unknown
  sessionId?: unknown
}

/**
 * The `env-paths`-style cache directory name the CLI derives from a working
 * directory: every non-alphanumeric character becomes a dash. Verified against
 * every directory present in a real `~/.cache/claude-cli-nodejs` by comparing
 * each one to the `cwd` recorded inside its own log lines.
 */
export function claudeCacheSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

/** Splits `"<first line>\n<rest>"` into the summary and its detail block. */
function splitDetail(value: string): { text: string; detail: string } {
  const newline = value.indexOf('\n')
  if (newline === -1) return { text: value.trim(), detail: '' }
  return { text: value.slice(0, newline).trim(), detail: value.slice(newline + 1).trimEnd() }
}

/**
 * Reads the CLI's duration wording (`2302ms`, `2.3s`, `34s`) as milliseconds.
 * Returns null when the unit isn't one the CLI writes.
 *
 * The CLI does occasionally emit a negative elapsed time (`in -1ms`) when the
 * host clock steps mid-connection. That is a clock artifact, not information,
 * so it clamps to zero rather than reaching the console as "-1 ms".
 */
function toMs(amount: string, unit: string): number | null {
  const value = Number(amount)
  // The patterns capture `[\d.]+`, which admits `1.2.3` — real, if rare, in a
  // log line the CLI assembled from a malformed number.
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(unit === 'ms' ? value : value * 1000))
}

/** Server stderr is informational far more often than not — promote only on real trouble. */
const STDERR_ALARM = /\b(error|fatal|exception|failed|ENOENT|EACCES|EADDRINUSE|traceback)\b/i

/** What a matched pattern contributes on top of the shared text/detail fields. */
type Facts = Partial<Omit<Classified, 'text' | 'detail'>> & Pick<Classified, 'level' | 'kind'>

/**
 * The classification table for the CLI's `debug` sentences, ordered most
 * specific first: the first pattern that matches wins, and a line that matches
 * nothing becomes a `notice` rather than being dropped.
 *
 * A table rather than a chain of `if`s because it *is* a table — every row is
 * "this wording means this event, and these captures are its facts" — and
 * because adding a wording the CLI starts printing should be one line here.
 */
const DEBUG_RULES: { pattern: RegExp; facts: (match: RegExpExecArray) => Facts }[] = [
  {
    pattern: /^Successfully connected \(transport: ([\w-]+)\) in (-?[\d.]+)(ms|s)$/,
    facts: (m) => ({
      level: 'info',
      kind: 'connected',
      transport: m[1],
      durationMs: toMs(m[2], m[3])
    })
  },
  {
    pattern: /^Starting connection with timeout/,
    facts: () => ({ level: 'debug', kind: 'connecting' })
  },
  {
    // Four wordings for one event: `Connection failed: …`, the timed
    // `Connection failed after 30000ms: …`, a transport-prefixed `HTTP
    // Connection failed after …`, and `Connection error: …` — the
    // post-handshake sibling (a timeout or abort on a connection that was up).
    pattern: /^(?:[\w-]+ )?Connection (?:failed|error)(?: after (-?[\d.]+)(ms|s))?:/i,
    facts: (m) => ({
      level: 'error',
      kind: 'connect-failed',
      durationMs: m[1] ? toMs(m[1], m[2]) : null
    })
  },
  {
    pattern: /^Connection established with capabilities: (.+)$/,
    facts: (m) => ({
      level: 'debug',
      kind: 'capabilities',
      serverVersion: readServerVersion(m[1])
    })
  },
  {
    pattern: /^Calling MCP tool: (\S+)$/,
    facts: (m) => ({ level: 'info', kind: 'tool-call', tool: m[1] })
  },
  {
    // A retry after the CLI recovered a dropped session — a call, but notable.
    pattern: /^Retrying tool '(.+?)'/,
    facts: (m) => ({ level: 'warn', kind: 'tool-call', tool: m[1] })
  },
  {
    pattern: /^Tool '(.+?)' completed successfully in (-?[\d.]+)(ms|s)$/,
    facts: (m) => ({ level: 'info', kind: 'tool-ok', tool: m[1], durationMs: toMs(m[2], m[3]) })
  },
  {
    // The CLI's keep-alive checkpoint for a call that hasn't returned — the one
    // line that names *which* tool a stalled turn is waiting on.
    pattern: /^Tool '(.+?)' still running \((-?[\d.]+)(ms|s) elapsed\)/,
    facts: (m) => ({
      level: 'warn',
      kind: 'tool-running',
      tool: m[1],
      durationMs: toMs(m[2], m[3])
    })
  },
  {
    pattern: /^Tool '(.+?)' failed/,
    facts: (m) => ({ level: 'error', kind: 'tool-failed', tool: m[1] })
  },
  {
    // `(cleanly)` is the CLI's own qualifier; a "dropped" connection is the
    // same event without it, and reads a step louder.
    pattern: /^([\w-]+) connection (closed|dropped) after (-?[\d.]+)(ms|s)/i,
    facts: (m) => ({
      level: m[2].toLowerCase() === 'dropped' ? 'warn' : 'debug',
      kind: 'closed',
      transport: m[1].toLowerCase(),
      durationMs: toMs(m[3], m[4])
    })
  },
  { pattern: /^SIG\w+ failed/, facts: () => ({ level: 'warn', kind: 'shutdown' }) },
  {
    // Two wordings for the same event across CLI releases: the signal-by-signal
    // `Sending SIGINT to MCP server process`, and the newer one-liner
    // `Terminating MCP server process tree` that replaced it.
    pattern: /^(?:Sending SIG\w+ to|Terminating) MCP server process/,
    facts: () => ({ level: 'debug', kind: 'shutdown' })
  },
  { pattern: /^MCP server process exited/, facts: () => ({ level: 'debug', kind: 'exited' }) },
  {
    // An expired session is a reconnect nobody asked for — louder than the
    // routine cache clear that precedes a normal re-dial.
    pattern: /session expired/i,
    facts: () => ({ level: 'warn', kind: 'reconnect' })
  },
  { pattern: /^Cleared connection cache/, facts: () => ({ level: 'debug', kind: 'reconnect' }) },
  {
    // The CLI's connection plumbing — URL parsing, proxy selection, the
    // environment dump before dialing a remote server. Real diagnostics when a
    // remote MCP won't connect, noise otherwise, which is why it gets its own
    // kind instead of sharing `notice` with genuinely unknown wording.
    pattern:
      /^(?:Initializing |Using |Testing basic |Parsed URL:|Client created|HTTP transport|Environment:|Node version:|claude\.ai proxy|Received \w+ request from server)/,
    facts: () => ({ level: 'debug', kind: 'transport' })
  }
]

function classifyDebug(value: string): Classified {
  const { text, detail } = splitDetail(value)
  const base: Classified = {
    text,
    detail,
    level: 'debug',
    kind: 'notice',
    tool: null,
    durationMs: null,
    transport: null,
    serverVersion: null
  }

  for (const rule of DEBUG_RULES) {
    const match = rule.pattern.exec(text)
    if (match) return { ...base, ...rule.facts(match) }
  }
  return base
}

/** Pulls `"name vX.Y.Z"` out of the capabilities line's embedded JSON. */
function readServerVersion(json: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const version = (parsed as { serverVersion?: unknown }).serverVersion
  if (version === null || typeof version !== 'object') return null
  const record = version as { name?: unknown; version?: unknown }
  if (typeof record.name !== 'string' || record.name === '') return null
  return typeof record.version === 'string' && record.version !== ''
    ? `${record.name} v${record.version}`
    : record.name
}

/**
 * The classification table for the CLI's `error` sentences. Two of these are
 * not really errors: `Server stderr:` is whatever the server printed (servers
 * routinely log startup banners there), and only a line that *reads* like
 * trouble is promoted past `info`.
 */
function classifyError(value: string): Classified {
  const stderr = /^Server stderr:\s*([\s\S]*)$/.exec(value)
  if (stderr) {
    const { text, detail } = splitDetail(stderr[1])
    const body = `${text}\n${detail}`
    return {
      level: STDERR_ALARM.test(body) ? 'error' : 'info',
      kind: 'stderr',
      text,
      detail,
      tool: null,
      durationMs: null,
      transport: null,
      serverVersion: null
    }
  }

  // The CLI's tool-failure shape: a `### Error` marker, then the stack.
  const marked = /^###\s*Error\s*\n?([\s\S]*)$/.exec(value)
  const { text, detail } = splitDetail(marked ? marked[1] : value)
  return {
    level: 'error',
    kind: marked ? 'tool-failed' : 'error',
    text,
    detail,
    tool: null,
    durationMs: null,
    transport: null,
    serverVersion: null
  }
}

/**
 * Parses one line of a `mcp-logs-<server>/*.jsonl` file into an entry.
 *
 * Returns null for the lines that carry no event: blanks, the NUL padding a
 * killed process can leave behind mid-write, non-JSON, and JSON without either
 * a `debug` or an `error` field.
 */
export function parseLogLine(
  line: string,
  context: { server: string; id: string; fallbackAt: number }
): McpLogEntry | null {
  // A process killed mid-write leaves NUL padding; strip it before parsing.
  const trimmed = line.replace(/\0/g, '').trim()
  if (trimmed === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const record = parsed as RawLogLine
  const classified =
    typeof record.error === 'string'
      ? classifyError(record.error)
      : typeof record.debug === 'string'
        ? classifyDebug(record.debug)
        : null
  if (classified === null) return null

  const stamped = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : Number.NaN

  return {
    ...classified,
    id: context.id,
    server: context.server,
    at: Number.isNaN(stamped) ? context.fallbackAt : stamped,
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : null,
    raw: trimmed
  }
}

/**
 * Parses a whole file body, numbering entries from `startLine` so ids stay
 * stable as a file is tailed (a later read of the same file continues the
 * numbering rather than renumbering from zero).
 */
export function parseLogChunk(
  body: string,
  context: { server: string; file: string; startLine: number; fallbackAt: number }
): McpLogEntry[] {
  const entries: McpLogEntry[] = []
  const lines = body.split('\n')
  for (const [offset, line] of lines.entries()) {
    const entry = parseLogLine(line, {
      server: context.server,
      id: `${context.file}#${context.startLine + offset}`,
      fallbackAt: context.fallbackAt
    })
    if (entry !== null) entries.push(entry)
  }
  return entries
}
