import type { ReactNode } from "react"
import { ChartFrame, ChartTable, type ChartToggleLabels } from "../Chart/ChartFrame"
import "./BarChart.css"

export interface BarChartDatum {
  id: string
  label: string
  value: number
  /** The value as the reader should see it ("1.932"). Defaults to the number. */
  valueLabel?: string
  /** The share of the whole, as text ("51%"). */
  shareLabel?: string
  /**
   * A part of this bar drawn apart — one item filtered inside the category.
   * The part takes the emphasis; the rest of the bar is the washed emphasis.
   * Only drawn on the emphasised row.
   */
  part?: number
  /** The row button's accessible name. Defaults to "label: value, share". */
  ariaLabel?: string
}

export interface BarChartLabels extends ChartToggleLabels {
  /** The twin table's column headers. */
  category: string
  value: string
  share: string
}

export interface BarChartProps {
  data: BarChartDatum[]
  /** The row in emphasis — controlled. The rest are context. */
  emphasis: string | null
  /** Activating a row asks for it to take the emphasis. */
  onEmphasisChange?: (id: string) => void
  labels: BarChartLabels
  title?: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3 | 4
  defaultTable?: boolean
  className?: string
}

/** The widest bar fills this much of its track, so its label always fits beside it. */
export const BAR_MAX_PERCENT = 74

function percent(value: number): string {
  return `${Number(value.toFixed(2))}%`
}

/** A bar's width, in % of the track: the largest is `BAR_MAX_PERCENT`, the rest in proportion. */
export function barWidth(value: number, max: number): number {
  return max > 0 ? (Math.max(0, value) / max) * BAR_MAX_PERCENT : 0
}

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
export function BarChart({
  data,
  emphasis,
  onEmphasisChange,
  labels,
  title,
  description,
  headingLevel,
  defaultTable,
  className,
}: BarChartProps) {
  const max = data.reduce((top, datum) => Math.max(top, datum.value), 0)
  const valueText = (datum: BarChartDatum): string => datum.valueLabel ?? String(datum.value)
  const chart = (
    <div className="hds-bars">
      {data.map((datum) => {
        const on = datum.id === emphasis
        const width = barWidth(datum.value, max)
        const part = on && datum.part !== undefined && datum.value > 0
          ? (Math.min(Math.max(0, datum.part), datum.value) / datum.value) * width
          : null
        return (
          <button
            key={datum.id}
            type="button"
            className="hds-bars-row"
            aria-pressed={on}
            aria-label={
              datum.ariaLabel ??
              `${datum.label}: ${valueText(datum)}${datum.shareLabel ? `, ${datum.shareLabel}` : ""}`
            }
            data-emphasis={on || undefined}
            onClick={() => onEmphasisChange?.(datum.id)}
          >
            <span className="hds-bars-label">{datum.label}</span>
            <span className="hds-bars-track">
              {part === null ? (
                <span className="hds-bars-bar" style={{ width: percent(width) }} />
              ) : (
                <>
                  <span className="hds-bars-bar hds-bars-part" style={{ width: percent(part) }} />
                  <span className="hds-bars-bar hds-bars-rest" style={{ width: percent(width - part) }} />
                </>
              )}
              <span className="hds-bars-value">
                {valueText(datum)}
                {datum.shareLabel && ` · ${datum.shareLabel}`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
  const table = (
    <ChartTable
      columns={[{ label: labels.category }, { label: labels.value, numeric: true }, { label: labels.share, numeric: true }]}
      rows={data.map((datum) => ({
        key: datum.id,
        cells: [datum.label, valueText(datum), datum.shareLabel ?? ""],
      }))}
    />
  )
  return (
    <ChartFrame
      className={className}
      title={title}
      description={description}
      headingLevel={headingLevel}
      toggle={labels}
      defaultTable={defaultTable}
      chart={chart}
      table={table}
    />
  )
}
