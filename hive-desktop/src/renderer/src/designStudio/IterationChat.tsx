import {
  Button,
  ChatMessage,
  Chip,
  MessageList,
  PromptInput,
  TypingIndicator
} from '@hive/design-system'
import { t } from '../i18n'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, HistoryIcon } from '../ui/icons'
import type { StudioChatMessage } from './screenSessions'
import type { SkillPhase } from './skillRun'

/**
 * Design Studio (M18) — T6.5. The Chat as a **strip**, not a column
 * (design.md §3.7).
 *
 * The Bancada already spends its width on three surfaces; a fourth column would
 * come out of the stage, which is the one thing the layout exists to protect.
 * So the chat is 56px of composer at the bottom, and it grows to about 40% only
 * while the user is reading the conversation.
 *
 * The context `Chip` is the part that carries a requirement rather than a
 * preference. DS-R10 says a request sent with a Component selected is
 * interpreted **in that context by default** — and a default the user cannot
 * see is indistinguishable from magic. The chip makes it a fact on screen, and
 * its `✕` makes it a default rather than a rule.
 */

const PHASE_LABEL: Record<SkillPhase, () => string> = {
  reading: () => t('designStudio.skillPhaseReading'),
  choosing: () => t('designStudio.skillPhaseChoosing'),
  composing: () => t('designStudio.skillPhaseComposing')
}

export interface IterationChatProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  transcript: StudioChatMessage[]
  /** The selected Component's tag, or `null` when the turn is about the Tela. */
  contextTag: string | null
  /** Drops the context for the next turns without dropping the selection itself. */
  onReleaseContext: () => void
  /** Non-null exactly while a turn is in flight — the composer's "working" state. */
  phase: SkillPhase | null
  onSend: (message: string) => void
  /**
   * T6.6: the one turn a single undo would revert. The log is linear, so
   * exactly one turn can offer "desfazer este turno" — offering it on an older
   * one would either lie or quietly take the newer edits with it.
   */
  undoableGroupId?: string | null
  onUndoTurn?: () => void
}

export function IterationChat({
  expanded,
  onExpandedChange,
  transcript,
  contextTag,
  onReleaseContext,
  phase,
  onSend,
  undoableGroupId = null,
  onUndoTurn
}: IterationChatProps): React.JSX.Element {
  return (
    <section
      className="wb-dstudio-chat"
      data-expanded={expanded || undefined}
      aria-label={t('designStudio.chatAria')}
    >
      <header className="wb-dstudio-chat-bar">
        <span className="wb-dstudio-chat-title">{t('designStudio.chatTitle')}</span>
        {contextTag !== null && (
          <span className="wb-dstudio-chat-context">
            <Chip variant="agent">{t('designStudio.chatContext', contextTag)}</Chip>
            <Button
              variant="ghost"
              className="wb-dstudio-chat-icon-button"
              aria-label={t('designStudio.chatReleaseContext')}
              onClick={onReleaseContext}
            >
              <CloseIcon size={14} />
            </Button>
          </span>
        )}
        {phase !== null && (
          <span className="wb-dstudio-chat-working">
            <TypingIndicator label={t('designStudio.skillRunning')} />
            <span className="wb-dstudio-chat-phase" aria-live="polite">
              {PHASE_LABEL[phase]()}
            </span>
          </span>
        )}
        <Button
          variant="ghost"
          className="wb-dstudio-chat-icon-button"
          aria-label={expanded ? t('designStudio.chatCollapse') : t('designStudio.chatExpand')}
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
        </Button>
      </header>

      {expanded && (
        <div className="wb-dstudio-chat-transcript">
          <MessageList jumpToLatestLabel={t('designStudio.chatJumpToLatest')}>
            {transcript.map((message) => (
              <ChatMessage key={message.id} role={message.role === 'user' ? 'user' : 'assistant'}>
                {message.text}
                {message.changes !== undefined && message.changes > 0 && (
                  <span className="wb-dstudio-chat-turn">
                    <span className="wb-dstudio-chat-turn-meta">
                      {t('designStudio.chatTurnChanges', message.changes)}
                    </span>
                    {message.groupId !== undefined && message.groupId === undoableGroupId && (
                      <Button variant="ghost" onClick={onUndoTurn}>
                        <HistoryIcon size={14} />
                        {t('designStudio.chatUndoTurn')}
                      </Button>
                    )}
                  </span>
                )}
              </ChatMessage>
            ))}
          </MessageList>
        </div>
      )}

      <PromptInput
        className="wb-dstudio-chat-input"
        placeholder={t('designStudio.chatPlaceholder')}
        sendLabel={t('designStudio.chatSend')}
        minRows={1}
        maxRows={4}
        streaming={phase !== null}
        onSubmit={onSend}
      />
    </section>
  )
}
