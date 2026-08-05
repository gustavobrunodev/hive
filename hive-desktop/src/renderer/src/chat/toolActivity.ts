/**
 * The live record of what the agent is *doing* while it answers
 * (agent-activity AA-R1..R3) — reading, searching, editing, running commands.
 *
 * Until now the adapter's `tool` events were dropped on the floor and the UI
 * showed three bouncing dots for the entire minute a workflow spent working.
 * That silence is the defect: the user can't tell a long read from a hung
 * process, and the one thing they most want to know — *is it touching my
 * files?* — was invisible.
 *
 * This module is the pure part: the shape of one activity, the reducer that
 * folds `tool` events into a list, and the tool→copy mapping. Presentation
 * lives in `ToolActivity.tsx`, so this stays unit-testable without a DOM.
 */

import { t } from '../i18n'

export type ToolActivityState = 'running' | 'ok' | 'failed'

export interface ToolActivity {
  /** Stable key — the CLI's own `tool_use.id` when it has one. */
  id: string
  /** Tool name as the CLI reports it (`Bash`, `Read`, `mcp__linear__issue`). */
  name: string
  /** The call's headline argument: the path, the command, the pattern. */
  detail?: string
  state: ToolActivityState
  /** Monotonic arrival index, for a stagger that follows arrival order. */
  seq: number
}

/** The `tool` event fields this reducer consumes (mirrors `main/agentAdapter.ts`'s `ToolEvent`). */
export interface ToolActivityEvent {
  name: string
  detail?: string
  toolId?: string
  phase?: 'start' | 'end'
  ok?: boolean
}

/**
 * The visual family a tool belongs to. Deliberately coarse: the user cares
 * whether the agent is *reading*, *changing*, *searching*, *running* or
 * *reaching out*, not which of four read-ish tools it picked.
 */
export type ToolKind = 'read' | 'edit' | 'search' | 'run' | 'web' | 'task' | 'other'

const KIND_BY_TOOL: Record<string, ToolKind> = {
  Read: 'read',
  NotebookRead: 'read',
  Write: 'edit',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
  Bash: 'run',
  BashOutput: 'run',
  KillShell: 'run',
  WebFetch: 'web',
  WebSearch: 'web',
  Task: 'task',
  TodoWrite: 'task',
  ExitPlanMode: 'task'
}

/** Everything an MCP server exposes arrives as `mcp__<server>__<tool>`. */
const MCP_PREFIX = 'mcp__'

/**
 * `name` is typed as a string but arrives off the wire: an adapter that emits
 * a malformed `tool` event must degrade to a generic row, not take the
 * transcript down with it.
 */
export function toolKind(name: string): ToolKind {
  if (typeof name !== 'string' || name === '') return 'other'
  if (name.startsWith(MCP_PREFIX)) return 'other'
  return KIND_BY_TOOL[name] ?? 'other'
}

/**
 * A readable name for an MCP tool: `mcp__linear__create_issue` → `linear ·
 * create issue`. Non-MCP tools keep the CLI's own name, which is already the
 * word people use when they talk about it ("the Bash tool").
 */
export function toolLabel(name: string): string {
  if (typeof name !== 'string' || name === '') return t('activity.unnamedTool')
  if (!name.startsWith(MCP_PREFIX)) return name
  const [server, ...rest] = name.slice(MCP_PREFIX.length).split('__')
  const tool = rest.join(' ').replace(/_/g, ' ')
  return tool === '' ? server : `${server} · ${tool}`
}

/**
 * Shortens a path for a one-line row: the last two segments are what identify
 * a file to a human (`chat/Chat.tsx`), and the leading directories are noise
 * at this width. Non-path details (a command, a query) pass through, trimmed
 * to a readable length — the row is a status line, not a log.
 */
const MAX_DETAIL_CHARS = 96

export function shortenDetail(detail: string | undefined, kind: ToolKind): string | undefined {
  if (detail === undefined || detail === '') return undefined
  if (kind === 'read' || kind === 'edit') {
    const segments = detail.split(/[/\\]/).filter((segment) => segment !== '')
    if (segments.length > 2) return segments.slice(-2).join('/')
    return segments.join('/') || detail
  }
  return detail.length > MAX_DETAIL_CHARS ? `${detail.slice(0, MAX_DETAIL_CHARS - 1)}…` : detail
}

/**
 * Folds one `tool` event into the turn's activity list.
 *
 * `start` appends (or revives a repeat of the same id); `end` settles the row
 * it pairs with by `toolId`. An `end` with no matching `start` — a stream that
 * began before the pane attached — settles the newest still-running row
 * instead of inventing a phantom, which is the honest reading: something the
 * agent was doing just finished.
 *
 * Returns the same array reference when nothing changed, so React can skip the
 * re-render.
 */
export function reduceToolActivity(
  current: ToolActivity[],
  event: ToolActivityEvent
): ToolActivity[] {
  if (event.phase === 'end') {
    const state: ToolActivityState = event.ok === false ? 'failed' : 'ok'
    const index =
      event.toolId !== undefined
        ? current.findIndex((activity) => activity.id === event.toolId)
        : findLastRunning(current)
    if (index === -1) return current
    const next = [...current]
    next[index] = { ...next[index], state }
    return next
  }
  // A `start` (or an adapter that reports no phase at all — treat it as one).
  const id = event.toolId ?? `${event.name}-${current.length}`
  const existing = current.findIndex((activity) => activity.id === id)
  const activity: ToolActivity = {
    id,
    name: event.name,
    detail: event.detail,
    state: 'running',
    seq: existing === -1 ? current.length : current[existing].seq
  }
  if (existing !== -1) {
    const next = [...current]
    next[existing] = activity
    return next
  }
  return [...current, activity]
}

function findLastRunning(activities: ToolActivity[]): number {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    if (activities[index].state === 'running') return index
  }
  return -1
}

/**
 * Settles every still-running row when a turn ends. An interrupted or failed
 * turn leaves rows mid-flight; a spinner that never resolves is a worse lie
 * than an honest "stopped".
 */
export function settleToolActivity(
  activities: ToolActivity[],
  outcome: 'ok' | 'failed'
): ToolActivity[] {
  if (!activities.some((activity) => activity.state === 'running')) return activities
  return activities.map((activity) =>
    activity.state === 'running' ? { ...activity, state: outcome } : activity
  )
}
