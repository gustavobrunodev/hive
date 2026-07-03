import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Empty.css";
export interface EmptyProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
    /** Decorative icon slot — typically an SVG the consuming app supplies. */
    icon?: ReactNode;
    /** Headline. Required: an empty state should always teach, not just say "nothing here." */
    title: ReactNode;
    /** Supporting copy explaining what belongs here or how to fill it. */
    description?: ReactNode;
    /** CTA slot — typically a `Button`. Not opinionated about its contents. */
    action?: ReactNode;
}
/**
 * A centered placeholder for a surface with no content (empty file tree,
 * empty chat, no search results). Composes an icon, a required title, an
 * optional description, and an optional action slot so the surface teaches
 * the interface instead of rendering a blank area.
 */
export declare function Empty({ icon, title, description, action, className, ...rest }: EmptyProps): import("react").JSX.Element;
