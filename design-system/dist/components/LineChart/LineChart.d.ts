import type { ReactNode } from "react";
import { type ChartToggleLabels } from "../Chart/ChartFrame";
import "./LineChart.css";
export interface LineChartPoint {
    /** The point's name on the X axis ("12 ago"). */
    label: string;
    value: number;
    /** The value as the reader should see it. Defaults to the number. */
    valueLabel?: string;
}
export interface LineChartLabels extends ChartToggleLabels {
    /** The twin table's column headers. */
    point: string;
    value: string;
}
export interface LineChartProps {
    points: LineChartPoint[];
    /** The series' name — the tooltip's line ("Status e avisos"). */
    seriesLabel: string;
    /** The drawing's accessible name: what it shows, in one sentence. */
    ariaLabel: string;
    labels: LineChartLabels;
    /** What a reading says, for the live region and the slider. Default "<label>: <value>". */
    reading?: (point: LineChartPoint) => string;
    /** How an axis tick is written. Defaults to the number. */
    formatTick?: (value: number) => string;
    title?: ReactNode;
    description?: ReactNode;
    headingLevel?: 2 | 3 | 4;
    defaultTable?: boolean;
    /** The drawing's height, in px. */
    height?: number;
    className?: string;
}
/** The plot's margins: room for the Y ticks on the left and the end value on the right. */
export declare const LINE_MARGIN: {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
/** Width used before the box is measured — and in environments that never lay out. */
export declare const LINE_FALLBACK_WIDTH = 560;
/** A tick step from 1, 2, 2.5, 5 × 10ⁿ, and the axis top it rounds up to (about four steps). */
export declare function niceScale(max: number): {
    step: number;
    top: number;
};
/** Where point `i` of `n` sits horizontally, for a plot `width` px wide. */
export declare function pointX(i: number, n: number, width: number): number;
/** The point nearest to a horizontal position inside the drawing. */
export declare function nearestPoint(x: number, n: number, width: number): number;
/**
 * One series over time, on a single Y axis, with a crosshair reading.
 *
 * Keyboard first: the drawing is a slider over the points — ←/→ step one
 * point, Home and End jump to the ends — and each reading ("<label>:
 * <value>") is announced through a live region. The pointer gets the same
 * reading: the crosshair and the tooltip follow the nearest point. "Ver
 * tabela" (built in) swaps the drawing for a table with the same numbers.
 */
export declare function LineChart({ points, seriesLabel, ariaLabel, labels, reading, formatTick, title, description, headingLevel, defaultTable, height, className, }: LineChartProps): import("react").JSX.Element;
