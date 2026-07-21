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
  Attachment,
  ChatMessage,
  MessageList,
  PromptInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  TypingIndicator
} from '@hive/design-system'
import { shortcutLabel, t } from '../i18n'
import { Markdown } from '../ui/markdown'
import { HiveCellIcon, PaperclipIcon, SlidersIcon } from '../ui/icons'
import { AgentSwitcher, type SwitchableAgent } from '../ui/AgentSwitcher'
import { shortcutIcon } from '../ui/roleVisuals'
import { FileTypeIcon } from '../ui/fileIcons'
import type { RoleAction } from '../ui/ActionRail'
import { IntentGrid } from './IntentGrid'
import { SlashMenu, type SlashSkill } from './SlashMenu'
import { FileMentionMenu } from './FileMentionMenu'
import { extractMentions, formatFileSize, mentionSegments } from './composerMentions'
import { useAttachments } from './useAttachments'
import { useMentions } from './useMentions'
import type { ChatSessionMeta } from './sessionMeta'

interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Display names of files attached to this (user) turn — rendered as chips in the bubble. */
  attachments?: string[]
}

interface AgentOption {
  id: string
  label: string
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
  | { type: 'tool'; name: string; detail?: string; turnId?: string }
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string; turnId?: string }
  | { type: 'interrupted'; turnId?: string }
  | { type: 'session'; id: string; turnId?: string }

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
  /** The current role's resolved actions — feeds the empty-state hero (RP-R4). */
  roleActions: RoleAction[]
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
  /** shortcut-customization: opens the "Personalizar atalhos" picker (hero pill + strip trailing control). */
  onCustomizeShortcuts?: () => void
}

const SLASH_LISTBOX_ID = 'wb-slash-listbox'
const MENTION_LISTBOX_ID = 'wb-mention-listbox'

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
 * the `/` skills menu and the `#` file-mention menu (extracted to module
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
  buffer: string
  visible: boolean
  session: Promise<string | null>
  hiveId: string | null
}

interface TurnEventCtx {
  /** In-flight turns, in spawn order. Events route by `turnId`; events without one fall back to newest (tokens) / oldest (terminals). */
  turns: ActiveTurn[]
  workspace: string
  currentSessionId: () => string | null
  setStreamingText: (value: string | null) => void
  setErrorMessage: (message: string) => void
  appendMessage: (entry: ChatMessageEntry) => void
  /** Updates the live conversation's CLI session id (conversation memory) — only called for a *visible* turn's `session` event. */
  setCliSession: (id: string) => void
  /** Recomputes the "conversations with a running turn" set (the history panel's "Em andamento" indicator). */
  notifyRunning: () => void
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
  const text = turn.buffer
  persistAssistantText(ctx, turn, text)
  if (turn.visible && (terminal === 'done' || text.length > 0)) {
    ctx.appendMessage({ id: nextMessageId(), role: 'assistant', text })
  }
  syncStreamingUi(ctx)
  ctx.notifyRunning()
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
 * Agent-event reducer (module scope for the same complexity-budget reason as
 * `handleSlashKey`). Every event routes to its turn via `turnId`
 * (background-turns) — tokens open an implicit turn only for a stray stream
 * with no live turn at all. Only a *visible* turn touches the pane; a
 * detached turn keeps buffering and persists what it produced (CC-R1.3 for
 * the partial-keep behavior, session-history for the persistence).
 */
function handleAgentEvent(event: AgentEventIn, ctx: TurnEventCtx): void {
  const { turns } = ctx
  switch (event.type) {
    case 'token': {
      let turn = findTurn(turns, event.turnId, 'newest')
      if (!turn) {
        turn = {
          id: event.turnId ?? nextTurnId(),
          buffer: '',
          visible: true,
          session: Promise.resolve(ctx.currentSessionId()),
          hiveId: ctx.currentSessionId()
        }
        turns.push(turn)
        ctx.notifyRunning()
      }
      turn.buffer += event.text
      if (turn.visible) ctx.setStreamingText(turn.buffer)
      break
    }
    case 'done':
    case 'interrupted':
      settleTurn(ctx, event.type, event.turnId)
      break
    case 'error': {
      const turn = takeTurn(turns, event.turnId)
      if (!turn || turn.visible) ctx.setErrorMessage(event.message)
      syncStreamingUi(ctx)
      ctx.notifyRunning()
      break
    }
    case 'session':
      adoptCliSession(ctx, event.id, event.turnId)
      break
    case 'tool':
      break
  }
}

/** After a terminal event: hand the streaming bubble to the newest still-visible in-flight turn, or clear it. */
function syncStreamingUi(ctx: TurnEventCtx): void {
  const visible = [...ctx.turns].reverse().find((turn) => turn.visible)
  ctx.setStreamingText(visible ? visible.buffer : null)
}

/**
 * Backdrop renderer for the composer's `#` mention pills (chat-attachments):
 * valid `#path` tokens get a tinted pill behind the textarea's own glyphs
 * (see PromptInput's `highlight` contract). Module scope — pure function of
 * its inputs.
 */
function renderMentionBackdrop(value: string, fileSet: ReadonlySet<string>): React.ReactNode {
  return mentionSegments(value, fileSet).map((segment, index) =>
    segment.mention ? (
      <mark key={index} className="wb-mention-token">
        {segment.text}
      </mark>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  )
}

/** Parent-folder line for a workspace attachment chip; `undefined` for a root-level file (the chip then shows only the name). */
function parentDirOf(path: string): string | undefined {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? undefined : path.slice(0, slash)
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

/** A message that is exactly one slash command (`/bmad-prd`) — rendered as a command token, mirroring what launching a shortcut or picking a skill "types". */
const SLASH_COMMAND_RE = /^\/[A-Za-z0-9][\w:-]*$/

/** A sent user message's text with its valid `#file` references styled as inline pills. */
function renderUserText(text: string, fileSet: ReadonlySet<string>): React.ReactNode {
  if (SLASH_COMMAND_RE.test(text)) {
    return <span className="wb-user-command">{text}</span>
  }
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
 * `roleActions`), a launch handle for the action rail (RP-R5), an interrupt
 * Stop control (chat-controls CC-R1), a `/` slash-command skills menu (CC-R2),
 * an active-agent indicator + session re-bind on agent change (AG-R3.3), and
 * persisted conversations (session-history): every turn auto-saves through
 * `window.hive.chatHistory`, the hero offers the latest conversations to
 * resume, and the pane header's history panel restores/renames/deletes them.
 */
export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  {
    workspace,
    roleActions,
    agents,
    defaultAgent,
    onManageAgents = () => {},
    userName = null,
    onSessionChange,
    onRunningSessionsChange,
    onCustomizeShortcuts
  },
  ref
) {
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageEntry[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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
  // chat-attachments: pending files for the next message + `#` mention state.
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attachments = useAttachments(capabilities?.supportsAttachments ?? false, workspace)
  const mentions = useMentions(workspace, composerValue, setComposerValue, composerTextareaRef)
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
      setStreamingText,
      setErrorMessage,
      appendMessage: (entry) => setMessages((current) => [...current, entry]),
      setCliSession: (id) => {
        cliSessionRef.current = id
      },
      notifyRunning: refreshRunning
    }

    const unsubscribe = window.hive.agent.onEvent((event) => handleAgentEvent(event, ctx))

    return () => {
      unsubscribe()
      turns.length = 0
      refreshRunning()
      void window.hive.agent.stop()
    }
  }, [workspace, refreshRunning])

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
      setMessages((current) => [
        ...current,
        { id: nextMessageId(), role: 'user', text: label, attachments: attachmentNames }
      ])
      const turn: ActiveTurn = {
        id: nextTurnId(),
        buffer: '',
        visible: true,
        session: persistUserMessage(label, attachmentNames),
        hiveId: sessionIdRef.current
      }
      turnsRef.current.push(turn)
      // A brand-new conversation's id only exists once `create` resolves —
      // refresh the running set again when it does.
      void turn.session.then((id) => {
        turn.hiveId = id
        refreshRunning()
      })
      setStreamingText('')
      refreshRunning()
      return turn.id
    },
    [persistUserMessage, refreshRunning]
  )

  const startWorkflowTurn = useCallback(
    (command: WorkflowCommand, label: string, opts?: { model?: string; effort?: string }) => {
      const resume = cliSessionRef.current
      const turnId = beginTurn(label)
      // multi-agent: the turn runs on THIS conversation's agent. Per-turn
      // model/effort (skill-studio override, else the current selection) travel
      // along; `undefined` lets the agent's CLI use its own default.
      window.hive.agent.runWorkflow(command, {
        agentId: activeAgent ?? undefined,
        resume,
        turnId,
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

  const handleSubmit = useCallback(
    (value: string) => {
      const pending = attachments.items
      if (value.trim() === '' && pending.length === 0) return
      // Context files for the agent: externally attached files travel as
      // absolute paths, workspace chips and `#` references as
      // workspace-relative paths (the session's cwd is the workspace) — all
      // resolved by the adapter's prompt composer. Deduped: dropping a tree
      // row AND typing its `#reference` yields one entry.
      const references = extractMentions(value, mentions.fileSet)
      const contextFiles = [...new Set([...pending.map((entry) => entry.path), ...references])]
      const names = pending.length > 0 ? pending.map((entry) => entry.name) : undefined
      const resume = cliSessionRef.current
      const turnId = beginTurn(value, names)
      setComposerValue('')
      attachments.clear()
      window.hive.agent.send(value, {
        agentId: activeAgent ?? undefined,
        resume,
        turnId,
        attachments: contextFiles.length > 0 ? contextFiles : undefined,
        model: model ?? undefined,
        effort: effort ?? undefined
      })
    },
    [beginTurn, attachments, mentions.fileSet, activeAgent, model, effort]
  )

  const handleStop = useCallback(() => {
    // CC-R1: interrupt only the on-screen conversation's turn, never
    // `stop()` (which would tear down the whole session) and never a blanket
    // interrupt (which would kill other conversations' background turns).
    const visible = [...turnsRef.current].reverse().find((turn) => turn.visible)
    void window.hive.agent.interrupt(visible?.id)
  }, [])

  // background-turns: switching conversations only *detaches* in-flight
  // turns from the pane — their processes keep running, their buffers keep
  // filling, and their replies land in their own conversations. Nothing is
  // interrupted here (that's exactly the behavior users expect from
  // Claude Desktop: leave a conversation thinking, come back later).
  const detachTurns = useCallback(() => {
    for (const turn of turnsRef.current) turn.visible = false
    setStreamingText(null)
  }, [])

  const newConversation = useCallback(() => {
    detachTurns()
    setMessages([])
    setErrorMessage(null)
    sessionIdRef.current = null
    setSessionId(null)
    sessionChainRef.current = Promise.resolve(null)
    cliSessionRef.current = null
    // multi-agent: a fresh conversation reverts to the app default agent (the
    // switcher can then re-pick before the first message).
    setConversationAgent(null)
  }, [detachTurns])

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
      // background-turns: if THIS conversation still has a turn running,
      // re-attach its live stream — the user returns to find the reply
      // exactly where it is, still streaming.
      const running = turnsRef.current.find((turn) => turn.hiveId === stored.id)
      if (running) {
        running.visible = true
        setStreamingText(running.buffer)
      }
    },
    [workspace, detachTurns]
  )

  useImperativeHandle(ref, () => ({ launchAction, launchCreation, newConversation, openSession }), [
    launchAction,
    launchCreation,
    newConversation,
    openSession
  ])

  const isStreaming = streamingText !== null
  const isEmpty = messages.length === 0 && streamingText === null

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
      mentions.onValueEdited()
    },
    [mentions.onValueEdited]
  )

  const selectSlashSkill = useCallback(
    (skill: SlashSkill) => {
      // Picking a row sends the slash command itself — menu, shortcut and
      // typed command all converge on the same `/bmad-*` invocation.
      startWorkflowTurn({ key: skill.key, prompt: `/${skill.key}` }, `/${skill.key}`)
      setComposerValue('')
      setSlashDismissed(true)
    },
    [startWorkflowTurn]
  )

  // Capture-phase so these fire before the textarea's own Enter-to-submit.
  // The `/` and `#` menus are mutually exclusive by their trigger rules; the
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
    },
    [slashOpen, filteredSkills, slashHighlight, selectSlashSkill, mentions]
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

  // User bubble: text with `#file` references as inline pills, plus one chip
  // per attached file (chat-attachments). Nested for the same
  // complexity-budget reason as `renderToolbar`.
  function userBody(message: ChatMessageEntry): React.JSX.Element {
    const hasAttachments = message.attachments !== undefined && message.attachments.length > 0
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
      </>
    )
  }

  const highlightComposer = useCallback(
    (value: string) => renderMentionBackdrop(value, mentions.fileSet),
    [mentions.fileSet]
  )

  // Nested so the menus'/attachments' conditionals stay off the Chat
  // component's complexity budget (same pattern as `renderToolbar`).
  function renderComposer(): React.JSX.Element {
    const mentionOpen = !slashOpen && mentions.open
    const attachmentChips =
      attachments.items.length > 0
        ? attachments.items.map((entry, index) => (
            <Attachment
              key={entry.path}
              className="wb-composer-chip"
              name={entry.name}
              meta={
                entry.kind === 'workspace' ? parentDirOf(entry.path) : formatFileSize(entry.size)
              }
              icon={<FileTypeIcon path={entry.path} size={14} />}
              onRemove={() => attachments.removeAt(index)}
              removeLabel={t('chat.attachmentRemoveAria', entry.name)}
            />
          ))
        : undefined
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
            highlightIndex={mentions.highlight}
            onHighlight={(index) => mentions.setHighlight(() => index)}
            onSelect={(path) => mentions.select(mentions.items.indexOf(path))}
            emptyLabel={
              mentions.fileSet.size === 0 ? t('chat.mentionEmpty') : t('chat.mentionNoMatch')
            }
            listboxId={MENTION_LISTBOX_ID}
          />
        )}
        <PromptInput
          value={composerValue}
          onChange={handleComposerChange}
          onSubmit={handleSubmit}
          streaming={isStreaming}
          onStop={handleStop}
          stopLabel={t('chat.stopAria')}
          placeholder={t('chat.promptPlaceholder')}
          sendLabel={t('chat.sendLabel')}
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
          attachments={attachmentChips}
          allowEmptySubmit={attachments.items.length > 0}
          highlight={highlightComposer}
          textareaRef={composerTextareaRef}
          toolbar={renderToolbar()}
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

  // Role-shortcut strip docked right above the composer (role-personalization
  // RP-R5's "second home", relocated from the old left rail to where the
  // action lands): one quiet chip per workflow, the persona chip set apart —
  // one click launches the matching /bmad-* turn mid-conversation. Nested for
  // the same complexity-budget reason as `renderToolbar`.
  function renderShortcutStrip(): React.JSX.Element | null {
    if (roleActions.length === 0 && !onCustomizeShortcuts) return null
    const workflows = roleActions.filter((action) => action.kind === 'workflow')
    const personas = roleActions.filter((action) => action.kind === 'persona')
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
    // The chips scroll horizontally in their own inner track; the customize
    // control stays pinned at the end so it's reachable no matter how many
    // shortcuts are selected.
    return (
      <div className="wb-shortcut-strip">
        <div
          className="wb-shortcut-strip-scroll"
          role="toolbar"
          aria-label={t('chat.shortcutsLabel')}
        >
          {workflows.map(renderChip)}
          {workflows.length > 0 && personas.length > 0 && (
            <span className="wb-shortcut-strip-divider" aria-hidden="true" />
          )}
          {personas.map(renderChip)}
        </div>
        {onCustomizeShortcuts && (
          <button
            type="button"
            className="wb-shortcut-chip wb-shortcut-customize"
            title={t('shortcuts.customizeTitle')}
            aria-label={t('shortcuts.customizeTitle')}
            onClick={onCustomizeShortcuts}
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
          actions={roleActions}
          onLaunch={launchAction}
          composer={composer}
          recents={recentSessions}
          onOpenRecent={handleOpenRecent}
          runningIds={runningSessionIds}
          userName={userName}
          onCustomize={onCustomizeShortcuts}
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
                avatar={message.role === 'assistant' ? assistantAvatar : undefined}
              >
                {message.role === 'assistant' ? assistantBody(message.text) : userBody(message)}
              </ChatMessage>
            ))}
            {streamingText !== null && (
              <ChatMessage role="assistant" avatar={assistantAvatar}>
                {streamingText.length > 0 ? (
                  assistantBody(streamingText)
                ) : (
                  <TypingIndicator label={t('chat.typingLabel')} />
                )}
              </ChatMessage>
            )}
          </div>
        </MessageList>
      </div>

      <div className="wb-chat-col wb-composer">
        {renderShortcutStrip()}
        {composer}
        <p className="wb-composer-hint">{t('chat.composerHint')}</p>
      </div>
    </div>
  )
})
