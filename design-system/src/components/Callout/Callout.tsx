import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Callout.css"

export interface CalloutProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * `"gate"` renders a dashed-border, brand-tinted box with a bold leading
   * `label` (a spec/task "Gate" marker). `"limits"` (default) renders a
   * denser boxed note with a leading `icon` glyph, for scoping/caveat copy.
   */
  variant?: "gate" | "limits"
  /** Leading bold marker text for the `"gate"` variant only. Defaults to `"Gate"`. */
  label?: string
  /** Leading glyph/character for the `"limits"` variant only. Defaults to `"!"`. */
  icon?: string
  /** Applies the brand's clipped-corner (`cut-sm`) silhouette. `"limits"` variant only; has no effect on `"gate"`. Defaults to `false`. */
  cut?: boolean
}

/**
 * Brand-register callout box for docs/spec-style marketing copy — a dashed
 * "Gate" marker or a boxed "limits/caveat" note. Not part of the product
 * register's semantic info/success/warning/danger vocabulary; see `Alert`
 * for that.
 */
export function Callout({
  variant = "limits",
  label = "Gate",
  icon = "!",
  cut = false,
  className,
  children,
  ...rest
}: CalloutProps) {
  if (variant === "gate") {
    return (
      <div className={cx("hds-callout", "hds-callout-gate", className)} {...rest}>
        <b className="hds-callout-label">{label}</b>
        <span>{children}</span>
      </div>
    )
  }
  return (
    <div className={cx("hds-callout", "hds-callout-limits", cut && "cut-sm", className)} {...rest}>
      <span className="hds-callout-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  )
}
