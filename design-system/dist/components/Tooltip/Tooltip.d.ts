import type { ComponentPropsWithoutRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import "./Tooltip.css";
export type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>;
/**
 * App-wide tooltip context — wraps Radix's `Tooltip.Provider`. Mount this
 * once near the root of the tree (design.md's Radix -> DS Mapping: "delay
 * defaults, tokenized bubble, arrow"); every `Tooltip` beneath it shares the
 * same open/close delay timing instead of each one starting its own clock.
 * Defaults land in the product register's expected "not instant, not
 * sluggish" range: a 350ms hover delay before first showing (Radix default
 * is 700ms, which reads as laggy for a keyboard-heavy desktop app), and a
 * 300ms grace window (Radix default) where moving between adjacent triggers
 * skips the delay so scanning a toolbar doesn't re-trigger the wait each time.
 */
export declare function TooltipProvider({ delayDuration, skipDelayDuration, ...rest }: TooltipProviderProps): import("react").JSX.Element;
/**
 * A single tooltip's open/close state — wraps Radix's `Tooltip.Root`. Must
 * render beneath a `TooltipProvider` ancestor.
 */
export declare const Tooltip: import("react").FC<TooltipPrimitive.TooltipProps>;
/**
 * The element that shows the tooltip on hover *and* keyboard focus (Radix
 * wires both by default — spec.md's Overlays AC4: "keyboard-reachable, focus
 * triggers it"). Renders a real `<button>` unless given `asChild` to wrap an
 * existing focusable element.
 */
export declare const TooltipTrigger: import("react").ForwardRefExoticComponent<TooltipPrimitive.TooltipTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;
/**
 * The floating hint bubble — portalled above app content on `--z-tooltip`
 * (the top of the shared z-index scale), tokenized surface/border/shadow-1,
 * with an `Arrow` styled to match. Radix wires `role="tooltip"` and
 * `aria-describedby` on the trigger automatically (spec.md AC4) — this layer
 * only supplies visual styling on top, never a parallel a11y implementation.
 * `avoidCollisions` is left at Radix's default (on) so the bubble flips/
 * shifts to stay in the viewport (spec.md AC3).
 */
export declare const TooltipContent: import("react").ForwardRefExoticComponent<Omit<TooltipPrimitive.TooltipContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
