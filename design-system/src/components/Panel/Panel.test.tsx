import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Panel } from "./Panel"

describe("Panel", () => {
  it("renders children as text content", () => {
    render(<Panel>Content</Panel>)
    expect(screen.getByText("Content")).toBeInTheDocument()
  })

  it("renders a div by default", () => {
    render(<Panel data-testid="panel">Content</Panel>)
    expect(screen.getByTestId("panel").tagName).toBe("DIV")
  })

  it("defaults to cut=true and applies the cut class", () => {
    render(<Panel data-testid="panel">Content</Panel>)
    expect(screen.getByTestId("panel")).toHaveClass("hds-panel", "cut")
  })

  it("omits the cut class when cut is false", () => {
    render(
      <Panel cut={false} data-testid="panel">
        Content
      </Panel>
    )
    const el = screen.getByTestId("panel")
    expect(el).toHaveClass("hds-panel")
    expect(el).not.toHaveClass("cut")
  })

  it("defaults to hover='none' and omits interactive classes", () => {
    render(<Panel data-testid="panel">Content</Panel>)
    const el = screen.getByTestId("panel")
    expect(el).not.toHaveClass("hds-panel-interactive")
    expect(el).not.toHaveClass("hds-panel-hover-lift")
    expect(el).not.toHaveClass("hds-panel-hover-slide")
  })

  it("applies interactive + lift classes when hover='lift'", () => {
    render(
      <Panel hover="lift" data-testid="panel">
        Content
      </Panel>
    )
    const el = screen.getByTestId("panel")
    expect(el).toHaveClass("hds-panel-interactive", "hds-panel-hover-lift")
    expect(el).not.toHaveClass("hds-panel-hover-slide")
  })

  it("applies interactive + slide classes when hover='slide'", () => {
    render(
      <Panel hover="slide" data-testid="panel">
        Content
      </Panel>
    )
    const el = screen.getByTestId("panel")
    expect(el).toHaveClass("hds-panel-interactive", "hds-panel-hover-slide")
    expect(el).not.toHaveClass("hds-panel-hover-lift")
  })

  it("omits the accent border class by default", () => {
    render(<Panel data-testid="panel">Content</Panel>)
    expect(screen.getByTestId("panel")).not.toHaveClass("hds-panel-accent-border")
  })

  it("applies the accent border class when accentBorder is true", () => {
    render(
      <Panel accentBorder data-testid="panel">
        Content
      </Panel>
    )
    expect(screen.getByTestId("panel")).toHaveClass("hds-panel-accent-border")
  })

  it("renders the element specified by the as prop", () => {
    render(
      <Panel as="article" data-testid="panel">
        Content
      </Panel>
    )
    expect(screen.getByTestId("panel").tagName).toBe("ARTICLE")
  })

  it("passes through a custom className alongside the base classes", () => {
    render(
      <Panel className="custom-class" data-testid="panel">
        Content
      </Panel>
    )
    expect(screen.getByTestId("panel")).toHaveClass("hds-panel", "cut", "custom-class")
  })

  it("spreads other rest props onto the host element", () => {
    render(
      <Panel data-testid="panel" title="hint">
        Content
      </Panel>
    )
    expect(screen.getByTestId("panel")).toHaveAttribute("title", "hint")
  })
})
