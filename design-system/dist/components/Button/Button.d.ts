import React from "react";
import "./Button.css";
type AnchorProps = React.ComponentPropsWithoutRef<"a">;
type ButtonHostProps = React.ComponentPropsWithoutRef<"button">;
export type ButtonProps = {
    /** Visual style: `primary` (solid accent fill) or `ghost` (outlined, transparent). Defaults to `primary`. */
    variant?: "primary" | "ghost";
    /** Renders the button as an `<a>` pointing at this URL instead of a `<button>`. Native `disabled` has no effect on a link — omit `href` for a disabled action. */
    href?: string;
    /** Appends a decorative trailing arrow glyph (`aria-hidden`) after the children. */
    arrow?: boolean;
    /** Applies the brand's clipped-corner (`cut-sm`) silhouette. Defaults to `true`; set `false` for a plain rectangular button. */
    cut?: boolean;
    className?: string;
    children?: React.ReactNode;
} & Omit<AnchorProps & ButtonHostProps, "href" | "className" | "children" | "type">;
export declare function Button({ variant, href, arrow, cut, className, children, ...rest }: ButtonProps): React.JSX.Element;
export {};
