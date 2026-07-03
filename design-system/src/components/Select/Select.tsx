import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cx } from "../../utils/cx"
import "./Select.css"

/** A single-select dropdown's state — wraps Radix's `Select.Root`. */
export const Select = SelectPrimitive.Root

export const SelectGroup = SelectPrimitive.Group

export const SelectValue = SelectPrimitive.Value

export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>

/**
 * The closed-state control — styled like `Input` (same height/border/
 * radius/focus ring) with a chevron indicator. Opens the portalled listbox.
 */
export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, SelectTriggerProps>(
  function SelectTrigger({ className, children, ...rest }, ref) {
    return (
      <SelectPrimitive.Trigger ref={ref} className={cx("hds-select-trigger", className)} {...rest}>
        {children}
        <SelectPrimitive.Icon className="hds-select-icon" asChild>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    )
  }
)

SelectTrigger.displayName = "SelectTrigger"

export type SelectContentProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Content>

/**
 * The portalled listbox — tokenized surface, `--z-dropdown` stacking,
 * scroll buttons for overflowing option lists, edge-aware positioning
 * (Radix's `avoidCollisions`, on by default — spec.md's Overlays AC3).
 */
export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, SelectContentProps>(
  function SelectContent({ className, children, position = "popper", sideOffset = 6, ...rest }, ref) {
    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          position={position}
          sideOffset={sideOffset}
          className={cx("hds-select-content", className)}
          {...rest}
        >
          <SelectPrimitive.ScrollUpButton className="hds-select-scroll-button">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="hds-select-viewport">{children}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="hds-select-scroll-button">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    )
  }
)

SelectContent.displayName = "SelectContent"

export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item>

/** A single option — shows a check indicator when selected (`data-state="checked"`). */
export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  function SelectItem({ className, children, ...rest }, ref) {
    return (
      <SelectPrimitive.Item ref={ref} className={cx("hds-select-item", className)} {...rest}>
        <span className="hds-select-item-indicator">
          <SelectPrimitive.ItemIndicator>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    )
  }
)

SelectItem.displayName = "SelectItem"

export type SelectLabelProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Label>

export const SelectLabel = forwardRef<ElementRef<typeof SelectPrimitive.Label>, SelectLabelProps>(
  function SelectLabel({ className, ...rest }, ref) {
    return <SelectPrimitive.Label ref={ref} className={cx("hds-select-label", className)} {...rest} />
  }
)

SelectLabel.displayName = "SelectLabel"

export type SelectSeparatorProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>

export const SelectSeparator = forwardRef<ElementRef<typeof SelectPrimitive.Separator>, SelectSeparatorProps>(
  function SelectSeparator({ className, ...rest }, ref) {
    return <SelectPrimitive.Separator ref={ref} className={cx("hds-select-separator", className)} {...rest} />
  }
)

SelectSeparator.displayName = "SelectSeparator"
