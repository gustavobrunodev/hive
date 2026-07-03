import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cx } from "../../utils/cx"
import "./Separator.css"

export type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>

/**
 * A thin visual divider — wraps Radix's `Separator.Root`. Delegates
 * `orientation` (`aria-orientation`/`data-orientation`) and the
 * `decorative` a11y default (presentational, no `role`, unless explicitly
 * set to `false` which adds `role="separator"`) to Radix (design.md's D1);
 * this layer supplies tokenized styling only.
 */
export const Separator = forwardRef<ElementRef<typeof SeparatorPrimitive.Root>, SeparatorProps>(
  function Separator({ orientation = "horizontal", decorative = true, className, ...rest }, ref) {
    return (
      <SeparatorPrimitive.Root
        ref={ref}
        orientation={orientation}
        decorative={decorative}
        className={cx("hds-separator", className)}
        {...rest}
      />
    )
  }
)

Separator.displayName = "Separator"
