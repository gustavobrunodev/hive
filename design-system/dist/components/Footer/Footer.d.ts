import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Footer.css";
export interface FooterProps extends ComponentPropsWithoutRef<"footer"> {
    brand?: ReactNode;
    tagline?: ReactNode;
    bottomItems?: ReactNode[];
}
export declare function Footer({ brand, tagline, bottomItems, className, ...rest }: FooterProps): import("react").JSX.Element;
