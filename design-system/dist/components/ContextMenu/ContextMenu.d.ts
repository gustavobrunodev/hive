import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import "./ContextMenu.css";
/** A right-click action menu's open/close state — wraps Radix's `ContextMenu.Root`. */
export declare const ContextMenu: import("react").FC<ContextMenuPrimitive.ContextMenuProps>;
/**
 * Wraps the element that should respond to right-click (or the keyboard
 * context-menu key / long-press). Unlike `DropdownMenuTrigger`, this isn't a
 * click-to-open button — it's a thin pass-through, typically used with
 * `asChild` around an arbitrary target (e.g. a tree item).
 */
export declare const ContextMenuTrigger: import("react").ForwardRefExoticComponent<ContextMenuPrimitive.ContextMenuTriggerProps & import("react").RefAttributes<HTMLSpanElement>>;
export type ContextMenuContentProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>;
/** The portalled menu panel — tokenized surface on `--z-dropdown`, positioned at the pointer. */
export declare const ContextMenuContent: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type ContextMenuItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    /** Tints the item as a destructive action (e.g. delete). */
    variant?: "default" | "danger";
    /** Right-aligned shortcut hint (e.g. "⌘K"). */
    shortcut?: ReactNode;
};
export declare const ContextMenuItem: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Tints the item as a destructive action (e.g. delete). */
    variant?: "default" | "danger";
    /** Right-aligned shortcut hint (e.g. "⌘K"). */
    shortcut?: ReactNode;
} & import("react").RefAttributes<HTMLDivElement>>;
export type ContextMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>;
export declare const ContextMenuCheckboxItem: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuCheckboxItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const ContextMenuRadioGroup: import("react").ForwardRefExoticComponent<ContextMenuPrimitive.ContextMenuRadioGroupProps & import("react").RefAttributes<HTMLDivElement>>;
export type ContextMenuRadioItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>;
export declare const ContextMenuRadioItem: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuRadioItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type ContextMenuSeparatorProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>;
export declare const ContextMenuSeparator: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuSeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type ContextMenuLabelProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>;
export declare const ContextMenuLabel: import("react").ForwardRefExoticComponent<Omit<ContextMenuPrimitive.ContextMenuLabelProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
