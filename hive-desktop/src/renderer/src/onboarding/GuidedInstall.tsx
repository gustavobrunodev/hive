import { useEffect, useState } from 'react'
import { Alert, Button, Progress, Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { CheckIcon } from '../ui/icons'
import { InstallConfigForm, type BmadInstallConfig } from './InstallConfigForm'

interface GuidedInstallProps {
  /** Workspace path to install BMAD into. */
  workspace: string
  /** Invoked once the install stream ends with a success (`done`) event. */
  onComplete: () => void
}

interface StepEntry {
  id: string
  label: string
}

type Phase = { status: 'running' } | { status: 'error'; message: string; detail?: string }

/**
 * Guided BMAD install screen (task T9, design.md §5.1, R3.2–R3.4). Runs in
 * two acts:
 *
 *  1. **Configure** (BUG 1): the CLI's interactive questions abstracted into
 *     the app's own visual form (`InstallConfigForm`). Nothing is installed
 *     until the user submits it — fixing the previous behaviour where the base
 *     package was installed silently with no input requested.
 *  2. **Run**: once submitted, `window.hive.installBmad()`'s BmadEvent stream
 *     renders as a step checklist (one row per `step` event — earlier steps
 *     marked done, the latest one active with an inline spinner) over a single
 *     indeterminate Progress bar whose caption tracks `progress` events, with
 *     an Alert + retry on `error`. `prompt` events stay unhandled — the run
 *     itself is non-interactive (all answers passed as flags up front, see
 *     bmadService.ts), so BMAD emits none.
 */
export function GuidedInstall({ workspace, onComplete }: GuidedInstallProps): React.JSX.Element {
  const [config, setConfig] = useState<BmadInstallConfig | null>(null)
  const [steps, setSteps] = useState<StepEntry[]>([])
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ status: 'running' })
  const [runToken, setRunToken] = useState(0)

  useEffect(() => {
    // The install only runs once the user has submitted the configuration
    // form — until then this screen is the form itself (rendered below).
    if (!config) return
    let active = true
    const collectedSteps: StepEntry[] = []

    // Reset lives inside a locally-defined function invoked immediately
    // below (mirrors explorer/Explorer.tsx's `load()` pattern), not as a
    // direct statement in the effect body — react-hooks/set-state-in-effect.
    function resetForNewRun(): void {
      setSteps([])
      setProgressMessage(null)
      setPhase({ status: 'running' })
    }
    resetForNewRun()

    const unsubscribe = window.hive.installBmad(workspace, config, (event) => {
      if (!active) return
      switch (event.type) {
        case 'step':
          collectedSteps.push({ id: event.id, label: event.label })
          setSteps([...collectedSteps])
          break
        case 'progress':
          setProgressMessage(event.message)
          break
        case 'done':
          onComplete()
          break
        case 'error':
          setPhase({ status: 'error', message: event.message, detail: event.detail })
          break
        case 'prompt':
          break
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [workspace, config, runToken, onComplete])

  // Act 1: configuration form — nothing installs until it's submitted.
  if (!config) {
    return <InstallConfigForm onSubmit={setConfig} />
  }

  // Act 2: the install is running (or errored).
  return (
    <main className="wb-gate">
      <div className="wb-gate-card">
        <h1 className="wb-gate-title">{t('guidedInstall.title')}</h1>
        <p className="wb-gate-desc">{t('guidedInstall.description')}</p>

        {phase.status === 'error' ? (
          <>
            <Alert variant="danger" title={t('guidedInstall.errorTitle')} role="alert">
              {phase.message || t('guidedInstall.errorDescriptionFallback')}
            </Alert>
            <div className="wb-gate-error-actions">
              <Button
                cut={false}
                className="wb-btn"
                onClick={() => setRunToken((current) => current + 1)}
              >
                {t('guidedInstall.retryCta')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {steps.length > 0 && (
              <ol className="wb-steps">
                {steps.map((step, index) => {
                  const isActive = index === steps.length - 1
                  return (
                    <li key={step.id} className="wb-step" data-state={isActive ? 'active' : 'done'}>
                      <span className="wb-step-marker" aria-hidden="true">
                        {isActive ? (
                          <Spinner size="sm" label={t('guidedInstall.progressLabel')} />
                        ) : (
                          <CheckIcon size={12} />
                        )}
                      </span>
                      {step.label}
                    </li>
                  )
                })}
              </ol>
            )}
            <Progress value={null} />
            <p className="wb-gate-progress-caption" role="status">
              {progressMessage ?? t('guidedInstall.progressLabel')}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
