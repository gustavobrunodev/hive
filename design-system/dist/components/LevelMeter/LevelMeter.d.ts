import * as React from "react";
import "./LevelMeter.css";
export interface LevelMeterProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
    /**
     * Normalized 0–1 levels, oldest first. Shorter than `bars` is fine — the
     * history fills in from the right, so a meter that has just started looks
     * like one that is running rather than one that is broken.
     */
    levels: number[];
    /** How many bars the track holds. */
    bars?: number;
    /** Accessible name. Required: an unlabelled meter is noise to a screen reader. */
    label: string;
    /**
     * Below this, the signal counts as none at all and the meter flattens. Not
     * zero: a live microphone in a silent room still reports a trickle.
     */
    silenceThreshold?: number;
}
/**
 * A bar meter for a live signal. **Numbers in, bars out** — nothing here knows
 * what a `MediaStream` or an `AnalyserNode` is, and that is deliberate: the
 * app owns the audio graph, the design system owns the picture of it. Any
 * future recorder surface can reuse this by handing over an array.
 *
 * The flat state is the point, not a fallback. A meter that idles with
 * decorative movement while nothing is being heard is worse than no meter,
 * because a timer counting up already looks identical whether a microphone is
 * capturing a voice or muted — the meter is the only thing on screen that can
 * answer "is this actually working?". So when every level is at or under
 * `silenceThreshold` the bars collapse into a single quiet rule and the
 * component says so in `data-signal="none"`.
 *
 * Motion is deliberately absent: the bars move because the data moves. There
 * are no keyframes to disable under `prefers-reduced-motion`, only a short
 * height transition that it shortens.
 */
export declare const LevelMeter: React.ForwardRefExoticComponent<LevelMeterProps & React.RefAttributes<HTMLDivElement>>;
