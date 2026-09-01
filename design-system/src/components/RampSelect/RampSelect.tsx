import { useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./RampSelect.css"

/** One rung of the scale. Order in the array *is* the magnitude order. */
export interface RampStep {
  /** Stable identity, compared against `value` and handed back to `onChange`. */
  id: string
  /** Short name for the rung — it sits under a ~48px column, so keep it to a word. */
  label: string
  /** One line on what choosing this rung costs or buys. Surfaced by `RampSelect` itself. */
  description?: string
  disabled?: boolean
}

export interface RampSelectProps {
  steps: RampStep[]
  /** The selected step's `id` — or `autoStep.id` when the scale is delegated. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the group — required, since the ramp has no visible title of its own. */
  ariaLabel: string
  /**
   * An "let something else decide" option, rendered *beside* the ramp rather
   * than as its first rung. A delegated scale has no magnitude, and giving it
   * the shortest bar would claim it is the lowest setting — which is a
   * different, and wrong, statement.
   */
  autoStep?: RampStep
  /** Shows the selected step's `description` under the ramp. Default `true`. */
  showDescription?: boolean
  /** Replaces the description line when nothing is selected or it has none. */
  descriptionFallback?: ReactNode
  /** `"sm"` for popovers and toolbars (default), `"md"` for a settings page. */
  size?: "sm" | "md"
  className?: string
}

/**
 * A single-select for an **ordinal** scale — a setting whose options are a
 * ladder, not a set of peers: reasoning effort, quality, compression,
 * aggressiveness.
 *
 * The difference from `SegmentedControl` is the whole reason this exists. A
 * segmented track draws every option the same size, so the order lives only in
 * the words: you have to *read* "Baixo · Médio · Alto · Extra · Máx" and know
 * the vocabulary to know which way is up. Here each rung is a bar that grows
 * across the track and the fill is **cumulative**, so the picture says three
 * things at once — where the ladder goes, where you are on it, and how much of
 * it you are asking for. That is what an ordinal control owes its user, and it
 * is what a row of equal pills cannot say.
 *
 * The scale can also be *delegated* (`autoStep`): rendered apart from the ramp,
 * because "let the tool decide" is not a rung. Choosing it empties the ramp
 * rather than filling it to some arbitrary point.
 *
 * Semantics are a `radiogroup` with one tab stop and arrow keys, matching
 * `SegmentedControl` — a user who has learned one of the two knows the other.
 */
export function RampSelect({
  steps,
  value,
  onChange,
  ariaLabel,
  autoStep,
  showDescription = true,
  descriptionFallback,
  size = "sm",
  className,
}: RampSelectProps) {
  const descriptionId = useId()
  // What the pointer is over, so the ramp can show the amount a click *would*
  // buy before it is bought. An ordinal control's whole job is to make "more"
  // legible, and previewing the fill is the cheapest way to teach the scale to
  // someone who does not yet know its vocabulary.
  const [preview, setPreview] = useState(-1)
  // The auto option is selectable and arrow-reachable like any other; it just
  // isn't part of the ramp's geometry.
  const all = autoStep ? [autoStep, ...steps] : steps
  const level = steps.findIndex((step) => step.id === value)
  const selected = all.find((step) => step.id === value) ?? null
  const description = selected?.description

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const selectable = all.filter((step) => !step.disabled)
    if (selectable.length === 0) return
    const current = selectable.findIndex((step) => step.id === value)
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = (current + 1 + selectable.length) % selectable.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = (current - 1 + selectable.length) % selectable.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = selectable.length - 1
    }
    const target = next === -1 ? undefined : selectable[next]
    if (!target) return
    event.preventDefault()
    onChange(target.id)
  }

  return (
    <div className={cx("hds-ramp", `hds-ramp-${size}`, className)}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-describedby={showDescription ? descriptionId : undefined}
        className="hds-ramp-track"
        // `delegated` empties every bar: see `autoStep`.
        data-delegated={autoStep && value === autoStep.id ? "" : undefined}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setPreview(-1)}
      >
        {autoStep && (
          <>
            <Rung
              step={autoStep}
              checked={value === autoStep.id}
              onSelect={() => onChange(autoStep.id)}
              onPreview={() => setPreview(-1)}
              glyph={<AutoGlyph />}
            />
            <span className="hds-ramp-divider" aria-hidden="true" />
          </>
        )}
        {steps.map((step, index) => (
          <Rung
            key={step.id}
            step={step}
            checked={step.id === value}
            // Cumulative: every rung up to the selected one reads as filled, so
            // the control shows an amount and not just a position.
            filled={level >= 0 && index <= level}
            preview={preview > level && index <= preview && index > level}
            onSelect={() => onChange(step.id)}
            onPreview={() => setPreview(step.disabled ? -1 : index)}
            glyph={
              <span
                className="hds-ramp-bar"
                aria-hidden="true"
                // Heights are derived, not hand-tuned: a scale that gains a
                // rung has to stay a straight climb, and six hardcoded values
                // would quietly become five wrong ones.
                style={{
                  ["--hds-ramp-height" as string]:
                    steps.length > 1 ? `${18 + (index / (steps.length - 1)) * 82}%` : "100%",
                }}
              />
            }
          />
        ))}
      </div>
      {showDescription && (
        <p className="hds-ramp-description" id={descriptionId}>
          {description ?? descriptionFallback ?? ""}
        </p>
      )}
    </div>
  )
}

function Rung({
  step,
  checked,
  filled,
  preview,
  onSelect,
  onPreview,
  glyph,
}: {
  step: RampStep
  checked: boolean
  filled?: boolean
  preview?: boolean
  onSelect: () => void
  onPreview: () => void
  glyph: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={step.disabled}
      // One tab stop for the group; arrows move from there.
      tabIndex={checked ? 0 : -1}
      className="hds-ramp-step"
      data-checked={checked || undefined}
      data-filled={filled || undefined}
      data-preview={preview || undefined}
      onClick={onSelect}
      onPointerEnter={onPreview}
    >
      <span className="hds-ramp-slot">{glyph}</span>
      <span className="hds-ramp-label">{step.label}</span>
    </button>
  )
}

/** The delegated option's mark: a dot on a rule — a scale nobody is holding. */
function AutoGlyph() {
  return (
    <svg
      className="hds-ramp-auto-glyph"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1.5 7h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <circle cx="7" cy="7" r="2.6" fill="currentColor" />
    </svg>
  )
}
