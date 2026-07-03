import type { ComponentPropsWithoutRef } from "react";
import "./Skeleton.css";
export interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {
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
export declare const Skeleton: import("react").ForwardRefExoticComponent<SkeletonProps & import("react").RefAttributes<HTMLDivElement>>;
