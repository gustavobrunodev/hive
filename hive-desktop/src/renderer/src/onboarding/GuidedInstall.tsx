import { useEffect, useState } from 'react'
import { Button } from '@hive/design-system'
import { installStepLabel, provisionMessages, t } from '../i18n'
import { InstallConfigForm, type BmadInstallConfig } from './InstallConfigForm'
import { ProvisionScene, type ProvisionStep } from './ProvisionScene'

interface GuidedInstallProps {
  /** Workspace path to prepare. */
  workspace: string
  /** Invoked once the install stream ends with a success (`done`) event. */
  onComplete: () => void
}

type Phase = { status: 'running' } | { status: 'error'; message: string; detail?: string }

/**
 * Guided workspace-preparation screen (task T9, design.md §5.1, R3.2–R3.4).
 * Runs in two acts:
 *
 *  1. **Configure** (BUG 1): the CLI's interactive questions abstracted into
 *     the app's own visual form (`InstallConfigForm`). Nothing is installed
 *     until the user submits it — fixing the previous behaviour where the base
 *     package was installed silently with no input requested.
 *  2. **Run**: once submitted, `window.hive.installBmad()`'s BmadEvent stream
 *     drives the shared `ProvisionScene` — one row per `step` event (earlier
 *     ones marked done, the latest active), the caption tracking `progress`
 *     events, and an Alert + retry on `error`. `prompt` events stay unhandled
 *     — the run itself is non-interactive (all answers passed as flags up
 *     front, see bmadService.ts), so BMAD emits none.
 *
 * This is stage 1 of 2: the Second Brain gate runs straight after it, in the
 * same surface, so the two read as one preparation rather than two waits.
 */
export function GuidedInstall({ workspace, onComplete }: GuidedInstallProps): React.JSX.Element {
  const [config, setConfig] = useState<BmadInstallConfig | null>(null)
  const [steps, setSteps] = useState<ProvisionStep[]>([])
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ status: 'running' })
  const [runToken, setRunToken] = useState(0)

  useEffect(() => {
    // The install only runs once the user has submitted the configuration
    // form — until then this screen is the form itself (rendered below).
    if (!config) return
    let active = true
    const collectedSteps: ProvisionStep[] = []

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
          // The id stays the CLI's (it is the checklist's React key and has to
          // stay stable); only the label is re-said in the product's words.
          collectedSteps.push({ id: event.id, label: installStepLabel(event.label) })
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
    <ProvisionScene
      title={t('guidedInstall.title')}
      messages={provisionMessages.install}
      caption={progressMessage}
      captionFallback={t('guidedInstall.progressLabel')}
      steps={steps}
      stage={[1, 2]}
      error={
        phase.status === 'error'
          ? {
              title: t('guidedInstall.errorTitle'),
              message: phase.message || t('guidedInstall.errorDescriptionFallback')
            }
          : null
      }
      actions={
        phase.status === 'error' ? (
          <Button
            cut={false}
            className="wb-btn"
            onClick={() => setRunToken((current) => current + 1)}
          >
            {t('guidedInstall.retryCta')}
          </Button>
        ) : null
      }
    />
  )
}
