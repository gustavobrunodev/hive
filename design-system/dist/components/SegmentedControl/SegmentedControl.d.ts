import "./SegmentedControl.css";
/** Tone of an option's trailing count badge. Omit for the neutral treatment. */
export type SegmentedTone = "neutral" | "accent" | "success" | "warning" | "danger";
export interface SegmentedOption {
    /** Stable identity, compared against `value` and passed back to `onChange`. */
    id: string;
    /** Visible label. */
    label: string;
    /** Optional trailing count. `0` renders — pass `undefined` to omit the badge entirely. */
    count?: number;
    /** Semantic tone for the count badge (e.g. `"danger"` for an error tally). */
    tone?: SegmentedTone;
    /** Renders the segment unselectable and dimmed. */
    disabled?: boolean;
}
export interface SegmentedControlProps {
    options: SegmentedOption[];
    /** The selected option's `id`. */
    value: string;
    onChange: (id: string) => void;
    /** Accessible name for the group — required, since the control has no visible label. */
    ariaLabel: string;
    /** `"sm"` for dense toolbars (default), `"md"` for standalone use. */
    size?: "sm" | "md";
    className?: string;
}
/**
 * A single-select filter/view switch: one track, one segment per option, and a
 * sliding indicator that follows the selection.
 *
 * Exposed as a `radiogroup` rather than a tablist — the segments filter a view
 * that is already on screen, they don't swap panels — which also brings the
 * keyboard contract users expect: one tab stop for the whole group, arrow keys
 * to move the selection, Home/End for the ends.
 *
 * The indicator is positioned from measured segment geometry (options size
 * themselves to their labels, so a pure-CSS thumb would need equal widths and
 * would pad short labels out of proportion). It stays hidden until a
 * measurement produces a non-zero width, so environments that don't lay out —
 * jsdom, a hidden parent — render the control without a stray bar at the
 * origin.
 */
export declare function SegmentedControl({ options, value, onChange, ariaLabel, size, className, }: SegmentedControlProps): import("react").JSX.Element;
