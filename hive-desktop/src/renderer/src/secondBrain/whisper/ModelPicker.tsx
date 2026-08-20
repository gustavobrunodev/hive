import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem
} from '@hive/design-system'
import { t } from '../../i18n'
import { ChevronDownIcon, SparkleIcon } from '../../ui/icons'
import { modelTradeoff, preferenceCaption, recommendationCopy, type ModelInfo } from './modelCopy'
import type { WhisperPreference } from './useWhisperPreference'
import type { WhisperModelId } from './useWhisper'

/** The value the radio group carries — a model id, or automatic. */
const AUTO = 'auto'

interface ModelPickerProps {
  /** `null` while main is still resolving it. */
  preference: WhisperPreference | null
  /** The catalog, used for the size/params facts on each row. */
  models: ModelInfo[]
  onSelect: (id: WhisperModelId) => void
  onAuto: () => void
  /** Opens the full catalog, for the models that are a download. */
  onOpenCatalog: () => void
}

/**
 * One bundled model as a row: the trade-off first, the numbers as evidence.
 *
 * The whole row **is** the radio, rather than a label pointing at one. Radix
 * renders a `<button role="radio">`, and a button is not a labelable element,
 * so `<label htmlFor>` would have produced a control with no accessible name
 * sitting next to a click target that does nothing.
 */
function ModelOption({ model }: { model: ModelInfo }): React.JSX.Element {
  return (
    <RadioGroupItem className="wb-model-option" value={model.id}>
      {/* The dot is ours, not Radix's `Indicator`: that only mounts while the
          item is checked, so relying on it left the unselected rows with no
          control at all and their text hanging off the left edge. */}
      <span className="wb-model-option-dot" aria-hidden="true" />
      <span className="wb-model-option-body">
        <span className="wb-model-option-head">
          <span className="wb-model-option-name">{model.id}</span>
          <span className="wb-model-option-tradeoff">{modelTradeoff(model.id)}</span>
        </span>
        <span className="wb-model-option-meta">
          {t('secondBrain.modelParamsSize', model.params, model.sizeMB.fp32)}
          {model.bundled && (
            <span className="wb-model-option-bundled">{t('secondBrain.modelBundledSuffix')}</span>
          )}
        </span>
      </span>
    </RadioGroupItem>
  )
}

/**
 * The transcription-model chooser (SB-R7.4).
 *
 * A popover on a strip, not a dialog. Picking a model is a *routine* decision
 * that belongs next to the thing it affects — the product register's rule that
 * a modal is usually laziness applies squarely here, and the old flow ("Modelo"
 * `<select>` + a "Gerenciar modelos" dialog) made a one-click choice cost a
 * context switch and a modal dismissal.
 *
 * **Automatic is an option, not a hidden default.** It sits first in the same
 * list as the models, carries the reason the probe gave, and is what any user
 * who has never thought about this is already on — so the picker teaches the
 * decision instead of merely offering it. The catalog of downloadable models
 * stays one link away: it is the rare case, and it is the only case that costs
 * bandwidth.
 */
export function ModelPicker({
  preference,
  models,
  onSelect,
  onAuto,
  onOpenCatalog
}: ModelPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const bundled = models.filter((model) => model.bundled)
  // A pinned model that isn't bundled still deserves a row, or selecting it
  // from the catalog would leave the picker showing a selection it can't render.
  const pinnedExtra =
    preference !== null && !preference.auto && !bundled.some((m) => m.id === preference.id)
      ? models.filter((model) => model.id === preference.id)
      : []
  const rows = [...bundled, ...pinnedExtra]

  // A picker whose answer has not arrived states nothing rather than a
  // placeholder id that is about to change under the reader.
  if (preference === null) {
    return <span className="wb-model-strip" data-loading="true" aria-hidden="true" />
  }

  const { id, auto, recommendation } = preference
  const info = models.find((model) => model.id === id)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="wb-model-strip"
          aria-label={t('secondBrain.modelPickerLabel')}
        >
          <span className="wb-model-strip-label">{t('secondBrain.modelPickerShort')}</span>
          <span className="wb-model-strip-value">
            {auto && <SparkleIcon size={12} aria-hidden="true" />}
            {auto ? t('secondBrain.modelAutoWith', id) : id}
          </span>
          {info?.bundled === true && (
            <span className="wb-model-strip-badge">{t('secondBrain.modelBundled')}</span>
          )}
          <ChevronDownIcon size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="wb-model-pop" align="end">
        <p className="wb-model-pop-title">{t('secondBrain.modelPickerLabel')}</p>
        <p className="wb-model-pop-note">{t('secondBrain.modelBundledExplain')}</p>

        <RadioGroup
          className="wb-model-list"
          value={auto ? AUTO : id}
          onValueChange={(next: string) => {
            if (next === AUTO) onAuto()
            else onSelect(next as WhisperModelId)
            setOpen(false)
          }}
        >
          <RadioGroupItem className="wb-model-option" data-auto="true" value={AUTO}>
            <span className="wb-model-option-dot" aria-hidden="true" />
            <span className="wb-model-option-body">
              <span className="wb-model-option-head">
                <span className="wb-model-option-name">{t('secondBrain.modelAuto')}</span>
                <span className="wb-model-option-tradeoff">{recommendation.recommendedId}</span>
              </span>
              <span className="wb-model-option-meta">{recommendationCopy(recommendation)}</span>
            </span>
          </RadioGroupItem>

          {rows.map((model) => (
            <ModelOption key={model.id} model={model} />
          ))}
        </RadioGroup>

        <button
          type="button"
          className="wb-model-pop-more"
          onClick={() => {
            setOpen(false)
            onOpenCatalog()
          }}
        >
          {t('secondBrain.modelMoreModels')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The caption under the strip — why *this* model is the one running.
 *
 * Renders nothing until the preference resolves, which is a plain derivation
 * rather than a latched flag: `preference === null` already means "main has not
 * answered yet", and mirroring that into state through an effect would be the
 * same fact stored twice, one render late.
 */
export function ModelCaption({
  preference,
  models
}: {
  preference: WhisperPreference | null
  models: ModelInfo[]
}): React.JSX.Element | null {
  if (preference === null) return null
  const info = models.find((model) => model.id === preference.id)
  return (
    <p className="wb-model-caption">
      {preferenceCaption(preference.auto, info?.bundled === true, preference.recommendation)}
    </p>
  )
}
