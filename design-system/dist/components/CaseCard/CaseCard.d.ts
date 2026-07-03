import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./CaseCard.css";
export interface CaseGridProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function CaseGrid({ className, children, ...rest }: CaseGridProps): import("react").JSX.Element;
export interface CaseCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    tag?: ReactNode;
    title?: ReactNode;
    prompt?: ReactNode;
    mode?: ReactNode;
    index?: number;
}
export declare function CaseCard({ tag, title, prompt, mode, className, children, style, index, ...rest }: CaseCardProps): import("react").JSX.Element;
