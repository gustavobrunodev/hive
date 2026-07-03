import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cx } from "../../utils/cx"
import "./Switch.css"

export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>

/**
 * Accessible on/off toggle — wraps Radix's `Switch.Root` + `Switch.Thumb`.
 * Delegates the button role, `checked`/keyboard (Space/Enter) toggling, and
 * `data-state`/`data-disabled` a11y wiring to Radix (design.md's D1 /
 * spec.md's Req P1.6); this layer supplies tokenized styling only.
 */
export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch({ className, ...rest }, ref) {
    return (
      <SwitchPrimitive.Root ref={ref} className={cx("hds-switch", className)} {...rest}>
        <SwitchPrimitive.Thumb className="hds-switch-thumb" />
      </SwitchPrimitive.Root>
    )
  }
)

Switch.displayName = "Switch"
