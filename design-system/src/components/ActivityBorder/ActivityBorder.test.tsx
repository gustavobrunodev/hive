import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ActivityBorder } from "./ActivityBorder"

describe("ActivityBorder", () => {
  it("renders its children", () => {
    render(
      <ActivityBorder>
        <button type="button">Send</button>
      </ActivityBorder>
    )
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
  })

  it("marks itself active only while work is in flight", () => {
    const { container, rerender } = render(<ActivityBorder>x</ActivityBorder>)
    const wrapper = container.querySelector(".hds-activity-border")
    expect(wrapper).not.toHaveAttribute("data-active")
    rerender(<ActivityBorder active>x</ActivityBorder>)
    expect(wrapper).toHaveAttribute("data-active")
  })

  it("keeps the ring out of the accessibility tree", () => {
    const { container } = render(<ActivityBorder active>x</ActivityBorder>)
    const ring = container.querySelector(".hds-activity-border-ring")
    expect(ring).toHaveAttribute("aria-hidden", "true")
    expect(ring).toHaveAttribute("focusable", "false")
  })

  it("draws the comet as three lanes on one normalised outline", () => {
    const { container } = render(<ActivityBorder active>x</ActivityBorder>)
    const lanes = [...container.querySelectorAll(".hds-activity-border-ring rect")]
    expect(lanes.map((rect) => rect.getAttribute("data-lane"))).toEqual(["tail", "mid", "head"])
    // Without the normalised outline the dash pattern would have to be
    // recomputed for every box size the ring is used on.
    lanes.forEach((rect) => expect(rect).toHaveAttribute("pathLength", "100"))
  })

  it("exposes radius, thickness and duration as custom properties", () => {
    const { container } = render(
      <ActivityBorder radius="20px" thickness="2px" duration="4s">
        x
      </ActivityBorder>
    )
    const wrapper = container.querySelector<HTMLElement>(".hds-activity-border")
    expect(wrapper?.style.getPropertyValue("--hds-activity-radius")).toBe("20px")
    expect(wrapper?.style.getPropertyValue("--hds-activity-thickness")).toBe("2px")
    expect(wrapper?.style.getPropertyValue("--hds-activity-duration")).toBe("4s")
  })

  it("leaves the custom properties unset when not configured, so the CSS defaults win", () => {
    const { container } = render(<ActivityBorder>x</ActivityBorder>)
    const wrapper = container.querySelector<HTMLElement>(".hds-activity-border")
    expect(wrapper?.style.getPropertyValue("--hds-activity-radius")).toBe("")
  })

  it("merges a caller style with the custom properties", () => {
    const { container } = render(
      <ActivityBorder radius="8px" style={{ marginTop: "4px" }}>
        x
      </ActivityBorder>
    )
    const wrapper = container.querySelector<HTMLElement>(".hds-activity-border")
    expect(wrapper?.style.marginTop).toBe("4px")
    expect(wrapper?.style.getPropertyValue("--hds-activity-radius")).toBe("8px")
  })

  it("merges a custom className and spreads native props", () => {
    render(
      <ActivityBorder className="extra" data-testid="ring-host">
        x
      </ActivityBorder>
    )
    expect(screen.getByTestId("ring-host")).toHaveClass("hds-activity-border", "extra")
  })
})
