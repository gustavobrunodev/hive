import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SteppedList.css";
/**
 * Numbered vertical step list — a CSS `counter()`-driven `<ol>` with a
 * dashed connector between items. No `active`/current-step affordance is
 * built in; the numbering is purely sequential (see `SteppedListItem` for
 * per-step title/description).
 */
export interface SteppedListProps extends ComponentPropsWithoutRef<"ol"> {
}
export declare function SteppedList({ className, children, ...rest }: SteppedListProps): import("react").JSX.Element;
export interface SteppedListItemProps extends Omit<ComponentPropsWithoutRef<"li">, "title"> {
    /** Step heading, rendered above `description`. */
    title?: ReactNode;
    /** Supporting copy under `title`. */
    description?: ReactNode;
}
export declare function SteppedListItem({ title, description, className, children, ...rest }: SteppedListItemProps): import("react").JSX.Element;
