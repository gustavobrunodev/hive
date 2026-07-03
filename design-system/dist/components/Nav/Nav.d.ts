import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Nav.css";
export interface NavLink {
    href: string;
    label: ReactNode;
}
export interface NavCta {
    href: string;
    label: ReactNode;
}
export interface NavProps extends ComponentPropsWithoutRef<"header"> {
    brand?: ReactNode;
    brandHref?: string;
    links?: NavLink[];
    cta?: NavCta;
}
export declare function Nav({ brand, brandHref, links, cta, className, ...rest }: NavProps): import("react").JSX.Element;
