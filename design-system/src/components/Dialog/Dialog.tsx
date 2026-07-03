import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cx } from "../../utils/cx"
import "./Dialog.css"

/** A modal dialog's open/close state — wraps Radix's `Dialog.Root`. */
export const Dialog = DialogPrimitive.Root

export const DialogTrigger = DialogPrimitive.Trigger

export const DialogClose = DialogPrimitive.Close

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Applies the brand register's diagonal-cut corner clip-path instead of a plain rounded corner. Off by default (product register). */
  cut?: boolean
}

/**
 * The modal surface — portalled backdrop (`--overlay`) + centered panel
 * (`--surface`, `--shadow-3`) on `--z-modal`. Radix supplies focus trap,
 * Escape/outside-click dismiss, and focus restore to the trigger on close
 * (spec.md's Overlays AC1/AC2) — this layer only styles on top.
 */
export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  function DialogContent({ className, cut = false, children, ...rest }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="hds-dialog-overlay" />
        <DialogPrimitive.Content
          ref={ref}
          aria-modal="true"
          className={cx("hds-dialog-content", cut && "cut-sm", className)}
          {...rest}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)

DialogContent.displayName = "DialogContent"

export type DialogTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>

export const DialogTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, DialogTitleProps>(
  function DialogTitle({ className, ...rest }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cx("hds-dialog-title", className)} {...rest} />
  }
)

DialogTitle.displayName = "DialogTitle"

export type DialogDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>

export const DialogDescription = forwardRef<ElementRef<typeof DialogPrimitive.Description>, DialogDescriptionProps>(
  function DialogDescription({ className, ...rest }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cx("hds-dialog-description", className)} {...rest} />
  }
)

DialogDescription.displayName = "DialogDescription"
