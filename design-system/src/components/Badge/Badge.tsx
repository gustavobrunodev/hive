import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Badge.css"

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  variant?: "accent" | "muted"
}

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
