import { t } from '../i18n'
import { CloseIcon, PlayIcon, QueueIcon, SlashIcon } from '../ui/icons'
import type { MessageQueue, QueuedMessage } from './messageQueue'

interface QueuedMessagesProps {
  queue: MessageQueue
  onRemove: (id: string) => void
  onClear: () => void
  /** Lifts a hold left by a stopped or failed turn, so the queue drains again. */
  onResume: () => void
}

/**
 * The messages waiting to be sent, docked to the top of the composer.
 *
 * ## Why here and why like this
 *
 * A queued message is neither in the composer nor in the transcript, and the
 * strip sits exactly there — between them, at the composer's own width, with a
 * hairline joining it to the box the messages came out of. That adjacency is
 * the whole affordance: the pile you can see is the pile that will be sent,
 * top first, and each row keeps a control to take it back out.
 *
 * It is a list, not cards. These are one line of the user's own text each; a
 * bordered box per message would give a sentence the visual weight of a
 * document and turn three queued follow-ups into a wall.
 *
 * ## Held
 *
 * A queue whose turn was stopped or failed does **not** keep firing. It says
 * so, and offers the one control that resolves it. Auto-sending three more
 * messages into a session the user just interrupted is the exact opposite of
 * what pressing Stop meant.
 */
export function QueuedMessages({
  queue,
  onRemove,
  onClear,
  onResume
}: QueuedMessagesProps): React.JSX.Element | null {
  if (queue.items.length === 0) return null

  return (
    <section
      className="wb-queue"
      data-held={queue.held || undefined}
      aria-label={t('queue.regionLabel')}
    >
      <header className="wb-queue-head">
        <QueueIcon size={12} aria-hidden="true" />
        <span className="wb-queue-title">
          {queue.held ? t('queue.heldTitle') : t('queue.title', queue.items.length)}
        </span>
        {queue.held ? (
          <button type="button" className="wb-queue-action" onClick={onResume}>
            <PlayIcon size={11} aria-hidden="true" />
            {t('queue.resumeCta')}
          </button>
        ) : (
          <button type="button" className="wb-queue-action" onClick={onClear}>
            {t('queue.clearCta')}
          </button>
        )}
      </header>
      <ol className="wb-queue-list">
        {queue.items.map((item, index) => (
          <li key={item.id} className="wb-queue-row">
            {/* Position, not decoration: the queue's whole promise is "in this
                order", and a bare list of sentences doesn't state one. */}
            <span className="wb-queue-index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="wb-queue-text" title={item.text}>
              {item.workflow ? (
                <span className="wb-queue-command">
                  <SlashIcon size={11} aria-hidden="true" />
                  {item.workflow.key}
                </span>
              ) : (
                item.text
              )}
              {attachmentNote(item)}
            </span>
            <button
              type="button"
              className="wb-queue-remove"
              aria-label={t('queue.removeAria', queueLabel(item))}
              title={t('queue.removeTitle')}
              onClick={() => onRemove(item.id)}
            >
              <CloseIcon size={12} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The files riding along with a queued send, so removing the right one is possible without sending it. */
function attachmentNote(item: QueuedMessage): React.ReactNode {
  const count = item.attachmentNames?.length ?? 0
  if (count === 0) return null
  return <span className="wb-queue-attachments">{t('queue.attachmentCount', count)}</span>
}

/** What the remove button names in its accessible label. */
function queueLabel(item: QueuedMessage): string {
  return item.workflow ? `/${item.workflow.key}` : item.text
}
