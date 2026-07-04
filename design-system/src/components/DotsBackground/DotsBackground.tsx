import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"

/**
 * Decorative dot-dispersion gradient texture, absolutely positioned to fill
 * its nearest positioned ancestor. `aria-hidden`, `pointer-events: none` —
 * mount inside a `position: relative` container with real content above it.
 */
export function DotsBackground({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("dots", className)} aria-hidden="true" {...rest} />
}
