import type { ComponentPropsWithoutRef } from "react";
import "./Logo.css";
type Tone = "color" | "black" | "white" | "current";
type Mark = "brain" | "simple" | "description" | "full" | "lockup" | "mark";
export interface LogoProps extends ComponentPropsWithoutRef<"span"> {
    /**
     * Color treatment of the SVG. `"current"` inherits the CSS `color` of its
     * container — the only tone that follows a theme without the caller
     * rendering one lockup per theme and hiding the wrong one. Default: "color".
     */
    tone?: Tone;
    /**
     * Which lockup to render.
     *
     * `"lockup"` is the horizontal mark-then-wordmark arrangement for app chrome
     * (a title bar has height to spare in width, not in height); `"mark"` is the
     * symbol alone. Both are cropped to the artwork, so a CSS height sets the
     * rendered height — unlike the delivered `brain`/`simple`/`description`
     * stacks, which sit on a 1408×768 canvas the artwork fills only ~20% of.
     *
     * Not every tone has every mark (e.g. `"full"` is color-only); missing
     * combinations fall back to the default simple-color mark. Default: "simple".
     */
    mark?: Mark;
}
export declare function Logo({ tone, mark, className, ...rest }: LogoProps): import("react").JSX.Element;
export {};
