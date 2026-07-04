import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./PinChip.css"

export interface PinChipProps extends ComponentPropsWithoutRef<"span"> {
  /** `"drive"` (default) marks a name the subject drives/owns; `"deleg"` marks one they delegate to. */
  variant?: "drive" | "deleg"
}

/** Small pill for a single name pinned to a drive/delegate role, used inside `SkillSpinePin`'s rows. */
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
