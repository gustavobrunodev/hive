import type { ComponentPropsWithoutRef } from "react";
import "./CodeBlock.css";
export interface CorProps extends ComponentPropsWithoutRef<"span"> {
}
export declare function Cor({ children }: CorProps): import("react").JSX.Element;
export interface CmtProps extends ComponentPropsWithoutRef<"span"> {
}
export declare function Cmt({ children }: CmtProps): import("react").JSX.Element;
export interface CodeBlockProps extends ComponentPropsWithoutRef<"div"> {
    copyText?: string;
    copyLabel?: string;
    copiedLabel?: string;
}
export declare function CodeBlock({ copyText, copyLabel, copiedLabel, className, children, ...rest }: CodeBlockProps): import("react").JSX.Element;
