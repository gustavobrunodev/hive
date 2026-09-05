import * as React from "react";
import "./Gauge.css";
export interface GaugeProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
    /** How full the arc is, 0–1. Values outside the range are clamped, not thrown. */
    value: number;
    /** Accessible name. Required: a ring with no name is a decoration. */
    label: string;
    /** The big glyph inside the ring — a duration, a percentage, a count. */
    children?: React.ReactNode;
    /** One word under the value, inside the ring. */
    caption?: React.ReactNode;
    /** Ring diameter in px. The stroke and inner type scale with it. */
    size?: number;
    /**
     * Which semantic colour the arc takes. `auto` (default) is the useful one
     * for a countdown: it turns from accent to warning to danger as the value
     * falls, so the ring means something before any number is read.
     */
    tone?: "auto" | "accent" | "success" | "warning" | "danger" | "neutral";
    /** What `aria-valuetext` says — a duration reads better than "43%". */
    valueText?: string;
}
/**
 * A radial meter: one arc, one number, one word.
 *
 * `Progress` answers "how far along is this task?" — a bar with a beginning
 * and an end, read left to right. This answers a different question: **how
 * much is left of something that is draining** — a session, a quota, a
 * battery. The ring is the right picture for that because it has no
 * beginning: a user glances at how much of the circle survives, exactly the
 * way they read a watch face, and the number in the middle is confirmation
 * rather than the primary reading.
 *
 * Drawn as a single SVG circle with `stroke-dasharray`, so it scales cleanly,
 * costs no layout, and animates on one property. Colour is semantic and, by
 * default, automatic — a ring that is still coral at four minutes left would
 * be a picture that lies.
 */
export declare const Gauge: React.ForwardRefExoticComponent<GaugeProps & React.RefAttributes<HTMLDivElement>>;
