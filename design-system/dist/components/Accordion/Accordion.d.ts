import type { ComponentPropsWithoutRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import "./Accordion.css";
export type AccordionProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>;
/**
 * A vertically-stacked set of collapsible sections — wraps Radix's
 * `Accordion.Root`. `type` (`"single" | "multiple"`) has no implicit
 * default in Radix and is left required here so a consumer always makes an
 * explicit choice between "one section open at a time" and "any number open
 * simultaneously"; `collapsible`/`value`/`defaultValue`/`onValueChange` pass
 * straight through. Roving-tabindex keyboard nav between triggers
 * (ArrowUp/ArrowDown/Home/End) is delegated to Radix (design.md's D1).
 */
export declare const Accordion: import("react").ForwardRefExoticComponent<AccordionProps & import("react").RefAttributes<HTMLDivElement>>;
export type AccordionItemProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>;
/** A single collapsible section. `disabled` removes the item's trigger from interaction and the tab order (Radix sets the native `disabled` attribute). */
export declare const AccordionItem: import("react").ForwardRefExoticComponent<Omit<AccordionPrimitive.AccordionItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type AccordionTriggerProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>;
/**
 * The always-visible header of an `AccordionItem` — wraps Radix's
 * `Accordion.Header` + `Accordion.Trigger`. Renders a trailing chevron that
 * rotates 180° on `data-state="open"`.
 */
export declare const AccordionTrigger: import("react").ForwardRefExoticComponent<Omit<AccordionPrimitive.AccordionTriggerProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type AccordionContentProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>;
/**
 * The collapsible body of an `AccordionItem` — wraps Radix's
 * `Accordion.Content`. Radix unmounts the content from the DOM once the
 * close animation finishes, so a closed item's content is not just hidden,
 * it is absent. Height is animated from `0` to Radix's
 * `--radix-accordion-content-height` custom property (the standard Radix
 * height-transition technique); an inner wrapper carries the padding so the
 * padding box never fights the animated height. `prefers-reduced-motion:
 * reduce` collapses the animation to near-zero duration for an instant
 * show/hide instead of an animated height (Accordion.css).
 */
export declare const AccordionContent: import("react").ForwardRefExoticComponent<Omit<AccordionPrimitive.AccordionContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
