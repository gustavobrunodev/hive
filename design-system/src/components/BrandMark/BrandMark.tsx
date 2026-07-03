import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./BrandMark.css"

export interface BrandMarkProps extends ComponentPropsWithoutRef<"span"> {
  letter?: string
}

export function BrandMark({ letter = "Z", className }: BrandMarkProps) {
  return (
    <span className={cx("hds-zmark", className)}>
      <span>{letter}</span>
    </span>
  )
}
