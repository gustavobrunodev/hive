import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import {
  Alert,
  ChatMessage,
  MessageList,
  PromptInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner
} from '@hive/design-system'
import { shortcutLabel, t } from '../i18n'
import { Markdown } from '../ui/markdown'
import {
  HiveCellIcon,
  MicIcon,
  PaperclipIcon,
  QueueIcon,
  SlashIcon,
  SlidersIcon,
  StopIcon,
  UnlockIcon
} from '../ui/icons'
import { AgentSwitcher, type SwitchableAgent } from '../ui/AgentSwitcher'
import { ScrollableRow } from '../ui/ScrollableRow'
import { shortcutIcon } from '../ui/roleVisuals'
import { FileTypeIcon } from '../ui/fileIcons'
import type { RoleAction } from '../ui/ActionRail'
import { IntentGrid } from './IntentGrid'
import { SlashMenu, type SlashSkill } from './SlashMenu'
import { FileMentionMenu } from './FileMentionMenu'
import { extractMentions, mentionSegments } from './composerMentions'
import { composerBackdrop } from './composerBackdrop'
import { DictationBar } from '../dictation/DictationBar'
import { useComposerDictation } from '../dictation/useComposerDictation'
import type { DictationEngine } from '../dictation/useDictation'
import { e2eDictationEngine } from '../dictation/e2eDictationSeam'
import { DEFAULT_LANGUAGE, useWhisper } from '../secondBrain/whisper/useWhisper'
import { useTranscriptionModel } from '../secondBrain/whisper/useWhisperPreference'
import { isLongBody, splitCommandMessage, type CommandMessage } from './commandMessage'
import { useAttachments } from './useAttachments'
import { AttachmentTray } from './AttachmentTray'
import { parkDraft, takeDraft, type DraftStore } from './composerDraft'
import { useMentions } from './useMentions'
import type { ChatSessionMeta } from './sessionMeta'
import { ChangeCard } from './ChangeCard'
import type { ApprovalAnswer } from './ApprovalCard'
import { TurnTimeline } from './TurnTimeline'
import { workspaceRelative, type ToolActivityEvent, type ToolPatch } from './toolActivity'
import {
  answerAllPendingApprovals,
  answerTurnApproval,
  appendTurnApproval,
  appendTurnMcp,
  appendTurnText,
  applyTurnTool,
  rosterSignature,
  settleTurnBlocks,
  trailingTurnText,
  turnText,
  type McpServerReport,
  type TurnBlock
} from './turnTimeline'
import { useSmoothStream } from './useSmoothStream'
import { useReviewOptional, type ReviewStore, type TurnMark } from '../scm/useReview'
import { turnsInConversation } from '../scm/reviewScope'
import { ContextMeter } from './ContextMeter'
import { QueuedMessages } from './QueuedMessages'
import { useMessageQueue } from './useMessageQueue'
import { useTicker } from './useTicker'
import type { QueuedMessage } from './messageQueue'
import { countSteps, type TurnMetrics, type TurnUsage } from './turnTiming'
import {
  EMPTY_SESSION_USAGE,
  applyTurnRuntime,
  applyUsage,
  withContextWindow,
  type SessionUsage
} from './sessionUsage'

interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Display names of files attached to this (user) turn — rendered as chips in the bubble. */
  attachments?: string[]
  /**
   * The (assistant) turn's timeline — its prose, tool calls and permission
   * cards in the order they happened, kept with the finished message so the
   * transcript still shows *how* the answer was produced after the turn
   * settles. Live-only, not persisted: a reopened conversation falls back to
   * rendering `text`.
   */
  blocks?: TurnBlock[]
  /**
   * What the turn took — time, steps, tokens, cost — frozen at its terminal
   * event so the settled bubble can carry its receipt. Live-only for the same
   * reason as `blocks`.
   */
  metrics?: TurnMetrics
}

interface AgentOption {
  id: string
  label: string
  /** session-usage: the model's context window in tokens, when the adapter declares one. */
  contextWindow?: number
}

interface AgentCapabilities {
  models: AgentOption[]
  efforts: AgentOption[]
  supportsAttachments: boolean
}

/** Structural mirror of `main/agentAdapter.ts`'s `WorkflowCommand`. */
interface WorkflowCommand {
  key: string
  prompt?: string
}

/** Structural mirror of `main/agentAdapter.ts`'s `AgentEvent` (renderer files mirror main types instead of importing across the boundary). */
type AgentEventIn =
  | { type: 'token'; text: string; turnId?: string }
  | {
      type: 'tool'
      name: string
      detail?: string
      toolId?: string
      phase?: 'start' | 'end'
      ok?: boolean
      filePath?: string
      patch?: ToolPatch
      turnId?: string
    }
  | {
      type: 'approval'
      requestId: string
      tool: string
      detail?: string
      input?: Record<string, unknown>
      turnId?: string
    }
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string; turnId?: string }
  | { type: 'interrupted'; turnId?: string }
  | { type: 'session'; id: string; turnId?: string }
  | { type: 'usage'; usage: TurnUsage; final?: boolean; turnId?: string }
  | { type: 'mcp'; servers: McpServerReport[]; turnId?: string }

/** Imperative handle so the work UI (action rail + session-history header controls, outside this subtree) can drive the chat. */
export interface ChatHandle {
  launchAction: (action: RoleAction) => void
  /**
   * skill-studio: launch an action into a *new* conversation (backgrounding
   * any conversation still generating), optionally overriding the model/effort
   * for that turn. Used by the studio's "Criar" so a generation always starts
   * clean, on the model the user picked, without disturbing work in flight.
   */
  launchCreation: (action: RoleAction, opts?: { model?: string; effort?: string }) => void
  /** session-history: clears the pane into a fresh, not-yet-persisted conversation. */
  newConversation: () => void
  /** session-history: restores a stored conversation's transcript into the pane. */
  openSession: (id: string) => Promise<void>
}

interface ChatProps {
  /** Absolute path to the active workspace — the agent session runs here. */
  workspace: string
  /**
   * shortcut-scopes: the `start` set — the shortcuts offered while there is no
   * conversation yet, on the empty-state hero (RP-R4).
   */
  startActions: RoleAction[]
  /**
   * shortcut-scopes: the `during` set — the strip docked above the composer
   * inside a live conversation. Usually empty (only the PM role ships a
   * default), and an empty set renders no strip at all: mid-thread chrome is
   * earned, not assumed.
   */
  conversationActions?: RoleAction[]
  /** Enabled agent ids (multi-agent) — the composer switcher's pool. */
  agents: string[]
  /** Default agent id (multi-agent) — a new conversation starts on it. */
  defaultAgent: string | null
  /** Opens the profile sheet's agent section (the switcher's "Gerenciar agentes…"). */
  onManageAgents?: () => void
  /** Display name for the empty-state hero greeting ("Olá <nome>, …"). */
  userName?: string | null
  /** session-history: notifies the work UI which stored conversation is on screen (highlight in the history panel). */
  onSessionChange?: (id: string | null) => void
  /** background-turns: stored-conversation ids with a turn still running (the history panel's "Em andamento" indicator). */
  onRunningSessionsChange?: (ids: string[]) => void
  /** shortcut-customization: opens the "Personalizar atalhos" picker on the
   *  set the user is looking at (hero pill → `start`, strip control → `during`). */
  onCustomizeShortcuts?: (scope: 'start' | 'during') => void
  /**
   * mcp-visibility: the MCP roster the CLI reported for the newest turn. The
   * chat is where it arrives (it rides the agent event stream), but the status
   * bar and the console are where it is *shown*, so it is handed up rather
   * than kept here.
   */
  onMcpRoster?: (servers: McpServerReport[]) => void
  /** mcp-visibility: opens the MCP console, from the turn's handshake row. */
  onOpenMcpConsole?: () => void
  /**
   * agent-patch: opens a file the agent edited, by workspace-relative path —
   * the editor's own `openFile`. Lets a path named in the transcript be a way
   * into the file instead of a dead end.
   */
  onOpenFile?: (relPath: string) => void
}

const SLASH_LISTBOX_ID = 'wb-slash-listbox'
const MENTION_LISTBOX_ID = 'wb-mention-listbox'

/**
 * agent-approvals: the card's answer → the scope the main process records.
 * `session` is the blanket, memory-only grant; `always` is the persisted rule
 * (and the write into the agent's own config); `once` covers this call alone.
 */
const APPROVAL_SCOPE: Record<ApprovalAnswer, 'once' | 'always' | 'session'> = {
  allow: 'once',
  'allow-always': 'always',
  'allow-session': 'session',
  deny: 'once'
}

/** Binds a scope onto the customize hook, staying `undefined` when the host
 *  wired none (the surfaces hide their entry point on `undefined`). Module
 *  scope so the branch doesn't land on `Chat`'s complexity budget. */
function customizeHandler(
  onCustomizeShortcuts: ((scope: 'start' | 'during') => void) | undefined,
  scope: 'start' | 'during'
): (() => void) | undefined {
  return onCustomizeShortcuts && (() => onCustomizeShortcuts(scope))
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${messageIdCounter}`
}

/** Matches `/` followed by zero+ non-space chars to end-of-value: the slash-menu open condition (a leading `/`, no space yet). */
function slashQueryOf(value: string): string | null {
  const match = /^\/(\S*)$/.exec(value)
  return match ? match[1] : null
}

interface ComposerMenuKeyCtx {
  open: boolean
  count: number
  highlight: number
  setHighlight: (updater: (h: number) => number) => void
  dismiss: () => void
  select: (index: number) => void
}

/**
 * Capture-phase keyboard handling shared by the composer's anchored menus —
 * the `/` skills menu and the `@` file-mention menu (extracted to module
 * scope so the `Chat` component itself stays under the complexity budget).
 * Fires before the textarea's own Enter-to-submit; a no-op unless the menu
 * is open.
 */
function handleComposerMenuKey(
  event: KeyboardEvent<HTMLDivElement>,
  ctx: ComposerMenuKeyCtx
): void {
  if (!ctx.open) return
  const { count } = ctx
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      event.stopPropagation()
      if (count > 0) ctx.setHighlight((h) => (h + 1) % count)
      break
    case 'ArrowUp':
      event.preventDefault()
      event.stopPropagation()
      if (count > 0) ctx.setHighlight((h) => (h - 1 + count) % count)
      break
    // Tab commits alongside Enter: every quick-open the user already knows
    // (VS Code, Raycast, the agent CLIs) accepts the highlighted row on Tab,
    // and with a menu open there is nothing to tab *to* anyway.
    case 'Tab':
    case 'Enter':
      if (count > 0) {
        event.preventDefault()
        event.stopPropagation()
        ctx.select(Math.min(ctx.highlight, count - 1))
      }
      break
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      ctx.dismiss()
      break
  }
}

let turnIdCounter = 0
function nextTurnId(): string {
  turnIdCounter += 1
  return `turn-${turnIdCounter}`
}

/**
 * Agent Change Review (ACR-R2.2): the turns whose change cards belong in the
 * transcript now on screen. The pending set is the workspace's — every
 * conversation shares the disk the agent wrote to — but a card annotates the
 * turn someone asked for, in the conversation they asked it from. Without the
 * scope, a review requested in one conversation rendered at the bottom of
 * whichever conversation happened to be open next.
 *
 * A pane with no review store (isolated tests) has no cards to render.
 */
function conversationCards(
  review: ReviewStore | null,
  conversationId: string | null,
  turnOwners: ReadonlyMap<string, string | null>
): TurnMark[] {
  return turnsInConversation(review?.turns ?? [], conversationId, turnOwners)
}

/**
 * One in-flight agent turn (session-history / background-turns). The turn —
 * not the component — owns the streamed text, so a reply keeps accumulating
 * (and lands in the right stored conversation) after the user switches the
 * pane to another conversation mid-stream: `visible` flips off, the buffer
 * keeps filling, and the turn's process keeps running in the background.
 * Returning to the conversation re-attaches the live stream. `id` is echoed
 * on every event the adapter produces for this turn — the router key that
 * keeps concurrent turns apart. `session` resolves to the stored-conversation
 * id this turn belongs to (a promise because the conversation may still be
 * being created when the first tokens arrive); `hiveId` caches it once known,
 * for synchronous lookups (re-attach, the running indicator).
 */
interface ActiveTurn {
  id: string
  /**
   * Everything this turn has produced, in arrival order: prose, tool calls and
   * permission cards interleaved exactly as they happened (see
   * `turnTimeline.ts`). Replaces the old `buffer` + `activities` pair, which
   * could only ever be rendered as two separate slabs.
   */
  blocks: TurnBlock[]
  /**
   * What it is costing (session-usage): when it started, and the newest token
   * report the CLI has sent for it. Lives on the turn — not on the component —
   * for the same reason `blocks` does: a backgrounded turn keeps accumulating,
   * and its receipt has to be right when the user comes back to it.
   */
  metrics: TurnMetrics
  visible: boolean
  session: Promise<string | null>
  hiveId: string | null
}

interface TurnEventCtx {
  /** In-flight turns, in spawn order. Events route by `turnId`; events without one fall back to newest (tokens) / oldest (terminals). */
  turns: ActiveTurn[]
  workspace: string
  currentSessionId: () => string | null
  /** Publishes the *visible* turn's timeline to the pane; `null` when no turn is on screen. */
  setStreamingBlocks: (blocks: TurnBlock[] | null) => void
  /** Publishes the *visible* turn's execution record (the live meter); `null` when no turn is on screen. */
  setStreamingMetrics: (metrics: TurnMetrics | null) => void
  /** Folds one token report into this conversation's session totals (session-usage). */
  recordUsage: (
    usage: TurnUsage,
    opts: { final: boolean; runtimeMs: number; turnId?: string }
  ) => void
  /** Records a turn that ended with no token report at all — the wall-clock still counts. */
  recordRuntime: (runtimeMs: number) => void
  /** Releases (or holds) the next queued send once a turn reaches its terminal event. */
  settleQueue: (outcome: 'done' | 'interrupted' | 'error') => void
  setErrorMessage: (message: string) => void
  appendMessage: (entry: ChatMessageEntry) => void
  /** Updates the live conversation's CLI session id (conversation memory) — only called for a *visible* turn's `session` event. */
  setCliSession: (id: string) => void
  /** Recomputes the "conversations with a running turn" set (the history panel's "Em andamento" indicator). */
  notifyRunning: () => void
  /** mcp-visibility: hands the turn's MCP roster to the work UI (status bar + console). */
  publishRoster: (servers: McpServerReport[]) => void
  /** mcp-visibility: true when this roster differs from the last one this pane saw. */
  rosterIsNews: (servers: McpServerReport[]) => boolean
}

/** Finds an in-flight turn by event `turnId`; events without one (older adapter, implicit turns) fall back positionally. */
function findTurn(
  turns: ActiveTurn[],
  turnId: string | undefined,
  fallback: 'newest' | 'oldest'
): ActiveTurn | undefined {
  if (turnId !== undefined) {
    const match = turns.find((turn) => turn.id === turnId)
    if (match) return match
  }
  return fallback === 'newest' ? turns[turns.length - 1] : turns[0]
}

/** `findTurn` + removal — terminal events consume their turn. */
function takeTurn(turns: ActiveTurn[], turnId: string | undefined): ActiveTurn | undefined {
  const turn = findTurn(turns, turnId, 'oldest')
  if (!turn) return undefined
  turns.splice(turns.indexOf(turn), 1)
  return turn
}

/** Persists a finished turn's assistant text into its stored conversation — fire-and-forget: persistence failures never break the live chat. */
function persistAssistantText(ctx: TurnEventCtx, turn: ActiveTurn, text: string): void {
  if (text.length === 0) return
  void turn.session
    .then((id) =>
      id === null
        ? null
        : window.hive.chatHistory.append(ctx.workspace, id, { role: 'assistant', text })
    )
    .catch(() => null)
}

/**
 * Settles an in-flight turn on a terminal event. CC-R1.3/R1.4: an interrupt
 * keeps whatever streamed as a finished message; an interrupt with zero
 * output leaves no empty bubble and no error Alert — a user stop is a normal
 * outcome. A detached (background) turn still persists what it produced into
 * its own conversation.
 */
function settleTurn(
  ctx: TurnEventCtx,
  terminal: 'done' | 'interrupted',
  turnId: string | undefined
): void {
  const turn = takeTurn(ctx.turns, turnId)
  if (!turn) return
  const text = turnText(turn.blocks)
  persistAssistantText(ctx, turn, text)
  // A turn that ends leaves nothing spinning and nothing answerable — an
  // interrupt settles its in-flight steps as failed, a clean finish as done,
  // and either way a permission nobody answered is recorded as refused.
  const blocks = settleTurnBlocks(turn.blocks, terminal === 'done' ? 'ok' : 'failed')
  const metrics = closeMetrics(ctx, turn, terminal)
  if (turn.visible && (terminal === 'done' || text.length > 0 || blocks.length > 0)) {
    ctx.appendMessage({
      id: nextMessageId(),
      role: 'assistant',
      text,
      blocks: blocks.length > 0 ? blocks : undefined,
      metrics
    })
  }
  syncStreamingUi(ctx)
  ctx.notifyRunning()
  // Only the conversation ON SCREEN releases its queue. A backgrounded turn
  // finishing must not fire the visible conversation's next queued message —
  // the two belong to different transcripts and different CLI sessions.
  if (turn.visible) ctx.settleQueue(terminal)
}

/**
 * Freezes a finished turn's execution record and folds its wall-clock into
 * the session totals.
 *
 * A turn that never reported usage — an adapter that emits none, or one
 * interrupted before the CLI printed its result line — still contributes its
 * time: time spent is time spent, whether or not anyone billed for it. A turn
 * that *did* report is already accumulated (its `final` usage event arrived
 * before this terminal one), so counting it again here would double it.
 */
function closeMetrics(
  ctx: TurnEventCtx,
  turn: ActiveTurn,
  outcome: 'done' | 'interrupted' | 'error'
): TurnMetrics {
  const endedAt = Date.now()
  turn.metrics = {
    ...turn.metrics,
    endedAt,
    outcome,
    steps: countSteps(turn.blocks)
  }
  if (!turn.metrics.usage) ctx.recordRuntime(endedAt - turn.metrics.startedAt)
  return turn.metrics
}

/**
 * The CLI announced (or re-minted) a conversation's native session id
 * (session-history). It belongs to the event's turn — persist it into that
 * turn's stored conversation for future --resume, and adopt it as the live
 * resume handle only if that turn is on screen right now.
 */
function adoptCliSession(ctx: TurnEventCtx, cliId: string, turnId: string | undefined): void {
  const turn = findTurn(ctx.turns, turnId, 'newest')
  if (!turn) return
  if (turn.visible) ctx.setCliSession(cliId)
  void turn.session
    .then((id) =>
      id === null ? null : window.hive.chatHistory.setCliSession(ctx.workspace, id, cliId)
    )
    .catch(() => null)
}

/**
 * Appends to the event's turn timeline and republishes it when that turn is
 * the one on screen. The single write path for everything a running turn
 * produces — text, steps, permission cards — so they can never again drift
 * into separate, separately-ordered stores.
 */
function growTurn(
  ctx: TurnEventCtx,
  turnId: string | undefined,
  grow: (blocks: TurnBlock[]) => TurnBlock[]
): void {
  const turn = findTurn(ctx.turns, turnId, 'newest') ?? openImplicitTurn(ctx, turnId)
  turn.blocks = grow(turn.blocks)
  if (turn.visible) ctx.setStreamingBlocks(turn.blocks)
}

/**
 * Files one token report (session-usage): onto the turn it belongs to, so its
 * meter and its receipt can read it, and into the conversation's running
 * totals. Only the `final` report — one per turn, off the CLI's own `result`
 * line — advances turns/tokens/cost; the intermediate snapshots restate the
 * same growing request and would quadruple the count if summed.
 */
function recordTurnUsage(
  ctx: TurnEventCtx,
  turnId: string | undefined,
  usage: TurnUsage,
  final: boolean
): void {
  const turn = findTurn(ctx.turns, turnId, 'newest')
  if (turn) {
    turn.metrics = { ...turn.metrics, usage }
    if (turn.visible) ctx.setStreamingMetrics(turn.metrics)
  }
  ctx.recordUsage(usage, {
    final,
    // Measured from the turn's own start, so a turn that reports twice restates
    // its elapsed time rather than reporting a second slice of it — which is
    // exactly how `applyUsage` folds a repeated report back in.
    runtimeMs: turn ? Date.now() - turn.metrics.startedAt : 0,
    turnId
  })
}

/**
 * Agent-event reducer (module scope for the same complexity-budget reason as
 * `handleSlashKey`). Every event routes to its turn via `turnId`
 * (background-turns) — tokens open an implicit turn only for a stray stream
 * with no live turn at all. Only a *visible* turn touches the pane; a
 * detached turn keeps buffering and persists what it produced (CC-R1.3 for
 * the partial-keep behavior, session-history for the persistence).
 */
function handleAgentEvent(event: AgentEventIn, ctx: TurnEventCtx): void {
  switch (event.type) {
    case 'token':
      growTurn(ctx, event.turnId, (blocks) => appendTurnText(blocks, event.text))
      break
    case 'done':
    case 'interrupted':
      settleTurn(ctx, event.type, event.turnId)
      break
    case 'error': {
      const turn = takeTurn(ctx.turns, event.turnId)
      if (turn) closeMetrics(ctx, turn, 'error')
      if (!turn || turn.visible) ctx.setErrorMessage(event.message)
      syncStreamingUi(ctx)
      ctx.notifyRunning()
      // A failed turn holds the queue rather than draining it into a session
      // that is already erroring — and, as above, only its own conversation's.
      if (!turn || turn.visible) ctx.settleQueue('error')
      break
    }
    case 'session':
      adoptCliSession(ctx, event.id, event.turnId)
      break
    case 'usage':
      recordTurnUsage(ctx, event.turnId, event.usage, event.final === true)
      break
    case 'mcp':
      handleMcpEvent(ctx, event.servers, event.turnId)
      break
    case 'tool':
      // The feed belongs to the turn's timeline, so a background turn keeps
      // accumulating steps and shows its full history — in order — when the
      // user switches back to it.
      growTurn(ctx, event.turnId, (blocks) => applyTurnTool(blocks, event as ToolActivityEvent))
      break
    case 'approval':
      // agent-approvals: the card opens *inside its turn*, at the point the
      // agent asked — not in a pile at the bottom of the conversation. A
      // request raised by a background turn stays blocked and simply comes
      // back into view with that conversation; it is never auto-answered.
      growTurn(ctx, event.turnId, (blocks) =>
        appendTurnApproval(blocks, {
          requestId: event.requestId,
          tool: event.tool,
          detail: event.detail,
          input: event.input,
          turnId: event.turnId,
          answer: null
        })
      )
      break
  }
}

/**
 * mcp-visibility: the turn's MCP roster, routed to its two very different
 * audiences. It is *always* published upward (the status bar's standing answer
 * must never go stale), but it only opens a block in the transcript when it is
 * **news** — an unchanged roster restated at the top of every turn is chrome,
 * and the whole point of that row is that its presence means something.
 */
function handleMcpEvent(
  ctx: TurnEventCtx,
  servers: McpServerReport[],
  turnId: string | undefined
): void {
  ctx.publishRoster(servers)
  if (!ctx.rosterIsNews(servers)) return
  growTurn(ctx, turnId, (blocks) => appendTurnMcp(blocks, servers))
}

/**
 * A stray stream with no live turn at all (an event arriving after a reload, or
 * from an adapter that reports no `turnId`) still deserves a bubble — open one
 * bound to the conversation on screen rather than dropping its output.
 */
function openImplicitTurn(ctx: TurnEventCtx, turnId: string | undefined): ActiveTurn {
  const turn: ActiveTurn = {
    id: turnId ?? nextTurnId(),
    blocks: [],
    // The stream is already under way, so this clock starts late by whatever
    // the first event took to arrive. It is the only start this turn has.
    metrics: { startedAt: Date.now(), steps: 0 },
    visible: true,
    session: Promise.resolve(ctx.currentSessionId()),
    hiveId: ctx.currentSessionId()
  }
  ctx.turns.push(turn)
  ctx.notifyRunning()
  return turn
}

/** After a terminal event: hand the streaming bubble to the newest still-visible in-flight turn, or clear it. */
function syncStreamingUi(ctx: TurnEventCtx): void {
  const visible = [...ctx.turns].reverse().find((turn) => turn.visible)
  ctx.setStreamingBlocks(visible ? visible.blocks : null)
  ctx.setStreamingMetrics(visible ? visible.metrics : null)
}

/**
 * Backdrop renderer for the composer's `@` mention pills (chat-attachments):
 * valid `@path` tokens get a tinted pill behind the textarea's own glyphs
 * (see PromptInput's `highlight` contract). Module scope — pure function of
 * its inputs.
 */
function renderMentionBackdrop(
  value: string,
  fileSet: ReadonlySet<string>,
  freshRange: readonly [number, number] | null
): React.ReactNode {
  return composerBackdrop(value, fileSet, freshRange).map((segment, index) => {
    const className = [
      segment.mention ? 'wb-mention-token' : null,
      segment.fresh ? 'wb-composer-fresh' : null
    ]
      .filter((name) => name !== null)
      .join(' ')
    // A mention still renders as <mark>; the freshly-landed run is a plain
    // span, because it is a transient glance and not a semantic token.
    return segment.mention ? (
      <mark key={index} className={className}>
        {segment.text}
      </mark>
    ) : (
      <span key={index} className={className === '' ? undefined : className}>
        {segment.text}
      </span>
    )
  })
}

/** `aria-activedescendant` target for an open composer menu, or `undefined`. */
function activeOptionId(
  open: boolean,
  count: number,
  highlight: number,
  listboxId: string
): string | undefined {
  return open && count > 0 ? `${listboxId}-opt-${Math.min(highlight, count - 1)}` : undefined
}

/**
 * A sent invocation: the command token, whatever rode on its line, and the
 * material the user actually wrote underneath.
 *
 * The two halves get deliberately different weight (see `.wb-invocation` in
 * workbench.css) because a launched turn is two things at once — a skill being
 * run and a message being sent — and a single flat run of text hides which is
 * which. Everything sent is still shown verbatim; a long body just collapses.
 */
function CommandInvocation({ invocation }: { invocation: CommandMessage }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const collapsible = isLongBody(invocation.body)
  return (
    <span className="wb-invocation">
      {/* One unbroken text run, `/` included: the token has to select, copy
          and read aloud as the exact command that was invoked. */}
      <span className="wb-command-token">
        <SlashIcon size={13} aria-hidden="true" />
        <span className="wb-command-token-name">/{invocation.command}</span>
        {invocation.args !== '' && <span className="wb-command-token-args">{invocation.args}</span>}
      </span>
      {invocation.body !== '' && (
        <span className="wb-invocation-body">
          <span
            className="wb-invocation-text"
            data-clamped={collapsible && !expanded ? '' : undefined}
          >
            {invocation.body}
          </span>
          {collapsible && (
            <button
              type="button"
              className="wb-invocation-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? t('chat.invocationLess') : t('chat.invocationMore')}
            </button>
          )}
        </span>
      )}
    </span>
  )
}

/** A sent user message's text with its valid `@file` references styled as inline pills. */
function renderUserText(text: string, fileSet: ReadonlySet<string>): React.ReactNode {
  return mentionSegments(text, fileSet).map((segment, index) =>
    segment.mention ? (
      <span key={index} className="wb-user-mention">
        {segment.text}
      </span>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  )
}

/**
 * Chat surface. A visual conversation (DS `MessageList`/`ChatMessage`/
 * `PromptInput`/`TypingIndicator`) with model/effort pickers driven by the
 * active adapter's capabilities.
 *
 * This feature set adds: a role-personalized empty-state hero (RP-R4, from
 * `startActions`), a launch handle for the action rail (RP-R5), an interrupt
 * Stop control (chat-controls CC-R1), a `/` slash-command skills menu (CC-R2),
 * an active-agent indicator + session re-bind on agent change (AG-R3.3), and
 * persisted conversations (session-history): every turn auto-saves through
 * `window.hive.chatHistory`, the hero offers the latest conversations to
 * resume, and the pane header's history panel restores/renames/deletes them.
 */
export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  {
    workspace,
    startActions,
    conversationActions = [],
    agents,
    defaultAgent,
    onManageAgents = () => {},
    userName = null,
    onSessionChange,
    onRunningSessionsChange,
    onCustomizeShortcuts,
    onOpenFile,
    onMcpRoster,
    onOpenMcpConsole
  },
  ref
) {
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageEntry[]>([])
  // The on-screen turn's live timeline (prose + steps + permission cards, in
  // order). `null` when no turn is running in this conversation.
  const [streamingBlocks, setStreamingBlocks] = useState<TurnBlock[] | null>(null)
  // The on-screen turn's execution record (elapsed, steps, tokens) — the live
  // meter at the foot of the turn. `null` when no turn is running here.
  const [streamingMetrics, setStreamingMetrics] = useState<TurnMetrics | null>(null)
  // session-usage: how full the context window is and what the conversation
  // has spent. Reset with the conversation, since both are properties of the
  // CLI session a conversation resumes, not of the app.
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>(EMPTY_SESSION_USAGE)
  // Agent Change Review (ACR-R2.2): the shared review store when present (the
  // app wraps Chat in a ReviewProvider); null in isolated tests → no cards.
  const review = useReviewOptional()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // agent-approvals (session grant): whether "permitir tudo nesta sessão" is
  // armed. Owned by the main process (it is what the CLI's prompt tool asks),
  // mirrored here so the footer chip can show it and take it back. Read once on
  // mount, because a window reload must not claim the agent is still asking.
  const [approvalSession, setApprovalSession] = useState(false)
  useEffect(() => {
    let alive = true
    void window.hive.agent.approvalSession().then((armed) => {
      if (alive) setApprovalSession(armed)
    })
    return () => {
      alive = false
    }
  }, [])
  // multi-agent: which agent drives THIS conversation. `null` → fall back to the
  // app default (`defaultAgent`); set explicitly by the composer switcher (fresh
  // conversation) or when restoring a stored conversation's own agent.
  const [conversationAgent, setConversationAgent] = useState<string | null>(null)
  const activeAgent = conversationAgent ?? defaultAgent
  // id → displayName for every registered agent, for the switcher labels.
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<SlashSkill[]>([])
  const [composerValue, setComposerValue] = useState('')
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [slashHighlight, setSlashHighlight] = useState(0)
  // chat-attachments: pending files for the next message + `@` mention state.
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attachments = useAttachments(capabilities?.supportsAttachments ?? false, workspace)
  const mentions = useMentions(workspace, composerValue, setComposerValue, composerTextareaRef)
  // A draft belongs to its conversation, not to this pane (`composerDraft.ts`):
  // conversation id → the text + files it left unsent. Leaving parks, entering
  // takes back. Without this, a file attached here stayed clipped to the
  // composer when the user opened an unrelated conversation — one Enter away
  // from sending private context into the wrong session.
  const draftsRef = useRef<DraftStore>(new Map())
  // A draft that just came back, so the tray can say so. `null` the rest of the
  // time — silence is the correct default for a composer the user just filled
  // themselves. Counts, not booleans: returning twice to the same conversation
  // has to re-announce, and a boolean already `true` renders nothing new.
  const [restoredDraft, setRestoredDraft] = useState<{ files: number; at: number } | null>(null)
  // The notice is a moment, not a state: it explains why the composer arrived
  // full and then gets out of the way, so a draft the user has already taken
  // over does not keep announcing itself.
  useEffect(() => {
    if (restoredDraft === null) return
    const timer = window.setTimeout(() => setRestoredDraft(null), 6000)
    return () => window.clearTimeout(timer)
  }, [restoredDraft])
  // voice-prompt (M13): the composer gains dictation. The engine is M12's
  // embedded Whisper, reused as-is and pinned to pt-BR (D-VP-4); everything
  // else lives in `dictation/`, which knows nothing about Chat (VP-R5.1).
  //
  // voice-settings (M25): the **model** comes from the same global preference
  // the ingestion sheet resolves, rather than from `useWhisper`'s built-in
  // default. This composer used to pass no `model` at all, so every dictation
  // in the chat ran `DEFAULT_MODEL` no matter what the user had chosen — the
  // setting existed and this surface, the one people dictate into most, was
  // not covered by it. `DEFAULT_MODEL` now covers only the round trip before
  // main answers, which no take can start inside.
  const { phase: whisperPhase, transcribe: whisperTranscribe } = useWhisper()
  const dictationModel = useTranscriptionModel()
  const dictationEngine = useMemo<DictationEngine>(
    () =>
      // A real Whisper pass would add a 278 MB download and ~4 s to every E2E
      // run; the seam returns null in every other context.
      e2eDictationEngine() ?? {
        phase: whisperPhase,
        transcribe: (pcm) =>
          whisperTranscribe(pcm, { model: dictationModel, language: DEFAULT_LANGUAGE })
      },
    [whisperPhase, whisperTranscribe, dictationModel]
  )
  const dictation = useComposerDictation({
    value: composerValue,
    setValue: setComposerValue,
    textareaRef: composerTextareaRef,
    engine: dictationEngine
  })
  // session-history: which stored conversation the pane is showing (null =
  // fresh, not yet persisted — it materializes on the first sent message).
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // Serializes create/append IPC per conversation so a fast second message
  // can't race the session's creation. Resolves to the session id.
  const sessionChainRef = useRef<Promise<string | null>>(Promise.resolve(null))
  // The current conversation's CLI-native session id (conversation memory):
  // sent as `resume` with every turn so the agent keeps prior context, and
  // refreshed by each turn's `session` event.
  const cliSessionRef = useRef<string | null>(null)
  const turnsRef = useRef<ActiveTurn[]>([])
  // Agent Change Review: turnId → the conversation the turn was asked from
  // (`null` = asked before that conversation was persisted). Main owns this
  // fact durably on the turn mark; this is the pane's copy, and it only answers
  // for the round trip between a conversation's id being minted and
  // `review.attachTurn` landing — long enough for a card to otherwise blink out
  // of the transcript that is watching it appear. State, not a ref: the card
  // list is rendered from it. One small entry per turn sent in this pane.
  const [turnOwners, setTurnOwners] = useState<ReadonlyMap<string, string | null>>(new Map())
  // mcp-visibility: the last roster this pane announced in the transcript. Kept
  // per pane rather than per conversation on purpose — the MCP set belongs to
  // the workspace and its CLI, not to whichever conversation is on screen, so
  // switching conversations is not a reason to re-announce an unchanged one.
  const rosterSignatureRef = useRef<string | null>(null)
  // The latest `onMcpRoster` prop, so the event subscription below can call it
  // without listing it as a dependency — a new callback identity from the
  // parent must not tear down and re-open the whole agent event stream.
  const onMcpRosterRef = useRef<((servers: McpServerReport[]) => void) | undefined>(undefined)
  useEffect(() => {
    onMcpRosterRef.current = onMcpRoster
  })
  // Latest conversations for the empty-state hero's "continue" list.
  const [recentSessions, setRecentSessions] = useState<ChatSessionMeta[]>([])
  // background-turns: which stored conversations have a turn still running —
  // feeds the "Em andamento" indicators (history panel + hero recents).
  const [runningSessionIds, setRunningSessionIds] = useState<string[]>([])

  const refreshRunning = useCallback(() => {
    const ids: string[] = []
    for (const turn of turnsRef.current) {
      if (turn.hiveId !== null && !ids.includes(turn.hiveId)) ids.push(turn.hiveId)
    }
    setRunningSessionIds((current) =>
      current.length === ids.length && current.every((id, index) => id === ids[index])
        ? current
        : ids
    )
  }, [])

  useEffect(() => {
    onSessionChange?.(sessionId)
  }, [sessionId, onSessionChange])

  useEffect(() => {
    onRunningSessionsChange?.(runningSessionIds)
  }, [runningSessionIds, onRunningSessionsChange])

  // session-usage: the denominator behind the context meter follows whichever
  // model this conversation is on — it is a property of the model, not of the
  // session, and switching model mid-conversation moves the ceiling. Composed
  // at read time rather than stored, so the measured half of the state stays
  // the only thing the event stream writes to. The curated figure is the
  // fallback: once the CLI has reported the window it is actually running at,
  // `withContextWindow` prefers that.
  const sessionUsageView = useMemo(() => {
    const window = capabilities?.models.find((option) => option.id === model)?.contextWindow ?? null
    return withContextWindow(sessionUsage, window)
  }, [sessionUsage, capabilities, model])

  const recordUsage = useCallback(
    (usage: TurnUsage, opts: { final: boolean; runtimeMs: number; turnId?: string }) => {
      setSessionUsage((current) => applyUsage(current, usage, opts))
    },
    []
  )
  const recordRuntime = useCallback((runtimeMs: number) => {
    setSessionUsage((current) => applyTurnRuntime(current, runtimeMs))
  }, [])

  // chat-queue: sends the user committed to while a turn was running. The
  // actual dispatcher is defined further down (it needs `beginTurn` and this
  // conversation's resume handle), so it is reached through a ref — the queue
  // owns the list, never the sending, and the two are wired in that order.
  const dispatchQueuedRef = useRef<(message: QueuedMessage) => void>(() => {})
  const queue = useMessageQueue(
    useCallback((message: QueuedMessage) => dispatchQueuedRef.current(message), [])
  )
  const settleQueue = queue.settle

  // multi-agent: capabilities reflect THIS conversation's agent. Model/effort
  // reset to the new agent's defaults on a switch — model ids aren't portable
  // across agents (Claude's `opus` means nothing to Copilot), and an agent may
  // expose no model and/or no effort at all (Devin/Copilot), in which case the
  // composer hides that picker and the value stays `null` (omitted per turn).
  useEffect(() => {
    let cancelled = false
    window.hive.agent.capabilities(activeAgent ?? undefined).then((caps) => {
      if (cancelled) return
      setCapabilities(caps)
      setModel(caps.models[0]?.id ?? null)
      setEffort(caps.efforts[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [activeAgent])

  // Resolve every agent's display name for the switcher labels.
  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (cancelled) return
      setAgentNames(Object.fromEntries(list.map((entry) => [entry.id, entry.displayName])))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // multi-agent: ensure THIS conversation's agent has a live pooled session
  // bound to the workspace cwd (idempotent — the pool no-ops a repeat). Per-turn
  // model/effort travel with each send, so this needn't restart on those.
  useEffect(() => {
    if (!activeAgent) return
    void window.hive.agent.start({ agentId: activeAgent, workspace })
  }, [activeAgent, workspace])

  // Discover the workspace's BMAD skills for the slash menu (CC-R3.1).
  useEffect(() => {
    let cancelled = false
    window.hive.skills.list(workspace).then((list) => {
      if (!cancelled) setSkills(list)
    })
    return () => {
      cancelled = true
    }
  }, [workspace])

  // multi-agent: one unified event subscription per workspace. Every agent's
  // pooled session funnels its events here; routing is by `turnId`
  // (background-turns), so a single subscription serves every concurrent
  // conversation/agent — no per-agent (re)subscribe. Teardown stops the whole
  // pool and drops in-flight turns (their terminal events die with the
  // unsubscribe; their user half is already persisted).
  useEffect(() => {
    // Stable alias: the array identity never changes (only its contents), and
    // the cleanup below must clear the same array it subscribed with.
    const turns = turnsRef.current
    const ctx: TurnEventCtx = {
      turns,
      workspace,
      currentSessionId: () => sessionIdRef.current,
      setStreamingBlocks,
      setStreamingMetrics,
      recordUsage,
      recordRuntime,
      settleQueue,
      setErrorMessage,
      appendMessage: (entry) => setMessages((current) => [...current, entry]),
      setCliSession: (id) => {
        cliSessionRef.current = id
      },
      notifyRunning: refreshRunning,
      publishRoster: (servers) => onMcpRosterRef.current?.(servers),
      rosterIsNews: (servers) => {
        const signature = rosterSignature(servers)
        if (signature === rosterSignatureRef.current) return false
        rosterSignatureRef.current = signature
        return true
      }
    }

    const unsubscribe = window.hive.agent.onEvent((event) => handleAgentEvent(event, ctx))

    return () => {
      unsubscribe()
      turns.length = 0
      refreshRunning()
      void window.hive.agent.stop()
    }
  }, [workspace, refreshRunning, recordUsage, recordRuntime, settleQueue])

  // session-history: persists a user turn into its stored conversation,
  // creating the conversation on the very first message (lazy — no empty
  // shells). Chained so ordering holds; failures degrade to an unpersisted
  // (but fully working) chat.
  const persistUserMessage = useCallback(
    (text: string, attachments?: string[]): Promise<string | null> => {
      const chained = sessionChainRef.current
        .then(async () => {
          let id = sessionIdRef.current
          if (id === null) {
            // multi-agent: stamp the conversation with the agent driving it, so
            // reopening it later restores the right agent (and history badge).
            const created = await window.hive.chatHistory.create(workspace, activeAgent)
            id = created.id
            sessionIdRef.current = id
            setSessionId(id)
          }
          await window.hive.chatHistory.append(workspace, id, { role: 'user', text, attachments })
          return id
        })
        .catch(() => sessionIdRef.current)
      sessionChainRef.current = chained
      return chained
    },
    [workspace, activeAgent]
  )

  // Shared turn kick-off for a text send, a role/rail action, and a slash
  // pick: pane bubble + persisted user message + a tracked in-flight turn.
  // Returns the turn id the agent call must carry (background-turns routing).
  // `attachmentNames` (chat-attachments) are the display names the bubble's
  // chips render — the sent *paths* travel separately with the agent call.
  const beginTurn = useCallback(
    (label: string, attachmentNames?: string[]): string => {
      setErrorMessage(null)
      // The conversation this turn is being asked from. `null` on a pane that
      // hasn't persisted anything yet — the id is minted below, and the turn's
      // review mark is attributed as soon as it lands.
      const askedFrom = sessionIdRef.current
      setMessages((current) => [
        ...current,
        { id: nextMessageId(), role: 'user', text: label, attachments: attachmentNames }
      ])
      const turn: ActiveTurn = {
        id: nextTurnId(),
        blocks: [],
        // The clock starts here — at the press of Enter, which is the moment
        // the user is timing, not whenever the CLI process gets around to
        // reporting its own.
        metrics: { startedAt: Date.now(), steps: 0 },
        visible: true,
        session: persistUserMessage(label, attachmentNames),
        hiveId: sessionIdRef.current
      }
      turnsRef.current.push(turn)
      setTurnOwners((current) => new Map(current).set(turn.id, askedFrom))
      // A brand-new conversation's id only exists once `create` resolves —
      // refresh the running set again when it does.
      void turn.session.then((id) => {
        turn.hiveId = id
        // Agent Change Review: the turn was sent before this conversation
        // existed, so its mark carries no conversation yet. Name it now — the
        // change card belongs to this transcript and to no other (ACR-R2.2).
        if (askedFrom === null && id !== null) {
          setTurnOwners((current) => new Map(current).set(turn.id, id))
          void window.hive.review.attachTurn(workspace, turn.id, id)
        }
        refreshRunning()
      })
      setStreamingBlocks([])
      setStreamingMetrics(turn.metrics)
      refreshRunning()
      return turn.id
    },
    [persistUserMessage, refreshRunning, workspace]
  )

  const startWorkflowTurn = useCallback(
    (command: WorkflowCommand, label: string, opts?: { model?: string; effort?: string }) => {
      const resume = cliSessionRef.current
      const conversationId = sessionIdRef.current ?? undefined
      const turnId = beginTurn(label)
      // multi-agent: the turn runs on THIS conversation's agent. Per-turn
      // model/effort (skill-studio override, else the current selection) travel
      // along; `undefined` lets the agent's CLI use its own default.
      window.hive.agent.runWorkflow(command, {
        agentId: activeAgent ?? undefined,
        resume,
        turnId,
        conversationId,
        model: opts?.model ?? model ?? undefined,
        effort: opts?.effort ?? effort ?? undefined
      })
    },
    [beginTurn, activeAgent, model, effort]
  )

  const launchAction = useCallback(
    (action: RoleAction) => {
      // The shortcut IS the slash command: the transcript shows exactly what
      // was invoked (`/bmad-prd`), same as typing it in the composer.
      startWorkflowTurn(action.command, action.command.prompt ?? `/${action.command.key}`)
    },
    [startWorkflowTurn]
  )

  /**
   * Hands one send to the agent, now. Shared by the composer's immediate path
   * and by the queue's deferred one, so a message that waited behaves exactly
   * like one that didn't — same bubble, same context files, same resume
   * handle (read at dispatch time, so a queued follow-up resumes the
   * conversation as it stands *then*, not as it stood when it was typed).
   */
  const sendNow = useCallback(
    (message: QueuedMessage) => {
      const resume = cliSessionRef.current
      // Read before `beginTurn`: this is the conversation the user is sending
      // from, and it's what scopes the turn's change card (ACR-R2.2).
      const conversationId = sessionIdRef.current ?? undefined
      const turnId = beginTurn(message.text, message.attachmentNames)
      if (message.workflow) {
        window.hive.agent.runWorkflow(message.workflow, {
          agentId: activeAgent ?? undefined,
          resume,
          turnId,
          conversationId,
          model: model ?? undefined,
          effort: effort ?? undefined
        })
        return
      }
      window.hive.agent.send(message.text, {
        agentId: activeAgent ?? undefined,
        resume,
        turnId,
        conversationId,
        attachments: message.contextFiles?.length ? message.contextFiles : undefined,
        model: model ?? undefined,
        effort: effort ?? undefined
      })
    },
    [beginTurn, activeAgent, model, effort]
  )

  useEffect(() => {
    dispatchQueuedRef.current = sendNow
  }, [sendNow])

  // chat-queue: a send committed while this conversation already has a turn
  // running joins the queue instead of racing it. Two turns of the same
  // conversation in flight at once would interleave two replies into one
  // transcript and fork the CLI session's memory — which is the failure the
  // old "the send button becomes Stop" behaviour was avoiding by simply
  // refusing the send. Queueing keeps the refusal's guarantee and drops its
  // cost: nothing is lost, and nothing has to be re-typed.
  const isStreaming = streamingBlocks !== null
  const submitOrQueue = useCallback(
    (message: Omit<QueuedMessage, 'id'>) => {
      if (isStreaming) {
        queue.add(message)
        return
      }
      sendNow({ ...message, id: '' })
    },
    [isStreaming, queue, sendNow]
  )

  const handleSubmit = useCallback(
    (value: string) => {
      const pending = attachments.items
      if (value.trim() === '' && pending.length === 0) return
      // Context files for the agent: externally attached files travel as
      // absolute paths, workspace chips and `@` references as
      // workspace-relative paths (the session's cwd is the workspace) — all
      // resolved by the adapter's prompt composer. Deduped: dropping a tree
      // row AND typing its `@reference` yields one entry.
      const references = extractMentions(value, mentions.fileSet)
      const contextFiles = [...new Set([...pending.map((entry) => entry.path), ...references])]
      const names = pending.length > 0 ? pending.map((entry) => entry.name) : undefined
      setComposerValue('')
      attachments.clear()
      setRestoredDraft(null)
      submitOrQueue({ text: value, contextFiles, attachmentNames: names })
    },
    [attachments, mentions.fileSet, submitOrQueue]
  )

  /**
   * VP-R1.6: submitting during a take finalizes it first and sends what the
   * transcription actually produced — never a half-transcribed prompt. The
   * send is deferred until the queue drains; `handleDictationSettled` below
   * performs it.
   */
  const pendingSendRef = useRef(false)
  const handleComposerSubmit = useCallback(
    (value: string) => {
      if (dictation.active) {
        pendingSendRef.current = true
        dictation.finish()
        return
      }
      handleSubmit(value)
    },
    [dictation, handleSubmit]
  )

  // The deferred half of VP-R1.6. A take that ended cleanly sends what the
  // composer now holds; a take that ended in an error does NOT — the failure
  // and its retry are on screen, and sending a prompt missing a segment is the
  // silent data loss this whole feature is built to avoid.
  const dictationStatus = dictation.phase.status
  // Mirrors `composerValue` for the callbacks that must not re-bind on every
  // keystroke: the deferred dictation send below, and `switchDraft`, which
  // closes over the whole session plumbing.
  const composerValueRef = useRef(composerValue)
  useEffect(() => {
    composerValueRef.current = composerValue
  }, [composerValue])
  useEffect(() => {
    if (!pendingSendRef.current) return
    if (dictationStatus === 'finalizing') return
    pendingSendRef.current = false
    if (dictationStatus === 'idle') handleSubmit(composerValueRef.current)
  }, [dictationStatus, handleSubmit])

  /**
   * Whether a stop is in flight: pressed, not yet acknowledged by the stream.
   *
   * The window is short — the adapter settles the turn the moment it receives
   * the interrupt rather than waiting for the process to die — but it is a
   * round trip through IPC and it is not zero, and a control that looks
   * identical the instant after you press it is a control users press again
   * and then report as broken. This is the press landing, visibly.
   */
  const [stopping, setStopping] = useState(false)
  // Read by `handleStop`, which must stay dependency-free: it is wired to a
  // button that only exists while a turn runs, and re-creating it on every
  // state change would remount that button mid-press.
  const stoppingRef = useRef(false)
  useEffect(() => {
    // Cleared by the stream, never by a timer: "stopped" is the turn ending,
    // and only the event stream knows when that happened.
    const settle = (): void => {
      if (isStreaming) return
      stoppingRef.current = false
      setStopping(false)
    }
    settle()
  }, [isStreaming])

  const handleStop = useCallback(() => {
    // CC-R1: interrupt only the on-screen conversation's turn, never
    // `stop()` (which would tear down the whole session) and never a blanket
    // interrupt (which would kill other conversations' background turns).
    if (stoppingRef.current) return
    const visible = [...turnsRef.current].reverse().find((turn) => turn.visible)
    stoppingRef.current = true
    setStopping(true)
    void window.hive.agent.interrupt(visible?.id)
  }, [])

  // background-turns: switching conversations only *detaches* in-flight
  // turns from the pane — their processes keep running, their buffers keep
  // filling, and their replies land in their own conversations. Nothing is
  // interrupted here (that's exactly the behavior users expect from
  // Claude Desktop: leave a conversation thinking, come back later).
  const detachTurns = useCallback(() => {
    // In-place on purpose. An `ActiveTurn` is aliased by the async callbacks
    // that outlive this render — `beginTurn`'s `turn.session.then` writes
    // `turn.hiveId`, and the event stream appends to `turn.blocks` — so
    // swapping in fresh objects would land those late writes on orphans and
    // silently lose a background conversation's reply.
    // eslint-disable-next-line react-hooks/immutability
    for (const turn of turnsRef.current) turn.visible = false
    // A pending permission card belongs to the conversation that raised it, so
    // it leaves with the pane. The request itself stays blocked in main and
    // comes back with the transcript — it is never silently auto-answered.
    setStreamingBlocks(null)
    setStreamingMetrics(null)
  }, [])

  /**
   * agent-patch: opens a file the agent edited, from its patch header.
   *
   * The CLI reports absolute paths and the editor addresses files relative to
   * the workspace, so this is where the two meet. A path outside the workspace
   * (the agent read something from elsewhere on disk) resolves to nothing
   * rather than to a wrong file — and `undefined` when the host has no editor
   * at all, which is what makes the control disappear instead of misfiring.
   */
  const openEditedFile = useMemo(
    () =>
      onOpenFile === undefined
        ? undefined
        : (path: string): void => {
            const relative = workspaceRelative(workspace, path)
            if (relative !== null) onOpenFile(relative)
          },
    [onOpenFile, workspace]
  )

  // agent-approvals: releases the CLI child parked on this request. The card
  // keeps its answered state in place — in the transcript, where it was asked
  // — so the record of what was authorized survives the decision.
  const handleApprovalDecision = useCallback((requestId: string, decision: ApprovalAnswer) => {
    // "Permitir tudo nesta sessão" answers every card still open, because the
    // main process releases every parked request with it (`approvalService`'s
    // `armSessionAllowAll`). Leaving the others asking would be the UI
    // claiming the agent is still blocked on a question already answered.
    const answerAll = decision === 'allow-session'
    const settleBlocks = (blocks: TurnBlock[]): TurnBlock[] =>
      answerAll
        ? answerAllPendingApprovals(blocks, decision)
        : answerTurnApproval(blocks, requestId, decision)
    // The card may live in a still-running turn or in one that has already
    // settled into a message (a request can outlive its turn), so both
    // stores are updated; whichever holds it, the answer lands in place.
    // In-place for the same reason as `detachTurns`: the turn object is the
    // identity the running stream keeps writing to.
    for (const turn of turnsRef.current) {
      // eslint-disable-next-line react-hooks/immutability
      turn.blocks = settleBlocks(turn.blocks)
      if (turn.visible) setStreamingBlocks(turn.blocks)
    }
    setMessages((current) =>
      current.map((message) =>
        message.blocks === undefined
          ? message
          : { ...message, blocks: settleBlocks(message.blocks) }
      )
    )
    // The blanket grant is armed as a *mode*, not as an answer to this one
    // request: arming already releases everything parked (including this
    // call), and it still works when the card has outlived its turn — a
    // request id the main process no longer knows makes `respondApproval` a
    // no-op, which would have left the chip on with nothing behind it.
    if (answerAll) {
      setApprovalSession(true)
      void window.hive.agent.setApprovalSession(true)
      return
    }
    void window.hive.agent.respondApproval(requestId, {
      behavior: decision === 'deny' ? 'deny' : 'allow',
      scope: APPROVAL_SCOPE[decision],
      message: decision === 'deny' ? t('approval.deniedMessage') : undefined
    })
  }, [])

  /**
   * Takes the session-wide grant back: the agent starts asking again from the
   * next call. The footer chip is the only surface that shows the grant is on,
   * so it is also the one that has to be able to end it.
   */
  const revokeApprovalSession = useCallback(() => {
    setApprovalSession(false)
    void window.hive.agent.setApprovalSession(false)
  }, [])

  /**
   * Hands the composer over between conversations: parks what is on screen
   * under the one being left, and restores what the one being entered had
   * waiting. Text and files move together — they were written as one draft,
   * and splitting them would put one conversation's message under another
   * conversation's attachments.
   */
  const switchDraft = useCallback(
    (from: string | null, to: string | null) => {
      // Re-opening the conversation already on screen is not a switch: parking
      // and immediately un-parking would work, but it would announce a restore
      // for a draft that never went anywhere. Both being `null` is NOT that
      // case — those are two different conversations that simply have no ids
      // yet, and "Nova conversa" over an unsent draft has to clear it.
      if (from !== null && from === to) return
      parkDraft(draftsRef.current, from, {
        text: composerValueRef.current,
        attachments: attachments.items
      })
      const draft = takeDraft(draftsRef.current, to)
      setComposerValue(draft.text)
      attachments.replace(draft.attachments)
      // Restored text is not text the user is typing: a parked `/bmad-prd`
      // must not reopen the slash menu over a transcript they just arrived at.
      setSlashDismissed(true)
      setSlashHighlight(0)
      setRestoredDraft(
        draft.text !== '' || draft.attachments.length > 0
          ? { files: draft.attachments.length, at: Date.now() }
          : null
      )
    },
    [attachments]
  )

  const newConversation = useCallback(() => {
    const leaving = sessionIdRef.current
    detachTurns()
    setMessages([])
    setErrorMessage(null)
    sessionIdRef.current = null
    setSessionId(null)
    sessionChainRef.current = Promise.resolve(null)
    cliSessionRef.current = null
    // The context reading belongs to the CLI session being left; a fresh
    // conversation starts from nothing known. The queue is *parked*, not
    // dropped — those messages were written for the conversation that keeps
    // running in the background, and they come back with it.
    setSessionUsage(EMPTY_SESSION_USAGE)
    queue.switchConversation(leaving, null)
    // ...and so is the composer's unsent draft: a fresh conversation starts
    // with an empty one, and the files picked for the old conversation stay
    // parked with it rather than following the user here.
    switchDraft(leaving, null)
    // multi-agent: a fresh conversation reverts to the app default agent (the
    // switcher can then re-pick before the first message).
    setConversationAgent(null)
  }, [detachTurns, queue, switchDraft])

  // skill-studio: launching a creation/generation opens a *fresh* conversation
  // rather than appending to whatever is on screen — the builder gets a clean
  // transcript, and any conversation still generating is detached to the
  // background (its turn keeps running, surfaced as "Em andamento") instead of
  // being interrupted. The studio's chosen model/effort ride along per-turn,
  // so this never restarts (and so tears down) the shared session.
  const launchCreation = useCallback(
    (action: RoleAction, opts?: { model?: string; effort?: string }) => {
      newConversation()
      startWorkflowTurn(action.command, action.command.prompt ?? `/${action.command.key}`, opts)
    },
    [newConversation, startWorkflowTurn]
  )

  const openSession = useCallback(
    async (id: string): Promise<void> => {
      const stored = await window.hive.chatHistory.get(workspace, id)
      if (!stored) return
      const leaving = sessionIdRef.current
      detachTurns()
      // multi-agent: restore the agent this conversation ran on (falls back to
      // the app default when the stored agent is unknown/blank).
      setConversationAgent(stored.agent ?? null)
      setMessages(
        stored.messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.text,
          attachments: message.attachments
        }))
      )
      setErrorMessage(null)
      sessionIdRef.current = stored.id
      setSessionId(stored.id)
      sessionChainRef.current = Promise.resolve(stored.id)
      // Conversation memory: the next turn resumes this conversation's CLI
      // session, so the agent picks up right where this transcript left off.
      cliSessionRef.current = stored.cliSessionId ?? null
      // The usage reading belongs to the conversation being left: a restored
      // transcript's real occupancy is unknown until its next turn reports one,
      // and showing the previous conversation's number would be a lie about
      // this one. The queue swaps with the pane — each conversation gets back
      // whatever it had waiting.
      setSessionUsage(EMPTY_SESSION_USAGE)
      queue.switchConversation(leaving, stored.id)
      // Same rule for the composer: this conversation gets its own unsent
      // draft back — never the one belonging to the conversation just left.
      switchDraft(leaving, stored.id)
      // background-turns: if THIS conversation still has a turn running,
      // re-attach its live stream — the user returns to find the reply
      // exactly where it is, still streaming.
      const running = turnsRef.current.find((turn) => turn.hiveId === stored.id)
      if (running) {
        running.visible = true
        setStreamingBlocks(running.blocks)
        setStreamingMetrics(running.metrics)
      }
    },
    [workspace, detachTurns, queue, switchDraft]
  )

  useImperativeHandle(ref, () => ({ launchAction, launchCreation, newConversation, openSession }), [
    launchAction,
    launchCreation,
    newConversation,
    openSession
  ])

  const isEmpty = messages.length === 0 && streamingBlocks === null
  // One clock for every live duration on screen (the turn meter, each running
  // step), running only while something is.
  const now = useTicker(isStreaming)
  // agent-activity AA-R4: the CLI delivers a reply in fat, irregular chunks;
  // this paces them into a continuous reveal so the text flows instead of
  // appearing in blocks. Grapheme-safe, so an emoji never renders half-formed.
  // Only the *trailing* text block is paced — prose the agent already finished
  // (because a tool call interrupted it) must not re-type itself.
  const revealedText = useSmoothStream(streamingBlocks && trailingTurnText(streamingBlocks))

  // multi-agent: the composer switcher's pool — enabled agents (in order) with
  // their display names resolved.
  const enabledAgents = useMemo<SwitchableAgent[]>(
    () => agents.map((id) => ({ id, displayName: agentNames[id] ?? id })),
    [agents, agentNames]
  )

  // session-history: the hero's "continue where you left off" list — loaded
  // whenever the pane is (back) on the empty state, so it's always current.
  useEffect(() => {
    if (!isEmpty) return
    let cancelled = false
    window.hive.chatHistory
      .list(workspace)
      .then((list) => {
        if (!cancelled) setRecentSessions(list.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setRecentSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [isEmpty, workspace])

  const handleOpenRecent = useCallback(
    (id: string) => {
      void openSession(id)
    },
    [openSession]
  )

  // --- Slash menu -----------------------------------------------------------
  const slashQuery = slashQueryOf(composerValue)
  const filteredSkills = useMemo(() => {
    if (slashQuery === null) return []
    const needle = slashQuery.toLowerCase()
    if (needle.length === 0) return skills
    // Filter on the command name only — it's the only thing the menu shows,
    // so what matches is always visible (no ghost matches via descriptions).
    return skills.filter((skill) => skill.key.toLowerCase().includes(needle))
  }, [slashQuery, skills])
  const slashOpen = slashQuery !== null && !slashDismissed

  const handleComposerChange = useCallback(
    (value: string) => {
      setComposerValue(value)
      // Any edit re-enables the menus and resets their highlights to the top.
      setSlashDismissed(false)
      setSlashHighlight(0)
      // Typing is acknowledgement: the user has seen what came back.
      setRestoredDraft(null)
      mentions.onValueEdited()
    },
    [mentions.onValueEdited]
  )

  const selectSlashSkill = useCallback(
    (skill: SlashSkill) => {
      // Picking a row sends the slash command itself — menu, shortcut and
      // typed command all converge on the same `/bmad-*` invocation. It goes
      // through the queue like any other composer send: launching a second
      // workflow into a conversation that is already running one is the same
      // collision a typed follow-up would cause.
      submitOrQueue({
        text: `/${skill.key}`,
        workflow: { key: skill.key, prompt: `/${skill.key}` }
      })
      setComposerValue('')
      setSlashDismissed(true)
    },
    [submitOrQueue]
  )

  // Capture-phase so these fire before the textarea's own Enter-to-submit.
  // The `/` and `@` menus are mutually exclusive by their trigger rules; the
  // slash menu (leading `/`) wins if both ever match.
  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      handleComposerMenuKey(event, {
        open: slashOpen,
        count: filteredSkills.length,
        highlight: slashHighlight,
        setHighlight: setSlashHighlight,
        dismiss: () => setSlashDismissed(true),
        select: (index) => selectSlashSkill(filteredSkills[index])
      })
      if (event.defaultPrevented) return
      handleComposerMenuKey(event, {
        open: !slashOpen && mentions.open,
        count: mentions.items.length,
        highlight: mentions.highlight,
        setHighlight: mentions.setHighlight,
        dismiss: mentions.dismiss,
        select: mentions.select
      })
      // Last, and only if a menu did not already claim the event: Esc belongs
      // to an open menu before it belongs to the take (VP-R1.5, VP-R1.7).
      dictation.handleKeyDown(event)
      // …and after all of those, Esc means "stop the agent" — the binding every
      // agent CLI already trained these users on. Strictly last, because Esc's
      // first job is always to close whatever is open: a press that dismisses
      // the slash menu must not also kill the turn behind it. Scoped to the
      // composer subtree, so a pending permission card (which reads Esc as
      // "Recusar" and holds focus itself) is never second-guessed from here.
      if (event.defaultPrevented || event.key !== 'Escape') return
      if (!isStreaming) return
      event.preventDefault()
      handleStop()
    },
    [
      slashOpen,
      filteredSkills,
      slashHighlight,
      selectSlashSkill,
      mentions,
      dictation,
      isStreaming,
      handleStop
    ]
  )

  const assistantAvatar = (
    <span className="wb-avatar" aria-hidden="true">
      <HiveCellIcon />
    </span>
  )

  function assistantBody(text: string): React.JSX.Element {
    return (
      <div className="wb-chat-md wb-md">
        <Markdown source={text} />
      </div>
    )
  }

  // User bubble: text with `@file` references as inline pills, plus one chip
  // per attached file (chat-attachments). Nested for the same
  // complexity-budget reason as `renderToolbar`.
  function userBody(message: ChatMessageEntry): React.JSX.Element {
    const hasAttachments = message.attachments !== undefined && message.attachments.length > 0
    // A message that STARTS with a command is not prose in a bubble — it's an
    // invocation, and possibly an invocation carrying material. It gets its own
    // compact token (see `.wb-msg-command`) rather than a tinted chip nested
    // inside the accent bubble, which put dark ink on a darkened accent at
    // 4.2:1 — under the WCAG AA floor.
    const invocation = hasAttachments ? null : splitCommandMessage(message.text)
    if (invocation !== null) return <CommandInvocation invocation={invocation} />
    return (
      <>
        {message.text !== '' && renderUserText(message.text, mentions.fileSet)}
        {hasAttachments && (
          <span className="wb-bubble-attachments">
            {message.attachments?.map((name, index) => (
              <span key={`${name}-${index}`} className="wb-bubble-attachment">
                <FileTypeIcon path={name} size={13} />
                <span className="wb-bubble-attachment-name">{name}</span>
              </span>
            ))}
          </span>
        )}
      </>
    )
  }

  // Nested so its own conditionals (capabilities/streaming/agent) stay off the
  // Chat component's complexity budget.
  function renderToolbar(): React.JSX.Element {
    if (!capabilities) return <Spinner label={t('chat.loadingCapabilities')} />
    return (
      <>
        {/* Leading the paperclip and sharing its weight: dictation is an
            alternative to typing, not a campaign (VP-R1.1). Hover or focus
            starts the engine warming in the background (D-VP-6) — nothing is
            downloaded for a user who never reaches for it. */}
        <button
          type="button"
          className="wb-attach-btn wb-mic-btn"
          aria-label={t('dictation.start')}
          aria-pressed={dictation.active}
          title={t('dictation.startHint')}
          onPointerEnter={dictation.prewarm}
          onFocus={dictation.prewarm}
          onClick={() => (dictation.active ? dictation.finish() : dictation.start())}
        >
          <MicIcon size={15} />
        </button>
        {capabilities.supportsAttachments && (
          <button
            type="button"
            className="wb-attach-btn"
            aria-label={t('chat.attachLabel')}
            title={t('chat.attachTitle')}
            onClick={() => void attachments.pick()}
          >
            <PaperclipIcon size={15} />
          </button>
        )}
        {enabledAgents.length > 0 && (
          <AgentSwitcher
            agents={enabledAgents}
            value={activeAgent}
            locked={messages.length > 0}
            onChange={setConversationAgent}
            onManage={onManageAgents}
          />
        )}
        {capabilities.models.length > 0 && (
          <Select value={model ?? undefined} onValueChange={setModel}>
            <SelectTrigger className="wb-select-compact" aria-label={t('chat.modelLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.models.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {capabilities.efforts.length > 0 && (
          <Select value={effort ?? undefined} onValueChange={setEffort}>
            <SelectTrigger className="wb-select-compact" aria-label={t('chat.effortLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.efforts.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* chat-queue: the interrupt moves out of the primary button and into
            its own control, because the primary button now has a job that
            outranks it — committing what you just typed. Two controls, each
            with one meaning: this stops the agent, that one sends. It appears
            only while there is something to stop. */}
        {isStreaming && (
          <button
            type="button"
            className="wb-stop-btn"
            aria-label={t('chat.stopAria')}
            title={stopping ? t('chat.stopPending') : t('chat.stopTitle')}
            aria-keyshortcuts="Escape"
            // Not `disabled`: a disabled button drops focus to the body, which
            // strands a keyboard user in the middle of the one interaction
            // where they most need to stay put. The repeat press is refused in
            // `handleStop` instead, where refusing costs nobody their place.
            data-stopping={stopping || undefined}
            onClick={handleStop}
          >
            <StopIcon size={14} className="wb-stop-glyph" />
          </button>
        )}
      </>
    )
  }

  const highlightComposer = useCallback(
    (value: string) => renderMentionBackdrop(value, mentions.fileSet, dictation.freshRange),
    [mentions.fileSet, dictation.freshRange]
  )

  // chat-queue: while a turn runs the composer stays open and its primary
  // control promises the queue instead of an immediate send. Resolved here so
  // `renderComposer` stays a layout function rather than a decision tree.
  const sendAffordance = isStreaming
    ? {
        placeholder: t('chat.promptPlaceholderBusy'),
        label: t('chat.queueLabel'),
        icon: <QueueIcon size={16} />
      }
    : {
        placeholder: t('chat.promptPlaceholder'),
        label: t('chat.sendLabel'),
        icon: undefined
      }

  // The staged-files tray (chat-attachments + per-conversation drafts). Built
  // here rather than inside `renderComposer` so the composer stays a layout
  // function. Handed over unconditionally — the tray renders nothing when there
  // is nothing staged and nothing to announce, and `PromptInput`'s slot hides
  // itself when its content came out empty.
  const attachmentTray = (
    <AttachmentTray
      items={attachments.items}
      onRemove={attachments.removeAt}
      onClear={attachments.clear}
      restored={restoredDraft}
    />
  )

  // Nested so the menus'/attachments' conditionals stay off the Chat
  // component's complexity budget (same pattern as `renderToolbar`).
  function renderComposer(): React.JSX.Element {
    const mentionOpen = !slashOpen && mentions.open
    return (
      <div
        className="wb-composer-wrap"
        data-tour="composer"
        data-dragging={attachments.dragActive || undefined}
        onKeyDownCapture={handleComposerKeyDown}
        onKeyUpCapture={mentions.syncCaret}
        onMouseUpCapture={mentions.syncCaret}
        {...attachments.dragHandlers}
      >
        {errorMessage && (
          <Alert variant="danger" role="alert" className="wb-composer-error">
            {t('chat.errorMessage', errorMessage)}
          </Alert>
        )}
        {/* agent-approvals (session grant): while the agent is not asking, the
            composer says so. A blanket permission with no standing surface is
            one the user grants for a task and keeps for the day — and it rides
            the composer rather than the footer strip so it is also there in a
            brand-new conversation, which has no footer at all. */}
        {approvalSession && (
          <p className="wb-approval-session-chip" aria-label={t('approval.sessionChipAria')}>
            <span className="wb-approval-session-chip-mark" aria-hidden="true">
              <UnlockIcon size={12} />
            </span>
            {t('approval.sessionChipLabel')}
            <button
              type="button"
              className="wb-approval-session-chip-cta"
              onClick={revokeApprovalSession}
            >
              {t('approval.sessionRevokeCta')}
            </button>
          </p>
        )}
        {slashOpen && (
          <SlashMenu
            items={filteredSkills}
            highlightIndex={slashHighlight}
            onHighlight={setSlashHighlight}
            onSelect={selectSlashSkill}
            emptyLabel={skills.length === 0 ? t('chat.slashEmpty') : t('chat.slashNoMatch')}
            listboxId={SLASH_LISTBOX_ID}
          />
        )}
        {mentionOpen && (
          <FileMentionMenu
            items={mentions.items}
            total={mentions.total}
            query={mentions.query}
            highlightIndex={mentions.highlight}
            onHighlight={(index) => mentions.setHighlight(() => index)}
            onSelect={(path) => mentions.select(mentions.items.indexOf(path))}
            emptyLabel={
              mentions.fileSet.size === 0 ? t('chat.mentionEmpty') : t('chat.mentionNoMatch')
            }
            listboxId={MENTION_LISTBOX_ID}
          />
        )}
        {/* Docked to the composer's top edge: what is waiting to be sent sits
            between the box it came out of and the transcript it is going to. */}
        <QueuedMessages
          queue={queue.queue}
          onRemove={queue.remove}
          onClear={queue.clear}
          onResume={queue.resume}
        />
        <PromptInput
          value={composerValue}
          onChange={handleComposerChange}
          onSubmit={handleComposerSubmit}
          placeholder={sendAffordance.placeholder}
          // chat-queue: the composer never takes the stop role now (that moved
          // to its own toolbar control), so the primary button always commits
          // what is typed — it only changes what it promises to do with it.
          sendLabel={sendAffordance.label}
          sendIcon={sendAffordance.icon}
          aria-controls={
            slashOpen ? SLASH_LISTBOX_ID : mentionOpen ? MENTION_LISTBOX_ID : undefined
          }
          aria-activedescendant={
            activeOptionId(slashOpen, filteredSkills.length, slashHighlight, SLASH_LISTBOX_ID) ??
            activeOptionId(
              mentionOpen,
              mentions.items.length,
              mentions.highlight,
              MENTION_LISTBOX_ID
            )
          }
          attachments={attachmentTray}
          allowEmptySubmit={attachments.items.length > 0}
          highlight={highlightComposer}
          textareaRef={composerTextareaRef}
          toolbar={renderToolbar()}
          highlighted={dictation.active}
          toolbarOverlay={
            dictation.active ? (
              <DictationBar
                phase={dictation.phase}
                levels={dictation.levels}
                failure={dictation.failure}
                onFinish={dictation.finish}
                onDiscard={dictation.discard}
                onRetry={dictation.retry}
                onRequestMic={dictation.start}
              />
            ) : undefined
          }
        />
        {attachments.dragActive && (
          <div className="wb-composer-dropzone">
            <PaperclipIcon size={18} />
            <span>{t('chat.dropHint')}</span>
          </div>
        )}
      </div>
    )
  }

  // The in-conversation shortcut strip, docked right above the composer
  // (role-personalization RP-R5's "second home", relocated from the old left
  // rail to where the action lands): one quiet chip per workflow, the persona
  // chip set apart — one click launches the matching /bmad-* turn
  // mid-conversation. Nested for the same complexity-budget reason as
  // `renderToolbar`.
  //
  // shortcut-scopes: this row renders the `during` set alone, and an empty set
  // renders nothing — not even the customize control. Most roles ship no
  // in-conversation default, and a permanent "configure me" affordance over
  // every conversation is chrome advertising itself; the hero pill and the
  // profile sheet are the two ways in, both always reachable.
  function renderShortcutStrip(): React.JSX.Element | null {
    if (conversationActions.length === 0) return null
    const workflows = conversationActions.filter((action) => action.kind === 'workflow')
    const personas = conversationActions.filter((action) => action.kind === 'persona')
    function renderChip(action: RoleAction): React.JSX.Element {
      const Icon = shortcutIcon(action)
      return (
        <button
          key={action.key}
          type="button"
          className="wb-shortcut-chip"
          data-persona={action.kind === 'persona' || undefined}
          title={`/${action.command.key}`}
          onClick={() => launchAction(action)}
        >
          <Icon size={13} />
          <span className="wb-shortcut-chip-label">
            {shortcutLabel(action.key, action.kind, action.label)}
          </span>
        </button>
      )
    }
    // The chips scroll horizontally in their own inner track — with paddles and
    // edge fades, since a role with many shortcuts can hide most of them past
    // the pane's edge; the customize control stays pinned after that track so
    // it's reachable no matter how many shortcuts are selected.
    return (
      <div className="wb-shortcut-strip">
        <ScrollableRow
          className="wb-shortcut-strip-row"
          trackClassName="wb-shortcut-strip-scroll"
          role="toolbar"
          ariaLabel={t('chat.shortcutsLabel')}
          scrollBackLabel={t('chat.shortcutsScrollBack')}
          scrollForwardLabel={t('chat.shortcutsScrollForward')}
        >
          {workflows.map(renderChip)}
          {workflows.length > 0 && personas.length > 0 && (
            <span className="wb-shortcut-strip-divider" aria-hidden="true" />
          )}
          {personas.map(renderChip)}
        </ScrollableRow>
        {onCustomizeShortcuts && (
          <button
            type="button"
            className="wb-shortcut-chip wb-shortcut-customize"
            title={t('shortcuts.customizeTitle')}
            aria-label={t('shortcuts.customizeTitle')}
            onClick={() => onCustomizeShortcuts('during')}
          >
            <SlidersIcon size={13} />
          </button>
        )}
      </div>
    )
  }

  const composer = renderComposer()

  if (isEmpty) {
    return (
      <div className="wb-chat">
        <IntentGrid
          actions={startActions}
          onLaunch={launchAction}
          composer={composer}
          recents={recentSessions}
          onOpenRecent={handleOpenRecent}
          runningIds={runningSessionIds}
          userName={userName}
          onCustomize={customizeHandler(onCustomizeShortcuts, 'start')}
        />
      </div>
    )
  }

  return (
    <div className="wb-chat">
      <div className="wb-chat-scroll">
        <MessageList jumpToLatestLabel={t('chat.jumpToLatestLabel')}>
          <div className="wb-chat-col wb-chat-messages">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                className={
                  message.role === 'user' && splitCommandMessage(message.text) !== null
                    ? 'wb-msg-command'
                    : undefined
                }
                avatar={message.role === 'assistant' ? assistantAvatar : undefined}
              >
                {message.role === 'assistant' ? (
                  // A finished turn replays its own timeline. A conversation
                  // restored from disk has no blocks (they aren't persisted),
                  // so it falls back to the prose it does have.
                  message.blocks !== undefined ? (
                    <TurnTimeline
                      blocks={message.blocks}
                      live={false}
                      metrics={message.metrics}
                      renderText={assistantBody}
                      onApprovalDecide={handleApprovalDecision}
                      onOpenFile={openEditedFile}
                      onOpenMcpConsole={onOpenMcpConsole}
                    />
                  ) : (
                    message.text !== '' && assistantBody(message.text)
                  )
                ) : (
                  userBody(message)
                )}
              </ChatMessage>
            ))}
            {streamingBlocks !== null && (
              <ChatMessage role="assistant" avatar={assistantAvatar}>
                {/* The live turn, in the order it is happening: what it says,
                    what it asks permission for, and what it runs — never
                    hoisted, never pinned to the bottom of the screen. */}
                <TurnTimeline
                  blocks={streamingBlocks}
                  live
                  metrics={streamingMetrics ?? undefined}
                  now={now}
                  revealedText={revealedText}
                  renderText={assistantBody}
                  onApprovalDecide={handleApprovalDecision}
                  onOpenFile={openEditedFile}
                  onOpenMcpConsole={onOpenMcpConsole}
                />
              </ChatMessage>
            )}
            {/* Agent Change Review (ACR-R2.2): a change card per turn that
                touched files, keyed off its TurnMark — Claude-Desktop tier.
                Scoped to the conversation the turn was asked from: the pending
                set is the workspace's, but a card is this transcript's. Other
                conversations' pending work stays reachable through the review
                bar, the panel, and the history list's marker. */}
            {conversationCards(review, sessionId, turnOwners).map((turn) => (
              <ChangeCard key={turn.turnId} turn={turn} />
            ))}
          </div>
        </MessageList>
      </div>

      <div className="wb-chat-col wb-composer">
        {renderShortcutStrip()}
        {composer}
        {/* The strip under the composer: session status on the left, keyboard
            grammar on the right. The hints used to own the whole line and were
            read once and never again; the meter is the half of it that keeps
            being worth a glance. */}
        <div className="wb-composer-footer">
          <ContextMeter usage={sessionUsageView} onNewConversation={newConversation} />
          <p className="wb-composer-hint">{t('chat.composerHint')}</p>
        </div>
      </div>
    </div>
  )
})
