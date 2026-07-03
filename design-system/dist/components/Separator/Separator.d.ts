import type { ComponentPropsWithoutRef } from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import "./Separator.css";
export type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;
/**
 * A thin visual divider — wraps Radix's `Separator.Root`. Delegates
 * `orientation` (`aria-orientation`/`data-orientation`) and the
 * `decorative` a11y default (presentational, no `role`, unless explicitly
 * set to `false` which adds `role="separator"`) to Radix (design.md's D1);
 * this layer supplies tokenized styling only.
 */
export declare const Separator: import("react").ForwardRefExoticComponent<Omit<SeparatorPrimitive.SeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
