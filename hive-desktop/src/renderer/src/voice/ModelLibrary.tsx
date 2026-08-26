import { useCallback } from 'react'
import { RadioGroup, RadioGroupItem } from '@hive/design-system'
import { t } from '../i18n'
import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  MicIcon,
  SparkleIcon,
  TrashIcon
} from '../ui/icons'
import { DownloadFailure, DownloadProgress } from './DownloadProgress'
import { formatMegabytes, type WhisperDownload } from './downloadCopy'
import { libraryOrder, modelRating, modelTradeoff, type ModelInfo } from './modelFacts'
import { modelFit, type ModelFit } from './modelFit'
import { ModelRatings } from './ModelMeter'
import type { WhisperDownloadsState } from './useWhisperDownloads'

type WhisperModelId = ModelInfo['id']
type Preference = Awaited<ReturnType<Window['hive']['whisper']['preference']>>
type Variant = 'fp32' | 'q8'

/** The value the chooser carries for "let the app decide". */
export const AUTO = 'auto'

export interface ModelLibraryProps {
  models: ModelInfo[]
  preference: Preference
  /** Which precision a download would fetch on this machine (sizes the rows). */
  variant: Variant
  downloads: WhisperDownloadsState
  onSelect: (id: WhisperModelId | null) => void
  onDelete: (id: WhisperModelId) => void
}

/**
 * Why a model has no download button — the measured reason, in one block.
 *
 * It replaces the button rather than sitting beside it, because a disabled
 * control with an explanation next to it still reads as "try again later";
 * this is not a wait, it is an answer.
 */
function FitNotice({ fit }: { fit: ModelFit }): React.JSX.Element | null {
  if (fit.kind === 'ok') return null
  const large = fit.kind === 'tooLarge'
  return (
    <div className="wb-vfit" role="note">
      <span className="wb-vfit-mark" aria-hidden="true">
        <AlertTriangleIcon size={13} />
      </span>
      <span className="wb-vfit-body">
        <span className="wb-vfit-title">
          {large ? t('voice.fitTooLargeTitle') : t('voice.fitTooHeavyTitle')}
        </span>
        <span className="wb-vfit-text">
          {large
            ? t('voice.fitTooLargeText', formatMegabytes(fit.fileMB))
            : t('voice.fitTooHeavyText', formatMegabytes(fit.needMB), fit.ramGB)}
        </span>
        <span className="wb-vfit-text">{t('voice.fitLearnMore')}</span>
      </span>
    </div>
  )
}

/** The row's supporting numbers, in one line. */
function factsLine(model: ModelInfo, variant: Variant): string {
  const size = model.downloaded
    ? formatMegabytes(model.sizeMB[model.downloadedVariant ?? variant])
    : formatMegabytes(model.sizeMB[variant])
  return t('voice.paramsSize', model.params, size)
}

/** The name + character + badges line, shared by every row shape. */
function RowHead({
  model,
  recommended,
  large = false
}: {
  model: ModelInfo
  recommended: boolean
  large?: boolean
}): React.JSX.Element {
  return (
    <span className="wb-vrow-head">
      <span className="wb-vrow-name" data-lg={large || undefined}>
        {model.id}
      </span>
      <span className="wb-vrow-tradeoff">{modelTradeoff(model)}</span>
      {recommended && <span className="wb-vbadge">{t('voice.recommendedBadge')}</span>}
      {!model.multilingual && (
        <span className="wb-vbadge wb-vbadge-quiet">{t('voice.englishOnly')}</span>
      )}
    </span>
  )
}

/**
 * One installed model, as a choice.
 *
 * The radio **is** the row rather than a label pointing at one: Radix renders a
 * `<button role="radio">`, and a button is not a labelable element, so
 * `<label htmlFor>` would produce a control with no accessible name sitting
 * beside a click target that does nothing.
 */
function InstalledRow({
  model,
  variant,
  inForce,
  recommended,
  onDelete
}: {
  model: ModelInfo
  variant: Variant
  inForce: boolean
  recommended: boolean
  onDelete: (id: WhisperModelId) => void
}): React.JSX.Element {
  const rating = modelRating(model)
  return (
    <div className="wb-vrow wb-vrow-installed" data-in-force={inForce || undefined}>
      <RadioGroupItem
        className="wb-vopt"
        value={model.id}
        aria-label={t('voice.useAria', model.id)}
      >
        <span className="wb-vopt-dot" aria-hidden="true" />
        <span className="wb-vopt-body">
          <RowHead model={model} recommended={recommended} />
          <span className="wb-vrow-facts">{factsLine(model, variant)}</span>
          <ModelRatings accuracy={rating.accuracy} speed={rating.speed} active={inForce} />
        </span>
      </RadioGroupItem>
      <button
        type="button"
        className="wb-vicon-btn"
        aria-label={t('voice.deleteAria', model.id)}
        title={t('voice.deleteTitle')}
        onClick={() => onDelete(model.id)}
      >
        <TrashIcon size={14} />
      </button>
    </div>
  )
}

/** One model that is not here yet: the facts, and the action that changes that. */
function LibraryRow({
  model,
  variant,
  download,
  recommended,
  downloads,
  fit
}: {
  model: ModelInfo
  variant: Variant
  download: WhisperDownload | undefined
  recommended: boolean
  downloads: WhisperDownloadsState
  fit: ModelFit
}): React.JSX.Element {
  const rating = modelRating(model)
  const running = download?.status === 'downloading'
  const failed = download?.status === 'error'
  const blocked = fit.kind !== 'ok'
  return (
    <li
      className="wb-vrow wb-vrow-library"
      data-busy={running || undefined}
      data-blocked={blocked || undefined}
    >
      <div className="wb-vrow-main">
        <div className="wb-vopt-body">
          <RowHead model={model} recommended={recommended} />
          <span className="wb-vrow-facts">{factsLine(model, variant)}</span>
          {!running && <ModelRatings accuracy={rating.accuracy} speed={rating.speed} />}
        </div>
        {/* Not while it is downloading, and not while it has failed: the
            failure banner below already carries the retry, and two buttons
            doing the same thing 60 px apart is the duplicated-affordance
            defect this project keeps re-finding in visual passes. */}
        {!running && !failed && !blocked && (
          <button
            type="button"
            className="wb-vbtn wb-vbtn-primary"
            aria-label={t('voice.downloadAria', model.id)}
            onClick={() => downloads.start(model.id, variant)}
          >
            <DownloadIcon size={13} aria-hidden="true" />
            {t('voice.download')}
          </button>
        )}
      </div>
      <FitNotice fit={fit} />
      {running && download && (
        <DownloadProgress download={download} onCancel={() => downloads.cancel(model.id)} />
      )}
      {failed && download && (
        <DownloadFailure
          download={download}
          onRetry={() => downloads.start(model.id, variant)}
          onDismiss={() => downloads.dismiss(model.id)}
        />
      )}
    </li>
  )
}

/**
 * Nothing installed — the state a fresh install is now in, and the one this
 * screen exists to get someone out of.
 *
 * It leads with the recommendation rather than with the catalog because a
 * first-time reader has no basis for choosing between ten model names, and the
 * app has already measured the machine that would run them. The full ladder is
 * right below, for the reader who does want to choose.
 */
function EmptyLead({
  recommended,
  variant,
  download,
  downloads
}: {
  recommended: ModelInfo | undefined
  variant: Variant
  download: WhisperDownload | undefined
  downloads: WhisperDownloadsState
}): React.JSX.Element {
  const running = download?.status === 'downloading'
  const rating = recommended ? modelRating(recommended) : null
  return (
    <section className="wb-vempty">
      <span className="wb-vempty-mark" aria-hidden="true">
        <MicIcon size={20} />
      </span>
      <h4 className="wb-vempty-title">{t('voice.emptyTitle')}</h4>
      <p className="wb-vempty-text">{t('voice.emptyText')}</p>
      {recommended && rating && (
        <div className="wb-vpick" data-busy={running || undefined}>
          <span className="wb-vpick-eyebrow">
            <SparkleIcon size={12} aria-hidden="true" />
            {t('voice.emptyPickLabel')}
          </span>
          <RowHead model={recommended} recommended={false} large />
          <span className="wb-vrow-facts">{factsLine(recommended, variant)}</span>
          {!running && download?.status !== 'error' && (
            <>
              <ModelRatings accuracy={rating.accuracy} speed={rating.speed} />
              <button
                type="button"
                className="wb-vbtn wb-vbtn-primary wb-vbtn-wide"
                onClick={() => downloads.start(recommended.id, variant)}
              >
                <DownloadIcon size={14} aria-hidden="true" />
                {t('voice.emptyDownloadCta', formatMegabytes(recommended.sizeMB[variant]))}
              </button>
            </>
          )}
          {running && download && (
            <DownloadProgress
              download={download}
              onCancel={() => downloads.cancel(recommended.id)}
            />
          )}
          {download?.status === 'error' && (
            <DownloadFailure
              download={download}
              onRetry={() => downloads.start(recommended.id, variant)}
              onDismiss={() => downloads.dismiss(recommended.id)}
            />
          )}
        </div>
      )}
    </section>
  )
}

/** The automatic row: an option in the same list, naming what it resolves to. */
function AutoRow({ preference }: { preference: Preference }): React.JSX.Element {
  return (
    <div className="wb-vrow wb-vrow-installed" data-in-force={preference.auto || undefined}>
      <RadioGroupItem className="wb-vopt" value={AUTO}>
        <span className="wb-vopt-dot" aria-hidden="true" />
        <span className="wb-vopt-body">
          <span className="wb-vrow-head">
            <SparkleIcon size={12} aria-hidden="true" />
            <span className="wb-vrow-name">{t('voice.autoLabel')}</span>
          </span>
          <span className="wb-vrow-facts">
            {preference.id === null ? t('voice.autoMetaEmpty') : t('voice.autoMeta', preference.id)}
          </span>
        </span>
      </RadioGroupItem>
    </div>
  )
}

/**
 * The transcription-model library — **one global choice**, applying to
 * dictation in the chat and to audio ingestion alike.
 *
 * Two lists, deliberately, rather than one with mixed affordances: "Seus
 * modelos" is a *decision* (a radio group, one of which is in force) and
 * "Biblioteca" is an *acquisition* (rows with a download action). Merging them
 * would put a radio beside a button inside one group, which is an accessibility
 * problem — Radix's roving tabindex expects every child of a `RadioGroup` to be
 * a radio — and a conceptual one: choosing and fetching are different acts, and
 * a row that answers both questions answers neither clearly. A finished
 * download moving from one list to the other is also the clearest confirmation
 * available that it finished.
 */
export function ModelLibrary({
  models,
  preference,
  variant,
  downloads,
  onSelect,
  onDelete
}: ModelLibraryProps): React.JSX.Element {
  const installed = libraryOrder(models.filter((model) => model.downloaded))
  const allAvailable = libraryOrder(models.filter((model) => !model.downloaded))
  const recommendedId = preference.recommendation.recommendedId
  const ramGB = preference.recommendation.ramGB
  const fitOf = (model: ModelInfo): ModelFit => modelFit(model, variant, ramGB)
  // The lead card is an offer, so it can only ever name a model this machine
  // can actually run: falling back to `allAvailable[0]` blindly is how a
  // first-run screen would open by proposing a 5.8 GB download that ends in an
  // allocation failure.
  const recommended =
    installed.length === 0
      ? (allAvailable.find((model) => model.id === recommendedId && fitOf(model).kind === 'ok') ??
        allAvailable.find((model) => fitOf(model).kind === 'ok'))
      : undefined
  // The lead card already *is* the recommended model's row — progress, failure
  // and all — so the library below drops it. Listing it twice would put two
  // live progress bars for one transfer on the same screen, which reads as two
  // downloads running.
  const available = allAvailable.filter((model) => model.id !== recommended?.id)

  const handleChange = useCallback(
    (value: string) => onSelect(value === AUTO ? null : (value as WhisperModelId)),
    [onSelect]
  )

  return (
    <div className="wb-vlib">
      {installed.length === 0 && (
        <EmptyLead
          recommended={recommended}
          variant={variant}
          download={recommended ? downloads.byId[recommended.id] : undefined}
          downloads={downloads}
        />
      )}

      {installed.length > 0 && (
        <section className="wb-vsection">
          <h4 className="wb-vsection-title">{t('voice.installedTitle')}</h4>
          <RadioGroup
            className="wb-vlist"
            value={preference.auto ? AUTO : (preference.id ?? AUTO)}
            onValueChange={handleChange}
          >
            <AutoRow preference={preference} />
            {installed.map((model) => (
              <InstalledRow
                key={model.id}
                model={model}
                variant={variant}
                inForce={!preference.auto && preference.id === model.id}
                recommended={recommendedId === model.id}
                onDelete={onDelete}
              />
            ))}
          </RadioGroup>
        </section>
      )}

      {available.length > 0 && (
        <section className="wb-vsection">
          <h4 className="wb-vsection-title">{t('voice.libraryTitle')}</h4>
          <p className="wb-vsection-note">{t('voice.libraryNote')}</p>
          <ul className="wb-vlist wb-vlist-plain">
            {available.map((model) => (
              <LibraryRow
                key={model.id}
                model={model}
                variant={variant}
                download={downloads.byId[model.id]}
                recommended={false}
                downloads={downloads}
                fit={fitOf(model)}
              />
            ))}
          </ul>
        </section>
      )}

      {available.length === 0 && installed.length > 0 && (
        <p className="wb-vsection-note wb-vsection-note-standalone">
          <CheckIcon size={13} aria-hidden="true" />
          {t('voice.catalogEmpty')}
        </p>
      )}
    </div>
  )
}
