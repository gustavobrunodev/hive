import * as React from "react";
import "./DataGrid.css";
/** Which cell the grid's single tab stop currently sits on. */
export interface DataGridCursor {
    row: number;
    column: number;
}
export interface DataGridColumn {
    /** Stable key for the column — never rendered. */
    id: string;
    /** What the header shows. */
    label: React.ReactNode;
    /** A short line under the header (a type, a unit, a count). */
    hint?: React.ReactNode;
    /** Right-aligns the column's body cells — numbers read down their last digit. */
    numeric?: boolean;
}
export interface DataGridProps {
    columns: DataGridColumn[];
    /** Row-major values. Short rows are padded to the column count on render. */
    rows: ReadonlyArray<ReadonlyArray<string>>;
    /** Accessible name for the grid — it has no visible label of its own. */
    ariaLabel: string;
    /**
     * Left gutter content for a row (default: its 1-based number). `false`
     * removes the gutter entirely.
     */
    rowHeader?: ((index: number) => React.ReactNode) | false;
    /** Cells are read-only: no editing, but the cursor and navigation stay. */
    readOnly?: boolean;
    /** A cell was committed (Enter, Tab, or blur) with a value different from the one it held. */
    onCellChange?: (row: number, column: number, value: string) => void;
    /** Controlled cursor. Uncontrolled (with an internal default) when omitted. */
    cursor?: DataGridCursor;
    onCursorChange?: (cursor: DataGridCursor) => void;
    /**
     * Tints each column header with its own ink, cycling through six hues. For
     * data whose columns are otherwise told apart only by position — the reason
     * a raw `.csv` is hard to read — the colour IS the column name.
     */
    colorColumns?: boolean;
    /** Per-column trailing control (a menu button), rendered inside the header cell. */
    columnActions?: (index: number) => React.ReactNode;
    /** What to show instead of the body when `rows` is empty. */
    empty?: React.ReactNode;
    /** Rendered under the last row, inside the scroller (an "add row" affordance). */
    footer?: React.ReactNode;
    className?: string;
}
/**
 * An editable data grid: rows of values with a spreadsheet's manners.
 *
 * ## Why this is a component and not a styled `<table>`
 *
 * Because everything that makes tabular data usable lives in the behaviour,
 * not the markup. A table shows values; a grid lets you walk them with the
 * arrow keys, tells you which cell you are in from across the room, keeps the
 * header and the row numbers in place while you scroll away from them, and
 * turns a cell into a field the moment you type. Three surfaces in this system
 * needed that and each had been re-deriving a piece of it.
 *
 * ## The crosshair
 *
 * The active cell is marked three times: the cell itself, its column header
 * and its row number. In a wide grid the cell alone is not enough — by the
 * time you have scrolled sideways, "which column is this?" is exactly the
 * question the highlight has to answer, and it answers it in the header where
 * the name actually is.
 *
 * ## Editing
 *
 * A cell is a `<td>` until it is being edited, and an `<input>` while it is.
 * Not an always-on input per cell: a thousand mounted fields is a scroll that
 * stutters, and a grid full of borders reads as a form, not as data. Enter and
 * F2 open the editor, typing opens it and replaces the value (the spreadsheet
 * convention everyone already has in their fingers), Escape restores what was
 * there, and Enter/Tab commit and move on.
 *
 * ## Tab
 *
 * Tab moves to the next cell, as it does in every spreadsheet — except at the
 * two ends, where it is left alone and takes focus out of the grid. That is
 * the escape hatch the ARIA grid pattern asks for, without giving up the
 * gesture data entry is actually done with.
 */
export declare function DataGrid({ columns, rows, ariaLabel, rowHeader, readOnly, onCellChange, cursor: cursorProp, onCursorChange, colorColumns, columnActions, empty, footer, className, }: DataGridProps): React.JSX.Element;
