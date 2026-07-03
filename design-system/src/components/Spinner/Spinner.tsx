import React, { useState } from "react"
import { cx } from "../../utils/cx"
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden"
import "./Spinner.css"

export type SpinnerSize = "sm" | "md" | "lg"

/**
 * Pixel scale for the named sizes. `sm` fits inline next to compact text
 * (e.g. a button's own loading state), `md` is the general-purpose
 * default, `lg` suits a standalone blocking-action indicator. Pass a
 * `number` directly for anything in between or outside this scale.
 */
const SIZE_SCALE: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

export type SpinnerProps = {
  /** Named scale (`"sm" | "md" | "lg"`) or an exact pixel size. Defaults to `"md"` (24px). */
  size?: number | SpinnerSize
  /**
   * Accessible name for the `role="status"` region. Rendered via
   * `VisuallyHidden` (clipped from sighted view, present in the a11y tree)
   * so screen readers announce it without a redundant visible text label
   * next to the visual spinner. Defaults to `"Loading"`.
   */
  label?: string
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">

function resolveSize(size: number | SpinnerSize): number {
  return typeof size === "number" ? size : SIZE_SCALE[size]
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Small in-house rotating-arc indicator for an inline/blocking pending
 * action (e.g. a submitting Button's loading state). For content loading
 * in place, prefer `Skeleton` instead — per the product register, Spinner
 * is for the smaller "something is happening right now" case, not a
 * mid-content placeholder.
 *
 * Color: the arc uses `var(--accent)` by default. Override it by setting
 * the `--hds-spinner-color` custom property, either inline
 * (`style={{ "--hds-spinner-color": "var(--danger)" }}`) or via a class
 * passed through `className` — the arc's `stroke` resolves that variable
 * before falling back to `--accent`.
 *
 * Reduced motion: when `prefers-reduced-motion: reduce` is set, the arc
 * stops rotating and renders as a static partial ring instead of a
 * slowed-down spin. A non-moving indicator still communicates "pending"
 * through its shape, and the pending status remains available to
 * screen-reader users via the `role="status"` label regardless of motion.
 * Detection runs both in JS (mirrored onto `data-reduced-motion` so the
 * behavior is directly testable and applies from first render) and via a
 * `prefers-reduced-motion` CSS media query (defense-in-depth for
 * environments where the JS check can't run before paint).
 */
export function Spinner({ size = "md", label = "Loading", className, style, ...rest }: SpinnerProps) {
  const [reducedMotion] = useState(prefersReducedMotion)
  const px = resolveSize(size)

  return (
    <span
      role="status"
      className={cx("hds-spinner", className)}
      data-reduced-motion={reducedMotion ? "true" : undefined}
      style={{ width: px, height: px, ...style }}
      {...rest}
    >
      <svg
        className="hds-spinner-svg"
        viewBox="0 0 50 50"
        width={px}
        height={px}
        aria-hidden="true"
        focusable="false"
      >
        <circle className="hds-spinner-track" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
        <circle className="hds-spinner-arc" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
      </svg>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}
