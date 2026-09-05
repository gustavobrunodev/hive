import * as React from "react";
import "./StepFlow.css";
/** Where one step of a flow currently stands. */
export type StepStatus = "pending" | "active" | "done" | "failed";
export interface StepFlowStep {
    /** Stable identity — also the React key. */
    id: string;
    label: React.ReactNode;
    /** One line under the label: what is happening, or what the user must do. */
    hint?: React.ReactNode;
    status: StepStatus;
}
export interface StepFlowProps extends Omit<React.ComponentPropsWithoutRef<"ol">, "children"> {
    steps: StepFlowStep[];
    /** Accessible name for the flow as a whole. Required: an unnamed list of dots says nothing. */
    label: string;
    /** `vertical` (default) reads as a checklist; `horizontal` as a wizard rail. */
    orientation?: "vertical" | "horizontal";
    /**
     * Spoken status words, appended to each step's accessible name.
     *
     * The visual states are colour and shape, which is exactly the information a
     * screen reader gets nothing of — so each step says its own status in words.
     * Overridable because the design system carries no locale of its own beyond
     * these defaults.
     */
    statusLabels?: Record<StepStatus, string>;
}
/**
 * A flow of steps that knows where it is.
 *
 * `SteppedList` numbers instructions; this one **reports progress**. The
 * difference is the whole point: an interface that hands a task to something
 * outside itself — a browser sign-in, an install, an upload — has to say which
 * part is finished, which part is happening now, and which part hasn't started,
 * or the user is left watching a spinner and guessing whether it is their turn
 * to act.
 *
 * Four states, and each one is carried by shape as well as colour (a filled
 * check, a breathing ring, a hollow dot, a cross) so the flow survives both a
 * colour-blind reader and a screen reader — `statusLabels` puts the same
 * information into the accessible name.
 *
 * The connector between nodes is filled behind every step that is done, which
 * makes the amount of progress readable at a glance, before any label is read.
 */
export declare const StepFlow: React.ForwardRefExoticComponent<StepFlowProps & React.RefAttributes<HTMLOListElement>>;
