import type { ComponentPropsWithoutRef } from "react";
import "./PinChip.css";
export interface PinChipProps extends ComponentPropsWithoutRef<"span"> {
    variant?: "drive" | "deleg";
}
export declare function PinChip({ variant, className, children, ...rest }: PinChipProps): import("react").JSX.Element;
