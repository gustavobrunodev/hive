import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  ChatMessage,
  Empty,
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
import { t } from '../i18n'

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

  const isStreaming = streamingText !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {messages.length === 0 && streamingText === null ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Empty title={t('chat.emptyTitle')} description={t('chat.emptyDescription')} />
          </div>
        ) : (
          <MessageList jumpToLatestLabel={t('chat.jumpToLatestLabel')}>
            {messages.map((message) => (
              <ChatMessage key={message.id} role={message.role}>
                {message.text}
              </ChatMessage>
            ))}
            {streamingText !== null && (
              <ChatMessage role="assistant">
                {streamingText.length > 0 ? (
                  streamingText
                ) : (
                  <TypingIndicator label={t('chat.typingLabel')} />
                )}
              </ChatMessage>
            )}
          </MessageList>
        )}
      </div>

      {errorMessage && (
        <Alert variant="danger" role="alert">
          {t('chat.errorMessage', errorMessage)}
        </Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
        <PromptInput
          onSubmit={handleSubmit}
          streaming={isStreaming}
          placeholder={t('chat.promptPlaceholder')}
          sendLabel={t('chat.sendLabel')}
          toolbar={
            capabilities ? (
              <>
                <Select value={model ?? undefined} onValueChange={setModel}>
                  <SelectTrigger aria-label={t('chat.modelLabel')}>
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
                  <SelectTrigger aria-label={t('chat.effortLabel')}>
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
      </div>
    </div>
  )
}
