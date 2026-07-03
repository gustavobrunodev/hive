import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Kbd.css"

export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {}

export function Kbd({ className, children, ...rest }: KbdProps) {
  return (
    <kbd className={cx("hds-kbd", className)} {...rest}>
      {children}
    </kbd>
  )
}
