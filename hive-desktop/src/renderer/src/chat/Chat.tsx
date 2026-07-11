import { useCallback, useEffect, useRef, useState } from 'react'
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
import { intentLabel, t } from '../i18n'
import { Markdown } from '../ui/markdown'
import { HiveCellIcon } from '../ui/icons'
import { IntentGrid } from './IntentGrid'

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

/** Structural mirror of `main/workflowCatalog.ts`'s `WorkflowEntry` — same self-contained convention `explorer/Explorer.tsx` uses for `FsTreeNode`. */
interface WorkflowEntry {
  key: string
  label: string
  command: { key: string; prompt?: string }
  status: 'wired' | 'planned'
}

interface ChatProps {
  /** Absolute path to the active workspace — the agent session runs here. */
  workspace: string
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${messageIdCounter}`
}

/**
 * Chat surface (task T15, design.md §4 "Chat" row, R6.1/R6.4). A visual
 * conversation — DS `MessageList`/`ChatMessage`/`PromptInput`/
 * `TypingIndicator` — never a raw terminal (R6.1). Model/effort `Select`
 * pickers are populated entirely from `window.hive.agent.capabilities()`,
 * never hardcoded (R6.4, C5).
 *
 * Deliberately **not** wired into `App.tsx` yet — a later integration task
 * (T19) composes this alongside the explorer (T12) into the 3-pane app
 * shell once the guided-intent flow (T17/T18) also exists.
 */
export function Chat({ workspace }: ChatProps): React.JSX.Element {
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageEntry[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workflowEntries, setWorkflowEntries] = useState<WorkflowEntry[]>([])
  const streamingTextRef = useRef<string | null>(null)

  // Load capabilities once and pick sensible defaults (first model/effort) —
  // never hardcoded, per R6.4/C5.
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
  }, [])

  // WorkflowCatalog (T17/T18) — feeds the new-session intent grid (R7.1).
  useEffect(() => {
    let cancelled = false
    window.hive.workflows.list(workspace).then((entries) => {
      if (!cancelled) setWorkflowEntries(entries)
    })
    return () => {
      cancelled = true
    }
  }, [workspace])

  // (Re)start the session whenever workspace/model/effort settle or change,
  // and (re)subscribe to events — AgentService.onEvent() is scoped to
  // whichever session was active *at subscribe time*; starting a new
  // session (e.g. the user switches model) requires re-subscribing, per its
  // own doc comment (agentService.ts).
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
    }
  }, [workspace, model, effort])

  const handleSubmit = useCallback((value: string) => {
    setErrorMessage(null)
    setMessages((current) => [...current, { id: nextMessageId(), role: 'user', text: value }])
    // Mark streaming immediately (empty buffer) rather than waiting for the
    // first token event, so the TypingIndicator appears right away instead
    // of leaving a gap between send and the agent's first output chunk.
    streamingTextRef.current = ''
    setStreamingText('')
    window.hive.agent.send(value)
  }, [])

  // Guided-intent entry point (T18/R7.2): clicking a wired intent (MVP:
  // "Create a PRD") is a turn like any other — the resulting artifact
  // becomes visible in the explorer via its own watcher (T11), not
  // something this component tracks directly.
  const handleSelectIntent = useCallback((entry: WorkflowEntry) => {
    setErrorMessage(null)
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), role: 'user', text: intentLabel(entry.key) }
    ])
    streamingTextRef.current = ''
    setStreamingText('')
    window.hive.agent.runWorkflow(entry.command)
  }, [])

  const isStreaming = streamingText !== null

  const assistantAvatar = (
    <span className="wb-avatar" aria-hidden="true">
      <HiveCellIcon />
    </span>
  )

  /** Assistant text is BMAD/agent output — markdown-heavy (headings, lists, tables, code) — so it renders through the same `react-markdown`+`remark-gfm` renderer the file viewer uses (T1) instead of collapsing into one unbroken paragraph. */
  function assistantBody(text: string): React.JSX.Element {
    return (
      <div className="wb-chat-md wb-md">
        <Markdown source={text} />
      </div>
    )
  }

  const isEmpty = messages.length === 0 && streamingText === null

  // One composer definition, two homes: center-stage inside the hero while
  // the conversation is empty (the prompt IS the empty state's main
  // affordance), docked at the bottom once messages exist.
  const composer = (
    <>
      {errorMessage && (
        <Alert variant="danger" role="alert" className="wb-composer-error">
          {t('chat.errorMessage', errorMessage)}
        </Alert>
      )}
      <PromptInput
        onSubmit={handleSubmit}
        streaming={isStreaming}
        placeholder={t('chat.promptPlaceholder')}
        sendLabel={t('chat.sendLabel')}
        toolbar={
          capabilities ? (
            <>
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
          ) : (
            <Spinner label={t('chat.loadingCapabilities')} />
          )
        }
      />
    </>
  )

  if (isEmpty) {
    return (
      <div className="wb-chat">
        <IntentGrid entries={workflowEntries} onSelect={handleSelectIntent} composer={composer} />
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
}
