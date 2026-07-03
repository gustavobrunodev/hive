import type { ComponentPropsWithoutRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import "./Dialog.css";
/** A modal dialog's open/close state — wraps Radix's `Dialog.Root`. */
export declare const Dialog: import("react").FC<DialogPrimitive.DialogProps>;
export declare const DialogTrigger: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DialogClose: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogCloseProps & import("react").RefAttributes<HTMLButtonElement>>;
export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Applies the brand register's diagonal-cut corner clip-path instead of a plain rounded corner. Off by default (product register). */
    cut?: boolean;
};
/**
 * The modal surface — portalled backdrop (`--overlay`) + centered panel
 * (`--surface`, `--shadow-3`) on `--z-modal`. Radix supplies focus trap,
 * Escape/outside-click dismiss, and focus restore to the trigger on close
 * (spec.md's Overlays AC1/AC2) — this layer only styles on top.
 */
export declare const DialogContent: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Applies the brand register's diagonal-cut corner clip-path instead of a plain rounded corner. Off by default (product register). */
    cut?: boolean;
} & import("react").RefAttributes<HTMLDivElement>>;
export type DialogTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;
export declare const DialogTitle: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogTitleProps & import("react").RefAttributes<HTMLHeadingElement>, "ref"> & import("react").RefAttributes<HTMLHeadingElement>>;
export type DialogDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;
export declare const DialogDescription: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogDescriptionProps & import("react").RefAttributes<HTMLParagraphElement>, "ref"> & import("react").RefAttributes<HTMLParagraphElement>>;
