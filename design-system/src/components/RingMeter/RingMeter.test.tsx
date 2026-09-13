import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RingMeter, ringArcs } from "./RingMeter"

describe("ringArcs", () => {
  it("lays runs end to end from twelve o'clock, taking the gap out of each run's own length", () => {
    const arcs = ringArcs([{ id: "a", value: 0.5 }, { id: "b", value: 0.25 }], 100, 4)
    expect(arcs).toEqual([
      { id: "a", offset: 0, length: 46 },
      { id: "b", offset: 50, length: 21 }
    ])
  })

  it("keeps a sliver whole rather than letting the gap erase it", () => {
    const arcs = ringArcs([{ id: "a", value: 0.01 }], 100, 4)
    expect(arcs[0]?.length).toBe(1)
  })

  it("never draws past one lap, whatever the shares add up to", () => {
    const arcs = ringArcs([{ id: "a", value: 0.8 }, { id: "b", value: 0.8 }], 100, 0)
    expect(arcs[1]?.offset).toBe(80)
    expect(arcs[1]?.length).toBeCloseTo(20)
  })

  it("drops runs with nothing in them", () => {
    expect(ringArcs([{ id: "a", value: 0 }, { id: "b", value: 0.5 }], 100, 0)).toHaveLength(1)
  })
})

describe("RingMeter", () => {
  it("is a named meter carrying its reading as a percentage", () => {
    render(<RingMeter value={0.42} label="Janela de contexto" />)
    const meter = screen.getByRole("meter", { name: "Janela de contexto" })
    expect(meter).toHaveAttribute("aria-valuenow", "42")
    expect(meter).toHaveAttribute("aria-valuemin", "0")
    expect(meter).toHaveAttribute("aria-valuemax", "100")
  })

  it("reads the sum of the segments when it has them", () => {
    render(
      <RingMeter
        label="A"
        segments={[{ id: "a", value: 0.2 }, { id: "b", value: 0.15 }]}
      />
    )
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "35")
  })

  it("turns from accent to warning to danger as it FILLS — the opposite of Gauge", () => {
    const { rerender } = render(<RingMeter value={0.3} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "accent")
    rerender(<RingMeter value={0.8} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "warning")
    rerender(<RingMeter value={0.95} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "danger")
  })

  it("honours caller thresholds and an explicit tone", () => {
    const { rerender } = render(<RingMeter value={0.5} label="A" thresholds={[0.4, 0.6]} />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "warning")
    rerender(<RingMeter value={0.99} label="A" tone="success" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "success")
  })

  it("clamps out-of-range and non-finite values instead of drawing nonsense", () => {
    const { rerender } = render(<RingMeter value={4} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100")
    rerender(<RingMeter value={-1} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
    rerender(<RingMeter value={Number.NaN} label="A" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
  })

  it("prefers a spoken value text when one is given", () => {
    render(<RingMeter value={0.25} label="A" valueText="12,4 mil de 200 mil tokens" />)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "12,4 mil de 200 mil tokens")
  })

  it("draws the track alone when indeterminate, and still reports zero rather than lying", () => {
    const { container } = render(<RingMeter value={0.8} label="A" indeterminate />)
    expect(container.querySelectorAll(".hds-ring-meter-arc")).toHaveLength(0)
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
  })

  it("rounds the lone arc's caps and squares them once runs have neighbours", () => {
    const { container, rerender } = render(<RingMeter value={0.5} label="A" />)
    expect(container.querySelector(".hds-ring-meter-arc")).toHaveAttribute("stroke-linecap", "round")
    rerender(<RingMeter label="A" segments={[{ id: "a", value: 0.3 }, { id: "b", value: 0.2 }]} />)
    expect(container.querySelector(".hds-ring-meter-arc")).toHaveAttribute("stroke-linecap", "butt")
  })

  it("paints a lone arc from CSS and a set from the ramp, unless the run brings its own colour", () => {
    const { container, rerender } = render(<RingMeter value={0.5} label="A" />)
    expect(container.querySelector(".hds-ring-meter-arc")).not.toHaveAttribute("style")
    rerender(<RingMeter label="A" segments={[{ id: "a", value: 0.3 }, { id: "b", value: 0.2 }]} />)
    expect(container.querySelector('[data-seg="a"]')).toHaveStyle({
      stroke: "color-mix(in oklab, var(--hds-ring-fill) 100%, var(--surface-3))"
    })
    rerender(<RingMeter label="A" segments={[{ id: "a", value: 0.3, color: "tomato" }]} />)
    expect(container.querySelector('[data-seg="a"]')).toHaveStyle({ stroke: "tomato" })
  })

  it("keeps the ring inside its box: the stroke is inset by half its own width", () => {
    const { container } = render(<RingMeter value={0.5} label="A" size={100} thickness={10} />)
    const track = container.querySelector(".hds-ring-meter-track") as SVGCircleElement
    expect(track.getAttribute("r")).toBe("45")
  })

  it("draws no face when it has neither value nor caption", () => {
    const { container } = render(<RingMeter value={0.5} label="A" />)
    expect(container.querySelector(".hds-ring-meter-face")).toBeNull()
  })

  it("renders the value and caption inside the ring", () => {
    render(
      <RingMeter value={0.5} label="A" caption="de 200 k">
        50%
      </RingMeter>
    )
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("de 200 k")).toBeInTheDocument()
  })
})
