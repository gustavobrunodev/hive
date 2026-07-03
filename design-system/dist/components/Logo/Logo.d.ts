import type { ComponentPropsWithoutRef } from "react";
import "./Logo.css";
type Tone = "color" | "black" | "white";
type Mark = "brain" | "simple" | "description" | "full";
export interface LogoProps extends ComponentPropsWithoutRef<"span"> {
    tone?: Tone;
    mark?: Mark;
}
export declare function Logo({ tone, mark, className, ...rest }: LogoProps): import("react").JSX.Element;
export {};
