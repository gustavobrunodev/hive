import type { ComponentPropsWithoutRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import "./Popover.css";
/**
 * Accessible popover — wraps Radix's `Popover.Root`. Delegates open/close
 * state, focus handling (move-in on open, restore on close), Escape/
 * outside-click dismiss, and edge-aware positioning to Radix (design.md's
 * D1 / spec.md's Req P1 Overlays AC1-3); this layer supplies tokenized
 * styling only.
 */
export declare const Popover: import("react").FC<PopoverPrimitive.PopoverProps>;
/** Element that toggles the popover open/closed. */
export declare const PopoverTrigger: import("react").ForwardRefExoticComponent<PopoverPrimitive.PopoverTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
/**
 * Optional alternate positioning reference — lets the popover anchor to an
 * element other than its trigger (e.g. a text selection or list row).
 */
export declare const PopoverAnchor: import("react").ForwardRefExoticComponent<PopoverPrimitive.PopoverAnchorProps & import("react").RefAttributes<HTMLDivElement>>;
/** Any element inside `PopoverContent` that should close the popover on click. */
export declare const PopoverClose: import("react").ForwardRefExoticComponent<PopoverPrimitive.PopoverCloseProps & import("react").RefAttributes<HTMLButtonElement>>;
export type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;
/**
 * The floating panel itself — portalled above app content on `--z-overlay`,
 * tokenized surface/border/shadow, and an `Arrow` styled to match the
 * surface. `avoidCollisions`/`collisionPadding` are left at Radix's
 * defaults (both on) so the popover flips/shifts to stay in the viewport
 * instead of clipping against an overflow ancestor (spec.md AC3).
 */
export declare const PopoverContent: import("react").ForwardRefExoticComponent<Omit<PopoverPrimitive.PopoverContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
