import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { DownloadIcon, MicIcon, SparkleIcon } from '../ui/icons'
import { DownloadFailure, DownloadProgress } from './DownloadProgress'
import { formatMegabytes } from './downloadCopy'
import { libraryOrder, modelRating, modelTradeoff, type ModelInfo } from './modelFacts'
import { fits } from './modelFit'
import { ModelRatings } from './ModelMeter'
import { useWhisperDownloads, type WhisperDownloadsState } from './useWhisperDownloads'
import { useWhisperCatalog } from '../secondBrain/whisper/useWhisperCatalog'
import { useWhisperPreference } from '../secondBrain/whisper/useWhisperPreference'

type WhisperModelId = ModelInfo['id']

export interface VoiceModelGateProps {
  open: boolean
  /**
   * Closing forgets the remembered intent; `useVoiceGate` closes this itself
   * the moment a model lands, and runs the take the user originally asked for.
   */
  onOpenChange: (open: boolean) => void
  /** Opens Perfil › Voz e transcrição, for the reader who wants the full library. */
  onOpenSettings: () => void
}

/** One model as a choosable card inside the gate. */
function GateOption({
  model,
  variant,
  selected,
  onSelect
}: {
  model: ModelInfo
  variant: 'fp32' | 'q8'
  selected: boolean
  onSelect: (id: WhisperModelId) => void
}): React.JSX.Element {
  const rating = modelRating(model)
  return (
    <button
      type="button"
      className="wb-vgate-opt"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(model.id)}
    >
      <span className="wb-vgate-opt-head">
        <span className="wb-vrow-name">{model.id}</span>
        <span className="wb-vrow-tradeoff">{modelTradeoff(model)}</span>
      </span>
      <span className="wb-vrow-facts">{formatMegabytes(model.sizeMB[variant])}</span>
      <ModelRatings accuracy={rating.accuracy} speed={rating.speed} active={selected} />
    </button>
  )
}

/**
 * The choosing half: three cards, the recommendation, and the one action.
 *
 * Split out of `VoiceModelGate` because the shell's job (a dialog, a loading
 * state, a subscription) and this one (four mutually-exclusive presentations of
 * a download) are different concerns, and holding both in one function put it
 * over the project's complexity ceiling — the sensor that asked for this split.
 */
function GateChooser({
  models,
  variant,
  recommendedId,
  downloads,
  onOpenSettings
}: {
  models: ModelInfo[]
  variant: 'fp32' | 'q8'
  recommendedId: WhisperModelId | null
  downloads: WhisperDownloadsState
  onOpenSettings: () => void
}): React.JSX.Element {
  const [picked, setPicked] = useState<WhisperModelId | null>(null)
  const selectedId = picked ?? recommendedId
  // Never optional past this line — a catalog that offers nothing is a dead end
  // this dialog cannot resolve, so it says so and hands over to the library
  // rather than rendering a chooser with nothing in it and a button that does
  // nothing. Narrowing it here is also what keeps the four presentations below
  // free of `selected &&` guards that only ever guarded that one case.
  const selected = models.find((model) => model.id === selectedId) ?? models[0]
  if (selected === undefined) {
    return (
      <p className="wb-vgate-foot">
        {t('voiceGate.emptyCatalog')}
        <button type="button" className="wb-vlink" onClick={onOpenSettings}>
          {t('voiceGate.allModelsCta')}
        </button>
      </p>
    )
  }

  const download = downloads.byId[selected.id]
  const running = download?.status === 'downloading'

  // A plain handler, not a `useCallback`: `selected` is derived from the
  // catalog during render, so nothing about it is stable enough to memoize —
  // and the React compiler is explicit that a memo it cannot preserve costs
  // more than the one call it would save.
  const start = (): void => downloads.start(selected.id, variant)

  return (
    <>
      <div
        className="wb-vgate-opts"
        role="radiogroup"
        aria-label={t('voiceGate.chooseAria')}
        data-busy={running || undefined}
      >
        {models.map((model) => (
          <GateOption
            key={model.id}
            model={model}
            variant={variant}
            selected={model.id === selected.id}
            onSelect={setPicked}
          />
        ))}
      </div>

      {selected.id === recommendedId && !running && (
        <p className="wb-vgate-why">
          <SparkleIcon size={12} aria-hidden="true" />
          {t('voiceGate.recommendedNote')}
        </p>
      )}

      {running && download && (
        <DownloadProgress download={download} onCancel={() => downloads.cancel(selected.id)} />
      )}
      {download?.status === 'error' && (
        <DownloadFailure
          download={download}
          onRetry={start}
          onDismiss={() => downloads.dismiss(selected.id)}
        />
      )}

      <div className="wb-vgate-actions">
        {!running && (
          <button type="button" className="wb-vbtn wb-vbtn-primary wb-vbtn-wide" onClick={start}>
            <DownloadIcon size={14} aria-hidden="true" />
            {t('voiceGate.downloadCta', formatMegabytes(selected.sizeMB[variant]))}
          </button>
        )}
        <p className="wb-vgate-foot">
          {running ? t('voiceGate.keepsGoing') : t('voiceGate.onceOnly')}
          <button type="button" className="wb-vlink" onClick={onOpenSettings}>
            {t('voiceGate.allModelsCta')}
          </button>
        </p>
      </div>
    </>
  )
}

/**
 * The gate every recording surface passes through when no model is installed.
 *
 * **It is a way in, not a wall.** The app stopped shipping weights, so pressing
 * the microphone on a fresh install has no honest outcome — the alternative to
 * this dialog is a take that records happily and then fails at transcription,
 * minutes of speech later, with the download the user actually needed hidden
 * three levels deep in a settings sheet.
 *
 * So the dialog does the whole job in place: it names the model this machine
 * should run, states its size, downloads it here, and then **starts the take
 * the user originally asked for** — `useVoiceGate` remembers the request across
 * the wait rather than throwing it away with the dialog. The three lightest
 * multilingual models are offered because that is the real choice at this
 * moment (how long am I willing to wait right now); everything else lives in
 * the full library, one link away.
 *
 * A modal, which the product register calls laziness by default — earned here
 * because it is the one case where the user's action genuinely cannot proceed,
 * and answering it inline would mean growing a downloader inside the chat
 * composer and inside the ingestion sheet, twice.
 */
export function VoiceModelGate({
  open,
  onOpenChange,
  onOpenSettings
}: VoiceModelGateProps): React.JSX.Element | null {
  const catalog = useWhisperCatalog(open)
  const preference = useWhisperPreference(open)
  const downloads = useWhisperDownloads()

  const resolved = preference.preference
  // Three lightest multilingual models — and only ones this machine can
  // actually load. The gate's whole promise is "download this and your take
  // starts", so offering a model the library itself refuses would break that
  // promise after the download rather than before it.
  const ramGB = resolved?.recommendation.ramGB ?? 0
  const options = libraryOrder(catalog.models)
    .filter((model) => model.multilingual && fits(model, catalog.variant, ramGB))
    .slice(0, 3)

  // A finished download does not re-resolve the preference on its own — main
  // answers `whisper:preference` on request, so the request has to be made.
  // Depends on the two stable callbacks, never on `catalog`/`preference`
  // themselves: those are fresh objects every render, and an effect keyed on
  // them would tear down and re-open this subscription on every frame.
  const { refresh: refreshCatalog } = catalog
  const { refresh: refreshPreference } = preference
  useEffect(() => {
    if (!open) return
    return window.hive.whisper.onDownloadSettled((settled) => {
      if (settled.status !== 'done') return
      refreshCatalog()
      refreshPreference()
    })
  }, [open, refreshCatalog, refreshPreference])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-vgate">
        <span className="wb-vgate-mark" aria-hidden="true">
          <MicIcon size={22} />
        </span>
        <DialogTitle className="wb-vgate-title">{t('voiceGate.title')}</DialogTitle>
        <DialogDescription className="wb-vgate-desc">
          {t('voiceGate.description')}
        </DialogDescription>

        {!catalog.loaded || resolved === null ? (
          <p className="wb-machine-measuring">{t('voice.machineMeasuring')}</p>
        ) : (
          <GateChooser
            models={options}
            variant={catalog.variant}
            recommendedId={resolved.recommendation.recommendedId}
            downloads={downloads}
            onOpenSettings={onOpenSettings}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
