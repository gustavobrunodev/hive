import type { ComponentPropsWithoutRef } from "react";
import "./Callout.css";
export interface CalloutProps extends ComponentPropsWithoutRef<"div"> {
    /**
     * `"gate"` renders a dashed-border, brand-tinted box with a bold leading
     * `label` (a spec/task "Gate" marker). `"limits"` (default) renders a
     * denser boxed note with a leading `icon` glyph, for scoping/caveat copy.
     */
    variant?: "gate" | "limits";
    /** Leading bold marker text for the `"gate"` variant only. Defaults to `"Gate"`. */
    label?: string;
    /** Leading glyph/character for the `"limits"` variant only. Defaults to `"!"`. */
    icon?: string;
    /** Applies the brand's clipped-corner (`cut-sm`) silhouette. `"limits"` variant only; has no effect on `"gate"`. Defaults to `false`. */
    cut?: boolean;
}
/**
 * Brand-register callout box for docs/spec-style marketing copy — a dashed
 * "Gate" marker or a boxed "limits/caveat" note. Not part of the product
 * register's semantic info/success/warning/danger vocabulary; see `Alert`
 * for that.
 */
export declare function Callout({ variant, label, icon, cut, className, children, ...rest }: CalloutProps): import("react").JSX.Element;
