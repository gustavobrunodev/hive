import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./ModeBlock.css";
export interface ModeSplitProps extends ComponentPropsWithoutRef<"div"> {
}
/** Side-by-side layout container for two (or more) `ModeBlock`s — e.g. contrasting "drive" vs "delegate" modes. */
export declare function ModeSplit({ className, children, ...rest }: ModeSplitProps): import("react").JSX.Element;
export interface ModeBlockProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    /** Small eyebrow label above the title (e.g. "Modo 1"). */
    label?: ReactNode;
    /** Block heading, rendered as an `<h3>`. */
    title?: ReactNode;
    /** Highlights this block as the primary/recommended one with `Panel`'s accent border. Defaults to `false`. */
    primary?: boolean;
    /** Optional bullet list rendered below `children`. Omit for no list. */
    items?: string[];
}
/** A `Panel`-based card describing one mode/approach — label, title, prose (`children`), and an optional bullet list. Typically paired inside a `ModeSplit`. */
export declare function ModeBlock({ label, title, primary, items, className, children, ...rest }: ModeBlockProps): import("react").JSX.Element;
