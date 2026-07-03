import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { cx } from "../../utils/cx"
import "./ContextMenu.css"

/** A right-click action menu's open/close state — wraps Radix's `ContextMenu.Root`. */
export const ContextMenu = ContextMenuPrimitive.Root

/**
 * Wraps the element that should respond to right-click (or the keyboard
 * context-menu key / long-press). Unlike `DropdownMenuTrigger`, this isn't a
 * click-to-open button — it's a thin pass-through, typically used with
 * `asChild` around an arbitrary target (e.g. a tree item).
 */
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export type ContextMenuContentProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>

/** The portalled menu panel — tokenized surface on `--z-dropdown`, positioned at the pointer. */
export const ContextMenuContent = forwardRef<ElementRef<typeof ContextMenuPrimitive.Content>, ContextMenuContentProps>(
  function ContextMenuContent({ className, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          ref={ref}
          className={cx("hds-context-menu-content", className)}
          {...rest}
        />
      </ContextMenuPrimitive.Portal>
    )
  }
)

ContextMenuContent.displayName = "ContextMenuContent"

export type ContextMenuItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  /** Tints the item as a destructive action (e.g. delete). */
  variant?: "default" | "danger"
  /** Right-aligned shortcut hint (e.g. "⌘K"). */
  shortcut?: ReactNode
}

export const ContextMenuItem = forwardRef<ElementRef<typeof ContextMenuPrimitive.Item>, ContextMenuItemProps>(
  function ContextMenuItem({ className, variant = "default", shortcut, children, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.Item
        ref={ref}
        className={cx("hds-context-menu-item", variant === "danger" && "hds-context-menu-item-danger", className)}
        {...rest}
      >
        <span className="hds-context-menu-item-label">{children}</span>
        {shortcut && <span className="hds-context-menu-shortcut">{shortcut}</span>}
      </ContextMenuPrimitive.Item>
    )
  }
)

ContextMenuItem.displayName = "ContextMenuItem"

export type ContextMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>

export const ContextMenuCheckboxItem = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  ContextMenuCheckboxItemProps
>(function ContextMenuCheckboxItem({ className, children, ...rest }, ref) {
  return (
    <ContextMenuPrimitive.CheckboxItem ref={ref} className={cx("hds-context-menu-item", className)} {...rest}>
      <span className="hds-context-menu-item-indicator">
        <ContextMenuPrimitive.ItemIndicator>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
})

ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem"

export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

export type ContextMenuRadioItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>

export const ContextMenuRadioItem = forwardRef<ElementRef<typeof ContextMenuPrimitive.RadioItem>, ContextMenuRadioItemProps>(
  function ContextMenuRadioItem({ className, children, ...rest }, ref) {
    return (
      <ContextMenuPrimitive.RadioItem ref={ref} className={cx("hds-context-menu-item", className)} {...rest}>
        <span className="hds-context-menu-item-indicator">
          <ContextMenuPrimitive.ItemIndicator>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <circle cx="4" cy="4" r="4" fill="currentColor" />
            </svg>
          </ContextMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </ContextMenuPrimitive.RadioItem>
    )
  }
)

ContextMenuRadioItem.displayName = "ContextMenuRadioItem"

export type ContextMenuSeparatorProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>

export const ContextMenuSeparator = forwardRef<ElementRef<typeof ContextMenuPrimitive.Separator>, ContextMenuSeparatorProps>(
  function ContextMenuSeparator({ className, ...rest }, ref) {
    return <ContextMenuPrimitive.Separator ref={ref} className={cx("hds-context-menu-separator", className)} {...rest} />
  }
)

ContextMenuSeparator.displayName = "ContextMenuSeparator"

export type ContextMenuLabelProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>

export const ContextMenuLabel = forwardRef<ElementRef<typeof ContextMenuPrimitive.Label>, ContextMenuLabelProps>(
  function ContextMenuLabel({ className, ...rest }, ref) {
    return <ContextMenuPrimitive.Label ref={ref} className={cx("hds-context-menu-label", className)} {...rest} />
  }
)

ContextMenuLabel.displayName = "ContextMenuLabel"
