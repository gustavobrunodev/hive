import React from "react"
import * as RadixVisuallyHidden from "@radix-ui/react-visually-hidden"

export type VisuallyHiddenProps = React.ComponentPropsWithoutRef<typeof RadixVisuallyHidden.Root>

/**
 * Content that stays in the accessibility tree (readable by screen readers,
 * focusable if the wrapped element is) while being clipped from sighted
 * view. Thin re-export over Radix's primitive — used for a11y labels on
 * icon-only controls (e.g. Spinner, icon buttons).
 */
export function VisuallyHidden({ children, ...rest }: VisuallyHiddenProps) {
  return <RadixVisuallyHidden.Root {...rest}>{children}</RadixVisuallyHidden.Root>
}
