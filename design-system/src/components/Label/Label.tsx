import React from "react"
import { cx } from "../../utils/cx"
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden"
import "./Label.css"

export type LabelProps = {
  /** Marks the associated control as required and renders a visual + accessible indicator. */
  required?: boolean
} & React.ComponentPropsWithoutRef<"label">

/**
 * Thin, styleable wrapper over the native `<label>`. Pairs with a form
 * control via `htmlFor`/`id` (the full label/description/error wiring lives
 * in the `Field` composite, which composes this component).
 */
export function Label({ required = false, className, children, ...rest }: LabelProps) {
  return (
    <label className={cx("hds-label", className)} {...rest}>
      {children}
      {required && (
        <>
          <span className="hds-label-required" aria-hidden="true">
            *
          </span>
          <VisuallyHidden>(required)</VisuallyHidden>
        </>
      )}
    </label>
  )
}
