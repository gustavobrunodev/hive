import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./ValueCard.css";
export interface ValueGridProps extends ComponentPropsWithoutRef<"div"> {
}
/** Responsive grid layout container for a collection of `ValueCard`s. */
export declare function ValueGrid({ className, children, ...rest }: ValueGridProps): import("react").JSX.Element;
export interface ValueCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    /** Small eyebrow label above the title, preceded by a decorative marker glyph. */
    kicker?: ReactNode;
    /** Card heading, rendered as an `<h3>`. */
    title?: ReactNode;
    /** Position within a `ValueGrid`, used to stagger this card's CSS entrance-animation delay via the `--i` custom property. Omit for no stagger. */
    index?: number;
}
/** A `Panel`-based value-proposition card: kicker, title, and prose (`children`). Typically laid out inside a `ValueGrid`. */
export declare function ValueCard({ kicker, title, className, children, style, index, ...rest }: ValueCardProps): import("react").JSX.Element;
