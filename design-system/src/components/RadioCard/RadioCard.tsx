import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { useId } from "react"
import { RadioGroupItem } from "../RadioGroup/RadioGroup"
import { cx } from "../../utils/cx"
import "./RadioCard.css"

export interface RadioCardProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** The radio value this card carries. Must be unique within its `RadioGroup`. */
  value: string
  /** Whether this card is the group's current choice. Drives the card's own selected styling. */
  selected?: boolean
  disabled?: boolean
  /** Small fixed-size visual in the leading slot — an icon, a glyph tile, an avatar. */
  leading?: ReactNode
  /** The option's name. The only line that reads at full ink. */
  title: ReactNode
  /** Optional trailing marker on the title line (a `Badge`, a status chip). */
  badge?: ReactNode
  /** One supporting line under the title: what this option is, or the evidence behind it. */
  meta?: ReactNode
  /**
   * Renders `meta` as machine text — monospace, wrapping rather than
   * truncating. Paths and command lines are told apart by their tails, and an
   * ellipsis hides exactly that half.
   */
  metaMono?: boolean
  /**
   * The consequence of this choice, revealed under the row while it is
   * selected. Interactive content is allowed here: only the header is a
   * `<label>`, so a button in this region does not toggle the radio.
   */
  children?: ReactNode
  /**
   * Accessible name for the radio, overriding the one taken from `title`.
   * Needed only when `title` is not plain readable text.
   */
  "aria-label"?: string
}

/**
 * A selectable option rendered as a row rather than a bare radio: leading
 * visual, name, badge, one line of supporting evidence, and a detail region
 * that opens under the row once it is chosen.
 *
 * It exists because the bare `RadioGroupItem` is a 20px circle, and every
 * surface that offers a *consequential* choice (which terminal the agents run
 * in, which agent answers by default) had been re-implementing the same row
 * chrome around it in app CSS. The shapes drifted; this is the one shape.
 *
 * The header is the `<label>` and the detail region is outside it. That split
 * is the whole reason this can hold a disclosure or a link — inside a label,
 * every click anywhere would land on the radio.
 *
 * The radio is named by `aria-labelledby` pointing at the title, not by the
 * wrapping `<label>`: Radix renders `role="radio"` on a `<button>`, and a
 * label around a button names nothing. Without this the whole group reads out
 * as unnamed radios.
 *
 * Must be rendered inside a `RadioGroup`, which owns the roving tabindex and
 * arrow-key navigation.
 */
export function RadioCard({
  value,
  selected,
  disabled,
  leading,
  title,
  badge,
  meta,
  metaMono,
  children,
  className,
  "aria-label": ariaLabel,
  ...rest
}: RadioCardProps) {
  const titleId = useId()
  return (
    <div
      className={cx("hds-radio-card", className)}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      {...rest}
    >
      <label className="hds-radio-card-head">
        <RadioGroupItem
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel === undefined ? titleId : undefined}
        />
        {leading && (
          <span className="hds-radio-card-leading" aria-hidden="true">
            {leading}
          </span>
        )}
        <span className="hds-radio-card-body">
          <span className="hds-radio-card-title-row">
            <span className="hds-radio-card-title" id={titleId}>
              {title}
            </span>
            {badge}
          </span>
          {meta && (
            <span className="hds-radio-card-meta" data-mono={metaMono || undefined}>
              {meta}
            </span>
          )}
        </span>
      </label>
      {children && selected && <div className="hds-radio-card-detail">{children}</div>}
    </div>
  )
}
