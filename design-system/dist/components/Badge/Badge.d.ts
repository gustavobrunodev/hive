import type { ComponentPropsWithoutRef } from "react";
import "./Badge.css";
export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
    variant?: "accent" | "muted";
}
export declare function Badge({ variant, className, children, ...rest }: BadgeProps): import("react").JSX.Element;
