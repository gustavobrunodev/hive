import { useEffect, useState } from 'react'
import { Button } from '@hive/design-system'
import { provisionMessages, t } from '../i18n'
import { ProvisionScene } from './ProvisionScene'

interface SecondBrainGateProps {
  /** Workspace path to provision the second-brain skills in. */
  workspace: string
  /** Invoked once provisioning ends with `done`, or the user chooses to continue anyway after an error. */
  onComplete: () => void
}

type Phase = { status: 'deciding' } | { status: 'running' } | { status: 'error'; message: string }

/**
 * Second step of the "Preparando o workspace" gate (SB-R1.4, D-SB-7). Runs
 * immediately after the BMAD install/update gate, in the same surface, so the
 * two read as one continuous preparation. It disk-checks
 * `secondBrain.isProvisioned()` to pick install (skill absent, SB-R1.1) vs
 * update (present, SB-R1.2), then renders the streamed `SkillEvent`s exactly
 * like `UpdateGate`: `step`/`progress` drive the caption under an indeterminate
 * `Progress`, `done` calls `onComplete()`, and `error` shows an Alert with
 * retry + **continue anyway** — the work UI is never permanently blocked by a
 * failed skill provision (SB-R1.3, mirroring the BMAD gate).
 */
export function SecondBrainGate({
  workspace,
  onComplete
}: SecondBrainGateProps): React.JSX.Element {
  const [caption, setCaption] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ status: 'deciding' })
  const [runToken, setRunToken] = useState(0)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    function resetForNewRun(): void {
      setCaption(null)
      setPhase({ status: 'deciding' })
    }
    resetForNewRun()

    const handleEvent = (event: { type: string; label?: string; message?: string }): void => {
      if (!active) return
      switch (event.type) {
        case 'step':
          setCaption(event.label ?? null)
          break
        case 'progress':
          setCaption(event.message ?? null)
          break
        case 'done':
          onComplete()
          break
        case 'error':
          setPhase({ status: 'error', message: event.message ?? '' })
          break
      }
    }

    void window.hive.secondBrain.isProvisioned(workspace).then((provisioned) => {
      if (!active) return
      setPhase({ status: 'running' })
      unsubscribe = provisioned
        ? window.hive.secondBrain.update(workspace, handleEvent)
        : window.hive.secondBrain.install(workspace, handleEvent)
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [workspace, runToken, onComplete])

  return (
    <ProvisionScene
      title={t('secondBrainGate.title')}
      messages={provisionMessages.secondBrain}
      caption={caption}
      captionFallback={t('secondBrainGate.progressLabel')}
      stage={[2, 2]}
      error={
        phase.status === 'error'
          ? {
              title: t('secondBrainGate.errorTitle'),
              message: phase.message || t('secondBrainGate.errorDescriptionFallback')
            }
          : null
      }
      actions={
        <>
          {phase.status === 'error' && (
            <Button
              cut={false}
              className="wb-btn"
              onClick={() => setRunToken((current) => current + 1)}
            >
              {t('secondBrainGate.retryCta')}
            </Button>
          )}
          {/*
            SB-R1.3, in full: "never permanently blocked" has to hold while
            provisioning is RUNNING, not only after it errors. This step shells
            out to a network-backed CLI, and it also re-runs on every workspace
            switch — without an escape here, a slow or stalled network traps
            the user on a spinner with no way into the work UI. Second-brain is
            an enhancement, so waiting for it is always optional; the quiet
            ghost button keeps it from competing with the (usually brief) happy
            path.
          */}
          <Button cut={false} variant="ghost" className="wb-btn" onClick={onComplete}>
            {t('secondBrainGate.continueAnywayCta')}
          </Button>
        </>
      }
    />
  )
}
