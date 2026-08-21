import { useCallback } from 'react'
import { t } from '../i18n'
import { ModelChoice } from './ModelChoice'
import { AUTO, pickedModel } from './modelChoiceValue'
import { ModelCatalog } from './ModelCatalog'
import { useModelDownloads } from './useModelDownloads'
import { preferenceCaption, reasonCopy, type ModelInfo, type Recommendation } from './voiceCopy'
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
 *
 * The verdict deliberately is NOT repeated here: the chooser's automatic row
 * names the model and its caption explains it, and stating it a third time
 * 60px above both was the defect the visual pass found.
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
 * Voice & transcription (M25) — the one place the transcription model is chosen.
 *
 * It used to live at the bottom of the ingestion sheet, which made it read as a
 * per-ingestion option; meanwhile dictation in the chat composer never consulted
 * it at all and quietly ran a hardcoded `base`. Both surfaces now resolve the
 * same preference from main, and this is where it is set — so the promise the
 * copy makes ("um modelo, os dois lugares") is one the code keeps.
 */
export function VoiceScope({ preference, catalog }: VoiceScopeProps): React.JSX.Element {
  const { preference: resolved, select, reset, refresh: refreshPreference } = preference
  const { refresh: refreshCatalog } = catalog
  const downloads = useModelDownloads(catalog.variant, refreshCatalog)

  const handleChange = useCallback(
    (value: string) => {
      const id = pickedModel(value)
      if (id === null) reset()
      else select(id)
    },
    [select, reset]
  )

  /**
   * Deleting a model can change which one transcribes, without the user having
   * chosen anything: main refuses a pinned id that is no longer on disk and
   * falls back to the probe. So both halves are re-read, not just the catalog.
   *
   * Depends on the two stable callbacks rather than on `catalog`, whose object
   * identity is new every render.
   */
  const handleDelete = useCallback(
    (id: WhisperModelId) => {
      void window.hive.whisper.deleteModel(id).then(() => {
        refreshCatalog()
        refreshPreference()
      })
    },
    [refreshCatalog, refreshPreference]
  )

  // A picker whose answer has not arrived states nothing rather than a
  // placeholder id that is about to change under the reader. Both halves have
  // to land: with the preference resolved but the catalog still in flight, the
  // chooser would offer only "Automático" and the catalog would announce
  // "nothing left to download" — two confident, wrong statements.
  if (resolved === null || !catalog.loaded) {
    return (
      <div className="wb-voice">
        <p className="wb-voice-lead">{t('voice.offlineNote')}</p>
        <p className="wb-machine-measuring">{t('voice.machineMeasuring')}</p>
      </div>
    )
  }

  const bundled = catalog.models.filter((model) => model.bundled)
  // A pinned model that is not bundled still deserves a row, or selecting it
  // from the catalog would leave the chooser showing a selection it cannot
  // render — the control would report no checked option at all.
  const pinnedExtra: ModelInfo[] =
    !resolved.auto && !bundled.some((model) => model.id === resolved.id)
      ? catalog.models.filter((model) => model.id === resolved.id)
      : []
  const downloadable = catalog.models.filter((model) => !model.bundled)
  const reason = reasonCopy(resolved.recommendation)

  return (
    <div className="wb-voice">
      {/* NOT a restatement of the sheet's description — that says where the
          choice applies; this says where the work happens. The two used to be
          the same sentence twice, 40 px apart. */}
      <p className="wb-voice-lead">{t('voice.offlineNote')}</p>

      <MachineFacts recommendation={resolved.recommendation} />

      <section className="wb-voice-choose">
        <h4 className="wb-voice-title">{t('voice.chooseLabel')}</h4>
        <ModelChoice
          value={resolved.auto ? AUTO : resolved.id}
          recommendation={resolved.recommendation}
          models={[...bundled, ...pinnedExtra]}
          onChange={handleChange}
        />
        <p className="wb-voice-caption" role="status">
          <span className="wb-voice-caption-lead">{preferenceCaption(resolved)}</span>
          {/* A separate element rather than a `{' '}` literal: the inline-string
              guard reads any JSX text child, whitespace included. */}
          {resolved.auto && reason !== null && (
            <span className="wb-voice-caption-why">{reason}</span>
          )}
          {!resolved.auto && pinnedExtra.length > 0 && (
            <span className="wb-voice-caption-why">{t('voice.captionPinnedExtra')}</span>
          )}
        </p>
      </section>

      <ModelCatalog
        models={downloadable}
        variant={catalog.variant}
        states={downloads.states}
        onDownload={downloads.start}
        onCancel={downloads.cancel}
        onDelete={handleDelete}
      />
    </div>
  )
}
