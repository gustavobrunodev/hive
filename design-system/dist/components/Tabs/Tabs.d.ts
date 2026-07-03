import type { ComponentPropsWithoutRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import "./Tabs.css";
/**
 * Accessible tabbed interface — wraps Radix's `Tabs.Root`. Delegates
 * value state, `orientation`, and `activationMode` to Radix (design.md's
 * D1 / PRODUCT.md's "roving tabindex for composite widgets" navigation
 * pattern); this layer supplies tokenized styling only.
 */
export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;
export declare const Tabs: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
/**
 * The row of triggers. `variant` picks the visual treatment: `"underline"`
 * (default) shows a bottom border under the active trigger; `"segmented"`
 * renders the list as a pill-shaped track with a solid pill behind the
 * active trigger. Radix's `Tabs.List` supplies `role="tablist"` and the
 * roving-tabindex/arrow-key navigation (`RovingFocusGroup`).
 */
export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: "underline" | "segmented";
};
export declare const TabsList: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsListProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    variant?: "underline" | "segmented";
} & import("react").RefAttributes<HTMLDivElement>>;
export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;
/**
 * A single tab button. Visual states (default/hover/focus-visible/
 * active/disabled) are driven entirely by Radix's `data-state`/
 * `data-disabled` attributes in CSS — see Tabs.css.
 */
export declare const TabsTrigger: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsTriggerProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;
/**
 * The panel associated with a trigger. Radix unmounts inactive panels by
 * default (no `forceMount`), so only the active panel is ever in the DOM;
 * it also zeroes the mount-in animation on first paint via an inline
 * `animationDuration` override, so the CSS fade only plays on activation
 * switches, never on initial render.
 */
export declare const TabsContent: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
