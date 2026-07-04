import type { ComponentPropsWithoutRef } from "react";
import "./BrandMark.css";
export interface BrandMarkProps extends ComponentPropsWithoutRef<"span"> {
    /** Single character rendered inside the cut-corner tile. Default: "Z". */
    letter?: string;
}
export declare function BrandMark({ letter, className }: BrandMarkProps): import("react").JSX.Element;
