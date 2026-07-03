import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cx } from "../../utils/cx"
import "./AlertDialog.css"

/**
 * A confirmation dialog's open/close state — wraps Radix's
 * `AlertDialog.Root`. Unlike `Dialog`, Escape and outside-click do NOT
 * dismiss it (Radix default, spec.md's Overlays AC2): the user must choose
 * `AlertDialogAction` or `AlertDialogCancel`.
 */
export const AlertDialog = AlertDialogPrimitive.Root

export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export type AlertDialogContentProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

export const AlertDialogContent = forwardRef<ElementRef<typeof AlertDialogPrimitive.Content>, AlertDialogContentProps>(
  function AlertDialogContent({ className, children, onEscapeKeyDown, ...rest }, ref) {
    return (
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="hds-alert-dialog-overlay" />
        <AlertDialogPrimitive.Content
          ref={ref}
          aria-modal="true"
          className={cx("hds-alert-dialog-content", className)}
          // Radix's AlertDialog blocks outside-click dismiss by default but,
          // unlike outside-click, does NOT block Escape — it falls through to
          // the underlying Dialog.Content's default close-on-Escape. Override
          // it here so AlertDialog always requires an explicit button choice
          // (spec.md's Overlays AC2), while still letting a consumer observe
          // the key event via its own onEscapeKeyDown.
          onEscapeKeyDown={(event) => {
            onEscapeKeyDown?.(event)
            event.preventDefault()
          }}
          {...rest}
        >
          {children}
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    )
  }
)

AlertDialogContent.displayName = "AlertDialogContent"

export type AlertDialogTitleProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>

export const AlertDialogTitle = forwardRef<ElementRef<typeof AlertDialogPrimitive.Title>, AlertDialogTitleProps>(
  function AlertDialogTitle({ className, ...rest }, ref) {
    return <AlertDialogPrimitive.Title ref={ref} className={cx("hds-alert-dialog-title", className)} {...rest} />
  }
)

AlertDialogTitle.displayName = "AlertDialogTitle"

export type AlertDialogDescriptionProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>

export const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  AlertDialogDescriptionProps
>(function AlertDialogDescription({ className, ...rest }, ref) {
  return <AlertDialogPrimitive.Description ref={ref} className={cx("hds-alert-dialog-description", className)} {...rest} />
})

AlertDialogDescription.displayName = "AlertDialogDescription"

export type AlertDialogActionProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
  /** Tints the action as a destructive/danger operation (e.g. delete). */
  variant?: "default" | "danger"
}

export const AlertDialogAction = forwardRef<ElementRef<typeof AlertDialogPrimitive.Action>, AlertDialogActionProps>(
  function AlertDialogAction({ className, variant = "default", ...rest }, ref) {
    return (
      <AlertDialogPrimitive.Action
        ref={ref}
        className={cx("hds-alert-dialog-action", variant === "danger" && "hds-alert-dialog-action-danger", className)}
        {...rest}
      />
    )
  }
)

AlertDialogAction.displayName = "AlertDialogAction"

export type AlertDialogCancelProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>

export const AlertDialogCancel = forwardRef<ElementRef<typeof AlertDialogPrimitive.Cancel>, AlertDialogCancelProps>(
  function AlertDialogCancel({ className, ...rest }, ref) {
    return <AlertDialogPrimitive.Cancel ref={ref} className={cx("hds-alert-dialog-cancel", className)} {...rest} />
  }
)

AlertDialogCancel.displayName = "AlertDialogCancel"
