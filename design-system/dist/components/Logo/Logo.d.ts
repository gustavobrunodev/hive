import type { ComponentPropsWithoutRef } from "react";
import "./Logo.css";
type Tone = "color" | "black" | "white";
type Mark = "brain" | "simple" | "description" | "full";
export interface LogoProps extends ComponentPropsWithoutRef<"span"> {
    /** Color treatment of the SVG. Default: "color". */
    tone?: Tone;
    /** Which lockup to render. Not every tone has every mark (e.g. "full" is color-only); missing combinations fall back to the default simple-color mark. Default: "simple". */
    mark?: Mark;
}
export declare function Logo({ tone, mark, className, ...rest }: LogoProps): import("react").JSX.Element;
export {};
