import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SkillCard.css";
export interface SkillGridProps extends ComponentPropsWithoutRef<"div"> {
}
/** Responsive grid layout container for a collection of `SkillCard`s. */
export declare function SkillGrid({ className, children, ...rest }: SkillGridProps): import("react").JSX.Element;
export interface SkillSpinePinProps {
    /** Label above the "drive" row. Defaults to `"Conduz"`. */
    driveLabel?: ReactNode;
    /** Names pinned as driving/owning this skill, each rendered as a `PinChip` with `variant="drive"`. Omit or pass `[]` to hide the row entirely. */
    drive?: string[];
    /** Label above the "delegate" row. Defaults to `"Delega"`. */
    delegateLabel?: ReactNode;
    /** Names pinned as delegates for this skill, each rendered as a `PinChip` with `variant="deleg"`. Omit or pass `[]` to hide the row entirely. */
    delegate?: string[];
}
/** Two labeled rows of `PinChip`s — who drives vs. who delegates a given skill/responsibility. Standalone component, not nested inside `SkillCard`. */
export declare function SkillSpinePin({ driveLabel, drive, delegateLabel, delegate, }: SkillSpinePinProps): import("react").JSX.Element;
export interface SkillCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title" | "role"> {
    /** Small role/category label above the title. */
    role?: ReactNode;
    /** Card heading, rendered as an `<h3>`. */
    title?: ReactNode;
    /** Highlights this as the lead/primary skill with `Panel`'s accent border and an `hds-skill-lead` class. Defaults to `false`. */
    lead?: boolean;
    /** Optional number badge (e.g. "01") rendered before the role label. Omit for no number. */
    number?: ReactNode;
    /** Position within a `SkillGrid`, used to stagger this card's CSS entrance-animation delay via the `--i` custom property. Omit for no stagger. */
    index?: number;
}
/** A `Panel`-based skill card: optional number, role, title, and free-form `children` content. Typically laid out inside a `SkillGrid`. */
export declare function SkillCard({ role, title, lead, number, className, children, style, index, ...rest }: SkillCardProps): import("react").JSX.Element;
