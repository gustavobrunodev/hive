import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden"
import "./TypingIndicator.css"

export interface TypingIndicatorProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Accessible status text, rendered via `VisuallyHidden`. Defaults to `"Assistant is responding"`. */
  label?: string
}

/**
 * Three-dot "assistant is typing" indicator — `role="status"` announces
 * `label` to screen readers (spec.md's P3 AC2); the bounce animation
 * collapses to a static state under `prefers-reduced-motion`.
 */
export function TypingIndicator({ label = "Assistant is responding", className, ...rest }: TypingIndicatorProps) {
  return (
    <span role="status" className={cx("hds-typing-indicator", className)} {...rest}>
      <span className="hds-typing-indicator-dot" aria-hidden="true" />
      <span className="hds-typing-indicator-dot" aria-hidden="true" />
      <span className="hds-typing-indicator-dot" aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}
