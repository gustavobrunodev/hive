import { t } from '../i18n'
import { CheckCircleIcon, CloudKeyIcon } from '../ui/icons'

export interface AwsTurnNoticeProps {
  /** `waiting` while the browser has the user; `cleared` once the session is good. */
  phase: 'waiting' | 'cleared'
  /** Opens the AWS panel — the row is a way in, not a dead end. */
  onOpenPanel?: () => void
}

/**
 * The line in the transcript that explains a pause.
 *
 * A turn that stops to renew an AWS session is the one case where the app,
 * not the agent, is the reason nothing is happening. Without this row the
 * conversation shows a message that was sent and an answer that never starts —
 * and the beacon explaining why is a separate surface the user may have
 * dismissed or never looked at.
 *
 * So it is one line, in the turn, at the moment it happened: *this is why your
 * answer is waiting*. It deliberately carries **no controls** — the browser,
 * the URL and the cancel all live in the beacon, and a second set of buttons
 * saying the same thing two panels apart is exactly the duplication that makes
 * a user wonder which one is real.
 *
 * When the session clears, the same block flips to a settled line rather than
 * disappearing: a transcript that silently erases the reason for a
 * forty-second gap is a transcript that cannot be read back later.
 */
export function AwsTurnNotice({ phase, onOpenPanel }: AwsTurnNoticeProps): React.JSX.Element {
  const waiting = phase === 'waiting'
  const body = (
    <>
      <span className="wb-awsturn-mark" aria-hidden="true">
        {waiting ? <CloudKeyIcon size={12} /> : <CheckCircleIcon size={12} />}
      </span>
      <span className="wb-awsturn-head">
        {waiting ? t('aws.turnWaiting') : t('aws.turnCleared')}
      </span>
      {waiting && <span className="wb-awsturn-hint">{t('aws.turnWaitingHint')}</span>}
    </>
  )

  if (!onOpenPanel) {
    return (
      <div className="wb-awsturn" data-phase={phase} role="note">
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="wb-awsturn wb-awsturn-button"
      data-phase={phase}
      onClick={onOpenPanel}
    >
      {body}
    </button>
  )
}
