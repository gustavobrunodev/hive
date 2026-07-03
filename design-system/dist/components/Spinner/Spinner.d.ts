import React from "react";
import "./Spinner.css";
export type SpinnerSize = "sm" | "md" | "lg";
export type SpinnerProps = {
    /** Named scale (`"sm" | "md" | "lg"`) or an exact pixel size. Defaults to `"md"` (24px). */
    size?: number | SpinnerSize;
    /**
     * Accessible name for the `role="status"` region. Rendered via
     * `VisuallyHidden` (clipped from sighted view, present in the a11y tree)
     * so screen readers announce it without a redundant visible text label
     * next to the visual spinner. Defaults to `"Loading"`.
     */
    label?: string;
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">;
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
export declare function Spinner({ size, label, className, style, ...rest }: SpinnerProps): React.JSX.Element;
