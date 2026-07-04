import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Command as CommandPrimitive } from "cmdk";
import "./Command.css";
export type CommandProps = ComponentPropsWithoutRef<typeof CommandPrimitive>;
/** The command surface itself — wraps cmdk's `Command` root. Use bare (inline, e.g. embedded in a page) or inside `CommandDialog` for a ⌘K palette. */
export declare const Command: import("react").ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild"> & {
    label?: string;
    shouldFilter?: boolean;
    filter?: (value: string, search: string, keywords?: string[]) => number;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
} & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type CommandDialogProps = ComponentPropsWithoutRef<typeof CommandPrimitive> & {
    /** Whether the palette dialog is open. Omit for uncontrolled (Radix manages state internally). */
    open?: boolean;
    /** Called with the next open state on trigger click, Escape, or outside click. */
    onOpenChange?: (open: boolean) => void;
    /** Accessible dialog title, visually hidden. Defaults to `"Command palette"`. */
    label?: string;
};
/**
 * cmdk's `Command` composed inside the DS's own `Dialog` (design.md's
 * Radix -> DS Mapping: "cmdk Command inside a DS Dialog for the ⌘K
 * palette") — reuses `Dialog`'s focus trap, Escape/outside-click dismiss,
 * explicit `aria-modal`, and z-modal stacking rather than cmdk's own
 * bundled `CommandDialog` (a second, separate Radix Dialog instance).
 */
export declare function CommandDialog({ open, onOpenChange, label, className, children, ...rest }: CommandDialogProps): import("react").JSX.Element;
export type CommandInputProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Input>;
export declare const CommandInput: import("react").ForwardRefExoticComponent<Omit<Omit<Pick<Pick<import("react").DetailedHTMLProps<import("react").InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "key" | keyof import("react").InputHTMLAttributes<HTMLInputElement>> & {
    ref?: React.Ref<HTMLInputElement>;
} & {
    asChild?: boolean;
}, "key" | "asChild" | keyof import("react").InputHTMLAttributes<HTMLInputElement>>, "onChange" | "type" | "value"> & {
    value?: string;
    onValueChange?: (search: string) => void;
} & import("react").RefAttributes<HTMLInputElement>, "ref"> & import("react").RefAttributes<HTMLInputElement>>;
export type CommandListProps = ComponentPropsWithoutRef<typeof CommandPrimitive.List>;
export declare const CommandList: import("react").ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild"> & {
    label?: string;
} & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type CommandEmptyProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>;
export declare const CommandEmpty: import("react").ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild"> & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type CommandGroupProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Group>;
export declare const CommandGroup: import("react").ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Omit<Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild">, "heading" | "value"> & {
    heading?: React.ReactNode;
    value?: string;
    forceMount?: boolean;
} & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type CommandItemProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & {
    /** Right-aligned shortcut hint slot — pair with `Kbd` (Phase 2, T33). */
    shortcut?: ReactNode;
};
export declare const CommandItem: import("react").ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Omit<Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild">, "onSelect" | "disabled" | "value"> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
} & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Right-aligned shortcut hint slot — pair with `Kbd` (Phase 2, T33). */
    shortcut?: ReactNode;
} & import("react").RefAttributes<HTMLDivElement>>;
export type CommandSeparatorProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>;
export declare const CommandSeparator: import("react").ForwardRefExoticComponent<Omit<Pick<Pick<import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof import("react").HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof import("react").HTMLAttributes<HTMLDivElement> | "asChild"> & {
    alwaysRender?: boolean;
} & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
