import { useCallback, useEffect, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../../i18n'
import { TrashIcon } from '../../ui/icons'
import { recommendationCopy, type Recommendation } from './recommendationCopy'
import type { WhisperModelId, WhisperVariant } from './useWhisper'

/** Catalog entry as the bridge returns it. */
type ModelInfo = Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]

interface ModelManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which precision this machine will actually run (drives the size shown + downloaded). */
  variant: WhisperVariant
}

/** In-flight download progress, keyed by model id. */
type Progress = Record<string, number>

/** One catalog row: facts, badges, and the download/delete action. */
function ModelRow({
  model,
  recommended,
  pct,
  variant,
  onDownload,
  onDelete
}: {
  model: ModelInfo
  recommended: boolean
  pct: number | undefined
  variant: WhisperVariant
  onDownload: (id: WhisperModelId) => void
  onDelete: (id: WhisperModelId) => void
}): React.JSX.Element {
  const downloading = pct !== undefined
  return (
    <tr className="wb-brain-models-row" data-recommended={recommended || undefined}>
      <th scope="row" className="wb-brain-models-name">
        <span>{model.id}</span>
        {recommended && (
          <span className="wb-brain-models-badge" data-kind="recommended">
            {t('secondBrain.modelsRecommended')}
          </span>
        )}
        {model.downloaded && (
          <span className="wb-brain-models-badge" data-kind="downloaded">
            {t('secondBrain.modelsDownloaded')}
          </span>
        )}
        {!model.multilingual && (
          <span className="wb-brain-models-note">{t('secondBrain.modelsEnglishOnly')}</span>
        )}
      </th>
      <td>{model.params}</td>
      <td>{t('secondBrain.modelsSizeMb', model.sizeMB[variant])}</td>
      <td>{t('secondBrain.modelsVramGb', model.approxVramGB)}</td>
      <td>{model.relativeSpeed}</td>
      <td className="wb-brain-models-actions">
        {downloading ? (
          <span className="wb-brain-models-progress" role="status">
            {t('secondBrain.modelsDownloading', pct)}
          </span>
        ) : model.downloaded ? (
          <button
            type="button"
            className="wb-brain-models-icon-btn"
            aria-label={t('secondBrain.modelsDeleteAria', model.id)}
            onClick={() => onDelete(model.id)}
          >
            <TrashIcon size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="wb-brain-models-btn"
            aria-label={t('secondBrain.modelsDownloadAria', model.id)}
            onClick={() => onDownload(model.id)}
          >
            {t('secondBrain.modelsDownload')}
          </button>
        )}
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
 */
export function ModelManager({
  open,
  onOpenChange,
  variant
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
                  pct={progress[model.id]}
                  variant={variant}
                  onDownload={download}
                  onDelete={remove}
                />
              ))}
            </tbody>
          </table>
        </div>

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
