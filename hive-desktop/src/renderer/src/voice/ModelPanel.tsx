import { t } from '../i18n'
import { CheckIcon, DownloadIcon, TrashIcon } from '../ui/icons'
import { DownloadFailure, DownloadProgress } from './DownloadProgress'
import { formatMegabytes } from './downloadCopy'
import type { AsrDownloadsState } from './useAsrDownloads'
import type { AsrReadiness } from './useAsrReadiness'

export interface ModelPanelProps {
  readiness: AsrReadiness
  downloads: AsrDownloadsState
  onDelete: () => void
}

/**
 * The model, as one row: is it here, what did it cost, and the one thing to do
 * about it.
 *
 * It replaces `ModelLibrary`, and the replacement is a deletion. That component
 * was 408 lines rendering ten radio rows, each with an accuracy meter, a speed
 * meter, a size that changed with the machine's precision, and — for the ones
 * that would not run — a measured explanation of why the download button was
 * missing instead of disabled. Every one of those affordances existed to help
 * someone resolve a trade Whisper forced and the app could not resolve for
 * them.
 *
 * Parakeet is both halves of that trade at once, so the screen has no choice
 * left to present. What remains is a fact and an action.
 */
export function ModelPanel({ readiness, downloads, onDelete }: ModelPanelProps): React.JSX.Element {
  const { model, installed } = readiness
  const download = downloads.byId[model.id]
  const running = download?.status === 'downloading'

  return (
    <section className="wb-vmodel" aria-label={t('voice.modelSectionLabel')}>
      <header className="wb-vmodel-head">
        <p className="wb-vmodel-name">
          {t('voice.modelName')}
          {installed && (
            <span className="wb-vmodel-state">
              <CheckIcon size={12} aria-hidden="true" />
              {t('voice.modelInstalled')}
            </span>
          )}
        </p>
        <p className="wb-vmodel-facts">
          {t('voice.modelFacts', model.params, model.languages, formatMegabytes(model.sizeMB))}
        </p>
      </header>

      {running && download && (
        <DownloadProgress download={download} onCancel={() => downloads.cancel(model.id)} />
      )}
      {download?.status === 'error' && (
        <DownloadFailure
          download={download}
          onRetry={downloads.start}
          onDismiss={() => downloads.dismiss(model.id)}
        />
      )}

      {!running && (
        <div className="wb-vmodel-actions">
          {installed ? (
            <button type="button" className="wb-vbtn wb-vbtn-quiet" onClick={onDelete}>
              <TrashIcon size={13} aria-hidden="true" />
              {t('voice.modelDeleteCta')}
            </button>
          ) : (
            <button
              type="button"
              className="wb-vbtn wb-vbtn-primary"
              onClick={downloads.start}
              disabled={downloads.busy}
            >
              <DownloadIcon size={13} aria-hidden="true" />
              {t('voice.modelDownloadCta', formatMegabytes(model.sizeMB))}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
