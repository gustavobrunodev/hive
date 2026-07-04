import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Footer.css";
export interface FooterProps extends ComponentPropsWithoutRef<"footer"> {
    /** Content rendered next to the internal `BrandMark`, e.g. the product name. */
    brand?: ReactNode;
    /** Short (≤42ch) supporting line shown beside the brand block. */
    tagline?: ReactNode;
    /** Legal/utility links or text rendered in the bottom row. Omitted or empty hides the row entirely. Default: `[]`. */
    bottomItems?: ReactNode[];
}
export declare function Footer({ brand, tagline, bottomItems, className, ...rest }: FooterProps): import("react").JSX.Element;
