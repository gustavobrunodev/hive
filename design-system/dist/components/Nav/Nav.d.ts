import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Nav.css";
export interface NavLink {
    /** Destination URL for the link. */
    href: string;
    /** Link text/content. */
    label: ReactNode;
}
export interface NavCta {
    /** Destination URL; rendered via `Button`'s `href` prop (so it's an `<a>`, not a `<button>`). */
    href: string;
    /** Button text/content. */
    label: ReactNode;
}
export interface NavProps extends ComponentPropsWithoutRef<"header"> {
    /** Text/content next to the mark, inside the brand link. */
    brand?: ReactNode;
    /** Destination for the brand link (mark + `brand`). Defaults to `"#top"`. */
    brandHref?: string;
    /** Primary nav links, rendered left-to-right after the brand and before the CTA. Omit/empty hides the links row entirely (and on narrow viewports, Nav.css hides it regardless — pair with a separate mobile menu if needed). */
    links?: NavLink[];
    /** Single call-to-action button, right-aligned after the links. Omit to render no CTA. */
    cta?: NavCta;
}
export declare function Nav({ brand, brandHref, links, cta, className, ...rest }: NavProps): import("react").JSX.Element;
