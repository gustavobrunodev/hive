import { t } from '../i18n'

const STEPS = [1, 2, 3, 4, 5]

/**
 * One rating as five steps.
 *
 * A meter rather than a number because the question it answers is comparative:
 * "is this one better than the row above, and by how much" is read off two
 * meters in a glance and computed from "244 M" versus "769 M" not at all.
 *
 * The filled steps carry the reading, so they must clear the 3:1 floor for
 * non-text carriers on their own — the empty ones are `--border` and deliberately
 * do not (they are the absence of a reading, not a second reading).
 */
export function ModelMeter({
  label,
  value,
  active = false
}: {
  label: string
  value: number
  /** The model in force gets the accent — a state signal, not decoration. */
  active?: boolean
}): React.JSX.Element {
  return (
    <span className="wb-vmeter" data-active={active || undefined}>
      <span className="wb-vmeter-label">{label}</span>
      <span className="wb-vmeter-track" role="img" aria-label={t('voice.meterAria', label, value)}>
        {STEPS.map((step) => (
          <span key={step} className="wb-vmeter-step" data-on={step <= value || undefined} />
        ))}
      </span>
    </span>
  )
}

/** The accuracy + speed pair, which is always read together. */
export function ModelRatings({
  accuracy,
  speed,
  active = false
}: {
  accuracy: number
  speed: number
  active?: boolean
}): React.JSX.Element {
  return (
    <span className="wb-vmeters">
      <ModelMeter label={t('voice.meterAccuracy')} value={accuracy} active={active} />
      <ModelMeter label={t('voice.meterSpeed')} value={speed} active={active} />
    </span>
  )
}
