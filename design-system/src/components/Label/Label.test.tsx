import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Label } from "./Label"

describe("Label", () => {
  it("renders as a native label element", () => {
    render(<Label>Email</Label>)
    const label = screen.getByText("Email")
    expect(label.tagName).toBe("LABEL")
  })

  it("passes htmlFor through so it associates with a control", () => {
    render(
      <>
        <Label htmlFor="email-input">Email</Label>
        <input id="email-input" />
      </>
    )
    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  it("renders children", () => {
    render(<Label>Username</Label>)
    expect(screen.getByText("Username")).toBeInTheDocument()
  })

  it("does not render a required indicator by default", () => {
    render(<Label htmlFor="x">Name</Label>)
    const label = screen.getByText("Name").closest("label")!
    expect(label.querySelector(".hds-label-required")).not.toBeInTheDocument()
  })

  it("renders a visual required indicator with an accessible text equivalent", () => {
    render(
      <>
        <Label htmlFor="name-input" required>
          Name
        </Label>
        <input id="name-input" />
      </>
    )
    const label = screen.getByText("Name").closest("label")!

    const asterisk = label.querySelector(".hds-label-required")
    expect(asterisk).toBeInTheDocument()
    expect(asterisk).toHaveAttribute("aria-hidden", "true")
    expect(asterisk).toHaveTextContent("*")

    // Accessible name includes a non-visual "(required)" equivalent, not just the asterisk.
    expect(screen.getByText("(required)")).toBeInTheDocument()
    expect(label.textContent?.replace(/\s+/g, " ").trim()).toBe("Name*(required)")
  })

  it("merges a custom className", () => {
    render(
      <Label htmlFor="x" className="extra">
        Name
      </Label>
    )
    const label = screen.getByText("Name").closest("label")!
    expect(label).toHaveClass("hds-label", "extra")
  })

  it("spreads extra native label props", () => {
    render(
      <Label htmlFor="x" data-testid="my-label" title="hint">
        Name
      </Label>
    )
    const label = screen.getByTestId("my-label")
    expect(label).toHaveAttribute("title", "hint")
  })
})
