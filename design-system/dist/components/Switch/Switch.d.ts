import type { ComponentPropsWithoutRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import "./Switch.css";
export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;
/**
 * Accessible on/off toggle — wraps Radix's `Switch.Root` + `Switch.Thumb`.
 * Delegates the button role, `checked`/keyboard (Space/Enter) toggling, and
 * `data-state`/`data-disabled` a11y wiring to Radix (design.md's D1 /
 * spec.md's Req P1.6); this layer supplies tokenized styling only.
 */
export declare const Switch: import("react").ForwardRefExoticComponent<Omit<SwitchPrimitive.SwitchProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
