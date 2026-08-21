import { useState } from 'react'
import { t } from '../i18n'
import { ChevronDownIcon, DownloadIcon, TrashIcon } from '../ui/icons'
import type { ModelInfo } from './voiceCopy'
import type { DownloadState } from './useModelDownloads'
import type { WhisperModelId, WhisperVariant } from '../secondBrain/whisper/useWhisper'

interface ModelCatalogProps {
  /** Only the models that are a real download — the bundled three are elsewhere. */
  models: ModelInfo[]
  /** Which precision a download would fetch on this machine (drives the size). */
  variant: WhisperVariant
  states: Record<string, DownloadState>
  onDownload: (id: WhisperModelId) => void
  onCancel: (id: WhisperModelId) => void
  onDelete: (id: WhisperModelId) => void
}

/**
 * The action cell — four states, one of which is the whole reason this is not
 * a table of "Baixar" buttons: a download in flight has to be **stoppable** and
 * a failed one has to say so. A row that silently reverted to "Baixar" after a
 * network drop is indistinguishable from one that was never clicked.
 */
function RowAction({
  model,
  state,
  onDownload,
  onCancel,
  onDelete
}: {
  model: ModelInfo
  state: DownloadState | undefined
  onDownload: (id: WhisperModelId) => void
  onCancel: (id: WhisperModelId) => void
  onDelete: (id: WhisperModelId) => void
}): React.JSX.Element {
  if (state?.failed === true) {
    return (
      <span className="wb-cat-action">
        <span className="wb-cat-failed" role="alert">
          {t('voice.downloadFailed')}
        </span>
        <button type="button" className="wb-cat-btn" onClick={() => onDownload(model.id)}>
          {t('voice.downloadRetry')}
        </button>
      </span>
    )
  }
  if (state !== undefined) {
    const pct = state.pct ?? 0
    return (
      <span className="wb-cat-action">
        <span
          className="wb-cat-progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('voice.downloadingAria', model.id, pct)}
        >
          <span className="wb-cat-progress-fill" style={{ width: `${pct}%` }} />
          <span className="wb-cat-progress-text">{t('voice.downloading', pct)}</span>
        </span>
        <button
          type="button"
          className="wb-cat-icon-btn"
          aria-label={t('voice.downloadCancelAria', model.id)}
          onClick={() => onCancel(model.id)}
        >
          <TrashIcon size={14} />
        </button>
      </span>
    )
  }
  if (!model.downloaded) {
    return (
      <button
        type="button"
        className="wb-cat-btn"
        data-primary="true"
        aria-label={t('voice.downloadAria', model.id)}
        onClick={() => onDownload(model.id)}
      >
        <DownloadIcon size={13} />
        {t('voice.download')}
      </button>
    )
  }
  return (
    <span className="wb-cat-action">
      <span className="wb-cat-have">{t('voice.downloadedBadge')}</span>
      <button
        type="button"
        className="wb-cat-icon-btn"
        aria-label={t('voice.deleteAria', model.id)}
        onClick={() => onDelete(model.id)}
      >
        <TrashIcon size={14} />
      </button>
    </span>
  )
}

/**
 * The models that are a genuine download, behind a disclosure.
 *
 * **Inline, not a second modal.** This used to be a `Dialog` opened from inside
 * the ingestion `Sheet` — a modal on top of a modal, to answer a question
 * ("what else could I run?") that is pure browsing. The product register's rule
 * that a modal is usually laziness applies squarely: the sheet has the room, so
 * the catalog expands in place and the reader keeps their chosen model on
 * screen while comparing it against the alternatives.
 *
 * Collapsed by default because it is the rare case: the three models that ship
 * inside the app cover everyone who has not gone looking, and this is the only
 * choice on the surface that costs bandwidth.
 */
export function ModelCatalog({
  models,
  variant,
  states,
  onDownload,
  onCancel,
  onDelete
}: ModelCatalogProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  if (models.length === 0) {
    return <p className="wb-cat-empty">{t('voice.catalogEmpty')}</p>
  }

  return (
    <div className="wb-cat">
      <button
        type="button"
        className="wb-cat-toggle"
        aria-expanded={open}
        aria-controls="wb-cat-list"
        aria-label={t('voice.catalogToggleAria')}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDownIcon size={14} aria-hidden="true" />
        {t('voice.catalogToggle', models.length)}
      </button>

      {open && (
        <div className="wb-cat-panel" id="wb-cat-list">
          <p className="wb-cat-note">{t('voice.catalogNote')}</p>
          <ul className="wb-cat-rows">
            {models.map((model) => (
              <li key={model.id} className="wb-cat-row">
                <span className="wb-cat-name">
                  {model.id}
                  {!model.multilingual && (
                    <span className="wb-cat-tag">{t('voice.englishOnly')}</span>
                  )}
                </span>
                <span className="wb-cat-facts">
                  {t('voice.paramsSize', model.params, model.sizeMB[variant])}
                </span>
                <RowAction
                  model={model}
                  state={states[model.id]}
                  onDownload={onDownload}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
