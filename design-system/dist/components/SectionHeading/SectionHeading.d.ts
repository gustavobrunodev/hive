import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SectionHeading.css";
export type SectionHeadingProps = {
    /** Small label rendered above the heading (e.g. a section kicker). Omitted entirely when not provided — no empty slot is reserved. */
    eyebrow?: ReactNode;
    /** Supporting paragraph rendered below the rule, capped at a readable measure (~60ch). Omitted entirely when not provided. */
    lead?: ReactNode;
} & ComponentPropsWithoutRef<"div">;
export declare function SectionHeading({ eyebrow, lead, id, className, children, ...rest }: SectionHeadingProps): import("react").JSX.Element;
