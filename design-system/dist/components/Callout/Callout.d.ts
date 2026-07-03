import type { ComponentPropsWithoutRef } from "react";
import "./Callout.css";
export interface CalloutProps extends ComponentPropsWithoutRef<"div"> {
    variant?: "gate" | "limits";
    label?: string;
    icon?: string;
    cut?: boolean;
}
export declare function Callout({ variant, label, icon, cut, className, children, ...rest }: CalloutProps): import("react").JSX.Element;
