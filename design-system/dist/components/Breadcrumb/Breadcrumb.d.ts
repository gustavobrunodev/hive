import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Breadcrumb.css";
export interface BreadcrumbItemData {
    /** Segment text/content. */
    label: ReactNode;
    /** Renders the segment as an `<a>`. Ignored on the trailing (current) item. */
    href?: string;
    /** Renders the segment as a `<button>` instead of a static `<span>`; mutually exclusive with `href` in practice (href wins if both are set). */
    onClick?: () => void;
}
export interface BreadcrumbItemProps extends Omit<ComponentPropsWithoutRef<"span">, "onClick"> {
    /** Renders as `<a href>` instead of a static `<span>`. */
    href?: string;
    /** Renders as `<button type="button">` instead of a static `<span>`. */
    onClick?: () => void;
    /** Marks this segment as the trailing, non-interactive page you're on: sets `aria-current="page"` and always renders a `<span>` regardless of `href`/`onClick`. */
    current?: boolean;
}
export declare function BreadcrumbItem({ href, onClick, current, className, children, ...rest }: BreadcrumbItemProps): import("react").JSX.Element;
export interface BreadcrumbProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
    /** Ordered trail from root to current page. The last entry always renders as the current segment (`aria-current="page"`), regardless of whether it has `href`/`onClick`. */
    items: BreadcrumbItemData[];
    /** Caps the number of rendered segments (first + ellipsis + trailing items) once `items.length` exceeds it; the first and last items are always preserved. Omit for no truncation. */
    maxItems?: number;
}
export declare function Breadcrumb({ items, maxItems, className, ...rest }: BreadcrumbProps): import("react").JSX.Element;
