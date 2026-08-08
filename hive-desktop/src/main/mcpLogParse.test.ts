import { describe, expect, it } from 'vitest'
import { claudeCacheSlug, parseLogChunk, parseLogLine, type McpLogEntry } from './mcpLogParse'

/**
 * `mcpLogParse` unit tests. Every `debug`/`error` sentence asserted here was
 * taken verbatim from a real `~/.cache/claude-cli-nodejs/**\/mcp-logs-*` file,
 * so the classification table is pinned to the CLI's actual wording rather
 * than to a guess at it.
 */

const CONTEXT = { server: 'playwright', id: 'f#0', fallbackAt: 1_000 }

/** Wraps a CLI sentence in the JSON envelope the log files actually use. */
function line(payload: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: '2026-08-06T16:41:18.361Z',
    sessionId: 'ecbaface-6b85-4e03-9098-73282d6a8905',
    cwd: '/home/gustavobgt/user-harness/hive',
    ...payload
  })
}

/** Classifies one CLI sentence, failing loudly rather than returning null. */
function parse(payload: Record<string, unknown>): McpLogEntry {
  const entry = parseLogLine(line(payload), CONTEXT)
  if (entry === null) throw new Error('expected the line to classify')
  return entry
}

describe('claudeCacheSlug', () => {
  it('replaces every non-alphanumeric character with a dash', () => {
    expect(claudeCacheSlug('/home/gustavobgt/user-harness/hive')).toBe(
      '-home-gustavobgt-user-harness-hive'
    )
  })

  it('collapses dots the same way, so a dotted directory doubles the dash', () => {
    expect(claudeCacheSlug('/home/u/proj/.claude/worktrees/x')).toBe(
      '-home-u-proj--claude-worktrees-x'
    )
  })

  it('handles a Windows-style path', () => {
    expect(claudeCacheSlug('C:\\Users\\ana\\proj')).toBe('C--Users-ana-proj')
  })
})

describe('parseLogLine — envelope', () => {
  it('carries the timestamp, session and server through', () => {
    const entry = parse({ debug: 'Cleared connection cache for reconnection' })
    expect(entry.at).toBe(Date.parse('2026-08-06T16:41:18.361Z'))
    expect(entry.sessionId).toBe('ecbaface-6b85-4e03-9098-73282d6a8905')
    expect(entry.server).toBe('playwright')
    expect(entry.id).toBe('f#0')
  })

  it('falls back to the supplied time when the timestamp is missing or unparseable', () => {
    const missing = parseLogLine(JSON.stringify({ debug: 'x' }), CONTEXT)
    expect(missing?.at).toBe(1_000)
    const broken = parseLogLine(JSON.stringify({ debug: 'x', timestamp: 'not a date' }), CONTEXT)
    expect(broken?.at).toBe(1_000)
  })

  it('reports no session when the line omits one', () => {
    expect(parseLogLine(JSON.stringify({ debug: 'x' }), CONTEXT)?.sessionId).toBeNull()
  })

  it('keeps the original line for a raw copy', () => {
    expect(parse({ debug: 'Cleared connection cache for reconnection' }).raw).toContain(
      '"debug":"Cleared connection cache for reconnection"'
    )
  })

  it.each([
    ['a blank line', ''],
    ['whitespace', '   \t '],
    ['the NUL padding a killed process leaves', '\0\0\0\0'],
    ['non-JSON', 'Shell cwd was reset to /home/x'],
    ['a JSON array', '[1,2,3]'],
    ['JSON null', 'null'],
    ['an object with neither debug nor error', '{"timestamp":"2026-01-01T00:00:00.000Z"}'],
    ['a non-string debug field', '{"debug":42}']
  ])('returns null for %s', (_label, raw) => {
    expect(parseLogLine(raw, CONTEXT)).toBeNull()
  })

  it('strips NUL padding around an otherwise valid line', () => {
    expect(parseLogLine(`${line({ debug: 'x' })}\0\0`, CONTEXT)?.text).toBe('x')
  })
})

describe('parseLogLine — connection lifecycle', () => {
  it('classifies the dial-out as a quiet debug event', () => {
    const entry = parse({ debug: 'Starting connection with timeout of 30000ms' })
    expect(entry).toMatchObject({ kind: 'connecting', level: 'debug' })
  })

  it('extracts the transport and elapsed time from a successful connect', () => {
    const entry = parse({ debug: 'Successfully connected (transport: stdio) in 2302ms' })
    expect(entry).toMatchObject({
      kind: 'connected',
      level: 'info',
      transport: 'stdio',
      durationMs: 2302
    })
  })

  it('reads a seconds-denominated connect time as milliseconds', () => {
    expect(parse({ debug: 'Successfully connected (transport: http) in 1.5s' })).toMatchObject({
      transport: 'http',
      durationMs: 1500
    })
  })

  it('raises a failed connection to error level', () => {
    const entry = parse({ debug: 'Connection failed: Unable to connect. Is the url reachable?' })
    expect(entry).toMatchObject({ kind: 'connect-failed', level: 'error' })
    expect(entry.text).toContain('Unable to connect')
  })

  it.each([
    ['the timed wording', 'Connection failed after 30000ms: Unable to connect.', 30_000],
    ['a transport-prefixed failure', 'HTTP Connection failed after 3s: Unable to connect.', 3000],
    ['a post-handshake error', 'Connection error: The operation timed out.', null]
  ])('recognises %s as a connection failure', (_label, debug, durationMs) => {
    expect(parse({ debug })).toMatchObject({ kind: 'connect-failed', level: 'error', durationMs })
  })

  it('reports no duration when the CLI writes an unparseable number', () => {
    expect(
      parse({ debug: 'Successfully connected (transport: stdio) in 1.2.3s' }).durationMs
    ).toBeNull()
  })

  it('clamps a negative elapsed time from a stepped clock to zero', () => {
    expect(parse({ debug: 'Successfully connected (transport: stdio) in -1ms' })).toMatchObject({
      kind: 'connected',
      durationMs: 0
    })
  })

  it('reads a hyphenated transport name', () => {
    expect(
      parse({ debug: 'Successfully connected (transport: claudeai-proxy) in 12ms' })
    ).toMatchObject({ transport: 'claudeai-proxy' })
    expect(parse({ debug: 'CLAUDEAI-PROXY connection closed after 4s (cleanly)' })).toMatchObject({
      kind: 'closed',
      transport: 'claudeai-proxy'
    })
  })

  it('reads a dropped connection as louder than a clean close', () => {
    expect(parse({ debug: 'HTTP connection dropped after 9s uptime' })).toMatchObject({
      kind: 'closed',
      level: 'warn',
      durationMs: 9000
    })
  })

  it('treats SIGTERM escalation like SIGINT escalation', () => {
    expect(parse({ debug: 'SIGTERM failed, sending SIGKILL to MCP server process' })).toMatchObject(
      {
        kind: 'shutdown',
        level: 'warn'
      }
    )
  })

  it('pulls the server name and version out of the capabilities line', () => {
    const entry = parse({
      debug:
        'Connection established with capabilities: {"hasTools":true,"hasPrompts":false,"serverVersion":{"name":"Playwright","version":"1.63.0"}}'
    })
    expect(entry).toMatchObject({ kind: 'capabilities', serverVersion: 'Playwright v1.63.0' })
  })

  it('accepts a capabilities line whose server reports no version', () => {
    expect(
      parse({
        debug:
          'Connection established with capabilities: {"serverVersion":{"name":"Pencil","version":""}}'
      }).serverVersion
    ).toBe('Pencil')
  })

  it.each([
    ['unparseable JSON', 'Connection established with capabilities: {oops'],
    ['a non-object payload', 'Connection established with capabilities: 7'],
    ['no serverVersion key', 'Connection established with capabilities: {"hasTools":true}'],
    ['a non-object serverVersion', 'Connection established with capabilities: {"serverVersion":3}'],
    ['a nameless serverVersion', 'Connection established with capabilities: {"serverVersion":{}}']
  ])('reports no version for %s', (_label, debug) => {
    expect(parse({ debug }).serverVersion).toBeNull()
  })

  it('records how long a closed connection lived', () => {
    expect(parse({ debug: 'STDIO connection closed after 34s (cleanly)' })).toMatchObject({
      kind: 'closed',
      transport: 'stdio',
      durationMs: 34_000
    })
  })

  it('treats an escalated shutdown as a warning and a plain one as debug', () => {
    expect(parse({ debug: 'SIGINT failed, sending SIGTERM to MCP server process' })).toMatchObject({
      kind: 'shutdown',
      level: 'warn'
    })
    expect(parse({ debug: 'Sending SIGINT to MCP server process' })).toMatchObject({
      kind: 'shutdown',
      level: 'debug'
    })
  })

  it('classifies the process exit', () => {
    expect(parse({ debug: 'MCP server process exited cleanly' }).kind).toBe('exited')
  })
})

describe('parseLogLine — tool traffic', () => {
  it('names the tool being called', () => {
    expect(parse({ debug: 'Calling MCP tool: browser_navigate' })).toMatchObject({
      kind: 'tool-call',
      level: 'info',
      tool: 'browser_navigate'
    })
  })

  it('pairs a completed tool with its duration in ms', () => {
    expect(parse({ debug: "Tool 'browser_click' completed successfully in 450ms" })).toMatchObject({
      kind: 'tool-ok',
      tool: 'browser_click',
      durationMs: 450
    })
  })

  it('converts a seconds-denominated tool duration', () => {
    expect(
      parse({ debug: "Tool 'browser_run_code_unsafe' completed successfully in 2s" })
    ).toMatchObject({ tool: 'browser_run_code_unsafe', durationMs: 2000 })
  })

  it('flags a call that has not returned yet, with the time so far', () => {
    expect(parse({ debug: "Tool 'approve' still running (30s elapsed)" })).toMatchObject({
      kind: 'tool-running',
      level: 'warn',
      tool: 'approve',
      durationMs: 30_000
    })
  })

  it('treats a retry after session recovery as a call worth noticing', () => {
    expect(parse({ debug: "Retrying tool 'approve' after session recovery" })).toMatchObject({
      kind: 'tool-call',
      level: 'warn',
      tool: 'approve'
    })
  })

  it('classifies an explicit tool failure at error level', () => {
    expect(parse({ debug: "Tool 'browser_click' failed after 3s" })).toMatchObject({
      kind: 'tool-failed',
      level: 'error',
      tool: 'browser_click'
    })
  })

  it('splits the CLI\u2019s "### Error" block into a summary and a stack', () => {
    const entry = parse({
      error:
        '### Error\nTimeoutError: locator.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting'
    })
    expect(entry).toMatchObject({ kind: 'tool-failed', level: 'error' })
    expect(entry.text).toBe('TimeoutError: locator.click: Timeout 5000ms exceeded.')
    expect(entry.detail).toBe('Call log:\n  - waiting')
  })
})

describe('parseLogLine — server stderr', () => {
  it('keeps a routine startup banner at info level', () => {
    const entry = parse({
      error: 'Server stderr: 2026/07/13 21:15:27 [MCP] Starting server in stdio mode'
    })
    expect(entry).toMatchObject({ kind: 'stderr', level: 'info' })
    expect(entry.text).toBe('2026/07/13 21:15:27 [MCP] Starting server in stdio mode')
  })

  it('promotes stderr that reads like trouble to error level', () => {
    expect(parse({ error: 'Server stderr: npm ERR! code ENOENT' })).toMatchObject({
      kind: 'stderr',
      level: 'error'
    })
  })

  it('promotes on a keyword found only in the detail lines', () => {
    expect(parse({ error: 'Server stderr: starting up\nfatal: cannot bind' })).toMatchObject({
      level: 'error'
    })
  })

  it('carries multi-line stderr into the detail block', () => {
    const entry = parse({ error: 'Server stderr: line one\nline two\nline three' })
    expect(entry.text).toBe('line one')
    expect(entry.detail).toBe('line two\nline three')
  })
})

describe('parseLogLine — reconnects and transport plumbing', () => {
  it('classifies the routine cache clear as a quiet reconnect', () => {
    expect(parse({ debug: 'Cleared connection cache for reconnection' })).toMatchObject({
      kind: 'reconnect',
      level: 'debug'
    })
  })

  it('raises an expired session above the routine reconnect', () => {
    expect(
      parse({
        debug: 'MCP session expired during tool call (connection closed), clearing connection cache'
      })
    ).toMatchObject({ kind: 'reconnect', level: 'warn' })
  })

  it.each([
    'Initializing HTTP transport to http://127.0.0.1:4000/mcp',
    'HTTP transport created successfully',
    'Client created, setting up request handler',
    'Testing basic HTTP connectivity to http://127.0.0.1:4000/mcp',
    'Parsed URL: host=127.0.0.1, port=4000, protocol=http:',
    'Using loopback address: 127.0.0.1',
    'Node version: v22.22.1, Platform: linux',
    'Environment: {"NODE_OPTIONS":"not set"}',
    'claude.ai proxy transport created successfully',
    'Received ListRoots request from server'
  ])('files connection plumbing under transport: %s', (debug) => {
    expect(parse({ debug })).toMatchObject({ kind: 'transport', level: 'debug' })
  })
})

describe('parseLogLine — fallbacks', () => {
  it('keeps an unrecognized debug sentence verbatim as a notice', () => {
    const entry = parse({ debug: 'Something the CLI has never printed before' })
    expect(entry).toMatchObject({ kind: 'notice', level: 'debug' })
    expect(entry.text).toBe('Something the CLI has never printed before')
  })

  it('keeps an unrecognized error sentence verbatim at error level', () => {
    expect(parse({ error: 'MCP error -32000: Connection closed' })).toMatchObject({
      kind: 'error',
      level: 'error'
    })
  })

  it('leaves duration null when the CLI uses a unit we do not read', () => {
    expect(parse({ debug: 'Successfully connected (transport: stdio) in 2ms' }).durationMs).toBe(2)
    expect(
      parseLogLine(line({ debug: 'STDIO connection closed after 1m (cleanly)' }), CONTEXT)?.kind
    ).toBe('notice')
  })
})

describe('parseLogChunk', () => {
  it('numbers entries from the start line so a tail continues the file', () => {
    const body = [line({ debug: 'a' }), line({ debug: 'b' })].join('\n')
    const entries = parseLogChunk(body, {
      server: 'pencil',
      file: '/logs/x.jsonl',
      startLine: 12,
      fallbackAt: 5
    })
    expect(entries.map((entry) => entry.id)).toEqual(['/logs/x.jsonl#12', '/logs/x.jsonl#13'])
    expect(entries.every((entry) => entry.server === 'pencil')).toBe(true)
  })

  it('skips unusable lines without shifting the numbering of the usable ones', () => {
    const body = ['', 'garbage', line({ debug: 'real' })].join('\n')
    const entries = parseLogChunk(body, {
      server: 'pencil',
      file: '/logs/x.jsonl',
      startLine: 0,
      fallbackAt: 5
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('/logs/x.jsonl#2')
  })

  it('returns nothing for an empty chunk', () => {
    expect(parseLogChunk('', { server: 's', file: 'f', startLine: 0, fallbackAt: 0 })).toEqual([])
  })
})
