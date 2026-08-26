import { useCallback, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { CheckIcon } from '../ui/icons'
import { ModelLibrary } from '../voice/ModelLibrary'
import { formatMegabytes } from '../voice/downloadCopy'
import { useWhisperDownloadEndings, useWhisperDownloads } from '../voice/useWhisperDownloads'
import { reasonCopy, type Recommendation } from './voiceCopy'
import type { WhisperPreferenceState } from '../secondBrain/whisper/useWhisperPreference'
import type { WhisperCatalog } from '../secondBrain/whisper/useWhisperCatalog'
import type { WhisperModelId } from '../secondBrain/whisper/useWhisper'

interface VoiceScopeProps {
  preference: WhisperPreferenceState
  catalog: WhisperCatalog
}

/**
 * What the probe measured, as three figures.
 *
 * This exists so "Automático" is a **statement rather than a shrug**. The old
 * surface offered an automatic option and one sentence of justification; a user
 * who wondered whether the app had actually looked at their machine had no way
 * to tell. These are the same three readings the ladder branches on, so if the
 * pick looks wrong, the reason it is wrong is on screen.
 */
function MachineFacts({ recommendation }: { recommendation: Recommendation }): React.JSX.Element {
  const { gpu, ramGB, cores } = recommendation
  const unknown = ramGB <= 0
  return (
    <section className="wb-machine" aria-label={t('voice.machineTitle')}>
      <h4 className="wb-machine-title">{t('voice.machineTitle')}</h4>
      <dl className="wb-machine-facts">
        <div className="wb-machine-fact">
          <dt>{t('voice.machineGpu')}</dt>
          <dd data-strong={gpu || undefined}>
            {gpu ? t('voice.machineGpuYes') : t('voice.machineGpuNo')}
          </dd>
        </div>
        <div className="wb-machine-fact">
          <dt>{t('voice.machineRam')}</dt>
          <dd>{unknown ? t('voice.machineUnknown') : t('voice.machineRamValue', ramGB)}</dd>
        </div>
        <div className="wb-machine-fact">
          <dt>{t('voice.machineCores')}</dt>
          <dd>{cores > 0 ? t('voice.machineCoresValue', cores) : t('voice.machineUnknown')}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * What is transcribing right now — a statement, at the top, before any control.
 *
 * It is a separate block from the chooser on purpose. The chooser answers "what
 * could run"; a reader arriving here almost always wants the other question
 * first, and reading it off a radio group means finding the checked dot and
 * then working out whether the automatic row above it is the one that is
 * actually in force.
 */
function InForce({
  id,
  auto,
  reason
}: {
  id: WhisperModelId
  auto: boolean
  reason: string | null
}): React.JSX.Element {
  return (
    <section className="wb-vinforce">
      <span className="wb-vinforce-label">
        <span className="wb-vinforce-dot" aria-hidden="true" />
        {t('voice.inForceLabel')}
      </span>
      <p className="wb-vinforce-name">
        {id}
        <span className="wb-vinforce-mode">
          {auto ? t('voice.inForceAuto') : t('voice.inForcePinned')}
        </span>
      </p>
      {auto && reason !== null && <p className="wb-vinforce-why">{reason}</p>}
    </section>
  )
}

/** The one destructive action on this screen, asked out loud before it runs. */
function DeleteConfirm({
  id,
  sizeMB,
  onCancel,
  onConfirm
}: {
  id: WhisperModelId
  sizeMB: number
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('voice.deleteConfirmTitle', id)}</DialogTitle>
        <DialogDescription>
          {t('voice.deleteConfirmText', formatMegabytes(sizeMB))}
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
 * Voice & transcription (M25, redesigned in M26) — the one place the
 * transcription model is chosen, and now also the one place it is *acquired*.
 *
 * The screen changed shape because the product did: the app used to ship three
 * models inside the installer, so this was a chooser with a rarely-opened
 * catalog folded away behind a disclosure. Nothing ships now — every model is a
 * download — which makes "you have none yet" the state a new user actually
 * arrives in, and a collapsed disclosure the worst possible place to keep the
 * only thing they can do.
 */
export function VoiceScope({ preference, catalog }: VoiceScopeProps): React.JSX.Element {
  const { preference: resolved, select, reset, refresh: refreshPreference } = preference
  const { refresh: refreshCatalog } = catalog
  const downloads = useWhisperDownloads()
  const [pendingDelete, setPendingDelete] = useState<WhisperModelId | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const handleSelect = useCallback(
    (id: WhisperModelId | null) => {
      if (id === null) reset()
      else select(id)
    },
    [select, reset]
  )

  /**
   * A finished download changes what this screen says, and nothing on the
   * screen knows it happened.
   *
   * The transfer belongs to main and outlives the sheet (M26), so the only
   * thing that arrives here is the ending — without this subscription a model
   * that finished while the sheet was open kept its "Baixar" button until the
   * app was closed and reopened, which is exactly what a user reported. Both
   * halves are re-read: a first model landing also decides what "Automático"
   * resolves to, and that answer lives in main.
   */
  useWhisperDownloadEndings(
    useCallback(
      (download) => {
        if (download.status !== 'done') return
        refreshCatalog()
        refreshPreference()
      },
      [refreshCatalog, refreshPreference]
    )
  )

  /**
   * Deleting a model can change which one transcribes, without the user having
   * chosen anything: main refuses a pinned id that is no longer on disk and
   * falls back to the probe. So both halves are re-read, not just the catalog.
   *
   * Re-read on **both** outcomes, which is the part the first cut got wrong: a
   * `remove` that throws part-way (Windows refuses to unlink a weight file the
   * engine still has open) left the promise rejected, the `.then` unreached and
   * a screen still showing a model that was already half gone.
   */
  const runDelete = useCallback(
    (id: WhisperModelId) => {
      setPendingDelete(null)
      void window.hive.whisper
        .deleteModel(id)
        .then(() => setDeleteFailed(false))
        .catch(() => setDeleteFailed(true))
        .finally(() => {
          refreshCatalog()
          refreshPreference()
        })
    },
    [refreshCatalog, refreshPreference]
  )

  /**
   * The confirmation. Deleting is cheap to do and expensive to undo — the undo
   * is a download measured in gigabytes — so it is the one action on this
   * screen that asks first.
   */
  const handleDelete = useCallback((id: WhisperModelId) => {
    setDeleteFailed(false)
    setPendingDelete(id)
  }, [])

  // A picker whose answer has not arrived states nothing rather than a
  // placeholder id that is about to change under the reader. Both halves have
  // to land: with the preference resolved but the catalog still in flight, the
  // library would render as "you have no models" for the length of one IPC
  // round trip — a confident, wrong statement, and the exact one this screen
  // exists to make actionable.
  if (resolved === null || !catalog.loaded) {
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

      {resolved.id !== null && (
        <InForce
          id={resolved.id}
          auto={resolved.auto}
          reason={reasonCopy(resolved.recommendation)}
        />
      )}

      {deleteFailed && (
        <p className="wb-voice-error" role="alert">
          {t('voice.deleteFailed')}
        </p>
      )}

      <ModelLibrary
        models={catalog.models}
        preference={resolved}
        variant={catalog.variant}
        downloads={downloads}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />

      <MachineFacts recommendation={resolved.recommendation} />

      {pendingDelete !== null && (
        <DeleteConfirm
          id={pendingDelete}
          sizeMB={
            catalog.models.find((model) => model.id === pendingDelete)?.sizeMB[catalog.variant] ?? 0
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => runDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
