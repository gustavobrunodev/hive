import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { forwardRef } from "react"
import { cx } from "../../utils/cx"
import "./Alert.css"

export type AlertVariant = "info" | "success" | "warning" | "danger"

export type AlertProps = {
  /** Semantic tint — full tinted background + matching border, no side-stripe. Defaults to `"info"`. */
  variant?: AlertVariant
  /** Optional leading icon slot, 20px box, `stroke: currentColor`. */
  icon?: ReactNode
  /** Optional heading rendered above the body content. */
  title?: ReactNode
} & ComponentPropsWithoutRef<"div">

/**
 * In-house static/inline message box for semantic state (info/success/
 * warning/danger). Per the product register's Restrained-color rule and
 * this task's own spec, Alert renders a **full tinted background +
 * matching full-perimeter border** — never a colored left stripe/accent
 * border (that treatment belongs to `Toast`, which is a transient,
 * portaled notification; Alert is inline page content).
 *
 * Role handling: no `role` is set by default. An Alert is frequently
 * static page content (a persistent inline notice, a form-level summary)
 * where an assertive/polite live-region role would be wrong or redundant
 * — the content is already in the accessibility tree at first render, so
 * announcing it as if newly injected is misleading. When an Alert *is*
 * mounted dynamically in response to an action (e.g. a submit failure),
 * the consumer should pass `role="alert"` (assertive) or `role="status"`
 * (polite) explicitly — same judgment call shadcn/ui and Radix's own
 * primitives leave to the caller rather than hardcoding.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = "info", icon, title, className, children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={cx("hds-alert", `hds-alert-${variant}`, className)} {...rest}>
      {icon && (
        <span className="hds-alert-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="hds-alert-body">
        {title && <div className="hds-alert-title">{title}</div>}
        {children && <div className="hds-alert-description">{children}</div>}
      </div>
    </div>
  )
})

Alert.displayName = "Alert"
