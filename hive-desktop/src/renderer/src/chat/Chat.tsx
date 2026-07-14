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
  Spinner,
  TypingIndicator
} from '@hive/design-system'
import { roleActionLabel, t } from '../i18n'
import { Markdown } from '../ui/markdown'
import { HiveCellIcon, StopIcon } from '../ui/icons'
import type { RoleAction } from '../ui/ActionRail'
import { IntentGrid } from './IntentGrid'
import { SlashMenu, type SlashSkill } from './SlashMenu'

interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
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

/** Imperative handle so the work UI's action rail (outside this subtree) can launch a role action as a chat turn. */
export interface ChatHandle {
  launchAction: (action: RoleAction) => void
}

interface ChatProps {
  /** Absolute path to the active workspace — the agent session runs here. */
  workspace: string
  /** The current role's resolved actions — feeds the empty-state hero (RP-R4). */
  roleActions: RoleAction[]
  /** The selected agent id — restarts the session when it changes (AG-C4). */
  agent: string | null
}

const SLASH_LISTBOX_ID = 'wb-slash-listbox'

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

interface SlashKeyCtx {
  open: boolean
  count: number
  highlight: number
  setHighlight: (updater: (h: number) => number) => void
  dismiss: () => void
  select: (index: number) => void
}

/**
 * Capture-phase keyboard handling for the slash menu (extracted to module scope
 * so the `Chat` component itself stays under the complexity budget). Fires
 * before the textarea's own Enter-to-submit; a no-op unless the menu is open.
 */
function handleSlashKey(event: KeyboardEvent<HTMLDivElement>, ctx: SlashKeyCtx): void {
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

/**
 * Chat surface. A visual conversation (DS `MessageList`/`ChatMessage`/
 * `PromptInput`/`TypingIndicator`) with model/effort pickers driven by the
 * active adapter's capabilities.
 *
 * This feature set adds: a role-personalized empty-state hero (RP-R4, from
 * `roleActions`), a launch handle for the action rail (RP-R5), an interrupt
 * Stop control (chat-controls CC-R1), a `/` slash-command skills menu (CC-R2),
 * and an active-agent indicator + session re-bind on agent change (AG-R3.3).
 */
export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  { workspace, roleActions, agent },
  ref
) {
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageEntry[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [agentName, setAgentName] = useState<string | null>(null)
  const [skills, setSkills] = useState<SlashSkill[]>([])
  const [composerValue, setComposerValue] = useState('')
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [slashHighlight, setSlashHighlight] = useState(0)
  const streamingTextRef = useRef<string | null>(null)

  // Capabilities reflect the active adapter — reload when the agent changes
  // (AG-R1.3). Defaults are only set when unset, so a switch doesn't clobber a
  // model/effort the user already picked.
  useEffect(() => {
    let cancelled = false
    window.hive.agent.capabilities().then((caps) => {
      if (cancelled) return
      setCapabilities(caps)
      setModel((current) => current ?? caps.models[0]?.id ?? null)
      setEffort((current) => current ?? caps.efforts[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [agent])

  // Resolve the active agent's display name for the composer indicator (AG-R3.3).
  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (cancelled) return
      const active = list.find((entry) => entry.id === agent)
      setAgentName(active?.displayName ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [agent])

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

  // (Re)start the session whenever workspace/model/effort/agent settle or
  // change, and (re)subscribe to events. Adding `agent` to the deps means a
  // profile agent switch tears down + restarts the session against the newly
  // selected adapter (AG-C4).
  useEffect(() => {
    if (!model || !effort) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    window.hive.agent.start({ workspace, model, effort }).then(() => {
      if (cancelled) return
      unsubscribe = window.hive.agent.onEvent((event) => {
        switch (event.type) {
          case 'token':
            streamingTextRef.current = (streamingTextRef.current ?? '') + event.text
            setStreamingText(streamingTextRef.current)
            break
          case 'done': {
            const finalText = streamingTextRef.current
            streamingTextRef.current = null
            setStreamingText(null)
            if (finalText !== null) {
              setMessages((current) => [
                ...current,
                { id: nextMessageId(), role: 'assistant', text: finalText }
              ])
            }
            break
          }
          case 'interrupted': {
            // CC-R1.3: keep whatever already streamed as a finished message;
            // an interrupt with zero output leaves no empty bubble. No error
            // Alert — a user stop is a normal outcome (CC-R1.4/1.5).
            const partial = streamingTextRef.current
            streamingTextRef.current = null
            setStreamingText(null)
            if (partial) {
              setMessages((current) => [
                ...current,
                { id: nextMessageId(), role: 'assistant', text: partial }
              ])
            }
            break
          }
          case 'error':
            streamingTextRef.current = null
            setStreamingText(null)
            setErrorMessage(event.message)
            break
          case 'tool':
            break
        }
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
      void window.hive.agent.stop()
    }
  }, [workspace, model, effort, agent])

  // Shared turn kick-off for a text send, a role/rail action, and a slash pick.
  const startWorkflowTurn = useCallback((command: WorkflowCommand, label: string) => {
    setErrorMessage(null)
    setMessages((current) => [...current, { id: nextMessageId(), role: 'user', text: label }])
    streamingTextRef.current = ''
    setStreamingText('')
    window.hive.agent.runWorkflow(command)
  }, [])

  const launchAction = useCallback(
    (action: RoleAction) => {
      startWorkflowTurn(action.command, roleActionLabel(action.key))
    },
    [startWorkflowTurn]
  )

  useImperativeHandle(ref, () => ({ launchAction }), [launchAction])

  const handleSubmit = useCallback((value: string) => {
    setErrorMessage(null)
    setMessages((current) => [...current, { id: nextMessageId(), role: 'user', text: value }])
    setComposerValue('')
    streamingTextRef.current = ''
    setStreamingText('')
    window.hive.agent.send(value)
  }, [])

  const handleStop = useCallback(() => {
    void window.hive.agent.stop()
  }, [])

  // --- Slash menu -----------------------------------------------------------
  const slashQuery = slashQueryOf(composerValue)
  const filteredSkills = useMemo(() => {
    if (slashQuery === null) return []
    const needle = slashQuery.toLowerCase()
    if (needle.length === 0) return skills
    return skills.filter((skill) =>
      `${skill.label} ${skill.key} ${skill.description}`.toLowerCase().includes(needle)
    )
  }, [slashQuery, skills])
  const slashOpen = slashQuery !== null && !slashDismissed

  const handleComposerChange = useCallback((value: string) => {
    setComposerValue(value)
    // Any edit re-enables the menu and resets the highlight to the top.
    setSlashDismissed(false)
    setSlashHighlight(0)
  }, [])

  const selectSlashSkill = useCallback(
    (skill: SlashSkill) => {
      startWorkflowTurn({ key: skill.key, prompt: `Use the ${skill.key} skill.` }, skill.label)
      setComposerValue('')
      setSlashDismissed(true)
    },
    [startWorkflowTurn]
  )

  // Capture-phase so these fire before the textarea's own Enter-to-submit.
  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      handleSlashKey(event, {
        open: slashOpen,
        count: filteredSkills.length,
        highlight: slashHighlight,
        setHighlight: setSlashHighlight,
        dismiss: () => setSlashDismissed(true),
        select: (index) => selectSlashSkill(filteredSkills[index])
      })
    },
    [slashOpen, filteredSkills, slashHighlight, selectSlashSkill]
  )

  const isStreaming = streamingText !== null

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

  const isEmpty = messages.length === 0 && streamingText === null

  const activeSlashOption =
    slashOpen && filteredSkills.length > 0
      ? `${SLASH_LISTBOX_ID}-opt-${Math.min(slashHighlight, filteredSkills.length - 1)}`
      : undefined

  // Nested so its own conditionals (capabilities/streaming/agent) stay off the
  // Chat component's complexity budget.
  function renderToolbar(): React.JSX.Element {
    if (!capabilities) return <Spinner label={t('chat.loadingCapabilities')} />
    return (
      <>
        {isStreaming && (
          <button
            type="button"
            className="wb-stop-btn"
            aria-label={t('chat.stopAria')}
            onClick={handleStop}
          >
            <StopIcon size={13} />
            <span className="wb-stop-btn-label">{t('chat.stopLabel')}</span>
          </button>
        )}
        {agentName && (
          <span className="wb-agent-indicator" aria-label={t('chat.agentIndicatorAria', agentName)}>
            {agentName}
          </span>
        )}
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
      </>
    )
  }

  const composer = (
    <div className="wb-composer-wrap" onKeyDownCapture={handleComposerKeyDown}>
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
      <PromptInput
        value={composerValue}
        onChange={handleComposerChange}
        onSubmit={handleSubmit}
        streaming={isStreaming}
        placeholder={t('chat.promptPlaceholder')}
        sendLabel={t('chat.sendLabel')}
        aria-controls={slashOpen ? SLASH_LISTBOX_ID : undefined}
        aria-activedescendant={activeSlashOption}
        toolbar={renderToolbar()}
      />
    </div>
  )

  if (isEmpty) {
    return (
      <div className="wb-chat">
        <IntentGrid actions={roleActions} onLaunch={launchAction} composer={composer} />
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
                {message.role === 'assistant' ? assistantBody(message.text) : message.text}
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
        {composer}
        <p className="wb-composer-hint">{t('chat.composerHint')}</p>
      </div>
    </div>
  )
})
