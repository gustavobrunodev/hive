import * as React from "react";
import "./RingMeter.css";
export interface RingMeterSegment {
    /** Stable key, and the value of `data-seg` on the arc — how a host themes one run. */
    id: string;
    /** This run's share of the whole ring, 0–1. Shares are drawn in order from twelve o'clock. */
    value: number;
    /** Paint for this run. Omitted, it takes the built-in ramp position for its index. */
    color?: string;
}
export interface RingMeterProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
    /** How full the ring is, 0–1. Ignored when `segments` is given (their sum is the reading). */
    value?: number;
    /**
     * The filled part, broken into runs drawn end to end. Use it when the
     * occupancy has provenance — three sources of one quantity, not three
     * statuses. Anything left over stays track.
     */
    segments?: readonly RingMeterSegment[];
    /** Accessible name. Required: a ring with no name is a decoration. */
    label: string;
    /** Ring diameter in px. Everything else scales from it. */
    size?: number;
    /** Stroke width in px. Defaults to a size-proportional weight that stays legible at 14px. */
    thickness?: number;
    /**
     * Which semantic colour the fill takes. `auto` (default) is the useful one
     * here: it stays accent while there is room and turns as the ring fills, so
     * a glance answers "am I near the ceiling?" before any number is read.
     * Ignored for a segment that carries its own `color`.
     */
    tone?: "auto" | "accent" | "success" | "warning" | "danger" | "neutral";
    /** Where `auto` flips, as fractions filled: `[warning, danger]`. */
    thresholds?: readonly [number, number];
    /** The big glyph inside the ring — a percentage, a count, a duration. */
    children?: React.ReactNode;
    /** One short line under the value, inside the ring. */
    caption?: React.ReactNode;
    /** What `aria-valuetext` says, when a percentage is not the honest reading. */
    valueText?: string;
    /** Renders the track only, with no reading — the "nothing measured yet" state. */
    indeterminate?: boolean;
}
/** One drawn run: where it starts along the circumference and how long it is. */
interface Arc {
    id: string;
    offset: number;
    length: number;
    color?: string;
}
/**
 * Lays the runs out along the circumference, in order, clamped to one lap.
 *
 * The gap is subtracted from a run's own length rather than added between
 * runs, so N segments always add up to exactly the fraction they represent —
 * a ring at 100% closes, whatever it is divided into. A run too short to give
 * the gap away keeps its full length instead of vanishing: a sliver that is
 * *there* is the whole point of drawing it.
 */
export declare function ringArcs(segments: readonly RingMeterSegment[], circumference: number, gap: number): Arc[];
/**
 * A radial meter for something **filling up**: a context window, a disk, a
 * budget.
 *
 * `Progress` answers "how far along is this task?" and `Gauge` answers "how
 * much is left of something draining". This answers the third question —
 * *how full is the container* — and it exists because the two are not the
 * same picture: a countdown that turns red near zero and an occupancy that
 * turns red near the top read in opposite directions, and one component
 * doing both would need the caller to invert every threshold.
 *
 * Why a ring rather than a bar:
 *
 * - **It survives being small.** A 4px-tall bar 34px wide is a hairline that
 *   the eye files as a divider. A 16px ring with a 2.5px stroke, at the same
 *   footprint, still reads as *a dial with an amount in it* — which is what a
 *   number beside it needs to be believed.
 * - **It has no beginning.** Occupancy is a state, not a journey, and a shape
 *   read all at once says so; left-to-right implies progress towards
 *   something.
 * - **Segments stay one quantity.** Runs of one hue at descending emphasis
 *   read as provenance of a single fill, where a bar cut into blocks starts
 *   to read as separate statuses.
 *
 * Drawn as SVG circles with `stroke-dasharray`, so it costs no layout, scales
 * to any size and animates on one property.
 */
export declare const RingMeter: React.ForwardRefExoticComponent<RingMeterProps & React.RefAttributes<HTMLDivElement>>;
export {};
