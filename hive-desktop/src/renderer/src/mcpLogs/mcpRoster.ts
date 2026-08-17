import { t } from '../i18n'
import type { McpServerReport } from '../chat/turnTimeline'
import type { ServerStat } from './logConsole'

/**
 * `mcpRoster` — the one answer to "quais servidores MCP eu tenho, e como estão".
 *
 * Before this, the app knew three separate things and told the user none of
 * them together:
 *
 *  - **`.mcp.json`** says what the workspace *asked for*. The MCP manager reads
 *    it. It is a wish, not a state: a server listed here may be disabled, may
 *    fail to start, may not be the one the agent actually got.
 *  - **The CLI's handshake** says what the turn *was given* — the only place
 *    "connected" or "failed" is a fact rather than an inference. It arrives per
 *    turn, on the `system`/`init` line.
 *  - **The log files** say what a server *did*: calls, errors, latencies.
 *
 * Any one alone lies by omission, which is how a user ends up watching an agent
 * drive Playwright while the app shows nothing about Playwright anywhere. This
 * module folds all three onto one key per server and settles the precedence.
 *
 * Pure and i18n-only; every consumer (status cluster, console rail, transcript
 * notice) renders from the same list, so the three surfaces cannot disagree.
 */

/** The comparison key across a server's three spellings. Mirror of `main/cliAdapterCore.ts`. */
export function mcpServerKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
}

/**
 * How a server reads right now. Ordered by how much it wants attention, which
 * is also the sort order — a failure belongs at the top of any list it is in.
 */
export type McpServerState = 'failed' | 'needs-auth' | 'starting' | 'connected' | 'known'

/** One server, everything the app knows about it, merged. */
export interface McpRosterEntry {
  /** Display name — the catalog's spelling when there is one, else the reporter's. */
  name: string
  key: string
  state: McpServerState
  /** Tools the CLI reported it exposing, or null when no handshake has named it. */
  tools: string[] | null
  /** True when this workspace's `.mcp.json` lists it. */
  inCatalog: boolean
  /** Epoch ms of its last log line, or null when it has no logs. */
  lastAt: number | null
  /** Tool calls in the loaded log window. */
  calls: number
  /** Error-level log lines in the loaded log window. */
  errors: number
}

/** Ranked most-alarming first; the roster sorts on this, then by name. */
const STATE_RANK: Record<McpServerState, number> = {
  failed: 0,
  'needs-auth': 1,
  starting: 2,
  connected: 3,
  known: 4
}

/** The CLI's per-turn status word, mapped onto the roster's states. */
function stateFromReport(status: McpServerReport['status']): McpServerState {
  if (status === 'connected') return 'connected'
  if (status === 'failed') return 'failed'
  if (status === 'needs-auth') return 'needs-auth'
  if (status === 'pending') return 'starting'
  return 'known'
}

/** Everything the roster is built from. Each field may be empty. */
export interface RosterInput {
  /** The most recent CLI handshake, or an empty list when no turn has run yet. */
  reported: McpServerReport[]
  /** Per-server log rollups (`serverStats`). */
  stats: ServerStat[]
  /** Server names from this workspace's `.mcp.json`. */
  catalog: string[]
}

/** A blank entry for `key`, before any source has contributed to it. */
function blankEntry(key: string, name: string): McpRosterEntry {
  return {
    name,
    key,
    state: 'known',
    tools: null,
    inCatalog: false,
    lastAt: null,
    calls: 0,
    errors: 0
  }
}

/**
 * Merges the three sources into one list, most-alarming first.
 *
 * **Precedence for `state` is deliberate.** The CLI's handshake wins outright
 * when it named the server, because it is the only source that speaks for *this
 * turn*; the logs are a record of the past and the catalog is a wish. When no
 * handshake has named it, a server whose last connection event was a failure
 * reads `failed` — the last thing that happened is the honest answer — and
 * anything else reads `known`, never `connected`. That last part matters: the
 * CLI closes its MCP connections at the end of every turn, so a log-derived
 * "conectado" would be true for seconds and a lie for the hours in between.
 */
export function buildRoster(input: RosterInput): McpRosterEntry[] {
  const byKey = new Map<string, McpRosterEntry>()
  const entryFor = (name: string): McpRosterEntry => {
    const key = mcpServerKey(name)
    const existing = byKey.get(key)
    if (existing) return existing
    const created = blankEntry(key, name)
    byKey.set(key, created)
    return created
  }

  // Catalog first, so its spelling is the one the user sees — it is the name
  // they typed, and the CLI's tool namespace mangles it.
  for (const name of input.catalog) {
    entryFor(name).inCatalog = true
  }
  for (const stat of input.stats) {
    const entry = entryFor(stat.server)
    entry.lastAt = entry.lastAt === null ? stat.lastAt : Math.max(entry.lastAt, stat.lastAt)
    entry.calls += stat.calls
    entry.errors += stat.errors
    if (stat.lastFailed) entry.state = 'failed'
  }
  for (const report of input.reported) {
    const entry = entryFor(report.name)
    entry.state = stateFromReport(report.status)
    entry.tools = report.tools
  }

  return [...byKey.values()].sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.name.localeCompare(b.name)
  )
}

/** The one-glance summary the status bar carries. */
export interface RosterSummary {
  /** Every server the workspace knows about. */
  total: number
  /** How many the last handshake reported connected. */
  connected: number
  /** How many are failing or waiting on auth — the number that earns a loud badge. */
  troubled: number
}

export function summarizeRoster(roster: McpRosterEntry[]): RosterSummary {
  return {
    total: roster.length,
    connected: roster.filter((entry) => entry.state === 'connected').length,
    troubled: roster.filter((entry) => entry.state === 'failed' || entry.state === 'needs-auth')
      .length
  }
}

/** The state's word, in pt-BR. */
export function stateLabel(state: McpServerState): string {
  if (state === 'connected') return t('mcpLogs.stateConnected')
  if (state === 'failed') return t('mcpLogs.stateFailed')
  if (state === 'needs-auth') return t('mcpLogs.stateNeedsAuth')
  if (state === 'starting') return t('mcpLogs.stateStarting')
  return t('mcpLogs.stateKnown')
}

/**
 * What the status bar reads when the dock is closed.
 *
 * Three sentences, not one with numbers swapped in: "nenhum servidor" is a
 * different fact from "2 de 3", and a workspace with servers but nothing wrong
 * should not be shouting a fraction at the user all day.
 */
export function summaryLabel(summary: RosterSummary): string {
  if (summary.total === 0) return t('mcpLogs.idleStrip')
  if (summary.troubled > 0) return t('mcpLogs.summaryTroubled', summary.troubled, summary.total)
  return t('mcpLogs.summaryPlain', summary.total)
}
