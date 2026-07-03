import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Breadcrumb.css";
export interface BreadcrumbItemData {
    label: ReactNode;
    href?: string;
    onClick?: () => void;
}
export interface BreadcrumbItemProps extends Omit<ComponentPropsWithoutRef<"span">, "onClick"> {
    href?: string;
    onClick?: () => void;
    current?: boolean;
}
export declare function BreadcrumbItem({ href, onClick, current, className, children, ...rest }: BreadcrumbItemProps): import("react").JSX.Element;
export interface BreadcrumbProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
    items: BreadcrumbItemData[];
    maxItems?: number;
}
export declare function Breadcrumb({ items, maxItems, className, ...rest }: BreadcrumbProps): import("react").JSX.Element;
