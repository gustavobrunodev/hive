import type { ComponentPropsWithoutRef } from "react";
import "./Chip.css";
declare const VARIANT_CLASS: {
    readonly tag: "hds-chip-tag";
    readonly phase: "hds-chip-phase";
    readonly agent: "hds-chip-agent";
    readonly skill: "hds-chip-skill";
};
export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
    /** Visual/semantic category: `"tag"` (default, generic label), `"phase"` (workflow step, pairs with `active`), `"agent"` (agent/tool name), or `"skill"` (skill name, pairs with `tone`). */
    variant?: keyof typeof VARIANT_CLASS;
    /** Only meaningful on `variant="phase"` — marks the current/selected phase with the accent treatment. Ignored for other variants. */
    active?: boolean;
    /** Only meaningful on `variant="skill"` — pass `"he"` to apply the harness-engineer tone accent. Ignored for other variants and other tone values. */
    tone?: string;
}
/**
 * Presentational label chip, purely a styled `<span>` — it has no built-in
 * dismiss/remove affordance. For a removable chip, compose your own trailing
 * button (e.g. an icon `Button`) alongside it; `Chip` itself stays static.
 */
export declare function Chip({ variant, active, tone, className, children, ...rest }: ChipProps): import("react").JSX.Element;
export {};
