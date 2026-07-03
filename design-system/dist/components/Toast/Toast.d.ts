import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import "./Toast.css";
export type ToastVariant = "info" | "success" | "warning" | "danger";
export type ToastProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
    /** Semantic tint. Defaults to `"info"`. */
    variant?: ToastVariant;
};
/** A single toast's presentation — wraps Radix's `Toast.Root`. Rendered internally by `ToastProvider`'s `toast()`; use `useToast()` to publish one instead of rendering this directly in most cases. */
export declare const Toast: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastProps & import("react").RefAttributes<HTMLLIElement>, "ref"> & {
    /** Semantic tint. Defaults to `"info"`. */
    variant?: ToastVariant;
} & import("react").RefAttributes<HTMLLIElement>>;
export type ToastTitleProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Title>;
export declare const ToastTitle: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastTitleProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type ToastDescriptionProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Description>;
export declare const ToastDescription: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastDescriptionProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type ToastActionProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Action>;
export declare const ToastAction: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastActionProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type ToastCloseProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Close>;
export declare const ToastClose: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastCloseProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type ToastViewportProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>;
/** The stacking region toasts render into — positioned bottom-right, `--z-toast`. */
export declare const ToastViewport: import("react").ForwardRefExoticComponent<Omit<ToastPrimitive.ToastViewportProps & import("react").RefAttributes<HTMLOListElement>, "ref"> & import("react").RefAttributes<HTMLOListElement>>;
export interface PublishToastOptions {
    title?: ReactNode;
    description?: ReactNode;
    variant?: ToastVariant;
    /** Milliseconds before auto-dismiss. Defaults to 5000. */
    duration?: number;
}
interface ToastContextValue {
    toast: (options: PublishToastOptions) => string;
    dismiss: (id: string) => void;
}
/** Imperative publish/dismiss API. Must be called from beneath a `ToastProvider`. */
export declare function useToast(): ToastContextValue;
export interface ToastProviderProps {
    children: ReactNode;
    /** Forwarded to Radix's `Toast.Provider` — default toast duration for toasts that don't specify their own. */
    duration?: number;
    /** Forwarded to Radix's `Toast.Provider` — viewport swipe-dismiss direction. */
    swipeDirection?: ComponentPropsWithoutRef<typeof ToastPrimitive.Provider>["swipeDirection"];
}
/**
 * App-wide toast context — composes Radix's `Toast.Provider` with an
 * internal toast-list store so `useToast()` can publish/dismiss
 * imperatively. Mount once near the root of the tree; renders its own
 * `ToastViewport`.
 */
export declare function ToastProvider({ children, duration, swipeDirection }: ToastProviderProps): import("react").JSX.Element;
export {};
