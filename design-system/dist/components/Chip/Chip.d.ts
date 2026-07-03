import type { ComponentPropsWithoutRef } from "react";
import "./Chip.css";
declare const VARIANT_CLASS: {
    readonly tag: "hds-chip-tag";
    readonly phase: "hds-chip-phase";
    readonly agent: "hds-chip-agent";
    readonly skill: "hds-chip-skill";
};
export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
    variant?: keyof typeof VARIANT_CLASS;
    active?: boolean;
    tone?: string;
}
export declare function Chip({ variant, active, tone, className, children, ...rest }: ChipProps): import("react").JSX.Element;
export {};
