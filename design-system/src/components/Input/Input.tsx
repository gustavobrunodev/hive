import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./Input.css"

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  /** Optional leading icon rendered inside the field, before the text. */
  startIcon?: ReactNode
  /** Marks the field invalid: drives `aria-invalid` and the danger-tinted visual state. */
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { startIcon, error = false, className, ...rest },
  ref
) {
  const input = (
    <input
      ref={ref}
      className={cx("hds-input", error && "hds-input-error", !startIcon && className)}
      aria-invalid={error ? "true" : undefined}
      {...rest}
    />
  )

  if (!startIcon) {
    return input
  }

  return (
    <span className={cx("hds-input-icon", error && "hds-input-icon-error", className)}>
      <span className="hds-input-icon-slot" aria-hidden="true">
        {startIcon}
      </span>
      {input}
    </span>
  )
})

Input.displayName = "Input"
