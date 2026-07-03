import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SectionHeading.css";
export type SectionHeadingProps = {
    eyebrow?: ReactNode;
    lead?: ReactNode;
} & ComponentPropsWithoutRef<"div">;
export declare function SectionHeading({ eyebrow, lead, id, className, children, ...rest }: SectionHeadingProps): import("react").JSX.Element;
