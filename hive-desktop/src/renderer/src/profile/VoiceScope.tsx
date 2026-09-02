import { useCallback, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { CheckIcon, TrashIcon } from '../ui/icons'
import { ModelPanel } from '../voice/ModelPanel'
import { useAsrDownloadEndings, useAsrDownloads } from '../voice/useAsrDownloads'
import { useLegacyModels } from '../voice/useLegacyModels'
import { formatBytes } from '../voice/downloadCopy'
import type { AsrReadinessState } from '../voice/useAsrReadiness'

interface VoiceScopeProps {
  readiness: AsrReadinessState
}

/**
 * What the probe measured, as three figures.
 *
 * This exists so the screen makes a **statement rather than a shrug**: a user
 * who wonders whether the app actually looked at their machine has a way to
 * tell. The figures used to justify which of ten models was picked; they now
 * justify how hard the engine drives the CPU, and they are still the honest
 * answer to "what did you measure".
 */
function MachineFacts({
  facts,
  threads
}: {
  facts: { gpu: boolean; ramGB: number; cores: number }
  threads: number
}): React.JSX.Element {
  const { ramGB, cores } = facts
  const unknown = ramGB <= 0
  return (
    <section className="wb-machine" aria-label={t('voice.machineTitle')}>
      <h4 className="wb-machine-title">{t('voice.machineTitle')}</h4>
      <dl className="wb-machine-facts">
        <div className="wb-machine-fact">
          <dt>{t('voice.machineRam')}</dt>
          <dd>{unknown ? t('voice.machineUnknown') : t('voice.machineRamValue', ramGB)}</dd>
        </div>
        <div className="wb-machine-fact">
          <dt>{t('voice.machineCores')}</dt>
          <dd>{cores > 0 ? t('voice.machineCoresValue', cores) : t('voice.machineUnknown')}</dd>
        </div>
        {/* Replaces the GPU row. A missing GPU used to decide which model could
            run at all — inference was WebGPU-or-one-WASM-thread. It costs
            nothing now, so reporting it would be reporting a fact with no
            consequence; the thread count is the reading that has one. */}
        <div className="wb-machine-fact">
          <dt>{t('voice.machineThreads')}</dt>
          <dd data-strong>{t('voice.machineThreadsValue', threads)}</dd>
        </div>
      </dl>
    </section>
  )
}

/** The one destructive action on this screen, asked out loud before it runs. */
function DeleteConfirm({
  sizeMB,
  onCancel,
  onConfirm
}: {
  sizeMB: number
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('voice.deleteConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('voice.deleteConfirmText', formatBytes(sizeMB * 1024 * 1024))}
        </DialogDescription>
        {/* `variant="ghost"` is not decoration: the DS Button defaults to
            primary, so two plain <Button>s render as two identical accent
            fills and the safe answer and the destructive one become
            indistinguishable — measured in all three themes. */}
        <div className="wb-dialog-actions">
          <Button className="wb-btn" variant="ghost" onClick={onCancel}>
            {t('voice.deleteConfirmKeepCta')}
          </Button>
          <Button className="wb-btn" onClick={onConfirm}>
            {t('voice.deleteConfirmCta')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Voice & transcription — the one place the model is acquired and removed.
 *
 * The screen keeps losing controls as the product answers questions instead of
 * asking them. M26 removed the shipped weights and turned a folded-away catalog
 * into the main event; M29 removes the catalog itself. What is left is a state,
 * a size, one action, and the readings that explain how the engine will run.
 */
export function VoiceScope({ readiness }: VoiceScopeProps): React.JSX.Element {
  const { readiness: resolved, remove, refresh } = readiness
  const downloads = useAsrDownloads()
  const legacy = useLegacyModels()
  const [confirming, setConfirming] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  /**
   * A finished download changes what this screen says, and nothing on the
   * screen knows it happened.
   *
   * The transfer belongs to main and outlives the sheet (M26), so the only
   * thing that arrives here is the ending — without this subscription a model
   * that finished while the sheet was open kept its "Baixar" button until the
   * app was closed and reopened, which is exactly what a user reported.
   */
  useAsrDownloadEndings(
    useCallback(
      (download) => {
        if (download.status === 'done') refresh()
      },
      [refresh]
    )
  )

  /**
   * Deleting is cheap to do and expensive to undo — the undo is a 670 MB
   * download — so it is the one action on this screen that asks first.
   */
  const runDelete = useCallback(() => {
    setConfirming(false)
    setDeleteFailed(false)
    // Windows refuses to unlink a weight file the engine still has open, which
    // is why main evicts the session before removing the files. It can still
    // fail, and the failure has to reach the screen rather than leaving a
    // confirmation that closed and a model that is still there.
    void remove().catch(() => setDeleteFailed(true))
  }, [remove])

  // A screen whose answer has not arrived states nothing rather than a
  // placeholder that is about to change under the reader.
  if (resolved === null) {
    return (
      <div className="wb-voice">
        <p className="wb-voice-lead">{t('voice.offlineNote')}</p>
        <p className="wb-machine-measuring">{t('voice.machineMeasuring')}</p>
      </div>
    )
  }

  return (
    <div className="wb-voice">
      {/* NOT a restatement of the sheet's description — that says where the
          choice applies; this says where the work happens. */}
      <p className="wb-voice-lead">
        <CheckIcon size={13} aria-hidden="true" />
        {t('voice.offlineNote')}
      </p>

      {deleteFailed && (
        <p className="wb-voice-error" role="alert">
          {t('voice.deleteFailed')}
        </p>
      )}

      <ModelPanel readiness={resolved} downloads={downloads} onDelete={() => setConfirming(true)} />

      {/* Space an upgrading install is still paying for. Offered, never taken
          on the user's behalf: it is a download they waited for, and a startup
          migration that deletes it is a surprise with no undo. */}
      {legacy.bytes !== null && legacy.bytes > 0 && (
        <section className="wb-vlegacy" aria-label={t('voice.legacyTitle')}>
          <p className="wb-vlegacy-text">{t('voice.legacyText', formatBytes(legacy.bytes))}</p>
          <button
            type="button"
            className="wb-vbtn wb-vbtn-quiet"
            onClick={() => void legacy.remove()}
          >
            <TrashIcon size={13} aria-hidden="true" />
            {t('voice.legacyCta')}
          </button>
        </section>
      )}

      <MachineFacts facts={resolved.runtime.facts} threads={resolved.runtime.threads} />

      {confirming && (
        <DeleteConfirm
          sizeMB={resolved.model.sizeMB}
          onCancel={() => setConfirming(false)}
          onConfirm={runDelete}
        />
      )}
    </div>
  )
}
