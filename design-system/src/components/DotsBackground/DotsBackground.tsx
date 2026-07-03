import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"

export function DotsBackground({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("dots", className)} aria-hidden="true" {...rest} />
}
