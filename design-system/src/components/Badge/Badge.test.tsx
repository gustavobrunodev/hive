import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "./Badge"

describe("Badge", () => {
  it("renders children as text content", () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("applies the accent variant classes by default", () => {
    render(<Badge>Accent</Badge>)
    expect(screen.getByText("Accent")).toHaveClass("hds-badge", "hds-badge-accent")
  })

  it("applies the muted variant classes when variant='muted'", () => {
    render(<Badge variant="muted">Muted</Badge>)
    const el = screen.getByText("Muted")
    expect(el).toHaveClass("hds-badge", "hds-badge-muted")
    expect(el).not.toHaveClass("hds-badge-accent")
  })

  it("passes through a custom className alongside the base classes", () => {
    render(<Badge className="custom-class">Passthrough</Badge>)
    expect(screen.getByText("Passthrough")).toHaveClass("hds-badge", "hds-badge-accent", "custom-class")
  })

  it("spreads other rest props onto the host span", () => {
    render(<Badge data-testid="badge-el" title="hint">Rest</Badge>)
    const el = screen.getByTestId("badge-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})
