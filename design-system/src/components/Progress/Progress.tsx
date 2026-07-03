import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cx } from "../../utils/cx"
import "./Progress.css"

export type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>

/**
 * Wraps Radix's Progress.Root/Indicator with DS tokens.
 *
 * Determinate by default: omit `value` (or pass a number) and Radix wires
 * `role="progressbar"` plus `aria-valuenow`/`aria-valuemax` automatically,
 * with `data-state` resolving to `"loading"` (0 <= value < max) or
 * `"complete"` (value === max). Pass `value={null}` explicitly to opt into
 * the indeterminate state (`data-state="indeterminate"`, no
 * `aria-valuenow`) — the track fill becomes an animated sweep instead of a
 * fixed-width bar.
 *
 * Motion: the determinate fill's width transition and the indeterminate
 * sweep both honor `prefers-reduced-motion: reduce` (instant snap / static
 * partial fill instead of animation), per PRODUCT.md's motion budget.
 */
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value = 0, max, style, ...rest },
  ref
) {
  const resolvedMax = typeof max === "number" && max > 0 ? max : 100
  const indicatorStyle =
    typeof value === "number"
      ? { transform: `translateX(-${100 - (value / resolvedMax) * 100}%)` }
      : undefined

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cx("hds-progress", className)}
      value={value}
      max={max}
      style={style}
      {...rest}
    >
      <ProgressPrimitive.Indicator className="hds-progress-indicator" style={indicatorStyle} />
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = "Progress"
