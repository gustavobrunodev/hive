import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { useTicker } from '../chat/useTicker'
import { AwsLoginFlow, type AwsLoginView } from './AwsLoginFlow'
import { isLoginLive, isLoginVisible } from './awsSession'

export interface AwsLoginBeaconProps {
  state: AwsLoginView
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  onCancel: () => void
  onRetry: () => void
  /** Suppresses the beacon while another surface is already drawing this login. */
  suppressed?: boolean
}

/** How long a landed login stays on screen before it lets go. */
const SUCCESS_LINGER_MS = 3200

/**
 * The live sign-in, findable from anywhere in the app.
 *
 * ## Why this is not a modal
 *
 * A modal would be the reflex, and it would be wrong twice over. The login is
 * triggered by *sending a message* — the user has already told the app what
 * they want, and a dialog that seizes the window to say "hold on" takes away
 * the one thing they can still usefully do, which is keep working while the
 * browser does its part. And the second trigger is a background turn, which can
 * fire while the user is reading a file three panels away: a modal there is an
 * interruption with no relationship to what they are doing.
 *
 * So it is a **beacon**: anchored top-centre, above the work but not blocking
 * it, dismissible by finishing the thing it is about. It is the shape a call
 * in progress takes in every OS that has one, for the same reason — the task
 * is elsewhere, and this is the way back to it.
 *
 * ## Why it lingers after success
 *
 * Three seconds. The user is coming back from another window; a card that
 * disappeared the instant the CLI exited would leave them with no evidence the
 * trip worked, staring at the app trying to remember whether they had finished.
 * The linger is the receipt.
 */
export function AwsLoginBeacon({
  state,
  onOpenUrl,
  onCopyUrl,
  onCancel,
  onRetry,
  suppressed = false
}: AwsLoginBeaconProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)
  const live = isLoginLive(state.phase)
  const now = useTicker(live)

  // A new attempt un-dismisses: the beacon is per-login, not per-session.
  // Locally-defined function invoked immediately (the repo's `resetScope`
  // pattern) — react-hooks/set-state-in-effect.
  useEffect(() => {
    function revive(): void {
      setDismissed(false)
    }
    if (live) revive()
  }, [live])

  useEffect(() => {
    if (state.phase !== 'success') return undefined
    const timer = setTimeout(() => setDismissed(true), SUCCESS_LINGER_MS)
    return () => clearTimeout(timer)
  }, [state.phase])

  if (suppressed || dismissed || !isLoginVisible(state.phase)) return null

  return (
    <div className="wb-aws-beacon" role="status" aria-label={t('aws.beaconAria')}>
      <AwsLoginFlow
        state={state}
        now={now}
        onOpenUrl={onOpenUrl}
        onCopyUrl={onCopyUrl}
        onCancel={() => {
          setDismissed(true)
          onCancel()
        }}
        onRetry={onRetry}
      />
    </div>
  )
}
