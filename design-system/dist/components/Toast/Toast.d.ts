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
    /**
     * Set to `false` when a consumer composes its own `<Toast>`/`<ToastViewport>`
     * directly as `children` (bypassing `useToast()`, e.g. for a toast with rich
     * custom content or a non-default position) instead of publishing through
     * this provider's own imperative `toast()` API. Radix portals every
     * `Toast.Root` into whichever `Toast.Viewport` is *currently registered* in
     * context — since this provider always used to render its own default
     * viewport after `children`, a custom viewport rendered in `children` would
     * register first and then immediately lose that registration to this
     * provider's own viewport, silently portaling every toast to the wrong
     * (default bottom-right) spot. Defaults to `true` (existing behavior,
     * unchanged for every consumer using `useToast()`).
     */
    viewport?: boolean;
}
/**
 * App-wide toast context — composes Radix's `Toast.Provider` with an
 * internal toast-list store so `useToast()` can publish/dismiss
 * imperatively. Mount once near the root of the tree; renders its own
 * `ToastViewport` unless `viewport={false}` (see that prop's doc comment).
 */
export declare function ToastProvider({ children, duration, swipeDirection, viewport }: ToastProviderProps): import("react").JSX.Element;
export {};
