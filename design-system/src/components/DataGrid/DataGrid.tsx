import * as React from "react"
import { cx } from "../../utils/cx"
import "./DataGrid.css"

/** Which cell the grid's single tab stop currently sits on. */
export interface DataGridCursor {
  row: number
  column: number
}

export interface DataGridColumn {
  /** Stable key for the column — never rendered. */
  id: string
  /** What the header shows. */
  label: React.ReactNode
  /** A short line under the header (a type, a unit, a count). */
  hint?: React.ReactNode
  /** Right-aligns the column's body cells — numbers read down their last digit. */
  numeric?: boolean
}

export interface DataGridProps {
  columns: DataGridColumn[]
  /** Row-major values. Short rows are padded to the column count on render. */
  rows: ReadonlyArray<ReadonlyArray<string>>
  /** Accessible name for the grid — it has no visible label of its own. */
  ariaLabel: string
  /**
   * Left gutter content for a row (default: its 1-based number). `false`
   * removes the gutter entirely.
   */
  rowHeader?: ((index: number) => React.ReactNode) | false
  /** Cells are read-only: no editing, but the cursor and navigation stay. */
  readOnly?: boolean
  /** A cell was committed (Enter, Tab, or blur) with a value different from the one it held. */
  onCellChange?: (row: number, column: number, value: string) => void
  /** Controlled cursor. Uncontrolled (with an internal default) when omitted. */
  cursor?: DataGridCursor
  onCursorChange?: (cursor: DataGridCursor) => void
  /**
   * Tints each column header with its own ink, cycling through six hues. For
   * data whose columns are otherwise told apart only by position — the reason
   * a raw `.csv` is hard to read — the colour IS the column name.
   */
  colorColumns?: boolean
  /** Per-column trailing control (a menu button), rendered inside the header cell. */
  columnActions?: (index: number) => React.ReactNode
  /** What to show instead of the body when `rows` is empty. */
  empty?: React.ReactNode
  /** Rendered under the last row, inside the scroller (an "add row" affordance). */
  footer?: React.ReactNode
  className?: string
}

/** How far PageUp/PageDown jump — a screenful in the sizes this grid is used at. */
const PAGE_ROWS = 12

/** Cell value at `row`/`column`, or `""` for a short row. */
function valueAt(rows: DataGridProps["rows"], row: number, column: number): string {
  return rows[row]?.[column] ?? ""
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
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
export function DataGrid({
  columns,
  rows,
  ariaLabel,
  rowHeader,
  readOnly = false,
  onCellChange,
  cursor: cursorProp,
  onCursorChange,
  colorColumns = false,
  columnActions,
  empty,
  footer,
  className,
}: DataGridProps) {
  const [internalCursor, setInternalCursor] = React.useState<DataGridCursor>({ row: 0, column: 0 })
  const cursor = cursorProp ?? internalCursor
  const [editing, setEditing] = React.useState<string | null>(null)
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  /**
   * Whether the open editor has already been closed this session.
   *
   * Every way out of a cell — Enter, Tab, Escape — moves focus, and moving
   * focus fires the field's own `blur` while React is still holding the
   * `editing` state update. Without this the blur runs the commit a SECOND
   * time (same value, a duplicate change reported to the caller), and Escape
   * commits the very text it was pressed to throw away.
   */
  const closedRef = React.useRef(false)
  const cellRefs = React.useRef(new Map<string, HTMLTableCellElement>())
  const lastRow = rows.length - 1
  const lastColumn = columns.length - 1

  const key = (row: number, column: number): string => `${row}:${column}`

  const moveTo = React.useCallback(
    (row: number, column: number) => {
      const next = { row: clamp(row, lastRow), column: clamp(column, lastColumn) }
      setInternalCursor(next)
      onCursorChange?.(next)
      // The cell may be under the sticky header or off-screen entirely; the
      // browser's own `nearest` scroll is what keeps a long walk with the
      // arrow keys inside the viewport.
      cellRefs.current.get(key(next.row, next.column))?.focus({ preventScroll: true })
      cellRefs.current.get(key(next.row, next.column))?.scrollIntoView({ block: "nearest", inline: "nearest" })
    },
    [lastRow, lastColumn, onCursorChange]
  )

  const commit = React.useCallback(
    (row: number, column: number, value: string) => {
      if (closedRef.current) return
      closedRef.current = true
      setEditing(null)
      if (value !== valueAt(rows, row, column)) onCellChange?.(row, column, value)
    },
    [rows, onCellChange]
  )

  /** Closes the editor without writing anything back (Escape). */
  const cancelEditing = React.useCallback((row: number, column: number) => {
    closedRef.current = true
    setEditing(null)
    cellRefs.current.get(`${row}:${column}`)?.focus()
  }, [])

  /** Opens the editor on a cell, optionally seeded with the character that opened it. */
  const startEditing = React.useCallback(
    (row: number, column: number, seed?: string) => {
      if (readOnly) return
      closedRef.current = false
      setEditing(seed === undefined ? valueAt(rows, row, column) : seed)
    },
    [readOnly, rows]
  )

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>, row: number, column: number): void => {
    const { key: pressed, ctrlKey, metaKey, shiftKey, altKey } = event
    const mod = ctrlKey || metaKey

    switch (pressed) {
      case "ArrowRight":
        event.preventDefault()
        moveTo(row, column + 1)
        return
      case "ArrowLeft":
        event.preventDefault()
        moveTo(row, column - 1)
        return
      case "ArrowDown":
        event.preventDefault()
        moveTo(row + 1, column)
        return
      case "ArrowUp":
        event.preventDefault()
        moveTo(row - 1, column)
        return
      case "PageDown":
        event.preventDefault()
        moveTo(row + PAGE_ROWS, column)
        return
      case "PageUp":
        event.preventDefault()
        moveTo(row - PAGE_ROWS, column)
        return
      case "Home":
        event.preventDefault()
        moveTo(mod ? 0 : row, 0)
        return
      case "End":
        event.preventDefault()
        moveTo(mod ? lastRow : row, lastColumn)
        return
      case "Enter":
      case "F2":
        event.preventDefault()
        startEditing(row, column)
        return
      case "Backspace":
      case "Delete":
        if (readOnly) return
        event.preventDefault()
        if (valueAt(rows, row, column) !== "") onCellChange?.(row, column, "")
        return
      case "Tab": {
        // The two ends are left to the browser — that is how focus gets out.
        const atEnd = row === lastRow && column === lastColumn
        const atStart = row === 0 && column === 0
        if ((shiftKey && atStart) || (!shiftKey && atEnd)) return
        event.preventDefault()
        if (shiftKey) {
          if (column === 0) moveTo(row - 1, lastColumn)
          else moveTo(row, column - 1)
        } else if (column === lastColumn) {
          moveTo(row + 1, 0)
        } else {
          moveTo(row, column + 1)
        }
        return
      }
      default:
        break
    }

    // Typing replaces the cell, the way it does in a spreadsheet. Guarded so
    // that shortcuts (Ctrl+C, Ctrl+S — the pane above still owns saving) and
    // every non-printing key fall through untouched.
    if (pressed.length === 1 && !mod && !altKey) {
      event.preventDefault()
      startEditing(row, column, pressed)
    }
  }

  const body = rows.map((_, rowIndex) => (
    <tr key={rowIndex} className="hds-grid-row" aria-rowindex={rowIndex + 2}>
      {rowHeader !== false && (
        <th
          scope="row"
          className="hds-grid-rowhead"
          data-current={rowIndex === cursor.row || undefined}
        >
          {rowHeader ? rowHeader(rowIndex) : rowIndex + 1}
        </th>
      )}
      {columns.map((column, columnIndex) => {
        const active = cursor.row === rowIndex && cursor.column === columnIndex
        const isEditing = active && editing !== null
        const value = valueAt(rows, rowIndex, columnIndex)
        return (
          <td
            key={column.id}
            ref={(node) => {
              if (node) cellRefs.current.set(key(rowIndex, columnIndex), node)
              else cellRefs.current.delete(key(rowIndex, columnIndex))
            }}
            role="gridcell"
            className="hds-grid-cell"
            data-numeric={column.numeric || undefined}
            data-active={active || undefined}
            data-editing={isEditing || undefined}
            data-empty={value === "" || undefined}
            aria-colindex={columnIndex + (rowHeader === false ? 1 : 2)}
            aria-readonly={readOnly || undefined}
            tabIndex={active && !isEditing ? 0 : -1}
            title={!isEditing && value !== "" ? value : undefined}
            onFocus={() => {
              if (active) return
              setInternalCursor({ row: rowIndex, column: columnIndex })
              onCursorChange?.({ row: rowIndex, column: columnIndex })
            }}
            onKeyDown={(event) => {
              if (isEditing) return
              handleCellKeyDown(event, rowIndex, columnIndex)
            }}
            onDoubleClick={() => startEditing(rowIndex, columnIndex)}
          >
            {isEditing ? (
              <input
                className="hds-grid-input"
                autoFocus
                value={editing}
                aria-label={typeof column.label === "string" ? column.label : ariaLabel}
                onChange={(event) => setEditing(event.target.value)}
                onBlur={(event) => commit(rowIndex, columnIndex, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    cancelEditing(rowIndex, columnIndex)
                    return
                  }
                  if (event.key === "Enter") {
                    event.preventDefault()
                    commit(rowIndex, columnIndex, event.currentTarget.value)
                    moveTo(event.shiftKey ? rowIndex - 1 : rowIndex + 1, columnIndex)
                    return
                  }
                  if (event.key === "Tab") {
                    event.preventDefault()
                    commit(rowIndex, columnIndex, event.currentTarget.value)
                    if (event.shiftKey) moveTo(rowIndex, columnIndex - 1)
                    else moveTo(rowIndex, columnIndex + 1)
                  }
                }}
              />
            ) : (
              <span className="hds-grid-value">{value}</span>
            )}
          </td>
        )
      })}
    </tr>
  ))

  return (
    <div className={cx("hds-grid", className)}>
      <div className="hds-grid-scroller" ref={scrollerRef}>
        <table
          role="grid"
          className="hds-grid-table"
          aria-label={ariaLabel}
          aria-rowcount={rows.length + 1}
          aria-colcount={columns.length + (rowHeader === false ? 0 : 1)}
          aria-readonly={readOnly || undefined}
        >
          <thead>
            <tr className="hds-grid-row" aria-rowindex={1}>
              {rowHeader !== false && <th className="hds-grid-corner" scope="col" aria-label={ariaLabel} />}
              {columns.map((column, index) => (
                <th
                  key={column.id}
                  scope="col"
                  className="hds-grid-colhead"
                  data-numeric={column.numeric || undefined}
                  data-current={index === cursor.column || undefined}
                  data-hue={colorColumns ? index % 6 : undefined}
                  aria-colindex={index + (rowHeader === false ? 1 : 2)}
                >
                  <span className="hds-grid-colhead-body">
                    <span className="hds-grid-colhead-label">{column.label}</span>
                    {column.hint !== undefined && <span className="hds-grid-colhead-hint">{column.hint}</span>}
                  </span>
                  {columnActions?.(index)}
                </th>
              ))}
            </tr>
          </thead>
          {rows.length > 0 && <tbody>{body}</tbody>}
        </table>
        {rows.length === 0 && empty !== undefined && <div className="hds-grid-empty">{empty}</div>}
        {footer}
      </div>
    </div>
  )
}
