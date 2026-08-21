import { RadioGroup, RadioGroupItem } from '@hive/design-system'
import { t } from '../i18n'
import { SparkleIcon } from '../ui/icons'
import { modelTradeoff, type ModelInfo, type Recommendation } from './voiceCopy'
import { AUTO, modelRowMeta } from './modelChoiceValue'

interface ModelChoiceProps {
  /** The pinned id, or `AUTO`. */
  value: string
  /** The probe's answer — what "Automático" resolves to right now. */
  recommendation: Recommendation
  /** The rows to offer: the bundled models, plus any pinned extra. */
  models: ModelInfo[]
  onChange: (value: string) => void
}

/**
 * One model as a row.
 *
 * The whole row **is** the radio rather than a label pointing at one. Radix
 * renders a `<button role="radio">`, and a button is not a labelable element,
 * so `<label htmlFor>` would produce a control with no accessible name sitting
 * beside a click target that does nothing.
 *
 * Every row is exactly two lines — a title line and a meta line, both
 * single-line — which is what lets the control be **vertically centred** rather
 * than pinned to the top of a box whose height depends on how long a sentence
 * happened to be. The old picker put the reason sentence *inside* the automatic
 * row, making it three lines tall while its neighbours were two, and the dot
 * sat at the top of all of them: the column of controls read as misaligned
 * because it was. The explanation moved out, under the group, where it can be
 * as long as it needs to be.
 */
function ModelRow({
  value,
  name,
  tradeoff,
  meta,
  recommended,
  auto = false
}: {
  value: string
  name: string
  /** The one-word choice this row represents; the automatic row has none. */
  tradeoff?: string
  meta: string
  recommended: boolean
  auto?: boolean
}): React.JSX.Element {
  return (
    <RadioGroupItem className="wb-mdl-opt" data-auto={auto || undefined} value={value}>
      {/* The ring is ours, not Radix's `Indicator`: that only mounts while the
          item is checked, so relying on it leaves every unselected row with no
          control at all and its text hanging off the left edge. */}
      <span className="wb-mdl-dot" aria-hidden="true" />
      <span className="wb-mdl-body">
        <span className="wb-mdl-head">
          {auto && <SparkleIcon size={12} aria-hidden="true" />}
          <span className="wb-mdl-name" data-auto={auto || undefined}>
            {name}
          </span>
          {tradeoff !== undefined && <span className="wb-mdl-tradeoff">{tradeoff}</span>}
          {recommended && <span className="wb-mdl-badge">{t('voice.recommendedBadge')}</span>}
        </span>
        <span className="wb-mdl-meta">{meta}</span>
      </span>
    </RadioGroupItem>
  )
}

/**
 * The transcription-model chooser (SB-R7.4) — **one global choice**, applying
 * to dictation in the chat and to audio ingestion alike.
 *
 * **Automatic is an option, not a hidden default.** It sits first in the same
 * list as the models and names what it currently resolves to, so a user who has
 * never thought about this can see what the app decided *and* what handing the
 * decision back would mean.
 */
export function ModelChoice({
  value,
  recommendation,
  models,
  onChange
}: ModelChoiceProps): React.JSX.Element {
  return (
    <RadioGroup className="wb-mdl-list" value={value} onValueChange={onChange}>
      <ModelRow
        auto
        value={AUTO}
        name={t('voice.autoLabel')}
        meta={t('voice.autoMeta', recommendation.recommendedId)}
        recommended={false}
      />
      {models.map((model) => (
        <ModelRow
          key={model.id}
          value={model.id}
          name={model.id}
          tradeoff={modelTradeoff(model.id)}
          meta={modelRowMeta(model)}
          recommended={recommendation.recommendedId === model.id}
        />
      ))}
    </RadioGroup>
  )
}
