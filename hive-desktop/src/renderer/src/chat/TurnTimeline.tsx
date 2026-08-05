import { TypingIndicator } from '@hive/design-system'
import { t } from '../i18n'
import { ApprovalCard } from './ApprovalCard'
import { ToolActivityFeed } from './ToolActivityFeed'
import { hasPendingApproval, type TurnBlock } from './turnTimeline'

interface TurnTimelineProps {
  blocks: TurnBlock[]
  /** `true` while this turn is still running — drives the live row's motion and the typing indicator. */
  live: boolean
  /**
   * The smoothed reveal of the trailing text block (agent-activity AA-R4).
   * Only the tail is paced; every earlier text block is settled prose and
   * renders whole. Ignored when the turn is finished.
   */
  revealedText?: string | null
  /** Renders one text block (the app owns markdown rendering). */
  renderText: (text: string) => React.ReactNode
  onApprovalDecide: (requestId: string, decision: 'allow' | 'allow-always' | 'deny') => void
}

/**
 * Whether the bouncing dots are the *only* honest signal left.
 *
 * They are not shown while a tool row is spinning (the feed already says what
 * is happening) nor while a permission is open — a turn parked on the user is
 * not "typing", and saying so is the kind of small lie that makes an interface
 * untrustworthy. What's left is the real gap: a step finished, nothing is
 * running, and no prose has started yet.
 */
function waitingWithoutSignal(blocks: TurnBlock[]): boolean {
  if (blocks.length === 0) return true
  if (hasPendingApproval(blocks)) return false
  const last = blocks[blocks.length - 1]
  if (last.kind === 'text') return false
  if (last.kind === 'tools') return !last.activities.some((a) => a.state === 'running')
  return true
}

/**
 * One assistant turn, rendered in the order it happened.
 *
 * The old layout split a turn into three fixed zones — tools on top, prose in
 * the middle, permission cards pinned below the entire conversation — so the
 * transcript never matched the story: the command ran above the sentence
 * explaining it, and the permission that gated it sat at the bottom of the
 * screen, next to the composer, long after the fact.
 *
 * This is a log, the way every coding agent renders one. Blocks come out of
 * `turnTimeline.ts` in arrival order and are drawn in that order, so a turn
 * reads top to bottom as: *what I'm about to do* → *may I?* → *doing it* →
 * *what came of it*.
 */
export function TurnTimeline({
  blocks,
  live,
  revealedText,
  renderText,
  onApprovalDecide
}: TurnTimelineProps): React.JSX.Element {
  const lastIndex = blocks.length - 1

  return (
    <div className="wb-turn">
      {blocks.map((block, index) => {
        if (block.kind === 'tools') {
          return (
            <ToolActivityFeed
              key={block.id}
              activities={block.activities}
              live={live && index === lastIndex}
            />
          )
        }
        if (block.kind === 'approval') {
          return <ApprovalCard key={block.id} request={block.request} onDecide={onApprovalDecide} />
        }
        // Trailing block of a live turn: the paced reveal. Everything above it
        // is done arriving and must not re-animate.
        const text = live && index === lastIndex && revealedText != null ? revealedText : block.text
        if (text === '') return null
        return <div key={block.id}>{renderText(text)}</div>
      })}
      {live && waitingWithoutSignal(blocks) && <TypingIndicator label={t('chat.typingLabel')} />}
    </div>
  )
}
