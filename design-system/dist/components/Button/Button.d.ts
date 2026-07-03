import React from "react";
import "./Button.css";
type AnchorProps = React.ComponentPropsWithoutRef<"a">;
type ButtonHostProps = React.ComponentPropsWithoutRef<"button">;
export type ButtonProps = {
    variant?: "primary" | "ghost";
    href?: string;
    arrow?: boolean;
    cut?: boolean;
    className?: string;
    children?: React.ReactNode;
} & Omit<AnchorProps & ButtonHostProps, "href" | "className" | "children" | "type">;
export declare function Button({ variant, href, arrow, cut, className, children, ...rest }: ButtonProps): React.JSX.Element;
export {};
