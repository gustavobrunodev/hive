import type { ComponentPropsWithoutRef } from "react";
import "./Terminal.css";
export interface TerminalPhase {
    label: string;
    active?: boolean;
}
export interface TerminalProps extends ComponentPropsWithoutRef<"div"> {
    title?: string;
    command?: string;
    output?: string;
    phases?: TerminalPhase[];
    cut?: boolean;
}
export declare function Terminal({ title, command, output, phases, cut, className, ...rest }: TerminalProps): import("react").JSX.Element;
