import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Gauge } from "./Gauge"

describe("Gauge", () => {
  it("is a named meter carrying its value as a percentage", () => {
    render(<Gauge value={0.5} label="Sessão AWS" />)
    const meter = screen.getByRole("meter", { name: "Sessão AWS" })
    expect(meter).toHaveAttribute("aria-valuenow", "50")
    expect(meter).toHaveAttribute("aria-valuemin", "0")
    expect(meter).toHaveAttribute("aria-valuemax", "100")
  })

  it("prefers a spoken value text when one is given — a duration reads better than a percentage", () => {
    render(<Gauge value={0.25} label="Sessão" valueText="2 horas restantes" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "2 horas restantes")
  })

  it("clamps out-of-range and non-finite values instead of drawing nonsense", () => {
    const { rerender } = render(<Gauge value={4} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100")
    rerender(<Gauge value={-1} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
    rerender(<Gauge value={Number.NaN} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
  })

  it("turns from accent to warning to danger as the value drains", () => {
    const { rerender } = render(<Gauge value={0.8} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "accent")
    rerender(<Gauge value={0.3} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "warning")
    rerender(<Gauge value={0.05} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "danger")
  })

  it("honours an explicit tone over the automatic one", () => {
    render(<Gauge value={0.02} label="A" tone="success" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "success")
  })

  it("renders the value and caption inside the ring", () => {
    render(
      <Gauge value={0.5} label="A" caption="restantes">
        6 h
      </Gauge>
    )
    expect(screen.getByText("6 h")).toBeInTheDocument()
    expect(screen.getByText("restantes")).toBeInTheDocument()
  })

  it("draws no face when it has neither value nor caption", () => {
    const { container } = render(<Gauge value={0.5} label="A" />)
    expect(container.querySelector(".hds-gauge-value")).toBeNull()
    expect(container.querySelector(".hds-gauge-caption")).toBeNull()
  })

  it("offsets the arc by the unfilled remainder, so 0 draws nothing and 1 draws the full ring", () => {
    const { container, rerender } = render(<Gauge value={0} label="A" size={100} />)
    const arc = (): SVGCircleElement => container.querySelector(".hds-gauge-arc") as SVGCircleElement
    const circumference = arc().getAttribute("stroke-dasharray")
    expect(arc().getAttribute("stroke-dashoffset")).toBe(circumference)
    rerender(<Gauge value={1} label="A" size={100} />)
    expect(arc().getAttribute("stroke-dashoffset")).toBe("0")
  })

  it("scales its stroke with its size and keeps the ring inside the box", () => {
    const { container } = render(<Gauge value={0.5} label="A" size={200} />)
    const arc = container.querySelector(".hds-gauge-arc") as SVGCircleElement
    const stroke = Number(arc.getAttribute("stroke-width"))
    const radius = Number(arc.getAttribute("r"))
    expect(stroke).toBeGreaterThan(4)
    expect(radius * 2 + stroke).toBeLessThanOrEqual(200)
  })
})
