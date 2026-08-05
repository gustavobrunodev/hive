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
/**
 * Forwards its ref to the rendered `<button>`/`<a>`. Required, not a nicety:
 * every Radix `asChild` trigger (DropdownMenu, Popover, Tooltip, …) clones the
 * child through `Slot` and hands it a ref, and on React 18 a plain function
 * component silently drops it. The menu then has no anchor and Radix positions
 * it at the viewport origin — the Source Control commit split-button looked
 * dead for exactly this reason, its menu opening off-screen at (0, -180).
 */
export declare const Button: React.ForwardRefExoticComponent<{
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
} & Omit<Omit<React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, "ref"> & Omit<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref">, "className" | "children" | "href" | "type"> & React.RefAttributes<HTMLAnchorElement | HTMLButtonElement>>;
export {};
