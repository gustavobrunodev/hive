import { describe, expect, it } from 'vitest'
import {
  applyQuery,
  categoryLabel,
  countByFilter,
  describeEntry,
  durationScale,
  formatBandStamp,
  formatClock,
  formatLatency,
  groupBySession,
  hasDurationBar,
  LOG_FILTERS,
  matchesFilter,
  matchesQuery,
  serverStats,
  type McpLogEntry,
  type McpLogKind,
  type McpLogLevel
} from './logConsole'

/**
 * `logConsole` unit tests — the console's decisions, none of which a
 * screenshot can check: a filter that drops a class of errors, a tally that
 * disagrees with the rows beneath it, or a duration bar scaled to the wrong
 * maximum all look perfectly fine on screen.
 */

let seq = 0

/** One entry with sane defaults; pass only what the assertion is about. */
function entry(overrides: Partial<McpLogEntry> = {}): McpLogEntry {
  seq += 1
  return {
    id: `f#${seq}`,
    server: 'playwright',
    at: 1_754_500_000_000 + seq * 1000,
    level: 'info' as McpLogLevel,
    kind: 'notice' as McpLogKind,
    text: 'algo',
    detail: '',
    sessionId: 's1',
    tool: null,
    durationMs: null,
    transport: null,
    serverVersion: null,
    raw: '{}',
    ...overrides
  }
}

describe('matchesFilter', () => {
  it('admits everything under "all"', () => {
    expect(matchesFilter(entry({ kind: 'transport', level: 'debug' }), 'all')).toBe(true)
  })

  it.each<McpLogKind>(['tool-call', 'tool-running', 'tool-ok', 'tool-failed'])(
    'files %s under tools',
    (kind) => {
      expect(matchesFilter(entry({ kind }), 'tools')).toBe(true)
      expect(matchesFilter(entry({ kind }), 'connection')).toBe(false)
    }
  )

  it.each<McpLogKind>([
    'connecting',
    'connected',
    'connect-failed',
    'capabilities',
    'closed',
    'reconnect',
    'transport',
    'shutdown',
    'exited'
  ])('files %s under connection', (kind) => {
    expect(matchesFilter(entry({ kind }), 'connection')).toBe(true)
    expect(matchesFilter(entry({ kind }), 'tools')).toBe(false)
  })

  it('leaves server output out of both tools and connection', () => {
    const stderr = entry({ kind: 'stderr' })
    expect(matchesFilter(stderr, 'tools')).toBe(false)
    expect(matchesFilter(stderr, 'connection')).toBe(false)
    expect(matchesFilter(stderr, 'all')).toBe(true)
  })

  it('admits errors AND warnings under issues, whatever their kind', () => {
    expect(matchesFilter(entry({ kind: 'stderr', level: 'error' }), 'issues')).toBe(true)
    expect(matchesFilter(entry({ kind: 'shutdown', level: 'warn' }), 'issues')).toBe(true)
    expect(matchesFilter(entry({ kind: 'tool-ok', level: 'info' }), 'issues')).toBe(false)
    expect(matchesFilter(entry({ kind: 'notice', level: 'debug' }), 'issues')).toBe(false)
  })

  it('names exactly four views, in render order', () => {
    expect(LOG_FILTERS).toEqual(['all', 'tools', 'connection', 'issues'])
  })
})

describe('matchesQuery', () => {
  it('matches everything on an empty or whitespace query', () => {
    expect(matchesQuery(entry(), '')).toBe(true)
    expect(matchesQuery(entry(), '   ')).toBe(true)
  })

  it('is case-insensitive across text, server and tool', () => {
    const row = entry({ text: 'Browser IS busy', server: 'Playwright', tool: 'browser_Click' })
    expect(matchesQuery(row, 'busy')).toBe(true)
    expect(matchesQuery(row, 'PLAYWRIGHT')).toBe(true)
    expect(matchesQuery(row, 'browser_click')).toBe(true)
  })

  it('searches the collapsed detail block too — a pasted stack has to find its row', () => {
    const row = entry({ text: 'TimeoutError', detail: 'at Object.<anonymous> (foo.ts:12)' })
    expect(matchesQuery(row, 'foo.ts')).toBe(true)
  })

  it('rejects what appears nowhere', () => {
    expect(matchesQuery(entry({ text: 'a' }), 'zzz')).toBe(false)
  })
})

describe('applyQuery', () => {
  const rows = [
    entry({ server: 'pencil', kind: 'tool-call', tool: 'get_app_state' }),
    entry({ server: 'playwright', kind: 'tool-call', tool: 'browser_navigate' }),
    entry({ server: 'playwright', kind: 'connected', level: 'info' })
  ]

  it('applies server, view and search together', () => {
    expect(
      applyQuery(rows, { server: 'playwright', filter: 'tools', search: 'navigate' })
    ).toHaveLength(1)
  })

  it('scopes to one server without touching the view', () => {
    expect(applyQuery(rows, { server: 'pencil', filter: 'all', search: '' })).toHaveLength(1)
  })

  it('preserves the incoming order', () => {
    const out = applyQuery(rows, { server: null, filter: 'all', search: '' })
    expect(out.map((row) => row.id)).toEqual(rows.map((row) => row.id))
  })
})

describe('countByFilter', () => {
  const rows = [
    entry({ kind: 'tool-call' }),
    entry({ kind: 'tool-ok' }),
    entry({ kind: 'connected' }),
    entry({ kind: 'stderr', level: 'error' }),
    entry({ server: 'pencil', kind: 'tool-call' })
  ]

  it('counts each view against the whole set', () => {
    expect(countByFilter(rows, { server: null, search: '' })).toEqual({
      all: 5,
      tools: 3,
      connection: 1,
      issues: 1
    })
  })

  it('honours the server scope', () => {
    expect(countByFilter(rows, { server: 'pencil', search: '' }).all).toBe(1)
  })

  it('honours the search scope, so a tally says what switching would show', () => {
    // The counts must NOT be filtered by the active view — otherwise every
    // segment but the current one reads zero and the tally says nothing.
    const counts = countByFilter(rows, { server: null, search: 'algo' })
    expect(counts.all).toBe(5)
    expect(counts.tools).toBe(3)
  })
})

describe('groupBySession', () => {
  it('returns nothing for an empty stream', () => {
    expect(groupBySession([])).toEqual([])
  })

  it('groups consecutive entries of one session', () => {
    const groups = groupBySession([
      entry({ sessionId: 'a' }),
      entry({ sessionId: 'a' }),
      entry({ sessionId: 'b' })
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[1].sessionId).toBe('b')
  })

  it('splits a session that returns after another, rather than folding time', () => {
    const groups = groupBySession([
      entry({ sessionId: 'a' }),
      entry({ sessionId: 'b' }),
      entry({ sessionId: 'a' })
    ])
    expect(groups.map((group) => group.sessionId)).toEqual(['a', 'b', 'a'])
  })

  it('stamps each band with its first entry time', () => {
    const first = entry({ sessionId: 'a', at: 5000 })
    expect(groupBySession([first, entry({ sessionId: 'a', at: 9000 })])[0].startedAt).toBe(5000)
  })

  it('treats a missing session id as its own group key', () => {
    const groups = groupBySession([entry({ sessionId: null }), entry({ sessionId: null })])
    expect(groups).toHaveLength(1)
    expect(groups[0].sessionId).toBeNull()
  })
})

describe('duration bars', () => {
  it('draws a bar for timed tool outcomes only', () => {
    expect(hasDurationBar(entry({ kind: 'tool-ok', durationMs: 400 }))).toBe(true)
    expect(hasDurationBar(entry({ kind: 'tool-running', durationMs: 400 }))).toBe(true)
    expect(hasDurationBar(entry({ kind: 'tool-failed', durationMs: 400 }))).toBe(true)
    // A call that has only been *started* has no elapsed time to draw yet.
    expect(hasDurationBar(entry({ kind: 'tool-call', durationMs: null }))).toBe(false)
    // A connection's duration is text, not a bar: it isn't comparable work.
    expect(hasDurationBar(entry({ kind: 'connected', durationMs: 2000 }))).toBe(false)
  })

  it('draws nothing for a zero or missing duration', () => {
    expect(hasDurationBar(entry({ kind: 'tool-ok', durationMs: 0 }))).toBe(false)
    expect(hasDurationBar(entry({ kind: 'tool-ok', durationMs: null }))).toBe(false)
  })

  it('scales to the slowest bar-worthy call in view', () => {
    expect(
      durationScale([
        entry({ kind: 'tool-ok', durationMs: 120 }),
        entry({ kind: 'tool-ok', durationMs: 4500 }),
        // A connection's 60s must not become the scale — bars would vanish.
        entry({ kind: 'connected', durationMs: 60_000 })
      ])
    ).toBe(4500)
  })

  it('reports zero when nothing in view is timed', () => {
    expect(durationScale([entry({ kind: 'connecting' })])).toBe(0)
    expect(durationScale([])).toBe(0)
  })
})

describe('serverStats', () => {
  it('returns nothing for an empty stream', () => {
    expect(serverStats([])).toEqual([])
  })

  it('rolls up calls, errors and latency per server', () => {
    const stats = serverStats([
      entry({ server: 'pw', kind: 'tool-call' }),
      entry({ server: 'pw', kind: 'tool-ok', durationMs: 100 }),
      entry({ server: 'pw', kind: 'tool-ok', durationMs: 300 }),
      entry({ server: 'pw', kind: 'stderr', level: 'error' })
    ])
    expect(stats[0]).toMatchObject({
      server: 'pw',
      calls: 1,
      errors: 1,
      slowestMs: 300,
      medianMs: 200
    })
  })

  it('takes the middle value for an odd number of samples', () => {
    const stats = serverStats([
      entry({ kind: 'tool-ok', durationMs: 10 }),
      entry({ kind: 'tool-ok', durationMs: 50 }),
      entry({ kind: 'tool-ok', durationMs: 900 })
    ])
    expect(stats[0].medianMs).toBe(50)
  })

  it('reports null latencies when nothing timed ran', () => {
    const stats = serverStats([entry({ kind: 'connecting' })])
    expect(stats[0]).toMatchObject({ slowestMs: null, medianMs: null })
  })

  it('reads live from the LAST connection event, not from a count of connects', () => {
    const reconnected = serverStats([
      entry({ kind: 'connected' }),
      entry({ kind: 'closed' }),
      entry({ kind: 'connected' })
    ])
    expect(reconnected[0].live).toBe(true)

    const gone = serverStats([
      entry({ kind: 'connected' }),
      entry({ kind: 'connected' }),
      entry({ kind: 'exited' })
    ])
    expect(gone[0].live).toBe(false)
  })

  it('is not live when no connection event has been seen at all', () => {
    expect(serverStats([entry({ kind: 'stderr' })])[0].live).toBe(false)
  })

  it('accepts the capabilities line as evidence of a live connection', () => {
    expect(serverStats([entry({ kind: 'capabilities' })])[0].live).toBe(true)
  })

  it('orders servers by most recent activity', () => {
    const stats = serverStats([
      entry({ server: 'old', at: 1000 }),
      entry({ server: 'new', at: 9000 })
    ])
    expect(stats.map((stat) => stat.server)).toEqual(['new', 'old'])
  })
})

describe('formatLatency', () => {
  it.each([
    [0, '0 ms'],
    [8, '8 ms'],
    [450, '450 ms'],
    [999, '999 ms'],
    [1000, '1,0 s'],
    [1400, '1,4 s'],
    [9949, '9,9 s'],
    [34_000, '34 s']
  ])('renders %ims as %s', (ms, expected) => {
    expect(formatLatency(ms)).toBe(expected)
  })

  it('treats a nonsensical value as zero rather than printing NaN', () => {
    expect(formatLatency(Number.NaN)).toBe('0 ms')
    expect(formatLatency(-5)).toBe('0 ms')
  })
})

describe('formatClock / formatBandStamp', () => {
  it('renders wall-clock time with seconds', () => {
    expect(formatClock(Date.parse('2026-08-06T13:41:18'))).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('renders the band stamp with a day and a time', () => {
    const stamp = formatBandStamp(Date.parse('2026-08-06T13:41:00'))
    expect(stamp).toContain('06')
    expect(stamp).toMatch(/\d{2}:\d{2}/)
  })
})

describe('describeEntry', () => {
  it('names the transport on a successful connect', () => {
    expect(describeEntry(entry({ kind: 'connected', transport: 'stdio' }))).toBe(
      'Conectado via stdio'
    )
  })

  it('falls back to a plain sentence when the transport is unknown', () => {
    expect(describeEntry(entry({ kind: 'connected', transport: null }))).toBe('Conectado')
  })

  it('carries the server version through the capabilities line', () => {
    expect(describeEntry(entry({ kind: 'capabilities', serverVersion: 'Playwright v1.6' }))).toBe(
      'Handshake concluído · Playwright v1.6'
    )
    expect(describeEntry(entry({ kind: 'capabilities', serverVersion: null }))).toBe(
      'Handshake concluído'
    )
  })

  it('leads a tool row with the tool name', () => {
    expect(describeEntry(entry({ kind: 'tool-call', tool: 'browser_navigate' }))).toBe(
      'browser_navigate'
    )
    expect(describeEntry(entry({ kind: 'tool-ok', tool: 'browser_click' }))).toBe('browser_click')
  })

  it('falls back to the raw text for a tool row with no name', () => {
    expect(describeEntry(entry({ kind: 'tool-call', tool: null, text: 'cru' }))).toBe('cru')
    expect(describeEntry(entry({ kind: 'tool-ok', tool: null, text: 'cru' }))).toBe('cru')
  })

  it('says a still-running call is still running, by name', () => {
    expect(describeEntry(entry({ kind: 'tool-running', tool: 'approve' }))).toBe(
      'approve ainda em execução'
    )
    expect(describeEntry(entry({ kind: 'tool-running', tool: null }))).toBe(' ainda em execução')
  })

  it.each<[McpLogKind, string]>([
    ['connecting', 'Iniciando conexão…'],
    ['closed', 'Conexão encerrada'],
    ['reconnect', 'Cache de conexão limpo — vai reconectar'],
    ['shutdown', 'Encerrando o processo do servidor'],
    ['exited', 'Processo do servidor encerrado']
  ])('gives %s its own sentence', (kind, expected) => {
    expect(describeEntry(entry({ kind }))).toBe(expected)
  })

  it.each<McpLogKind>(['stderr', 'error', 'notice', 'transport', 'connect-failed', 'tool-failed'])(
    'shows %s verbatim — the content IS the message',
    (kind) => {
      expect(describeEntry(entry({ kind, text: 'texto cru' }))).toBe('texto cru')
    }
  )
})

describe('categoryLabel', () => {
  it.each<[McpLogKind, string]>([
    ['tool-call', 'ferramenta'],
    ['tool-ok', 'ferramenta'],
    ['stderr', 'saída'],
    ['connected', 'conexão'],
    ['transport', 'conexão'],
    ['notice', 'evento'],
    ['error', 'evento']
  ])('labels %s as "%s"', (kind, expected) => {
    expect(categoryLabel(entry({ kind }))).toBe(expected)
  })
})
