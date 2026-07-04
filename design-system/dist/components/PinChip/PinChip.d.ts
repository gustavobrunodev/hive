import type { ComponentPropsWithoutRef } from "react";
import "./PinChip.css";
export interface PinChipProps extends ComponentPropsWithoutRef<"span"> {
    /** `"drive"` (default) marks a name the subject drives/owns; `"deleg"` marks one they delegate to. */
    variant?: "drive" | "deleg";
}
/** Small pill for a single name pinned to a drive/delegate role, used inside `SkillSpinePin`'s rows. */
export declare function PinChip({ variant, className, children, ...rest }: PinChipProps): import("react").JSX.Element;
