import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LINE_FALLBACK_WIDTH, LineChart, nearestPoint, niceScale, pointX, type LineChartPoint } from "./LineChart"

const LABELS = { showTable: "Ver tabela", showChart: "Ver gráfico", point: "Semana de", value: "Menções" }

const WEEKS = ["7 jul", "14 jul", "21 jul", "28 jul", "4 ago", "11 ago", "18 ago", "25 ago", "1 set", "8 set", "15 set", "22 set", "29 set"]
const POINTS: LineChartPoint[] = WEEKS.map((label, i) => ({ label, value: 40 + i * 2, valueLabel: String(40 + i * 2) }))

function renderChart(points = POINTS) {
  return render(
    <LineChart points={points} seriesLabel="Status e avisos" ariaLabel="Recorrência semanal de Status e avisos" labels={LABELS} title="Recorrência semana a semana" />
  )
}

function liveRegion(container: HTMLElement): HTMLElement {
  return container.querySelector('[aria-live="polite"]') as HTMLElement
}

describe("LineChart", () => {
  it("C27d: draws the series as one line, over a single Y axis", () => {
    const { container } = renderChart()
    const paths = container.querySelectorAll(".hds-line-path")
    expect(paths).toHaveLength(1)
    // One move and one line segment per remaining point.
    const d = paths[0]!.getAttribute("d") as string
    expect(d.match(/[ML]/g)).toHaveLength(POINTS.length)
    expect(container.querySelectorAll(".hds-line-axis-y")).toHaveLength(1)
    // The axis starts at zero and tops out at a nice number above the maximum.
    const ticks = Array.from(container.querySelectorAll(".hds-line-axis-y .hds-line-tick")).map((t) => Number(t.textContent))
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(64)
    // The last point is labelled with its value.
    expect(container.querySelector(".hds-line-end-label")).toHaveTextContent("64")
  })

  it.each([
    ["ArrowLeft", "22 set: 62"],
    ["ArrowRight", "29 set: 64"],
    ["Home", "7 jul: 40"],
    ["End", "29 set: 64"],
  ])("C29a: with focus on the line, %s reads %s into an aria-live region", (key, expected) => {
    const { container } = renderChart()
    const slider = screen.getByRole("slider", { name: "Recorrência semanal de Status e avisos" })
    fireEvent.focus(slider)
    // Focus lands on the latest week.
    expect(liveRegion(container)).toHaveTextContent("29 set: 64")
    fireEvent.keyDown(slider, { key })
    expect(liveRegion(container)).toHaveTextContent(expected)
    expect(slider).toHaveAttribute("aria-valuetext", expected)
  })

  it("C29a: steps week by week and stops at the ends", () => {
    const { container } = renderChart()
    const slider = screen.getByRole("slider")
    fireEvent.focus(slider)
    fireEvent.keyDown(slider, { key: "Home" })
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(liveRegion(container)).toHaveTextContent("21 jul: 44")
    expect(slider).toHaveAttribute("aria-valuenow", "2")
    fireEvent.keyDown(slider, { key: "Home" })
    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(liveRegion(container)).toHaveTextContent("7 jul: 40")
    fireEvent.keyDown(slider, { key: "a" })
    expect(liveRegion(container)).toHaveTextContent("7 jul: 40")
    fireEvent.blur(slider)
    expect(liveRegion(container)).toHaveTextContent("")
  })

  it("C29b: with the pointer over it, the crosshair and the tooltip sit on the nearest week", () => {
    const { container } = renderChart()
    const slider = screen.getByRole("slider")
    slider.getBoundingClientRect = () => ({ left: 100, top: 0, width: LINE_FALLBACK_WIDTH, height: 236, right: 100 + LINE_FALLBACK_WIDTH, bottom: 236, x: 100, y: 0, toJSON: () => ({}) })
    // A few pixels right of week 5 is still week 5.
    const target = pointX(5, POINTS.length, LINE_FALLBACK_WIDTH)
    fireEvent.mouseMove(slider, { clientX: 100 + target + 6 })
    const cursor = container.querySelector(".hds-line-cursor") as SVGLineElement
    expect(Number(cursor.getAttribute("x1"))).toBeCloseTo(target)
    const tip = container.querySelector(".hds-line-tip") as HTMLElement
    expect(tip).toHaveTextContent("11 ago")
    expect(tip).toHaveTextContent("50 Status e avisos")
    expect(tip.style.left).toBe(`${target}px`)

    // Past the right edge, the nearest week is the last.
    fireEvent.mouseMove(slider, { clientX: 100 + LINE_FALLBACK_WIDTH + 50 })
    expect(container.querySelector(".hds-line-tip")).toHaveTextContent("29 set")
    expect(container.querySelector(".hds-line-tip")).toHaveAttribute("data-side", "left")

    fireEvent.mouseLeave(slider)
    expect(container.querySelector(".hds-line-cursor")).toBeNull()
    expect(container.querySelector(".hds-line-tip")).toBeNull()
  })

  it("C30a: \"Ver tabela\" swaps the line for a table with the same numbers, and the same control swaps back", () => {
    renderChart()
    const toggle = screen.getByRole("button", { name: "Ver tabela" })
    fireEvent.click(toggle)
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Semana de", "Menções"])
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(13)
    expect(Array.from(rows[0]!.children).map((cell) => cell.textContent)).toEqual(["7 jul", "40"])
    expect(rows[12]!.children[1]).toHaveClass("hds-chart-num")
    expect(screen.queryByRole("slider")).toBeNull()
    expect(toggle).toHaveTextContent("Ver gráfico")
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(toggle)
    expect(screen.getByRole("slider")).toBeInTheDocument()
  })

  it("draws nothing to read on an empty series, and a lone point in the middle", () => {
    const { container, rerender } = renderChart([])
    const slider = screen.getByRole("slider")
    fireEvent.focus(slider)
    fireEvent.keyDown(slider, { key: "End" })
    fireEvent.mouseMove(slider, { clientX: 10 })
    expect(container.querySelector(".hds-line-end")).toBeNull()
    expect(slider).not.toHaveAttribute("aria-valuetext")
    rerender(<LineChart points={[{ label: "29 set", value: 0 }]} seriesLabel="x" ariaLabel="y" labels={LABELS} formatTick={(v) => `${v}!`} />)
    expect(container.querySelector(".hds-line-end")?.getAttribute("cx")).toBe(String(pointX(0, 1, LINE_FALLBACK_WIDTH)))
    expect(container.querySelector(".hds-line-tick")?.textContent).toBe("0!")
  })

  it("rounds the axis to a nice step", () => {
    expect(niceScale(64)).toEqual({ step: 20, top: 80 })
    expect(niceScale(9)).toEqual({ step: 2.5, top: 10 })
    expect(niceScale(0)).toEqual({ step: 0.25, top: 1 })
    expect(niceScale(1700)).toEqual({ step: 500, top: 2000 })
    expect(nearestPoint(0, 1, 560)).toBe(0)
    expect(nearestPoint(0, 13, 560)).toBe(0)
  })
})
