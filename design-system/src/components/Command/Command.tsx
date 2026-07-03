import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cx } from "../../utils/cx"
import { Dialog, DialogContent, DialogTitle } from "../Dialog/Dialog"
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden"
import "./Command.css"

export type CommandProps = ComponentPropsWithoutRef<typeof CommandPrimitive>

/** The command surface itself — wraps cmdk's `Command` root. Use bare (inline, e.g. embedded in a page) or inside `CommandDialog` for a ⌘K palette. */
export const Command = forwardRef<ElementRef<typeof CommandPrimitive>, CommandProps>(function Command(
  { className, ...rest },
  ref
) {
  return <CommandPrimitive ref={ref} className={cx("hds-command", className)} {...rest} />
})

Command.displayName = "Command"

export type CommandDialogProps = ComponentPropsWithoutRef<typeof CommandPrimitive> & {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Accessible dialog title, visually hidden. Defaults to `"Command palette"`. */
  label?: string
}

/**
 * cmdk's `Command` composed inside the DS's own `Dialog` (design.md's
 * Radix -> DS Mapping: "cmdk Command inside a DS Dialog for the ⌘K
 * palette") — reuses `Dialog`'s focus trap, Escape/outside-click dismiss,
 * explicit `aria-modal`, and z-modal stacking rather than cmdk's own
 * bundled `CommandDialog` (a second, separate Radix Dialog instance).
 */
export function CommandDialog({ open, onOpenChange, label = "Command palette", className, children, ...rest }: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hds-command-dialog-content">
        <DialogTitle asChild>
          <VisuallyHidden>{label}</VisuallyHidden>
        </DialogTitle>
        <Command className={cx("hds-command-in-dialog", className)} {...rest}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export type CommandInputProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Input>

export const CommandInput = forwardRef<ElementRef<typeof CommandPrimitive.Input>, CommandInputProps>(
  function CommandInput({ className, ...rest }, ref) {
    return (
      <div className="hds-command-input-wrap">
        <svg className="hds-command-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <CommandPrimitive.Input ref={ref} className={cx("hds-command-input", className)} {...rest} />
      </div>
    )
  }
)

CommandInput.displayName = "CommandInput"

export type CommandListProps = ComponentPropsWithoutRef<typeof CommandPrimitive.List>

export const CommandList = forwardRef<ElementRef<typeof CommandPrimitive.List>, CommandListProps>(
  function CommandList({ className, ...rest }, ref) {
    return <CommandPrimitive.List ref={ref} className={cx("hds-command-list", className)} {...rest} />
  }
)

CommandList.displayName = "CommandList"

export type CommandEmptyProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>

export const CommandEmpty = forwardRef<ElementRef<typeof CommandPrimitive.Empty>, CommandEmptyProps>(
  function CommandEmpty({ className, children = "No results found.", ...rest }, ref) {
    return (
      <CommandPrimitive.Empty ref={ref} className={cx("hds-command-empty", className)} {...rest}>
        {children}
      </CommandPrimitive.Empty>
    )
  }
)

CommandEmpty.displayName = "CommandEmpty"

export type CommandGroupProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Group>

export const CommandGroup = forwardRef<ElementRef<typeof CommandPrimitive.Group>, CommandGroupProps>(
  function CommandGroup({ className, ...rest }, ref) {
    return <CommandPrimitive.Group ref={ref} className={cx("hds-command-group", className)} {...rest} />
  }
)

CommandGroup.displayName = "CommandGroup"

export type CommandItemProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & {
  /** Right-aligned shortcut hint slot — pair with `Kbd` (Phase 2, T33). */
  shortcut?: ReactNode
}

export const CommandItem = forwardRef<ElementRef<typeof CommandPrimitive.Item>, CommandItemProps>(function CommandItem(
  { className, shortcut, children, ...rest },
  ref
) {
  return (
    <CommandPrimitive.Item ref={ref} className={cx("hds-command-item", className)} {...rest}>
      <span className="hds-command-item-label">{children}</span>
      {shortcut && <span className="hds-command-item-shortcut">{shortcut}</span>}
    </CommandPrimitive.Item>
  )
})

CommandItem.displayName = "CommandItem"

export type CommandSeparatorProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>

export const CommandSeparator = forwardRef<ElementRef<typeof CommandPrimitive.Separator>, CommandSeparatorProps>(
  function CommandSeparator({ className, ...rest }, ref) {
    return <CommandPrimitive.Separator ref={ref} className={cx("hds-command-separator", className)} {...rest} />
  }
)

CommandSeparator.displayName = "CommandSeparator"
