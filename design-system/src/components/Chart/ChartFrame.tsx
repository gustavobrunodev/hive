import { useId, useState } from "react"
import type { ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./Chart.css"

/** The words a chart's frame needs from its host — the DS holds no copy of its own. */
export interface ChartToggleLabels {
  /** The toggle while the drawing shows ("Ver tabela"). */
  showTable: string
  /** The same toggle while the table shows ("Ver gráfico"). */
  showChart: string
}

export interface ChartFrameProps {
  title?: ReactNode
  description?: ReactNode
  /** The level of the title's heading. Defaults to 2. */
  headingLevel?: 2 | 3 | 4
  toggle: ChartToggleLabels
  /** Start on the table instead of the drawing. */
  defaultTable?: boolean
  className?: string
  /** The drawing. */
  chart: ReactNode
  /** The twin table, with the same numbers. */
  table: ReactNode
}

function TableGlyph({ table }: { table: boolean }) {
  return table ? (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2.5 12.5l3.5-4 3 2.5 4.5-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.5 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The frame both charts share: a heading, a one-line description, and the
 * built-in "Ver tabela" toggle that swaps the drawing for a `<table>` holding
 * the same numbers (the twin-table rule). One control, two states — it
 * becomes "Ver gráfico", `aria-pressed="true"`, and swaps back.
 */
export function ChartFrame({
  title,
  description,
  headingLevel = 2,
  toggle,
  defaultTable = false,
  className,
  chart,
  table,
}: ChartFrameProps) {
  const [asTable, setAsTable] = useState(defaultTable)
  const titleId = useId()
  const Heading = `h${headingLevel}` as "h2"
  return (
    <figure className={cx("hds-chart", className)} aria-labelledby={title ? titleId : undefined}>
      <div className="hds-chart-head">
        <div className="hds-chart-titles">
          {title && (
            <Heading id={titleId} className="hds-chart-title">
              {title}
            </Heading>
          )}
          {description && <p className="hds-chart-description">{description}</p>}
        </div>
        <button
          type="button"
          className="hds-chart-toggle"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
        >
          <TableGlyph table={asTable} />
          {asTable ? toggle.showChart : toggle.showTable}
        </button>
      </div>
      {asTable ? table : chart}
    </figure>
  )
}

/** One column of a twin table. Numeric columns align right, in tabular figures. */
export interface ChartColumn {
  label: string
  numeric?: boolean
}

/** The twin table: the first cell of each row is its header. */
export function ChartTable({ columns, rows }: { columns: ChartColumn[]; rows: Array<{ key: string; cells: ReactNode[] }> }) {
  return (
    <div className="hds-chart-table-wrap">
      <table className="hds-chart-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={cx(column.numeric && "hds-chart-num")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={index} className={cx(columns[index]?.numeric && "hds-chart-num")}>
                    {cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
