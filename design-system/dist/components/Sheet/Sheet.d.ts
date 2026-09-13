import type { ComponentPropsWithoutRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import "./Sheet.css";
/** An edge-anchored panel's open/close state — wraps Radix's `Dialog.Root`. */
export declare const Sheet: import("react").FC<DialogPrimitive.DialogProps>;
export declare const SheetTrigger: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const SheetClose: import("react").ForwardRefExoticComponent<DialogPrimitive.DialogCloseProps & import("react").RefAttributes<HTMLButtonElement>>;
export type SheetSide = "left" | "right" | "top" | "bottom";
export type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Which viewport edge the panel slides in from. Defaults to `"right"`. */
    side?: SheetSide;
};
/**
 * The modal surface — portalled backdrop (`--overlay`) + edge-anchored panel
 * (`--surface`, `--shadow-3`) on `--z-modal`. Radix supplies focus trap,
 * Escape/outside-click dismiss, and focus restore to the trigger on close —
 * this layer only styles on top and adds the `side` slide direction.
 *
 * Same **dismiss guard** as `DialogContent`, for the same reason: this panel
 * hosts popovers and menus too (the ingestion sheet's agent selector), and a
 * modal one of those makes every click over the panel arrive as a click on the
 * overlay. See `useSurfaceDismissGuard`.
 */
export declare const SheetContent: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Which viewport edge the panel slides in from. Defaults to `"right"`. */
    side?: SheetSide;
} & import("react").RefAttributes<HTMLDivElement>>;
export type SheetTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;
export declare const SheetTitle: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogTitleProps & import("react").RefAttributes<HTMLHeadingElement>, "ref"> & import("react").RefAttributes<HTMLHeadingElement>>;
export type SheetDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;
export declare const SheetDescription: import("react").ForwardRefExoticComponent<Omit<DialogPrimitive.DialogDescriptionProps & import("react").RefAttributes<HTMLParagraphElement>, "ref"> & import("react").RefAttributes<HTMLParagraphElement>>;
