import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./PinChip.css"

export interface PinChipProps extends ComponentPropsWithoutRef<"span"> {
  variant?: "drive" | "deleg"
}

export function PinChip({ variant = "drive", className, children, ...rest }: PinChipProps) {
  return (
    <span
      className={cx("hds-pin-chip", variant === "drive" ? "hds-pin-chip-drive" : "hds-pin-chip-deleg", className)}
      {...rest}
    >
      {children}
    </span>
  )
}
