import { type KeyboardEvent } from "react"
import { cx } from "../../utils/cx"
import "./SwatchPicker.css"

export interface Swatch {
  /** Stable identity, compared against `value` and handed back to `onChange`. */
  id: string
  /** Accessible name for this colour — the only thing a non-sighted user gets, so it must be a real name ("Âmbar"), never a hex. */
  label: string
  /** Any CSS colour. A `var(--token)` is the intended form: the swatch then follows the theme instead of freezing one theme's value. */
  color: string
}

export interface SwatchPickerProps {
  swatches: Swatch[]
  /** The selected swatch's `id`. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the group — required, since a row of colours has no visible label of its own. */
  ariaLabel: string
  /** `"sm"` for dense rows (default), `"md"` when the picker is the point of the surface. */
  size?: "sm" | "md"
  className?: string
}

/**
 * A row of colour chips, one of which is chosen.
 *
 * A `radiogroup`, not a set of buttons: picking a colour is picking one of a
 * closed set, which is exactly what the radio pattern means — and it brings the
 * keyboard contract with it (one tab stop for the row, arrows to move, Home/End
 * for the ends) instead of making a user Tab through six chips to reach the
 * last one.
 *
 * ## The selected state is a shape, never only a colour
 *
 * The obvious design — tint the chosen chip, leave the rest plain — encodes the
 * answer in hue alone, which is unreadable to anyone who cannot separate two of
 * the hues on offer, and it is the one control where that is guaranteed to
 * matter: the whole row *is* colour. So selection is drawn as a ring plus a
 * check glyph inside the chip. The colour says which option; the ring and the
 * tick say which one is picked.
 *
 * Chips carry their colour through an inline custom property rather than a
 * class per hue, so a consumer can offer any palette — including one read from
 * user data — without the design system owning the list.
 */
export function SwatchPicker({
  swatches,
  value,
  onChange,
  ariaLabel,
  size = "sm",
  className,
}: SwatchPickerProps) {
  // Read once per render, not once per chip: it decides which chip owns the
  // group's single tab stop when `value` matches nothing.
  const selectedIndex = swatches.findIndex((swatch) => swatch.id === value)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (swatches.length === 0) return
    const current = swatches.findIndex((swatch) => swatch.id === value)
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1 + swatches.length) % swatches.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + swatches.length) % swatches.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = swatches.length - 1
    }
    const target = next === -1 ? undefined : swatches[next]
    if (!target) return
    event.preventDefault()
    onChange(target.id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("hds-swatches", `hds-swatches-${size}`, className)}
      onKeyDown={handleKeyDown}
    >
      {swatches.map((swatch) => {
        const active = swatch.id === value
        return (
          <button
            key={swatch.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={swatch.label}
            title={swatch.label}
            data-active={active || undefined}
            // One tab stop for the group — arrows move from the selected chip.
            // Falls back to the first chip so a group whose `value` matches
            // nothing is still reachable by Tab at all.
            tabIndex={active || (selectedIndex === -1 && swatch === swatches[0]) ? 0 : -1}
            className="hds-swatch"
            style={{ ["--hds-swatch" as string]: swatch.color }}
            onClick={() => onChange(swatch.id)}
          >
            <span className="hds-swatch-fill" aria-hidden="true">
              <svg className="hds-swatch-check" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8.5 6.5 11.5 12.5 5" />
              </svg>
            </span>
          </button>
        )
      })}
    </div>
  )
}
