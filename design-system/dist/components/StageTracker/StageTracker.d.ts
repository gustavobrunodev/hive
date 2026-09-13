import * as React from "react";
import "./StageTracker.css";
/** Where one stage of a plan currently stands. */
export type StageStatus = "done" | "active" | "pending";
export interface StageTrackerStage {
    /** Stable identity — also the React key and what `onSelect` reports. */
    id: string;
    label: React.ReactNode;
    /** One line under the label: the artifact this stage produces, or what it needs. */
    hint?: React.ReactNode;
    status: StageStatus;
    /** Nothing to run yet — the row stays a row, and says why through `hint`. */
    disabled?: boolean;
    /**
     * Which `groups` entry this stage belongs to. Ignored when `groups` is absent;
     * a stage naming a group that was not declared does not draw at all, rather
     * than being quietly swept into a chapter it does not belong to.
     */
    group?: string;
    /**
     * A short qualifier beside the label — "Opcional", "Beta".
     *
     * Folded into the row's accessible name when it is a string, because a badge
     * that only exists as a visual chip is information the screen reader never
     * gets — and "this one you may skip" is exactly the kind of thing a user
     * needs before they commit to a run.
     */
    badge?: React.ReactNode;
    /**
     * Inline affordance at the end of the row, **inside** the activation target.
     *
     * The row is a button, and at rest a row of text with a dot beside it does
     * not look like one. This is where the verb goes — a play glyph, a "Iniciar"
     * pill — so the thing that can be clicked says so without being hovered.
     * Decorative by construction (`aria-hidden`): the row's own name already
     * carries the promise for a screen reader.
     */
    cue?: React.ReactNode;
    /**
     * Right-hand slot, outside the row's own activation.
     *
     * A stage that already produced something has two different verbs — "run it
     * again" and "show me what it made" — and folding both into one click makes
     * the more destructive of the two the accidental one.
     */
    trailing?: React.ReactNode;
}
/**
 * A named chapter of the plan — BMAD's phases, a release's milestones.
 *
 * Groups are declared separately from stages (rather than inferred from a field
 * on the first stage that mentions them) so an empty phase still draws: a plan
 * whose chapters appear and disappear as their contents fill in is a plan you
 * cannot learn the shape of.
 */
export interface StageTrackerGroup {
    id: string;
    label: React.ReactNode;
    /** Right-hand slot on the header — typically how many of its stages are done. */
    meta?: React.ReactNode;
}
export interface StageTrackerProps extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "onSelect"> {
    stages: StageTrackerStage[];
    /**
     * Splits the plan into named chapters, in this order. Stages are matched to
     * them by their own `group`; without this prop the tracker is one flat list,
     * exactly as before.
     */
    groups?: StageTrackerGroup[];
    /** Accessible name for the plan as a whole. Required: an unnamed column of dots says nothing. */
    label: string;
    /** Runs a stage. Rows are only buttons when this is given — without it the tracker is a read-only report. */
    onSelect?: (id: string) => void;
    /**
     * The verb each row promises, by status.
     *
     * A row whose name never changes teaches nobody that a finished stage can be
     * run again, and "Executar" over something already done reads as a mistake.
     */
    actionLabels?: Partial<Record<StageStatus, (label: string) => string>>;
    /**
     * Spoken status words, appended to each row's accessible name.
     *
     * The visual states are colour and shape, which is exactly what a screen
     * reader gets none of.
     */
    statusLabels?: Record<StageStatus, string>;
}
/**
 * A plan that knows where it is — and lets you act on it.
 *
 * `StepFlow` reports a flow the interface is driving on the user's behalf: it
 * is a status display, and every one of its steps is inert by construction.
 * This is the other half of that idea. Here the stages are the user's to run,
 * in an order the tracker only *suggests*: what is finished, what comes next,
 * and what is still ahead — with the next one a single click away and the ones
 * behind it still reachable, because "you skipped a step" and "you want to redo
 * one" are both ordinary and neither is an error.
 *
 * Three states, each carried by shape as well as colour (a filled check, a
 * ringed ordinal, a quiet outline) so the column survives a colour-blind reader,
 * with `statusLabels` putting the same information into the accessible name.
 * The wire between nodes is lit behind everything done, which makes the amount
 * of progress readable before a single label is.
 *
 * Pass `groups` and the same plan reads as chapters: one wire per phase, a
 * header that can carry the phase's own tally, and ordinals that keep counting
 * across the breaks — because the phases are a way of reading the flow, not
 * four separate flows.
 */
export declare const StageTracker: React.ForwardRefExoticComponent<StageTrackerProps & React.RefAttributes<HTMLElement>>;
