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

/**
 * Structural mirrors of `main/toolPatch.ts` (renderer files mirror main types
 * instead of importing across the process boundary — same convention as
 * `Chat.tsx`'s `AgentEventIn`). See that module for what each field means and
 * why the diff is computed in main.
 */
export type PatchOp = 'create' | 'edit' | 'rewrite'

export interface PatchSpan {
  text: string
  changed: boolean
}

export interface PatchLine {
  type: 'add' | 'del' | 'ctx'
  text: string
  no: number | null
  spans?: PatchSpan[]
}

export interface PatchHunk {
  lines: PatchLine[]
}

export interface ToolPatch {
  op: PatchOp
  path: string
  adds: number
  dels: number
  hunks: PatchHunk[]
  truncated?: number
  anchored: boolean
}

/**
 * Structural mirrors of `main/toolDetails.ts` (agent-tool-details) — one
 * argument of a tool call, and what the call answered. Same mirroring
 * convention as `ToolPatch` above; see that module for the caps and why they
 * are applied at the source.
 */
export interface ToolParam {
  key: string
  value: string
  block?: boolean
  truncated?: number
}

export interface ToolOutput {
  text: string
  lines: number
  truncated?: number
}

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
  /**
   * When the step started, as `Date.now()` in the renderer. A running row
   * counts up from here; a settled one shows `endedAt - startedAt`. Measured
   * at the event, not reported by the CLI — see `turnTiming.ts` on why.
   */
  startedAt: number
  /** When its result came back; unset while it runs. */
  endedAt?: number
  /**
   * agent-patch: the change this step is applying, on a file-editing tool.
   * Arrives on the `start` half and is preserved when the `end` settles the
   * row — the patch is the record of what the step *did*, so it has to outlive
   * the moment it was doing it.
   */
  patch?: ToolPatch
  /**
   * agent-tool-details: the whole call, as arguments. Arrives with the `start`
   * half — the same half that carries `patch`, and for the same reason: it is
   * what the step *is*, so it has to be on screen while the step is still
   * running, not only in hindsight.
   */
  params?: ToolParam[]
  /**
   * agent-tool-details: what the call answered. Arrives with the `end` half,
   * because it does not exist before then — a running row shows its call and
   * says the result is still pending.
   */
  output?: ToolOutput
}

/** The `tool` event fields this reducer consumes (mirrors `main/agentAdapter.ts`'s `ToolEvent`). */
export interface ToolActivityEvent {
  name: string
  detail?: string
  toolId?: string
  phase?: 'start' | 'end'
  ok?: boolean
  patch?: ToolPatch
  params?: ToolParam[]
  output?: ToolOutput
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
 *
 * `now` is injected rather than read from the clock inside, so a test can pin
 * a step's duration exactly instead of asserting on a range.
 */
export function reduceToolActivity(
  current: ToolActivity[],
  event: ToolActivityEvent,
  now: number = Date.now()
): ToolActivity[] {
  if (event.phase === 'end') {
    const state: ToolActivityState = event.ok === false ? 'failed' : 'ok'
    const index =
      event.toolId !== undefined
        ? current.findIndex((activity) => activity.id === event.toolId)
        : findLastRunning(current)
    if (index === -1) return current
    const next = [...current]
    next[index] = {
      ...next[index],
      state,
      endedAt: now,
      // The result joins the row it belongs to. An `end` that carries none
      // must not blank one already there — an adapter that re-settles a row
      // (a repeat, a late duplicate) would otherwise erase the evidence.
      output: event.output ?? next[index].output
    }
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
    seq: existing === -1 ? current.length : current[existing].seq,
    // A repeat `start` for the same id restarts the clock: the CLI is telling
    // us the step is running *again*, and carrying the first attempt's stamp
    // would report a duration that includes the gap between them.
    startedAt: now,
    // …but it does NOT restart the patch: an adapter that re-announces a step
    // without repeating its input would otherwise blank the snippet already on
    // screen, which reads as the change being withdrawn.
    patch: event.patch ?? (existing === -1 ? undefined : current[existing].patch),
    params: event.params ?? (existing === -1 ? undefined : current[existing].params),
    // A `start` never carries a result, but a re-announced step must keep the
    // one it already had rather than reverting to "still running".
    output: existing === -1 ? undefined : current[existing].output
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
 * Whether a step has a record behind it (agent-tool-details): its arguments,
 * its result, or the diff it applied. Rows without one stay plain status lines
 * — a chevron that opens an empty drawer is worse than no chevron.
 */
export function hasToolDetails(activity: ToolActivity): boolean {
  return (
    activity.patch !== undefined ||
    activity.output !== undefined ||
    (activity.params !== undefined && activity.params.length > 0)
  )
}

/**
 * Settles every still-running row when a turn ends. An interrupted or failed
 * turn leaves rows mid-flight; a spinner that never resolves is a worse lie
 * than an honest "stopped".
 */
export function settleToolActivity(
  activities: ToolActivity[],
  outcome: 'ok' | 'failed',
  now: number = Date.now()
): ToolActivity[] {
  if (!activities.some((activity) => activity.state === 'running')) return activities
  return activities.map((activity) =>
    activity.state === 'running' ? { ...activity, state: outcome, endedAt: now } : activity
  )
}

/** A step's elapsed ms: counting up while it runs, frozen once it settled. */
export function activityElapsed(activity: ToolActivity, now: number): number {
  return Math.max(0, (activity.endedAt ?? now) - activity.startedAt)
}

/**
 * The collapsed view of a long turn: the newest `limit` rows — **plus every
 * row that carries a patch**, wherever it sits (agent-patch).
 *
 * Collapsing by recency alone would hide the one thing the feed exists to
 * show. A turn that edits a file and then reads four more would push the
 * change off screen behind a count, and the user would watch the agent's most
 * consequential step scroll away while four file reads stayed. What the agent
 * *looked at* is fine to fold; what it *changed* is not.
 *
 * Returns the same array reference when nothing needs folding.
 */
export function collapseActivities(activities: ToolActivity[], limit: number): ToolActivity[] {
  if (activities.length <= limit) return activities
  const keep = new Set(activities.slice(-limit).map((activity) => activity.id))
  for (const activity of activities) if (activity.patch) keep.add(activity.id)
  return activities.filter((activity) => keep.has(activity.id))
}

/**
 * An absolute path as POSIX, relative to the workspace — the address the
 * editor uses when the patch header's control opens the file it changed.
 *
 * `null` for anything outside the workspace, so a tool that touched a file
 * elsewhere on disk opens nothing rather than the wrong thing. Backslashes are
 * normalised because the CLI reports Windows paths natively while the editor's
 * tree is POSIX throughout.
 */
export function workspaceRelative(workspace: string, path: string): string | null {
  const posix = (value: string): string => value.split('\\').join('/').replace(/\/+$/, '')
  const root = posix(workspace)
  const file = posix(path)
  if (root === '' || !file.startsWith(`${root}/`)) return null
  return file.slice(root.length + 1)
}
