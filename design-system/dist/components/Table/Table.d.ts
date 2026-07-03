import type { ComponentPropsWithoutRef } from "react";
import "./Table.css";
export interface TableProps extends ComponentPropsWithoutRef<"div"> {
    cut?: boolean;
}
export declare function Table({ cut, className, children, ...rest }: TableProps): import("react").JSX.Element;
export interface PkgProps extends ComponentPropsWithoutRef<"span"> {
}
export declare function Pkg({ className, children, ...rest }: PkgProps): import("react").JSX.Element;
export interface StackProps extends ComponentPropsWithoutRef<"span"> {
}
export declare function Stack({ className, children, ...rest }: StackProps): import("react").JSX.Element;
export interface CondProps extends ComponentPropsWithoutRef<"span"> {
}
export declare function Cond({ className, children, ...rest }: CondProps): import("react").JSX.Element;
