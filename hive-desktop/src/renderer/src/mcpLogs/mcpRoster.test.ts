import { describe, expect, it } from 'vitest'
import {
  buildRoster,
  mcpServerKey,
  stateLabel,
  summarizeRoster,
  summaryLabel,
  type McpRosterEntry
} from './mcpRoster'
import type { ServerStat } from './logConsole'
import type { McpServerReport } from '../chat/turnTimeline'

/**
 * `mcpRoster` unit tests — the merge of three disagreeing sources into the one
 * list every MCP surface renders from.
 *
 * These are the decisions that fail invisibly. A precedence bug shows a server
 * as connected hours after its connection closed; a keying bug splits one
 * server into two half-populated rows; a summary bug puts a red badge on a
 * healthy workspace. Every one of those *looks* like a working UI.
 */

const stat = (over: Partial<ServerStat> = {}): ServerStat => ({
  server: 'playwright',
  calls: 0,
  errors: 0,
  slowestMs: null,
  medianMs: null,
  lastAt: 0,
  live: false,
  lastFailed: false,
  ...over
})

const report = (over: Partial<McpServerReport> = {}): McpServerReport => ({
  name: 'playwright',
  status: 'connected',
  tools: [],
  ...over
})

const empty = { reported: [], stats: [], catalog: [] }

describe('mcpServerKey', () => {
  it("collapses a server's three spellings onto one key", () => {
    // Config: `hive-approvals`. Tool namespace: `hive_approvals`. Log dir:
    // `mcp-logs-hive-approvals`. All one server.
    expect(mcpServerKey('hive-approvals')).toBe(mcpServerKey('hive_approvals'))
    expect(mcpServerKey('Claude.AI Remote')).toBe('claude_ai_remote')
  })
})

describe('buildRoster', () => {
  it('is empty when nothing knows about any server', () => {
    expect(buildRoster(empty)).toEqual([])
  })

  it('merges the same server across all three sources into one row', () => {
    const roster = buildRoster({
      catalog: ['hive-approvals'],
      stats: [stat({ server: 'hive-approvals', calls: 4, errors: 1, lastAt: 99 })],
      reported: [report({ name: 'hive_approvals', tools: ['approve'] })]
    })
    expect(roster).toHaveLength(1)
    expect(roster[0]).toMatchObject({
      // The catalog's spelling wins: it is the name the user typed.
      name: 'hive-approvals',
      state: 'connected',
      tools: ['approve'],
      inCatalog: true,
      calls: 4,
      errors: 1,
      lastAt: 99
    })
  })

  it('surfaces a server the CLI reported that is not in the catalog', () => {
    const roster = buildRoster({ ...empty, reported: [report({ name: 'pencil' })] })
    expect(roster[0]).toMatchObject({ name: 'pencil', inCatalog: false, state: 'connected' })
  })

  it('surfaces a catalogued server that has never run', () => {
    const roster = buildRoster({ ...empty, catalog: ['playwright'] })
    expect(roster[0]).toMatchObject({
      name: 'playwright',
      inCatalog: true,
      state: 'known',
      // Never handshaken is `null`, not `[]` — "we don't know" is not "none".
      tools: null,
      lastAt: null
    })
  })

  it('lets the handshake override what the logs imply', () => {
    // The logs say the last connection failed; this turn's handshake says it
    // connected. The handshake speaks for *now* and wins.
    const roster = buildRoster({
      catalog: [],
      stats: [stat({ lastFailed: true })],
      reported: [report({ status: 'connected' })]
    })
    expect(roster[0].state).toBe('connected')
  })

  it('never infers "connected" from the logs alone', () => {
    // A live connection in the log window is not a claim about now: the CLI
    // closes every MCP connection at the end of a turn, so this would be true
    // for seconds and a lie for the hours in between.
    const roster = buildRoster({ ...empty, stats: [stat({ live: true, calls: 12 })] })
    expect(roster[0].state).toBe('known')
    expect(roster[0].calls).toBe(12)
  })

  it('reads a last-event failure as failed when no handshake has spoken', () => {
    const roster = buildRoster({ ...empty, stats: [stat({ lastFailed: true })] })
    expect(roster[0].state).toBe('failed')
  })

  it('maps every CLI status word onto a roster state', () => {
    const roster = buildRoster({
      ...empty,
      reported: [
        report({ name: 'a', status: 'failed' }),
        report({ name: 'b', status: 'needs-auth' }),
        report({ name: 'c', status: 'pending' }),
        report({ name: 'd', status: 'unknown' })
      ]
    })
    expect(Object.fromEntries(roster.map((entry) => [entry.name, entry.state]))).toEqual({
      a: 'failed',
      b: 'needs-auth',
      // The CLI says "pending"; the roster says "starting", which is the word
      // a user reads as "wait a second" rather than "something is queued".
      c: 'starting',
      d: 'known'
    })
  })

  it('sorts most-alarming first, then alphabetically', () => {
    const roster = buildRoster({
      ...empty,
      reported: [
        report({ name: 'zeta', status: 'connected' }),
        report({ name: 'alpha', status: 'connected' }),
        report({ name: 'auth', status: 'needs-auth' }),
        report({ name: 'boom', status: 'failed' }),
        report({ name: 'slow', status: 'pending' })
      ]
    })
    expect(roster.map((entry) => entry.name)).toEqual(['boom', 'auth', 'slow', 'alpha', 'zeta'])
  })

  it('sums the log rollups when one server somehow has two stat rows', () => {
    // Two spellings of one server in the log directories (it happens across
    // CLI versions) must add up rather than shadow each other.
    const roster = buildRoster({
      ...empty,
      stats: [
        stat({ server: 'hive-approvals', calls: 2, errors: 1, lastAt: 10 }),
        stat({ server: 'hive_approvals', calls: 3, errors: 0, lastAt: 40 })
      ]
    })
    expect(roster).toHaveLength(1)
    expect(roster[0]).toMatchObject({ calls: 5, errors: 1, lastAt: 40 })
  })
})

describe('summarizeRoster / summaryLabel', () => {
  const entry = (over: Partial<McpRosterEntry> = {}): McpRosterEntry => ({
    name: 'a',
    key: 'a',
    state: 'connected',
    tools: null,
    inCatalog: true,
    lastAt: null,
    calls: 0,
    errors: 0,
    ...over
  })

  it('counts connected and troubled separately', () => {
    expect(
      summarizeRoster([
        entry({ state: 'connected' }),
        entry({ name: 'b', key: 'b', state: 'failed' }),
        entry({ name: 'c', key: 'c', state: 'needs-auth' }),
        entry({ name: 'd', key: 'd', state: 'known' })
      ])
    ).toEqual({ total: 4, connected: 1, troubled: 2 })
  })

  it('says "nenhum" rather than a zero, and stays quiet when nothing is wrong', () => {
    expect(summaryLabel(summarizeRoster([]))).toBe('Nenhum servidor MCP')
    expect(summaryLabel(summarizeRoster([entry()]))).toBe('1 servidor MCP')
    expect(summaryLabel(summarizeRoster([entry(), entry({ name: 'b', key: 'b' })]))).toBe(
      '2 servidores MCP'
    )
  })

  it('names the trouble as a fraction when there is any', () => {
    expect(
      summaryLabel(summarizeRoster([entry({ state: 'failed' }), entry({ name: 'b', key: 'b' })]))
    ).toBe('1 de 2 com falha')
  })
})

describe('stateLabel', () => {
  it('has a word for every state', () => {
    expect(
      (['failed', 'needs-auth', 'starting', 'connected', 'known'] as const).map(stateLabel)
    ).toEqual(['falhou', 'precisa de login', 'iniciando', 'conectado', 'sem conexão ativa'])
  })
})
