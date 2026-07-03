import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./Timeline.css";
export interface SpineLabelProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function SpineLabel({ children, ...rest }: SpineLabelProps): import("react").JSX.Element;
export interface FlowProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function Flow({ className, children, ...rest }: FlowProps): import("react").JSX.Element;
export interface StepsProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function Steps({ className, children, ...rest }: StepsProps): import("react").JSX.Element;
export interface StepSkill {
    label: string;
    he?: boolean;
}
export interface StepProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
    number?: ReactNode;
    title?: ReactNode;
    skills?: StepSkill[];
    highlight?: boolean;
    last?: boolean;
}
export declare function Step({ number, title, skills, highlight, last, className, children, ...rest }: StepProps): import("react").JSX.Element;
export interface SubstepsProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function Substeps({ className, children, ...rest }: SubstepsProps): import("react").JSX.Element;
export interface SubProps extends ComponentPropsWithoutRef<"div"> {
    label?: ReactNode;
    skill?: ReactNode;
}
export declare function Sub({ label, skill, className, children, ...rest }: SubProps): import("react").JSX.Element;
