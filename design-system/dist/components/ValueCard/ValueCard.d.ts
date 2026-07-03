import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./ValueCard.css";
export interface ValueGridProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function ValueGrid({ className, children, ...rest }: ValueGridProps): import("react").JSX.Element;
export interface ValueCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    kicker?: ReactNode;
    title?: ReactNode;
    index?: number;
}
export declare function ValueCard({ kicker, title, className, children, style, index, ...rest }: ValueCardProps): import("react").JSX.Element;
