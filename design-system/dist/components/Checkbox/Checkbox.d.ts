import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import "./Checkbox.css";
export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;
/**
 * Radix-backed Checkbox [R]. A11y/keyboard behavior (Space/Enter toggle,
 * `role="checkbox"`, `aria-checked`/`data-state`, non-focusable-when-disabled)
 * is entirely delegated to `@radix-ui/react-checkbox` — this component only
 * supplies tokenized styling on top (design.md's Folder & Convention Rules).
 */
export declare const Checkbox: React.ForwardRefExoticComponent<Omit<CheckboxPrimitive.CheckboxProps & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
