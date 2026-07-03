import { createContext, forwardRef, useCallback, useContext, useMemo, useState } from "react"
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { cx } from "../../utils/cx"
import "./Toast.css"

export type ToastVariant = "info" | "success" | "warning" | "danger"

export type ToastProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
  /** Semantic tint. Defaults to `"info"`. */
  variant?: ToastVariant
}

/** A single toast's presentation — wraps Radix's `Toast.Root`. Rendered internally by `ToastProvider`'s `toast()`; use `useToast()` to publish one instead of rendering this directly in most cases. */
export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(function Toast(
  { className, variant = "info", ...rest },
  ref
) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cx("hds-toast", `hds-toast-${variant}`, className)}
      {...rest}
    />
  )
})

Toast.displayName = "Toast"

export type ToastTitleProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Title>

export const ToastTitle = forwardRef<ElementRef<typeof ToastPrimitive.Title>, ToastTitleProps>(function ToastTitle(
  { className, ...rest },
  ref
) {
  return <ToastPrimitive.Title ref={ref} className={cx("hds-toast-title", className)} {...rest} />
})

ToastTitle.displayName = "ToastTitle"

export type ToastDescriptionProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Description>

export const ToastDescription = forwardRef<ElementRef<typeof ToastPrimitive.Description>, ToastDescriptionProps>(
  function ToastDescription({ className, ...rest }, ref) {
    return <ToastPrimitive.Description ref={ref} className={cx("hds-toast-description", className)} {...rest} />
  }
)

ToastDescription.displayName = "ToastDescription"

export type ToastActionProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Action>

export const ToastAction = forwardRef<ElementRef<typeof ToastPrimitive.Action>, ToastActionProps>(function ToastAction(
  { className, ...rest },
  ref
) {
  return <ToastPrimitive.Action ref={ref} className={cx("hds-toast-action", className)} {...rest} />
})

ToastAction.displayName = "ToastAction"

export type ToastCloseProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Close>

export const ToastClose = forwardRef<ElementRef<typeof ToastPrimitive.Close>, ToastCloseProps>(function ToastClose(
  { className, "aria-label": ariaLabel = "Dismiss", children, ...rest },
  ref
) {
  return (
    <ToastPrimitive.Close ref={ref} aria-label={ariaLabel} className={cx("hds-toast-close", className)} {...rest}>
      {children ?? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </ToastPrimitive.Close>
  )
})

ToastClose.displayName = "ToastClose"

export type ToastViewportProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>

/** The stacking region toasts render into — positioned bottom-right, `--z-toast`. */
export const ToastViewport = forwardRef<ElementRef<typeof ToastPrimitive.Viewport>, ToastViewportProps>(
  function ToastViewport({ className, ...rest }, ref) {
    return <ToastPrimitive.Viewport ref={ref} className={cx("hds-toast-viewport", className)} {...rest} />
  }
)

ToastViewport.displayName = "ToastViewport"

export interface PublishToastOptions {
  title?: ReactNode
  description?: ReactNode
  variant?: ToastVariant
  /** Milliseconds before auto-dismiss. Defaults to 5000. */
  duration?: number
}

interface ToastRecord extends PublishToastOptions {
  id: string
}

interface ToastContextValue {
  toast: (options: PublishToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Imperative publish/dismiss API. Must be called from beneath a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

let toastIdCounter = 0
function nextToastId(): string {
  toastIdCounter += 1
  return `hds-toast-${toastIdCounter}`
}

export interface ToastProviderProps {
  children: ReactNode
  /** Forwarded to Radix's `Toast.Provider` — default toast duration for toasts that don't specify their own. */
  duration?: number
  /** Forwarded to Radix's `Toast.Provider` — viewport swipe-dismiss direction. */
  swipeDirection?: ComponentPropsWithoutRef<typeof ToastPrimitive.Provider>["swipeDirection"]
}

/**
 * App-wide toast context — composes Radix's `Toast.Provider` with an
 * internal toast-list store so `useToast()` can publish/dismiss
 * imperatively. Mount once near the root of the tree; renders its own
 * `ToastViewport`.
 */
export function ToastProvider({ children, duration = 5000, swipeDirection = "right" }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((options: PublishToastOptions) => {
    const id = nextToastId()
    setToasts((current) => [...current, { id, ...options }])
    return id
  }, [])

  const contextValue = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastPrimitive.Provider duration={duration} swipeDirection={swipeDirection}>
        {children}
        {toasts.map(({ id, title, description, variant, duration: itemDuration }) => (
          <Toast
            key={id}
            variant={variant}
            duration={itemDuration}
            onOpenChange={(open) => {
              if (!open) dismiss(id)
            }}
          >
            <div className="hds-toast-body">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
