import { type ReactNode } from "react";
import "./RampSelect.css";
/** One rung of the scale. Order in the array *is* the magnitude order. */
export interface RampStep {
    /** Stable identity, compared against `value` and handed back to `onChange`. */
    id: string;
    /** Short name for the rung — it sits under a ~48px column, so keep it to a word. */
    label: string;
    /** One line on what choosing this rung costs or buys. Surfaced by `RampSelect` itself. */
    description?: string;
    disabled?: boolean;
}
export interface RampSelectProps {
    steps: RampStep[];
    /** The selected step's `id` — or `autoStep.id` when the scale is delegated. */
    value: string;
    onChange: (id: string) => void;
    /** Accessible name for the group — required, since the ramp has no visible title of its own. */
    ariaLabel: string;
    /**
     * An "let something else decide" option, rendered *beside* the ramp rather
     * than as its first rung. A delegated scale has no magnitude, and giving it
     * the shortest bar would claim it is the lowest setting — which is a
     * different, and wrong, statement.
     */
    autoStep?: RampStep;
    /** Shows the selected step's `description` under the ramp. Default `true`. */
    showDescription?: boolean;
    /** Replaces the description line when nothing is selected or it has none. */
    descriptionFallback?: ReactNode;
    /** `"sm"` for popovers and toolbars (default), `"md"` for a settings page. */
    size?: "sm" | "md";
    className?: string;
}
/**
 * A single-select for an **ordinal** scale — a setting whose options are a
 * ladder, not a set of peers: reasoning effort, quality, compression,
 * aggressiveness.
 *
 * The difference from `SegmentedControl` is the whole reason this exists. A
 * segmented track draws every option the same size, so the order lives only in
 * the words: you have to *read* "Baixo · Médio · Alto · Extra · Máx" and know
 * the vocabulary to know which way is up. Here each rung is a bar that grows
 * across the track and the fill is **cumulative**, so the picture says three
 * things at once — where the ladder goes, where you are on it, and how much of
 * it you are asking for. That is what an ordinal control owes its user, and it
 * is what a row of equal pills cannot say.
 *
 * The scale can also be *delegated* (`autoStep`): rendered apart from the ramp,
 * because "let the tool decide" is not a rung. Choosing it empties the ramp
 * rather than filling it to some arbitrary point.
 *
 * Semantics are a `radiogroup` with one tab stop and arrow keys, matching
 * `SegmentedControl` — a user who has learned one of the two knows the other.
 */
export declare function RampSelect({ steps, value, onChange, ariaLabel, autoStep, showDescription, descriptionFallback, size, className, }: RampSelectProps): import("react").JSX.Element;
