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
     * Leading visual, rendered into a reserved tile that tints with the row's
     * own highlight. `aria-hidden`: an icon beside a label it duplicates is
     * noise to a screen reader, and every icon here has a label beside it.
     */
    icon?: ReactNode;
    /**
     * A second line under the label, for a menu whose items are *choices*
     * rather than plain commands — two ways to do the same thing, where the
     * title alone cannot say which is which ("do workspace" vs "do computador").
     *
     * Unlike `shortcut`, this is NOT hidden from the accessible name: it is the
     * item's own content, and the distinction it carries is exactly what a
     * screen-reader user needs to pick the right row. Pass `textValue` when the
     * extra words would spoil Radix's type-ahead.
     */
    description?: ReactNode;
    /**
     * Right-aligned shortcut hint (e.g. "⌘K"). Rendered `aria-hidden`: it is a
     * visual reminder of a binding, not part of what the item *is*, and folding
     * it into the accessible name turns "Recortar" into "Recortar Ctrl+X" for
     * every screen-reader user and every name-based query. Announce the binding
     * with `aria-keyshortcuts` on the item instead — that attribute takes the
     * canonical key names, which this prop (localized glyphs on macOS) is not.
     */
    shortcut?: ReactNode;
};
export declare const DropdownMenuItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Tints the item as a destructive action (e.g. delete). */
    variant?: "default" | "danger";
    /**
     * Leading visual, rendered into a reserved tile that tints with the row's
     * own highlight. `aria-hidden`: an icon beside a label it duplicates is
     * noise to a screen reader, and every icon here has a label beside it.
     */
    icon?: ReactNode;
    /**
     * A second line under the label, for a menu whose items are *choices*
     * rather than plain commands — two ways to do the same thing, where the
     * title alone cannot say which is which ("do workspace" vs "do computador").
     *
     * Unlike `shortcut`, this is NOT hidden from the accessible name: it is the
     * item's own content, and the distinction it carries is exactly what a
     * screen-reader user needs to pick the right row. Pass `textValue` when the
     * extra words would spoil Radix's type-ahead.
     */
    description?: ReactNode;
    /**
     * Right-aligned shortcut hint (e.g. "⌘K"). Rendered `aria-hidden`: it is a
     * visual reminder of a binding, not part of what the item *is*, and folding
     * it into the accessible name turns "Recortar" into "Recortar Ctrl+X" for
     * every screen-reader user and every name-based query. Announce the binding
     * with `aria-keyshortcuts` on the item instead — that attribute takes the
     * canonical key names, which this prop (localized glyphs on macOS) is not.
     */
    shortcut?: ReactNode;
} & import("react").RefAttributes<HTMLDivElement>>;
/**
 * Where a selectable item shows that it is selected.
 *
 * `"leading"` is the default and the right answer for a plain list of labels:
 * the mark sits in a reserved gutter, so the labels stay aligned whether they
 * are checked or not.
 *
 * `"trailing"` is for rows that already carry a leading visual of their own —
 * a swatch, a preview, an avatar. Stacking a selection dot to the left of one
 * puts two circles in a row and makes the reader work out which one means
 * "current"; moving the mark to the far edge keeps one meaning per position,
 * which is also what the platform menus do. It becomes a check rather than a
 * dot, because at the end of a row a dot reads as a bullet.
 */
export type DropdownMenuIndicatorPlacement = "leading" | "trailing";
export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
    /** Which edge carries the selection mark. Default: `"leading"`. */
    indicator?: DropdownMenuIndicatorPlacement;
};
export declare const DropdownMenuCheckboxItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuCheckboxItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Which edge carries the selection mark. Default: `"leading"`. */
    indicator?: DropdownMenuIndicatorPlacement;
} & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuRadioGroup: import("react").ForwardRefExoticComponent<DropdownMenuPrimitive.DropdownMenuRadioGroupProps & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
    /** Which edge carries the selection mark. Default: `"leading"`. */
    indicator?: DropdownMenuIndicatorPlacement;
};
export declare const DropdownMenuRadioItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuRadioItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Which edge carries the selection mark. Default: `"leading"`. */
    indicator?: DropdownMenuIndicatorPlacement;
} & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>;
export declare const DropdownMenuSeparator: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuSeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type DropdownMenuLabelProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>;
export declare const DropdownMenuLabel: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuLabelProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
