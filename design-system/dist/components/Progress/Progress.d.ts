import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import "./Progress.css";
export type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>;
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
export declare const Progress: React.ForwardRefExoticComponent<Omit<ProgressPrimitive.ProgressProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
