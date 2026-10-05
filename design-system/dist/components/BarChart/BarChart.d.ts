import type { ReactNode } from "react";
import { type ChartToggleLabels } from "../Chart/ChartFrame";
import "./BarChart.css";
export interface BarChartDatum {
    id: string;
    label: string;
    value: number;
    /** The value as the reader should see it ("1.932"). Defaults to the number. */
    valueLabel?: string;
    /** The share of the whole, as text ("51%"). */
    shareLabel?: string;
    /**
     * A part of this bar drawn apart — one item filtered inside the category.
     * The part takes the emphasis; the rest of the bar is the washed emphasis.
     * Only drawn on the emphasised row.
     */
    part?: number;
    /** The row button's accessible name. Defaults to "label: value, share". */
    ariaLabel?: string;
}
export interface BarChartLabels extends ChartToggleLabels {
    /** The twin table's column headers. */
    category: string;
    value: string;
    share: string;
}
export interface BarChartProps {
    data: BarChartDatum[];
    /** The row in emphasis — controlled. The rest are context. */
    emphasis: string | null;
    /** Activating a row asks for it to take the emphasis. */
    onEmphasisChange?: (id: string) => void;
    labels: BarChartLabels;
    title?: ReactNode;
    description?: ReactNode;
    headingLevel?: 2 | 3 | 4;
    defaultTable?: boolean;
    className?: string;
}
/** The widest bar fills this much of its track, so its label always fits beside it. */
export declare const BAR_MAX_PERCENT = 74;
/** A bar's width, in % of the track: the largest is `BAR_MAX_PERCENT`, the rest in proportion. */
export declare function barWidth(value: number, max: number): number;
/**
 * Horizontal bars, one series in emphasis and the rest in context (the
 * chart grammar of DESIGN.md): the eye lands on one category, and the others
 * stay readable around it.
 *
 * Each row is a button with `aria-pressed` — activating it moves the emphasis,
 * which is how a reader picks the category a sibling chart then follows. The
 * largest bar fills 74% of its track and the others are in proportion, so the
 * value beside each bar always has room. "Ver tabela" (built in) swaps the
 * drawing for a table with the same numbers.
 */
export declare function BarChart({ data, emphasis, onEmphasisChange, labels, title, description, headingLevel, defaultTable, className, }: BarChartProps): import("react").JSX.Element;
