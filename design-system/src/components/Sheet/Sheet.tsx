import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
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
 */
export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  function SheetContent({ className, side = "right", children, ...rest }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="hds-sheet-overlay" />
        <DialogPrimitive.Content
          ref={ref}
          aria-modal="true"
          data-side={side}
          className={cx("hds-sheet-content", className)}
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
