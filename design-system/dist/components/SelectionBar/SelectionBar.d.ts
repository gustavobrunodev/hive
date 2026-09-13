import type { ReactNode } from "react";
import "./SelectionBar.css";
export interface SelectionBarProps {
    /** How many rows are selected right now. */
    count: number;
    /** How many rows are selectable — the denominator "select all" acts on. */
    total: number;
    /** The count, in words ("3 selecionadas"). The bar states it; it never builds the sentence itself. */
    label: string;
    /**
     * The full sentence for the accessibility tree, when the visible one had to
     * be shortened to fit. A bar that lives in a 280px column has room for "3
     * selecionadas" and not for "3 conversas selecionadas" — but a screen reader
     * has no width, and the noun is exactly what tells it *what* was selected.
     * Defaults to `label`.
     */
    ariaLabel?: string;
    /** Accessible name for the select-all control (e.g. "Selecionar todas as conversas"). */
    selectAllLabel: string;
    /** Checks every row, or clears them — the control is tri-state and reflects `count` vs `total`. */
    onSelectAllChange: (checked: boolean) => void;
    /** Leaves selection mode entirely. */
    onDismiss: () => void;
    /** Accessible name for the dismiss control. */
    dismissLabel: string;
    /** The bulk actions, trailing. Typically one destructive button. */
    actions?: ReactNode;
    /**
     * A question about the selection, asked **in the bar itself** — it takes the
     * place of the select-all control, the count and the dismiss.
     *
     * Two reasons it replaces them rather than joining them. Room: a bar in a
     * 280px column fits a count, one action and a ✕, and adding a question plus a
     * confirm plus a cancel to that pushes the cancel off its own edge (measured).
     * And meaning: while the bar is asking "delete 3?", "select all" is a control
     * that would change the subject of the question, and a ✕ is a second cancel
     * next to the real one.
     *
     * The selection stays visible behind it — which is the whole reason to ask
     * here instead of in a modal that would dim the rows being decided about.
     */
    prompt?: ReactNode;
    className?: string;
}
/**
 * The contextual toolbar for a list that has a selection: how many are picked,
 * the way to pick or drop them all, and what can be done to them.
 *
 * ## Why it is a component and not a `<div>` at each call site
 *
 * Because the fiddly parts are the ones nobody re-derives correctly the second
 * time: the select-all control is **tri-state** (none / some / all, and "some"
 * must render as a dash rather than as unchecked, or the bar claims nothing is
 * selected while three rows are highlighted); the count has to be announced,
 * not merely drawn, so a screen-reader user knows the list they are standing in
 * has changed meaning; and there must always be a way *out* of selection mode
 * that is not "uncheck them one by one".
 *
 * ## The live region
 *
 * The bar announces itself politely as the count changes (`aria-live`), which
 * is the only signal a non-sighted user gets that a row toggled — the row's own
 * checkbox announces its own state, but not how many are now in play.
 *
 * ## What it deliberately does not do
 *
 * It holds no selection state and performs no action. Which rows are selected
 * belongs to the list, and what "delete" means belongs to the app — a bar that
 * owned either would have to be re-taught for every list it appeared in.
 */
export declare function SelectionBar({ count, total, label, ariaLabel, selectAllLabel, onSelectAllChange, onDismiss, dismissLabel, actions, prompt, className, }: SelectionBarProps): import("react").JSX.Element;
