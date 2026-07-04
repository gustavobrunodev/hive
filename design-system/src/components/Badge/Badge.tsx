import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Badge.css"

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  /**
   * Tone: `"accent"` (brand-colored, default) for a highlighted/primary
   * label, `"muted"` for a quieter/secondary label (e.g. a mode or category
   * tag riding alongside a card's main content).
   */
  variant?: "accent" | "muted"
}

/** Small inline tag for a single short label — a mode, status, or category. */
export function Badge({ variant = "accent", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx("hds-badge", variant === "accent" ? "hds-badge-accent" : "hds-badge-muted", className)}
      {...rest}
    >
      {children}
    </span>
  )
}
