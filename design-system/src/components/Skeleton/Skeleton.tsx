import { forwardRef } from "react"
import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Skeleton.css"

export interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {}

/**
 * Synchronous, SSR-safe read of the reduced-motion preference. Mirrors
 * useReveal's check but is invoked directly in render (no effect/state)
 * since a skeleton has nothing else that depends on lifecycle timing —
 * it only needs the class present on first paint.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * A flexible loading-placeholder block. Not a fixed set of shapes — consumers
 * compose their own (a text line, an avatar circle, a card) by setting
 * `width`/`height`/`className`/inline `style` (e.g. `borderRadius: "50%"` for
 * a circular avatar skeleton). Renders a shimmer sweep across the two
 * "sunken" surface roles (`--surface-2` → `--surface-3`) by default.
 *
 * Accessibility: a skeleton is decorative loading chrome, not itself an
 * accessible status. It renders `role="presentation"` and `aria-hidden="true"`
 * so assistive tech skips over it entirely — duplicating a "loading"
 * announcement here would be redundant (and, with several Skeletons on
 * screen at once, noisy). If the surrounding UI needs an accessible loading
 * announcement, pair this with a `Spinner` (`role="status"`) or a live
 * region nearby; that responsibility belongs to the consumer composing the
 * loading state, not to this primitive.
 *
 * Reduced motion: when `prefers-reduced-motion: reduce` is set, the shimmer
 * sweep is replaced with a static, muted fill — no animation — both via a
 * `prefers-reduced-motion` CSS fallback (for browsers) and a matching JS
 * class computed at render time (so environments that can't evaluate the
 * media query against layout, like tests, still get the static appearance).
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, ...rest },
  ref
) {
  const reduced = prefersReducedMotion()

  return (
    <div
      ref={ref}
      className={cx("hds-skeleton", reduced && "hds-skeleton-static", className)}
      role="presentation"
      aria-hidden="true"
      {...rest}
    />
  )
})

Skeleton.displayName = "Skeleton"
