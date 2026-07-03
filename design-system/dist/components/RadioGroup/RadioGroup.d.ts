import type { ComponentPropsWithoutRef } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import "./RadioGroup.css";
export type RadioGroupProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;
/**
 * Accessible radio group — wraps Radix's `RadioGroup.Root`. Delegates
 * roving-tabindex, arrow-key navigation, and ARIA to Radix (design.md's
 * D1 / spec.md's Req P1.6); this layer supplies tokenized styling only.
 */
export declare const RadioGroup: import("react").ForwardRefExoticComponent<Omit<RadioGroupPrimitive.RadioGroupProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type RadioGroupItemProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;
/**
 * A single radio option — wraps Radix's `RadioGroup.Item` + `Indicator`.
 * Visual states (unchecked/checked/hover/focus-visible/disabled) are driven
 * entirely by Radix's `data-state`/`data-disabled` attributes in CSS.
 */
export declare const RadioGroupItem: import("react").ForwardRefExoticComponent<Omit<RadioGroupPrimitive.RadioGroupItemProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
