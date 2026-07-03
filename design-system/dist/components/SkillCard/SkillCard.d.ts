import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SkillCard.css";
export interface SkillGridProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function SkillGrid({ className, children, ...rest }: SkillGridProps): import("react").JSX.Element;
export interface SkillSpinePinProps {
    driveLabel?: ReactNode;
    drive?: string[];
    delegateLabel?: ReactNode;
    delegate?: string[];
}
export declare function SkillSpinePin({ driveLabel, drive, delegateLabel, delegate, }: SkillSpinePinProps): import("react").JSX.Element;
export interface SkillCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title" | "role"> {
    role?: ReactNode;
    title?: ReactNode;
    lead?: boolean;
    number?: ReactNode;
    index?: number;
}
export declare function SkillCard({ role, title, lead, number, className, children, style, index, ...rest }: SkillCardProps): import("react").JSX.Element;
