import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import "./DropdownMenu.css";
/** An action menu's open/close state — wraps Radix's `DropdownMenu.Root`. */
export declare const DropdownMenu: import("react").FC<DropdownMenuPrimitive.DropdownMenuProps>;
export declare const DropdownMenuTrigger: import("react").ForwardRefExoticComponent<DropdownMenuPrimitive.DropdownMenuTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>;
/** The portalled menu panel — tokenized surface on `--z-dropdown`. */
export declare const DropdownMenuContent: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    /** Tints the item as a destructive action (e.g. delete). */
    variant?: "default" | "danger";
    /**
     * Right-aligned shortcut hint (e.g. "⌘K"). Plain node/string for now — the
     * real `Kbd` component (Phase 2, T33) can be swapped in later without any
     * API change here.
     */
    shortcut?: ReactNode;
};
export declare const DropdownMenuItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Tints the item as a destructive action (e.g. delete). */
    variant?: "default" | "danger";
    /**
     * Right-aligned shortcut hint (e.g. "⌘K"). Plain node/string for now — the
     * real `Kbd` component (Phase 2, T33) can be swapped in later without any
     * API change here.
     */
    shortcut?: ReactNode;
} & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>;
export declare const DropdownMenuCheckboxItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuCheckboxItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuRadioGroup: import("react").ForwardRefExoticComponent<DropdownMenuPrimitive.DropdownMenuRadioGroupProps & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>;
export declare const DropdownMenuRadioItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuRadioItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>;
export declare const DropdownMenuSeparator: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuSeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuLabelProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>;
export declare const DropdownMenuLabel: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuLabelProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
