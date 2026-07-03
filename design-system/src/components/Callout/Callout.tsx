import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Callout.css"

export interface CalloutProps extends ComponentPropsWithoutRef<"div"> {
  variant?: "gate" | "limits"
  label?: string
  icon?: string
  cut?: boolean
}

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
