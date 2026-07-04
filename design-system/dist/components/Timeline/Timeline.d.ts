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
    /** Chip text, rendered via `Chip` `variant="skill"`. */
    label: string;
    /** Applies the harness-engineer tone accent to this skill's chip (`Chip`'s `tone="he"`). */
    he?: boolean;
}
export interface StepProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
    /** Content of the rail node (typically a step index, e.g. `"01"`). */
    number?: ReactNode;
    /** Step heading, shown at the top of the step's panel. */
    title?: ReactNode;
    /** Skill chips rendered next to the title. */
    skills?: StepSkill[];
    /** Marks this step as the emphasized/current one: the rail node gets the brand accent fill instead of the neutral surface. */
    highlight?: boolean;
    /** Set on the final step to omit the connecting wire below its rail node. */
    last?: boolean;
}
export declare function Step({ number, title, skills, highlight, last, className, children, ...rest }: StepProps): import("react").JSX.Element;
export interface SubstepsProps extends ComponentPropsWithoutRef<"div"> {
}
export declare function Substeps({ className, children, ...rest }: SubstepsProps): import("react").JSX.Element;
export interface SubProps extends ComponentPropsWithoutRef<"div"> {
    /** Small leading label above the sub-step body (e.g. a sub-index). */
    label?: ReactNode;
    /** Secondary label under `label` (e.g. a related skill/tool name). */
    skill?: ReactNode;
}
export declare function Sub({ label, skill, className, children, ...rest }: SubProps): import("react").JSX.Element;
