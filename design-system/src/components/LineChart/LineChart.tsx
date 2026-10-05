import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { ChartFrame, ChartTable, type ChartToggleLabels } from "../Chart/ChartFrame"
import "./LineChart.css"

export interface LineChartPoint {
  /** The point's name on the X axis ("12 ago"). */
  label: string
  value: number
  /** The value as the reader should see it. Defaults to the number. */
  valueLabel?: string
}

export interface LineChartLabels extends ChartToggleLabels {
  /** The twin table's column headers. */
  point: string
  value: string
}

export interface LineChartProps {
  points: LineChartPoint[]
  /** The series' name — the tooltip's line ("Status e avisos"). */
  seriesLabel: string
  /** The drawing's accessible name: what it shows, in one sentence. */
  ariaLabel: string
  labels: LineChartLabels
  /** What a reading says, for the live region and the slider. Default "<label>: <value>". */
  reading?: (point: LineChartPoint) => string
  /** How an axis tick is written. Defaults to the number. */
  formatTick?: (value: number) => string
  title?: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3 | 4
  defaultTable?: boolean
  /** The drawing's height, in px. */
  height?: number
  className?: string
}

/** The plot's margins: room for the Y ticks on the left and the end value on the right. */
export const LINE_MARGIN = { left: 48, right: 56, top: 12, bottom: 28 }

/** Width used before the box is measured — and in environments that never lay out. */
export const LINE_FALLBACK_WIDTH = 560

/** A tick step from 1, 2, 2.5, 5 × 10ⁿ, and the axis top it rounds up to (about four steps). */
export function niceScale(max: number): { step: number; top: number } {
  const raw = Math.max(1, max) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) as number
  return { step, top: Math.ceil(Math.max(1, max) / step) * step }
}

/** Where point `i` of `n` sits horizontally, for a plot `width` px wide. */
export function pointX(i: number, n: number, width: number): number {
  const plot = width - LINE_MARGIN.left - LINE_MARGIN.right
  return LINE_MARGIN.left + (n <= 1 ? plot / 2 : (i / (n - 1)) * plot)
}

/** The point nearest to a horizontal position inside the drawing. */
export function nearestPoint(x: number, n: number, width: number): number {
  const plot = width - LINE_MARGIN.left - LINE_MARGIN.right
  if (n <= 1 || plot <= 0) return 0
  return Math.max(0, Math.min(n - 1, Math.round(((x - LINE_MARGIN.left) / plot) * (n - 1))))
}

/** The drawing's width, measured, falling back when the box has none. */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(LINE_FALLBACK_WIDTH)
  const measure = useCallback(() => {
    const measured = ref.current?.clientWidth ?? 0
    setWidth(measured > 0 ? measured : LINE_FALLBACK_WIDTH)
  }, [])
  useLayoutEffect(measure, [measure])
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure])
  return [ref, width]
}

/**
 * One series over time, on a single Y axis, with a crosshair reading.
 *
 * Keyboard first: the drawing is a slider over the points — ←/→ step one
 * point, Home and End jump to the ends — and each reading ("<label>:
 * <value>") is announced through a live region. The pointer gets the same
 * reading: the crosshair and the tooltip follow the nearest point. "Ver
 * tabela" (built in) swaps the drawing for a table with the same numbers.
 */
export function LineChart({
  points,
  seriesLabel,
  ariaLabel,
  labels,
  reading = (point) => `${point.label}: ${point.valueLabel ?? point.value}`,
  formatTick = (value) => String(value),
  title,
  description,
  headingLevel,
  defaultTable,
  height = 236,
  className,
}: LineChartProps) {
  const [boxRef, width] = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  const n = points.length
  const last = Math.max(0, n - 1)
  const { step, top } = niceScale(points.reduce((max, point) => Math.max(max, point.value), 0))
  const plotBottom = height - LINE_MARGIN.bottom
  const y = (value: number): number => LINE_MARGIN.top + (plotBottom - LINE_MARGIN.top) * (1 - value / top)
  const x = (i: number): number => pointX(i, n, width)
  const line = points.map((point, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ")
  const area = n > 0 ? `${line} L${x(last).toFixed(1)} ${plotBottom} L${x(0).toFixed(1)} ${plotBottom} Z` : ""
  const ticks: number[] = []
  for (let value = 0; value <= top + 1e-9; value += step) ticks.push(value)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((width - LINE_MARGIN.left - LINE_MARGIN.right) / 56))))
  const current = selected === null ? last : selected
  const shown = selected !== null ? (points[selected] ?? null) : null
  const currentPoint = points[current]
  const lastPoint = points[last]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }
    const next = moves[event.key]
    if (next === undefined || n === 0) return
    event.preventDefault()
    setSelected(Math.max(0, Math.min(last, next)))
  }
  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (n === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    setSelected(nearestPoint(event.clientX - box.left, n, width))
  }

  const chart = (
    <div className="hds-line" ref={boxRef}>
      <div
        className="hds-line-plot"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={current}
        aria-valuetext={currentPoint ? reading(currentPoint) : undefined}
        onFocus={() => setSelected((value) => (value === null ? last : value))}
        onBlur={() => setSelected(null)}
        onKeyDown={onKeyDown}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setSelected(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <g className="hds-line-axis-y">
            {ticks.map((value) => (
              <g key={value}>
                <line className="hds-line-grid" x1={LINE_MARGIN.left} x2={width - LINE_MARGIN.right} y1={y(value)} y2={y(value)} />
                <text className="hds-line-tick" x={LINE_MARGIN.left - 8} y={y(value) + 4} textAnchor="end">
                  {formatTick(value)}
                </text>
              </g>
            ))}
          </g>
          <g className="hds-line-axis-x">
            {points.map((point, i) =>
              i % labelEvery === 0 ? (
                <text key={point.label} className="hds-line-tick" x={x(i)} y={height - 8} textAnchor="middle">
                  {point.label}
                </text>
              ) : null
            )}
          </g>
          <path className="hds-line-area" d={area} />
          <path className="hds-line-path" d={line} />
          {lastPoint && (
            <>
              <circle className="hds-line-end" cx={x(last)} cy={y(lastPoint.value)} r={4} />
              <text className="hds-line-end-label" x={x(last) + 10} y={y(lastPoint.value) + 4}>
                {lastPoint.valueLabel ?? lastPoint.value}
              </text>
            </>
          )}
          {shown && selected !== null && (
            <>
              <line className="hds-line-cursor" x1={x(selected)} x2={x(selected)} y1={LINE_MARGIN.top} y2={plotBottom} />
              <circle className="hds-line-dot" cx={x(selected)} cy={y(shown.value)} r={4.5} />
            </>
          )}
        </svg>
        {shown && selected !== null && (
          <div
            className="hds-line-tip"
            data-side={x(selected) > width / 2 ? "left" : "right"}
            style={{ left: `${x(selected)}px` }}
          >
            <span className="hds-line-tip-label">{shown.label}</span>
            <span className="hds-line-tip-value">
              <b>{shown.valueLabel ?? shown.value}</b> {seriesLabel}
            </span>
          </div>
        )}
      </div>
      <p className="hds-chart-sr" aria-live="polite">
        {shown ? reading(shown) : ""}
      </p>
    </div>
  )
  const table = (
    <ChartTable
      columns={[{ label: labels.point }, { label: labels.value, numeric: true }]}
      rows={points.map((point) => ({
        key: point.label,
        cells: [point.label, point.valueLabel ?? String(point.value)],
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
