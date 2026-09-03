/**
 * The chronological spine of one assistant turn.
 *
 * ## The defect this replaces
 *
 * The transcript used to render a turn in three fixed slabs: every tool call
 * hoisted to the top of the bubble, the prose in the middle, and every
 * permission card pinned to the bottom of the whole conversation, above the
 * composer. So a turn that said "I'll create the folder", asked to run
 * `mkdir`, ran it, and then said "done" rendered as *run mkdir* → *I'll create
 * the folder / done* → *permission for mkdir* — the answer before the question,
 * the work before the reason, and a stack of approvals that kept growing at the
 * bottom no matter where in the turn they were raised.
 *
 * A coding agent's transcript is a **log**. Claude Code, Cursor and Claude
 * Desktop all render one thing: the events in the order they happened. That is
 * the only ordering a user can reason about, because it is the only one that
 * matches the story the agent is telling.
 *
 * ## The model
 *
 * A turn is an append-only list of blocks. Text accretes into the trailing text
 * block; consecutive tool calls share one `tools` block (they draw as a single
 * threaded rail); a permission request opens its own block exactly where the
 * agent asked for it. Nothing is ever reordered or removed — a block's index is
 * its identity, which is what makes the `id`s below stable across renders
 * without a counter.
 *
 * Pure, DOM-free, and unit-tested on its own; presentation lives in
 * `TurnTimeline.tsx`.
 */

import type { ApprovalRequest } from './ApprovalCard'
import {
  reduceToolActivity,
  settleToolActivity,
  type ToolActivity,
  type ToolActivityEvent
} from './toolActivity'

/**
 * One MCP server as the CLI's handshake reported it (mcp-visibility). Mirror of
 * `main/agentAdapter.ts`'s `McpServerReport` — renderer files mirror main types
 * rather than importing across the process boundary.
 */
export interface McpServerReport {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'unknown'
  /** Tool names without the `mcp__<server>__` prefix. */
  tools: string[]
}

export type TurnBlock =
  | { kind: 'text'; id: string; text: string }
  /**
   * The agent's reasoning as it arrives (`thought` events).
   *
   * Its own block, not prose merged into the reply, because the two have
   * different lifetimes: the reply is the turn's product and is kept; the
   * reasoning is worth watching live and worth collapsing the moment the
   * agent starts answering. `settled` is what flips it from "thinking out
   * loud, expanded" to "a line you can open if you care".
   *
   * This is the block that answers "sempre aparece Iniciando" — before it,
   * the seconds Devin spends deciding produced nothing on screen at all.
   */
  | {
      kind: 'thinking'
      id: string
      text: string
      settled?: boolean
      /** `Date.now()` when the agent started this stretch of reasoning. */
      startedAt?: number
      /** How long it lasted, filled in when the block settles. */
      ms?: number
    }
  | { kind: 'tools'; id: string; activities: ToolActivity[] }
  | { kind: 'approval'; id: string; request: ApprovalRequest }
  /**
   * The MCP servers this turn started with. First in the turn because that is
   * when it happens — the CLI dials every server and reports the outcome
   * before the agent is allowed to do anything — and the previous silence
   * there is what made "está subindo o servidor MCP?" unanswerable.
   */
  | { kind: 'mcp'; id: string; servers: McpServerReport[] }

/**
 * Blocks are append-only, so position is identity: the block created as the
 * n-th one keeps `…-n` forever, which is a stable React key with no counter and
 * no risk of two turns minting the same id.
 */
function blockId(kind: TurnBlock['kind'], index: number): string {
  return `${kind}-${index}`
}

/**
 * Appends streamed text, merging into the trailing text block when there is one.
 *
 * Reply text also **settles** any open reasoning block: the agent has stopped
 * deliberating and started answering, which is precisely the moment the live
 * thinking panel should fold itself away.
 */
export function appendTurnText(
  blocks: TurnBlock[],
  text: string,
  now: number = Date.now()
): TurnBlock[] {
  if (text === '') return blocks
  const settled = settleThinking(blocks, now)
  const last = settled[settled.length - 1]
  if (last?.kind === 'text') {
    const next = [...settled]
    next[next.length - 1] = { ...last, text: last.text + text }
    return next
  }
  return [...settled, { kind: 'text', id: blockId('text', settled.length), text }]
}

/**
 * Appends streamed reasoning, merging into the trailing thinking block.
 *
 * A thought that arrives *after* the agent already wrote prose (a second round
 * of deliberation mid-turn) opens a new block rather than reopening the closed
 * one — the transcript reads in order, and reopening would move earlier
 * thinking below later text.
 */
export function appendTurnThought(
  blocks: TurnBlock[],
  text: string,
  now: number = Date.now()
): TurnBlock[] {
  if (text === '') return blocks
  const last = blocks[blocks.length - 1]
  if (last?.kind === 'thinking' && !last.settled) {
    const next = [...blocks]
    next[next.length - 1] = { ...last, text: last.text + text }
    return next
  }
  return [
    ...blocks,
    { kind: 'thinking', id: blockId('thinking', blocks.length), text, startedAt: now }
  ]
}

/**
 * Closes an open reasoning block, if the trailing block is one, recording how
 * long it ran.
 *
 * The duration is measured here rather than read off the turn's own metrics
 * because a turn can reason more than once — the number that belongs on a
 * collapsed row is how long *that* stretch took, not how long the whole turn
 * has been going.
 */
export function settleThinking(blocks: TurnBlock[], now: number = Date.now()): TurnBlock[] {
  const last = blocks[blocks.length - 1]
  if (last?.kind !== 'thinking' || last.settled) return blocks
  const next = [...blocks]
  next[next.length - 1] = {
    ...last,
    settled: true,
    ...(last.startedAt !== undefined ? { ms: Math.max(0, now - last.startedAt) } : {})
  }
  return next
}

/**
 * Folds one `tool` event in.
 *
 * A `start` joins the trailing tool group, or opens a new one when prose (or an
 * approval) came in between — that grouping is what keeps a burst of six reads
 * drawn as one rail instead of six lonely rows.
 *
 * An `end` settles the row it pairs with **wherever it lives**: the CLI happily
 * finishes a tool three paragraphs after it started it, so the search runs over
 * every group, not just the last.
 */
export function applyTurnTool(
  blocks: TurnBlock[],
  event: ToolActivityEvent,
  now: number = Date.now()
): TurnBlock[] {
  // Reaching for a tool ends the deliberation that led to it, the same way
  // writing the reply does.
  if (event.phase !== 'end') blocks = settleThinking(blocks, now)
  const index = event.phase === 'end' ? findToolBlock(blocks, event) : trailingToolBlock(blocks)
  if (index === -1) {
    // An `end` with nothing to settle is dropped rather than inventing a
    // phantom row; a `start` opens the turn's first group.
    if (event.phase === 'end') return blocks
    return [
      ...blocks,
      {
        kind: 'tools',
        id: blockId('tools', blocks.length),
        activities: reduceToolActivity([], event, now)
      }
    ]
  }
  const block = blocks[index]
  if (block.kind !== 'tools') return blocks
  const activities = reduceToolActivity(block.activities, event, now)
  if (activities === block.activities) return blocks
  const next = [...blocks]
  next[index] = { ...block, activities }
  return next
}

/** Index of the trailing block when it is a tool group, else -1 (a new group is due). */
function trailingToolBlock(blocks: TurnBlock[]): number {
  const last = blocks.length - 1
  return blocks[last]?.kind === 'tools' ? last : -1
}

/** Index of the group holding this `end` event's row: by `toolId`, else the newest still-running one. */
function findToolBlock(blocks: TurnBlock[], event: ToolActivityEvent): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]
    if (block.kind !== 'tools') continue
    if (event.toolId !== undefined) {
      if (block.activities.some((activity) => activity.id === event.toolId)) return index
    } else if (block.activities.some((activity) => activity.state === 'running')) {
      return index
    }
  }
  return -1
}

/** Opens a permission block at the point in the turn where the agent asked. */
export function appendTurnApproval(blocks: TurnBlock[], request: ApprovalRequest): TurnBlock[] {
  if (findApproval(blocks, request.requestId) !== -1) return blocks
  return [...blocks, { kind: 'approval', id: blockId('approval', blocks.length), request }]
}

/** Records the user's verdict in place — the card stays as the record of what was authorized. */
export function answerTurnApproval(
  blocks: TurnBlock[],
  requestId: string,
  answer: NonNullable<ApprovalRequest['answer']>
): TurnBlock[] {
  const index = findApproval(blocks, requestId)
  if (index === -1) return blocks
  const block = blocks[index]
  if (block.kind !== 'approval') return blocks
  const next = [...blocks]
  next[index] = { ...block, request: { ...block.request, answer } }
  return next
}

/**
 * Records the same verdict on every request still waiting (agent-approvals,
 * session grant). "Permitir tudo nesta sessão" releases whatever else the
 * agent had parked — several tool calls can block at once — so the cards for
 * those have to close with it instead of sitting there asking a question that
 * has already been answered.
 */
export function answerAllPendingApprovals(
  blocks: TurnBlock[],
  answer: NonNullable<ApprovalRequest['answer']>
): TurnBlock[] {
  let changed = false
  const next = blocks.map((block) => {
    if (block.kind !== 'approval' || block.request.answer != null) return block
    changed = true
    return { ...block, request: { ...block.request, answer } }
  })
  return changed ? next : blocks
}

function findApproval(blocks: TurnBlock[], requestId: string): number {
  return blocks.findIndex(
    (block) => block.kind === 'approval' && block.request.requestId === requestId
  )
}

/**
 * Records the turn's MCP roster (mcp-visibility). At most one per turn: the CLI
 * reports it once, and a second report would be a restatement of the same
 * handshake, so it replaces rather than stacks. An empty roster appends
 * nothing — a turn with no MCP servers has nothing to say about them, and a row
 * reading "0 servidores" on every turn of a workspace that uses none is exactly
 * the chrome `PRODUCT.md` tells us not to add.
 */
export function appendTurnMcp(blocks: TurnBlock[], servers: McpServerReport[]): TurnBlock[] {
  if (servers.length === 0) return blocks
  const index = blocks.findIndex((block) => block.kind === 'mcp')
  if (index === -1) return [...blocks, { kind: 'mcp', id: blockId('mcp', blocks.length), servers }]
  const next = [...blocks]
  next[index] = { kind: 'mcp', id: blocks[index].id, servers }
  return next
}

/**
 * A roster's identity, for deciding whether it is *news*. Two turns that got
 * the same servers in the same states produce the same signature, so the
 * transcript can announce a change instead of repeating an unchanged fact at
 * the top of every turn — the status bar is where the standing answer lives.
 * The tool list is deliberately out: a server that gained a tool between turns
 * has not changed anything the reader of a transcript needs told.
 */
export function rosterSignature(servers: McpServerReport[]): string {
  return servers
    .map((server) => `${server.name}:${server.status}`)
    .sort()
    .join('|')
}

/**
 * Settles a finished turn: no row may keep spinning, and a permission the user
 * never answered (the turn was stopped, or it timed out in main) is recorded as
 * refused rather than left looking answerable.
 */
export function settleTurnBlocks(
  blocks: TurnBlock[],
  outcome: 'ok' | 'failed',
  now: number = Date.now()
): TurnBlock[] {
  let changed = false
  const next = blocks.map((block) => {
    if (block.kind === 'tools') {
      const activities = settleToolActivity(block.activities, outcome, now)
      if (activities === block.activities) return block
      changed = true
      return { ...block, activities }
    }
    if (block.kind === 'approval' && block.request.answer == null) {
      changed = true
      return { ...block, request: { ...block.request, answer: 'deny' as const } }
    }
    // A turn that ended while the agent was still thinking (interrupted, or
    // an error mid-reasoning) must not leave a block breathing forever.
    if (block.kind === 'thinking' && !block.settled) {
      changed = true
      return {
        ...block,
        settled: true,
        ...(block.startedAt !== undefined ? { ms: Math.max(0, now - block.startedAt) } : {})
      }
    }
    return block
  })
  return changed ? next : blocks
}

/**
 * The turn's prose, concatenated. Text blocks only ever split at a tool or
 * approval boundary, and the stream carried no separator across that boundary,
 * so a plain join reproduces the raw buffer byte for byte — which is what gets
 * persisted into the stored conversation.
 */
export function turnText(blocks: TurnBlock[]): string {
  let text = ''
  for (const block of blocks) if (block.kind === 'text') text += block.text
  return text
}

/**
 * The text still being streamed — the trailing text block, or `null` when the
 * turn currently ends on a tool group or an open permission card. Only this
 * block gets the smooth reveal; everything above it is already settled prose
 * and must render whole.
 */
export function trailingTurnText(blocks: TurnBlock[]): string | null {
  const last = blocks[blocks.length - 1]
  return last?.kind === 'text' ? last.text : null
}

/** True while the turn is parked on a permission the user hasn't answered. */
export function hasPendingApproval(blocks: TurnBlock[]): boolean {
  return blocks.some((block) => block.kind === 'approval' && block.request.answer == null)
}
