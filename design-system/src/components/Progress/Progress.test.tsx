import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Progress } from "./Progress"

describe("Progress", () => {
  it("renders with role=\"progressbar\"", () => {
    render(<Progress value={40} max={100} />)
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("reflects value/max props via aria-valuenow/aria-valuemax", () => {
    render(<Progress value={40} max={100} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "40")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("reflects a custom max", () => {
    render(<Progress value={3} max={5} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "3")
    expect(bar).toHaveAttribute("aria-valuemax", "5")
  })

  it("sets data-state=\"complete\" when value === max", () => {
    render(<Progress value={100} max={100} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-state", "complete")
  })

  it("sets data-state=\"loading\" when value < max", () => {
    render(<Progress value={40} max={100} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-state", "loading")
  })

  it("is determinate by default (no value prop passed)", () => {
    render(<Progress />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "0")
    expect(bar).toHaveAttribute("data-state", "loading")
  })

  it("renders the indeterminate state when value is null, with no aria-valuenow", () => {
    render(<Progress value={null} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("data-state", "indeterminate")
    expect(bar).not.toHaveAttribute("aria-valuenow")
  })

  it("merges a custom className", () => {
    render(<Progress value={40} max={100} className="extra" />)
    expect(screen.getByRole("progressbar")).toHaveClass("hds-progress", "extra")
  })

  it("forwards a ref to the root element", () => {
    const ref = { current: null as HTMLDivElement | null }
    render(<Progress ref={ref} value={40} max={100} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveClass("hds-progress")
  })
})
