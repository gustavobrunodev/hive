import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cx } from "../../utils/cx"
import "./DropdownMenu.css"

/** An action menu's open/close state — wraps Radix's `DropdownMenu.Root`. */
export const DropdownMenu = DropdownMenuPrimitive.Root

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>

/** The portalled menu panel — tokenized surface on `--z-dropdown`. */
export const DropdownMenuContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Content>, DropdownMenuContentProps>(
  function DropdownMenuContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cx("hds-dropdown-menu-content", className)}
          {...rest}
        />
      </DropdownMenuPrimitive.Portal>
    )
  }
)

DropdownMenuContent.displayName = "DropdownMenuContent"

export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  /** Tints the item as a destructive action (e.g. delete). */
  variant?: "default" | "danger"
  /**
   * Right-aligned shortcut hint (e.g. "⌘K"). Rendered `aria-hidden`: it is a
   * visual reminder of a binding, not part of what the item *is*, and folding
   * it into the accessible name turns "Recortar" into "Recortar Ctrl+X" for
   * every screen-reader user and every name-based query. Announce the binding
   * with `aria-keyshortcuts` on the item instead — that attribute takes the
   * canonical key names, which this prop (localized glyphs on macOS) is not.
   */
  shortcut?: ReactNode
}

export const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, variant = "default", shortcut, children, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cx("hds-dropdown-menu-item", variant === "danger" && "hds-dropdown-menu-item-danger", className)}
        {...rest}
      >
        <span className="hds-dropdown-menu-item-label">{children}</span>
        {shortcut && <span className="hds-dropdown-menu-shortcut" aria-hidden="true">{shortcut}</span>}
      </DropdownMenuPrimitive.Item>
    )
  }
)

DropdownMenuItem.displayName = "DropdownMenuItem"

export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(function DropdownMenuCheckboxItem({ className, children, ...rest }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} className={cx("hds-dropdown-menu-item", className)} {...rest}>
      <span className="hds-dropdown-menu-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
})

DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>

export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.RadioItem>, DropdownMenuRadioItemProps>(
  function DropdownMenuRadioItem({ className, children, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.RadioItem ref={ref} className={cx("hds-dropdown-menu-item", className)} {...rest}>
        <span className="hds-dropdown-menu-item-indicator">
          <DropdownMenuPrimitive.ItemIndicator>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <circle cx="4" cy="4" r="4" fill="currentColor" />
            </svg>
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    )
  }
)

DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>

export const DropdownMenuSeparator = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Separator>, DropdownMenuSeparatorProps>(
  function DropdownMenuSeparator({ className, ...rest }, ref) {
    return <DropdownMenuPrimitive.Separator ref={ref} className={cx("hds-dropdown-menu-separator", className)} {...rest} />
  }
)

DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export type DropdownMenuLabelProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>

export const DropdownMenuLabel = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Label>, DropdownMenuLabelProps>(
  function DropdownMenuLabel({ className, ...rest }, ref) {
    return <DropdownMenuPrimitive.Label ref={ref} className={cx("hds-dropdown-menu-label", className)} {...rest} />
  }
)

DropdownMenuLabel.displayName = "DropdownMenuLabel"
