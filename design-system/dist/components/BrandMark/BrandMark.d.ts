import type { ComponentPropsWithoutRef } from "react";
import "./BrandMark.css";
export interface BrandMarkProps extends ComponentPropsWithoutRef<"span"> {
    letter?: string;
}
export declare function BrandMark({ letter, className }: BrandMarkProps): import("react").JSX.Element;
