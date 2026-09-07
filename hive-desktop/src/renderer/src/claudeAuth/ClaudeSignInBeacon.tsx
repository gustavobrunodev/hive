import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { useTicker } from '../chat/useTicker'
import { ClaudeSignInFlow, type ClaudeLoginView } from './ClaudeSignInFlow'
import { isLoginLive, isLoginVisible } from './claudeSession'

export interface ClaudeSignInBeaconProps {
  state: ClaudeLoginView
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  onSubmitCode: (code: string) => void
  onReadClipboard: () => Promise<string>
  onCancel: () => void
  onRetry: () => void
  /** Suppresses the beacon while another surface is already drawing this sign-in. */
  suppressed?: boolean
}

/** How long a landed sign-in stays on screen before it lets go. */
const SUCCESS_LINGER_MS = 3600

/**
 * The live sign-in to a Claude account, findable from anywhere in the app.
 *
 * Not a modal, for the same two reasons the AWS beacon isn't: the sign-in is
 * triggered by *trying to work* — the user already said what they wanted — and
 * a dialog that seizes the window takes away the one thing still worth doing
 * while a browser tab has their attention. And it can start from a background
 * turn, three panels away from whatever they are reading.
 *
 * So it is a beacon: anchored above the work, dismissible by finishing the
 * thing it is about, and lingering for a beat after success — the user is
 * coming back from another window, and the receipt is the only proof the trip
 * worked.
 */
export function ClaudeSignInBeacon({
  state,
  onOpenUrl,
  onCopyUrl,
  onSubmitCode,
  onReadClipboard,
  onCancel,
  onRetry,
  suppressed = false
}: ClaudeSignInBeaconProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)
  const live = isLoginLive(state.phase)
  const now = useTicker(live)

  // A new attempt un-dismisses: the beacon is per sign-in, not per session.
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
    <div className="wb-claude-beacon" role="status" aria-label={t('claude.beaconAria')}>
      <ClaudeSignInFlow
        state={state}
        now={now}
        onOpenUrl={onOpenUrl}
        onCopyUrl={onCopyUrl}
        onSubmitCode={onSubmitCode}
        onReadClipboard={onReadClipboard}
        onCancel={() => {
          setDismissed(true)
          onCancel()
        }}
        onRetry={onRetry}
      />
    </div>
  )
}
