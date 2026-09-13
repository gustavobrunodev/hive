import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useSurfaceDismissGuard } from "../../hooks/useSurfaceDismissGuard"
import { cx } from "../../utils/cx"
import "./Sheet.css"

/** An edge-anchored panel's open/close state — wraps Radix's `Dialog.Root`. */
export const Sheet = DialogPrimitive.Root

export const SheetTrigger = DialogPrimitive.Trigger

export const SheetClose = DialogPrimitive.Close

export type SheetSide = "left" | "right" | "top" | "bottom"

export type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Which viewport edge the panel slides in from. Defaults to `"right"`. */
  side?: SheetSide
}

/**
 * The modal surface — portalled backdrop (`--overlay`) + edge-anchored panel
 * (`--surface`, `--shadow-3`) on `--z-modal`. Radix supplies focus trap,
 * Escape/outside-click dismiss, and focus restore to the trigger on close —
 * this layer only styles on top and adds the `side` slide direction.
 *
 * Same **dismiss guard** as `DialogContent`, for the same reason: this panel
 * hosts popovers and menus too (the ingestion sheet's agent selector), and a
 * modal one of those makes every click over the panel arrive as a click on the
 * overlay. See `useSurfaceDismissGuard`.
 */
export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  function SheetContent({ className, side = "right", children, onPointerDownOutside, ...rest }, ref) {
    const guard = useSurfaceDismissGuard<HTMLDivElement>(ref)
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="hds-sheet-overlay" />
        <DialogPrimitive.Content
          ref={guard.ref}
          aria-modal="true"
          data-side={side}
          className={cx("hds-sheet-content", className)}
          onPointerDownOutside={(event) => {
            onPointerDownOutside?.(event)
            guard.onPointerDownOutside(event)
          }}
          {...rest}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)

SheetContent.displayName = "SheetContent"

export type SheetTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>

export const SheetTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, SheetTitleProps>(
  function SheetTitle({ className, ...rest }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cx("hds-sheet-title", className)} {...rest} />
  }
)

SheetTitle.displayName = "SheetTitle"

export type SheetDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>

export const SheetDescription = forwardRef<ElementRef<typeof DialogPrimitive.Description>, SheetDescriptionProps>(
  function SheetDescription({ className, ...rest }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cx("hds-sheet-description", className)} {...rest} />
  }
)

SheetDescription.displayName = "SheetDescription"
