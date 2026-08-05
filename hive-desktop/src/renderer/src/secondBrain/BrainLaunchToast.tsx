import { Toast, ToastProvider, ToastViewport } from '@hive/design-system'
import { t } from '../i18n'
import { BrainIcon, CloseIcon } from '../ui/icons'

export interface BrainLaunch {
  /** The slash-command key that was launched (`second-brain`, `…-ingest`, …). */
  key: string
  /** The conversation moved to the background — the one the "voltar" action restores. */
  resumeId: string
}

interface BrainLaunchToastProps {
  launch: BrainLaunch | null
  onResume: (sessionId: string) => void
  onClose: () => void
}

/** Names the command in the user's words, so the toast reads as an outcome, not a log line. */
function launchLabel(key: string): string {
  switch (key) {
    case 'second-brain':
      return t('secondBrain.launchSetup')
    case 'second-brain-ingest':
      return t('secondBrain.launchIngest')
    case 'second-brain-lint':
      return t('secondBrain.launchLint')
    default:
      return t('secondBrain.launchQuery')
  }
}

/**
 * The hand-off after a Second Brain command takes over the chat pane: it opened
 * a conversation of its own, and the one that was on screen is still running
 * behind it. Both halves matter — the user asked for one thing and got a new
 * transcript, so the app says what it did and hands back the way home rather
 * than leaving them to find it in the history panel.
 *
 * Auto-dismisses: this is a notice, not a decision. Mounts its own
 * `ToastProvider` scope with a bottom-right viewport, mirroring `GitOpToast`.
 */
export function BrainLaunchToast({
  launch,
  onResume,
  onClose
}: BrainLaunchToastProps): React.JSX.Element {
  return (
    <ToastProvider duration={7000} swipeDirection="right" viewport={false}>
      <Toast
        open={launch !== null}
        onOpenChange={(open: boolean) => {
          if (!open) onClose()
        }}
        duration={7000}
        className="wb-brain-toast"
      >
        <span className="wb-brain-toast-glyph" aria-hidden="true">
          <BrainIcon size={15} />
        </span>
        <div className="wb-brain-toast-text">
          <p className="wb-brain-toast-title">
            {launch !== null ? t('secondBrain.launchToastTitle', launchLabel(launch.key)) : ''}
          </p>
          <p className="wb-brain-toast-desc">{t('secondBrain.launchToastDescription')}</p>
        </div>
        <button
          type="button"
          className="wb-brain-toast-action"
          onClick={() => {
            if (launch !== null) onResume(launch.resumeId)
            onClose()
          }}
        >
          {t('secondBrain.launchToastResume')}
        </button>
        <button
          type="button"
          className="wb-brain-toast-close"
          aria-label={t('secondBrain.launchToastClose')}
          onClick={onClose}
        >
          <CloseIcon size={12} />
        </button>
      </Toast>
      <ToastViewport
        className="wb-brain-toast-viewport"
        label={t('secondBrain.launchToastLabel')}
      />
    </ToastProvider>
  )
}
