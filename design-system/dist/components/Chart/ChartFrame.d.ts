import type { ReactNode } from "react";
import "./Chart.css";
/** The words a chart's frame needs from its host — the DS holds no copy of its own. */
export interface ChartToggleLabels {
    /** The toggle while the drawing shows ("Ver tabela"). */
    showTable: string;
    /** The same toggle while the table shows ("Ver gráfico"). */
    showChart: string;
}
export interface ChartFrameProps {
    title?: ReactNode;
    description?: ReactNode;
    /** The level of the title's heading. Defaults to 2. */
    headingLevel?: 2 | 3 | 4;
    toggle: ChartToggleLabels;
    /** Start on the table instead of the drawing. */
    defaultTable?: boolean;
    className?: string;
    /** The drawing. */
    chart: ReactNode;
    /** The twin table, with the same numbers. */
    table: ReactNode;
}
/**
 * The frame both charts share: a heading, a one-line description, and the
 * built-in "Ver tabela" toggle that swaps the drawing for a `<table>` holding
 * the same numbers (the twin-table rule). One control, two states — it
 * becomes "Ver gráfico", `aria-pressed="true"`, and swaps back.
 */
export declare function ChartFrame({ title, description, headingLevel, toggle, defaultTable, className, chart, table, }: ChartFrameProps): import("react").JSX.Element;
/** One column of a twin table. Numeric columns align right, in tabular figures. */
export interface ChartColumn {
    label: string;
    numeric?: boolean;
}
/** The twin table: the first cell of each row is its header. */
export declare function ChartTable({ columns, rows }: {
    columns: ChartColumn[];
    rows: Array<{
        key: string;
        cells: ReactNode[];
    }>;
}): import("react").JSX.Element;
