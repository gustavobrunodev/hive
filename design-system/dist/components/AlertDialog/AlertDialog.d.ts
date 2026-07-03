import type { ComponentPropsWithoutRef } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import "./AlertDialog.css";
/**
 * A confirmation dialog's open/close state — wraps Radix's
 * `AlertDialog.Root`. Unlike `Dialog`, Escape and outside-click do NOT
 * dismiss it (Radix default, spec.md's Overlays AC2): the user must choose
 * `AlertDialogAction` or `AlertDialogCancel`.
 */
export declare const AlertDialog: import("react").FC<AlertDialogPrimitive.AlertDialogProps>;
export declare const AlertDialogTrigger: import("react").ForwardRefExoticComponent<AlertDialogPrimitive.AlertDialogTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export type AlertDialogContentProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>;
export declare const AlertDialogContent: import("react").ForwardRefExoticComponent<Omit<AlertDialogPrimitive.AlertDialogContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type AlertDialogTitleProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>;
export declare const AlertDialogTitle: import("react").ForwardRefExoticComponent<Omit<AlertDialogPrimitive.AlertDialogTitleProps & import("react").RefAttributes<HTMLHeadingElement>, "ref"> & import("react").RefAttributes<HTMLHeadingElement>>;
export type AlertDialogDescriptionProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>;
export declare const AlertDialogDescription: import("react").ForwardRefExoticComponent<Omit<AlertDialogPrimitive.AlertDialogDescriptionProps & import("react").RefAttributes<HTMLParagraphElement>, "ref"> & import("react").RefAttributes<HTMLParagraphElement>>;
export type AlertDialogActionProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    /** Tints the action as a destructive/danger operation (e.g. delete). */
    variant?: "default" | "danger";
};
export declare const AlertDialogAction: import("react").ForwardRefExoticComponent<Omit<AlertDialogPrimitive.AlertDialogActionProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & {
    /** Tints the action as a destructive/danger operation (e.g. delete). */
    variant?: "default" | "danger";
} & import("react").RefAttributes<HTMLButtonElement>>;
export type AlertDialogCancelProps = ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>;
export declare const AlertDialogCancel: import("react").ForwardRefExoticComponent<Omit<AlertDialogPrimitive.AlertDialogCancelProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
