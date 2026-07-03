import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { cx } from "../../utils/cx"
import "./RadioGroup.css"

export type RadioGroupProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>

/**
 * Accessible radio group — wraps Radix's `RadioGroup.Root`. Delegates
 * roving-tabindex, arrow-key navigation, and ARIA to Radix (design.md's
 * D1 / spec.md's Req P1.6); this layer supplies tokenized styling only.
 */
export const RadioGroup = forwardRef<ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  function RadioGroup({ className, ...rest }, ref) {
    return (
      <RadioGroupPrimitive.Root ref={ref} className={cx("hds-radio-group", className)} {...rest} />
    )
  }
)

RadioGroup.displayName = "RadioGroup"

export type RadioGroupItemProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>

/**
 * A single radio option — wraps Radix's `RadioGroup.Item` + `Indicator`.
 * Visual states (unchecked/checked/hover/focus-visible/disabled) are driven
 * entirely by Radix's `data-state`/`data-disabled` attributes in CSS.
 */
export const RadioGroupItem = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, RadioGroupItemProps>(
  function RadioGroupItem({ className, ...rest }, ref) {
    return (
      <RadioGroupPrimitive.Item ref={ref} className={cx("hds-radio-item", className)} {...rest}>
        <RadioGroupPrimitive.Indicator className="hds-radio-indicator" />
      </RadioGroupPrimitive.Item>
    )
  }
)

RadioGroupItem.displayName = "RadioGroupItem"
