import { useCallback, useEffect, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../../i18n'
import { TrashIcon } from '../../ui/icons'
import { recommendationCopy, type ModelInfo, type Recommendation } from './modelCopy'
import type { WhisperModelId, WhisperVariant } from './useWhisper'

interface ModelManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which precision a *download* would fetch (drives the size shown). */
  variant: WhisperVariant
  /** The model transcription currently runs with, marked in the table. */
  selectedId: WhisperModelId
  /** Pins a model straight from the catalog — the reason to open this at all. */
  onSelect: (id: WhisperModelId) => void
}

/** In-flight download progress, keyed by model id. */
type Progress = Record<string, number>

/**
 * The action cell.
 *
 * Four states, and the one that matters most is the **bundled** one: a model
 * that ships inside the app has nothing to download and nothing to delete, so
 * offering either would be a control that lies. It gets "Usar" instead — the
 * only thing there is to do with it.
 */
function RowAction({
  model,
  selected,
  pct,
  onDownload,
  onDelete,
  onSelect
}: {
  model: ModelInfo
  selected: boolean
  pct: number | undefined
  onDownload: (id: WhisperModelId) => void
  onDelete: (id: WhisperModelId) => void
  onSelect: (id: WhisperModelId) => void
}): React.JSX.Element {
  if (pct !== undefined) {
    return (
      <span className="wb-brain-models-progress" role="status">
        {t('secondBrain.modelsDownloading', pct)}
      </span>
    )
  }
  if (!model.downloaded) {
    return (
      <button
        type="button"
        className="wb-brain-models-btn"
        aria-label={t('secondBrain.modelsDownloadAria', model.id)}
        onClick={() => onDownload(model.id)}
      >
        {t('secondBrain.modelsDownload')}
      </button>
    )
  }
  return (
    <span className="wb-brain-models-cell">
      <button
        type="button"
        className="wb-brain-models-btn"
        data-selected={selected || undefined}
        disabled={selected}
        onClick={() => onSelect(model.id)}
      >
        {selected ? t('secondBrain.modelsInUse') : t('secondBrain.modelsUse')}
      </button>
      {/* The installation is read-only — a bundled model has no delete. */}
      {!model.bundled && (
        <button
          type="button"
          className="wb-brain-models-icon-btn"
          aria-label={t('secondBrain.modelsDeleteAria', model.id)}
          onClick={() => onDelete(model.id)}
        >
          <TrashIcon size={14} />
        </button>
      )}
    </span>
  )
}

/** One catalog row: facts, badges, and the action. */
function ModelRow({
  model,
  recommended,
  selected,
  pct,
  variant,
  onDownload,
  onDelete,
  onSelect
}: {
  model: ModelInfo
  recommended: boolean
  selected: boolean
  pct: number | undefined
  variant: WhisperVariant
  onDownload: (id: WhisperModelId) => void
  onDelete: (id: WhisperModelId) => void
  onSelect: (id: WhisperModelId) => void
}): React.JSX.Element {
  return (
    <tr
      className="wb-brain-models-row"
      data-recommended={recommended || undefined}
      data-selected={selected || undefined}
    >
      <th scope="row" className="wb-brain-models-name">
        <span>{model.id}</span>
        {model.bundled && (
          <span className="wb-brain-models-badge" data-kind="bundled">
            {t('secondBrain.modelsBundledBadge')}
          </span>
        )}
        {recommended && (
          <span className="wb-brain-models-badge" data-kind="recommended">
            {t('secondBrain.modelsRecommended')}
          </span>
        )}
        {model.downloaded && !model.bundled && (
          <span className="wb-brain-models-badge" data-kind="downloaded">
            {t('secondBrain.modelsDownloaded')}
          </span>
        )}
        {!model.multilingual && (
          <span className="wb-brain-models-note">{t('secondBrain.modelsEnglishOnly')}</span>
        )}
      </th>
      <td>{model.params}</td>
      {/* A bundled model's size is the fp32 copy already on disk, not what a
          download of some other precision would have cost. */}
      <td>{t('secondBrain.modelsSizeMb', model.sizeMB[model.bundled ? 'fp32' : variant])}</td>
      <td>{t('secondBrain.modelsVramGb', model.approxVramGB)}</td>
      <td>{model.relativeSpeed}</td>
      <td className="wb-brain-models-actions">
        <RowAction
          model={model}
          selected={selected}
          pct={pct}
          onDownload={onDownload}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      </td>
    </tr>
  )
}

/**
 * The Whisper model manager (SB-R7.1/7.2): the catalog as a real table — size,
 * parameters, ~VRAM and relative speed — with per-row **Recomendado** /
 * **Baixado** badges and download/delete actions.
 *
 * A table, not cards: this is dense, comparable, homogeneous data, which is
 * exactly what a table is for. The size column shows the variant this machine
 * will actually download, so the number is the truth for *this* user rather
 * than a generic figure.
 *
 * Since the app ships `tiny`, `base` and `small` (D-SB-8), this is no longer
 * the first thing a new user has to visit — it is the **overflow**, reached
 * from the picker when someone wants a model that is genuinely a download. The
 * three bundled rows still appear, marked as such and without a delete they
 * could not perform, so the table stays the one complete picture of what is
 * available rather than a second, partial one.
 */
export function ModelManager({
  open,
  onOpenChange,
  variant,
  selectedId,
  onSelect
}: ModelManagerProps): React.JSX.Element {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [progress, setProgress] = useState<Progress>({})

  const refresh = useCallback(() => {
    void window.hive.whisper.listModels().then(setModels)
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()
    void window.hive.whisper.recommend().then(setRecommendation)
  }, [open, refresh])

  const download = useCallback(
    (id: WhisperModelId) => {
      setProgress((current) => ({ ...current, [id]: 0 }))
      const unsubscribe = window.hive.whisper.downloadModel(id, variant, (event) => {
        if (event.type === 'progress') {
          const pct = event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0
          setProgress((current) => ({ ...current, [id]: pct }))
          return
        }
        unsubscribe()
        setProgress((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        refresh()
      })
    },
    [variant, refresh]
  )

  const remove = useCallback(
    (id: WhisperModelId) => {
      void window.hive.whisper.deleteModel(id).then(refresh)
    },
    [refresh]
  )

  const reason = recommendationCopy(recommendation)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-brain-models">
        <DialogTitle>{t('secondBrain.modelsTitle')}</DialogTitle>
        <DialogDescription>{t('secondBrain.modelsDescription')}</DialogDescription>

        <div className="wb-brain-models-scroll">
          <table className="wb-brain-models-table">
            <thead>
              <tr>
                <th scope="col">{t('secondBrain.modelsColModel')}</th>
                <th scope="col">{t('secondBrain.modelsColParams')}</th>
                <th scope="col">{t('secondBrain.modelsColSize')}</th>
                <th scope="col">{t('secondBrain.modelsColVram')}</th>
                <th scope="col">{t('secondBrain.modelsColSpeed')}</th>
                <th scope="col">
                  <span className="wb-visually-hidden">{t('secondBrain.modelsDownload')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  recommended={recommendation?.recommendedId === model.id}
                  selected={model.id === selectedId}
                  pct={progress[model.id]}
                  variant={variant}
                  onDownload={download}
                  onDelete={remove}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        </div>

        <p className="wb-brain-models-bundled">{t('secondBrain.modelsBundledNote')}</p>
        {reason && <p className="wb-brain-models-reason">{reason}</p>}

        <div className="wb-brain-ingest-actions">
          <Button
            cut={false}
            variant="ghost"
            className="wb-btn"
            onClick={() => onOpenChange(false)}
          >
            {t('secondBrain.modelsClose')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
