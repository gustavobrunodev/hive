import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PinChip } from "./PinChip"

describe("PinChip", () => {
  it("renders children as text content", () => {
    render(<PinChip>D</PinChip>)
    expect(screen.getByText("D")).toBeInTheDocument()
  })

  it("defaults to the drive variant", () => {
    render(<PinChip>D</PinChip>)
    expect(screen.getByText("D")).toHaveClass("hds-pin-chip", "hds-pin-chip-drive")
  })

  it("renders the drive variant explicitly", () => {
    render(<PinChip variant="drive">Drive</PinChip>)
    const el = screen.getByText("Drive")
    expect(el).toHaveClass("hds-pin-chip", "hds-pin-chip-drive")
    expect(el).not.toHaveClass("hds-pin-chip-deleg")
  })

  it("renders the deleg variant", () => {
    render(<PinChip variant="deleg">Deleg</PinChip>)
    const el = screen.getByText("Deleg")
    expect(el).toHaveClass("hds-pin-chip", "hds-pin-chip-deleg")
    expect(el).not.toHaveClass("hds-pin-chip-drive")
  })

  it("passes through a custom className alongside the base classes", () => {
    render(<PinChip className="custom-class">Passthrough</PinChip>)
    expect(screen.getByText("Passthrough")).toHaveClass("hds-pin-chip", "hds-pin-chip-drive", "custom-class")
  })

  it("spreads other rest props onto the host span", () => {
    render(
      <PinChip data-testid="pin-chip-el" title="hint">
        Rest
      </PinChip>
    )
    const el = screen.getByTestId("pin-chip-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})
