import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cx } from "../../utils/cx"
import "./Checkbox.css"

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>

/**
 * Radix-backed Checkbox [R]. A11y/keyboard behavior (Space/Enter toggle,
 * `role="checkbox"`, `aria-checked`/`data-state`, non-focusable-when-disabled)
 * is entirely delegated to `@radix-ui/react-checkbox` — this component only
 * supplies tokenized styling on top (design.md's Folder & Convention Rules).
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...rest }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={cx("hds-checkbox", className)} {...rest}>
    <CheckboxPrimitive.Indicator className="hds-checkbox-indicator">
      <svg
        className="hds-checkbox-icon hds-checkbox-icon-check"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        className="hds-checkbox-icon hds-checkbox-icon-dash"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 8H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = "Checkbox"
