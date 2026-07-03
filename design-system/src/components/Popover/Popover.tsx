import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cx } from "../../utils/cx"
import "./Popover.css"

/**
 * Accessible popover — wraps Radix's `Popover.Root`. Delegates open/close
 * state, focus handling (move-in on open, restore on close), Escape/
 * outside-click dismiss, and edge-aware positioning to Radix (design.md's
 * D1 / spec.md's Req P1 Overlays AC1-3); this layer supplies tokenized
 * styling only.
 */
export const Popover = PopoverPrimitive.Root

/** Element that toggles the popover open/closed. */
export const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * Optional alternate positioning reference — lets the popover anchor to an
 * element other than its trigger (e.g. a text selection or list row).
 */
export const PopoverAnchor = PopoverPrimitive.Anchor

/** Any element inside `PopoverContent` that should close the popover on click. */
export const PopoverClose = PopoverPrimitive.Close

export type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>

/**
 * The floating panel itself — portalled above app content on `--z-overlay`,
 * tokenized surface/border/shadow, and an `Arrow` styled to match the
 * surface. `avoidCollisions`/`collisionPadding` are left at Radix's
 * defaults (both on) so the popover flips/shifts to stay in the viewport
 * instead of clipping against an overflow ancestor (spec.md AC3).
 */
export const PopoverContent = forwardRef<ElementRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
  function PopoverContent({ className, sideOffset = 8, collisionPadding = 8, children, ...rest }, ref) {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx("hds-popover-content", className)}
          {...rest}
        >
          {children}
          <PopoverPrimitive.Arrow className="hds-popover-arrow" width={12} height={6} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    )
  }
)

PopoverContent.displayName = "PopoverContent"
