import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./ModeBlock.css";
export interface ModeSplitProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function ModeSplit({ className, children, ...rest }: ModeSplitProps): import("react").JSX.Element;
export interface ModeBlockProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    label?: ReactNode;
    title?: ReactNode;
    primary?: boolean;
    items?: string[];
}
export declare function ModeBlock({ label, title, primary, items, className, children, ...rest }: ModeBlockProps): import("react").JSX.Element;
