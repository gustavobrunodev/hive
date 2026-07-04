import type { ComponentPropsWithoutRef } from "react";
import "./Badge.css";
export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
    /**
     * Tone: `"accent"` (brand-colored, default) for a highlighted/primary
     * label, `"muted"` for a quieter/secondary label (e.g. a mode or category
     * tag riding alongside a card's main content).
     */
    variant?: "accent" | "muted";
}
/** Small inline tag for a single short label — a mode, status, or category. */
export declare function Badge({ variant, className, children, ...rest }: BadgeProps): import("react").JSX.Element;
