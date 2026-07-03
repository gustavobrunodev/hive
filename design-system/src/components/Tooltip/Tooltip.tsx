import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cx } from "../../utils/cx"
import "./Tooltip.css"

export type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>

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
export function TooltipProvider({ delayDuration = 350, skipDelayDuration = 300, ...rest }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...rest} />
}

/**
 * A single tooltip's open/close state — wraps Radix's `Tooltip.Root`. Must
 * render beneath a `TooltipProvider` ancestor.
 */
export const Tooltip = TooltipPrimitive.Root

/**
 * The element that shows the tooltip on hover *and* keyboard focus (Radix
 * wires both by default — spec.md's Overlays AC4: "keyboard-reachable, focus
 * triggers it"). Renders a real `<button>` unless given `asChild` to wrap an
 * existing focusable element.
 */
export const TooltipTrigger = TooltipPrimitive.Trigger

export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>

/**
 * The floating hint bubble — portalled above app content on `--z-tooltip`
 * (the top of the shared z-index scale), tokenized surface/border/shadow-1,
 * with an `Arrow` styled to match. Radix wires `role="tooltip"` and
 * `aria-describedby` on the trigger automatically (spec.md AC4) — this layer
 * only supplies visual styling on top, never a parallel a11y implementation.
 * `avoidCollisions` is left at Radix's default (on) so the bubble flips/
 * shifts to stay in the viewport (spec.md AC3).
 */
export const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
  function TooltipContent({ className, sideOffset = 6, collisionPadding = 8, children, ...rest }, ref) {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx("hds-tooltip-content", className)}
          {...rest}
        >
          {children}
          <TooltipPrimitive.Arrow className="hds-tooltip-arrow" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    )
  }
)

TooltipContent.displayName = "TooltipContent"
