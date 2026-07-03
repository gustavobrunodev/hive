import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cx } from "../../utils/cx"
import "./Tabs.css"

/**
 * Accessible tabbed interface — wraps Radix's `Tabs.Root`. Delegates
 * value state, `orientation`, and `activationMode` to Radix (design.md's
 * D1 / PRODUCT.md's "roving tabindex for composite widgets" navigation
 * pattern); this layer supplies tokenized styling only.
 */
export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(
  function Tabs({ className, ...rest }, ref) {
    return <TabsPrimitive.Root ref={ref} className={cx("hds-tabs", className)} {...rest} />
  }
)

Tabs.displayName = "Tabs"

/**
 * The row of triggers. `variant` picks the visual treatment: `"underline"`
 * (default) shows a bottom border under the active trigger; `"segmented"`
 * renders the list as a pill-shaped track with a solid pill behind the
 * active trigger. Radix's `Tabs.List` supplies `role="tablist"` and the
 * roving-tabindex/arrow-key navigation (`RovingFocusGroup`).
 */
export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: "underline" | "segmented"
}

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, variant = "underline", ...rest }, ref) {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={cx(
          "hds-tabs-list",
          variant === "segmented" ? "hds-tabs-list-segmented" : "hds-tabs-list-underline",
          className
        )}
        {...rest}
      />
    )
  }
)

TabsList.displayName = "TabsList"

export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>

/**
 * A single tab button. Visual states (default/hover/focus-visible/
 * active/disabled) are driven entirely by Radix's `data-state`/
 * `data-disabled` attributes in CSS — see Tabs.css.
 */
export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  function TabsTrigger({ className, ...rest }, ref) {
    return <TabsPrimitive.Trigger ref={ref} className={cx("hds-tabs-trigger", className)} {...rest} />
  }
)

TabsTrigger.displayName = "TabsTrigger"

export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>

/**
 * The panel associated with a trigger. Radix unmounts inactive panels by
 * default (no `forceMount`), so only the active panel is ever in the DOM;
 * it also zeroes the mount-in animation on first paint via an inline
 * `animationDuration` override, so the CSS fade only plays on activation
 * switches, never on initial render.
 */
export const TabsContent = forwardRef<ElementRef<typeof TabsPrimitive.Content>, TabsContentProps>(
  function TabsContent({ className, ...rest }, ref) {
    return <TabsPrimitive.Content ref={ref} className={cx("hds-tabs-content", className)} {...rest} />
  }
)

TabsContent.displayName = "TabsContent"
