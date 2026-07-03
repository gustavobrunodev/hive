import type { ComponentPropsWithoutRef, ElementType } from "react";
import "./Panel.css";
export interface PanelProps extends ComponentPropsWithoutRef<"div"> {
    as?: ElementType;
    cut?: boolean;
    hover?: "none" | "lift" | "slide";
    accentBorder?: boolean;
}
export declare function Panel({ as: Tag, cut, hover, accentBorder, className, children, ...rest }: PanelProps): import("react").JSX.Element;
