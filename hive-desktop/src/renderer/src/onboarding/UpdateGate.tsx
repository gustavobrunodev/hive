import { useEffect, useState } from 'react'
import { Button } from '@hive/design-system'
import { provisionMessages, t } from '../i18n'
import { ProvisionScene } from './ProvisionScene'

interface UpdateGateProps {
  /** Workspace path to update BMAD in. */
  workspace: string
  /** Invoked once the update stream ends with a success (`done`) event, or the user chooses to continue anyway after an error. */
  onComplete: () => void
}

type Phase = { status: 'running' } | { status: 'error'; message: string }

/**
 * Auto-update gate shown on every launch after first-run provisioning
 * (task T10, design.md §5.2, R4.1–R4.3). Renders
 * `window.hive.updateBmad()`'s BmadEvent stream: `progress` drives the
 * caption under a single indeterminate Progress bar, `done` calls
 * `onComplete()` straight away (so an already-up-to-date workspace
 * resolves fast without extra noise, R4.3), `error` shows an Alert with
 * both a retry button and a "continue anyway" button (R4.2 — the work UI
 * must not be permanently blocked by a failed update). Unlike
 * `GuidedInstall` (T9), this never renders a step list: an update is a
 * background-ish gate, not a first-run ceremony.
 */
export function UpdateGate({ workspace, onComplete }: UpdateGateProps): React.JSX.Element {
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ status: 'running' })
  const [runToken, setRunToken] = useState(0)

  useEffect(() => {
    let active = true

    // Reset lives inside a locally-defined function invoked immediately
    // below, not as a direct statement in the effect body — same
    // react-hooks/set-state-in-effect pattern as GuidedInstall/Explorer.
    function resetForNewRun(): void {
      setProgressMessage(null)
      setPhase({ status: 'running' })
    }
    resetForNewRun()

    const unsubscribe = window.hive.updateBmad(workspace, (event) => {
      if (!active) return
      switch (event.type) {
        case 'progress':
          setProgressMessage(event.message)
          break
        case 'done':
          onComplete()
          break
        case 'error':
          setPhase({ status: 'error', message: event.message })
          break
        case 'step':
        case 'prompt':
          break
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [workspace, runToken, onComplete])

  return (
    <ProvisionScene
      title={t('updateGate.title')}
      messages={provisionMessages.update}
      caption={progressMessage}
      captionFallback={t('updateGate.progressLabel')}
      stage={[1, 2]}
      error={
        phase.status === 'error'
          ? {
              title: t('updateGate.errorTitle'),
              message: phase.message || t('updateGate.errorDescriptionFallback')
            }
          : null
      }
      actions={
        phase.status === 'error' ? (
          <>
            <Button
              cut={false}
              className="wb-btn"
              onClick={() => setRunToken((current) => current + 1)}
            >
              {t('updateGate.retryCta')}
            </Button>
            <Button cut={false} variant="ghost" className="wb-btn" onClick={onComplete}>
              {t('updateGate.continueAnywayCta')}
            </Button>
          </>
        ) : null
      }
    />
  )
}
