import type { ComponentPropsWithoutRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import "./Select.css";
/** A single-select dropdown's state — wraps Radix's `Select.Root`. */
export declare const Select: import("react").FC<SelectPrimitive.SelectProps>;
export declare const SelectGroup: import("react").ForwardRefExoticComponent<SelectPrimitive.SelectGroupProps & import("react").RefAttributes<HTMLDivElement>>;
export declare const SelectValue: import("react").ForwardRefExoticComponent<SelectPrimitive.SelectValueProps & import("react").RefAttributes<HTMLSpanElement>>;
export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;
/**
 * The closed-state control — styled like `Input` (same height/border/
 * radius/focus ring) with a chevron indicator. Opens the portalled listbox.
 */
export declare const SelectTrigger: import("react").ForwardRefExoticComponent<Omit<SelectPrimitive.SelectTriggerProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type SelectContentProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;
/**
 * The portalled listbox — tokenized surface, `--z-dropdown` stacking,
 * scroll buttons for overflowing option lists, edge-aware positioning
 * (Radix's `avoidCollisions`, on by default — spec.md's Overlays AC3).
 */
export declare const SelectContent: import("react").ForwardRefExoticComponent<Omit<SelectPrimitive.SelectContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;
/** A single option — shows a check indicator when selected (`data-state="checked"`). */
export declare const SelectItem: import("react").ForwardRefExoticComponent<Omit<SelectPrimitive.SelectItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type SelectLabelProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Label>;
export declare const SelectLabel: import("react").ForwardRefExoticComponent<Omit<SelectPrimitive.SelectLabelProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type SelectSeparatorProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;
export declare const SelectSeparator: import("react").ForwardRefExoticComponent<Omit<SelectPrimitive.SelectSeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
