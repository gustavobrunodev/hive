import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ModeSplit, ModeBlock } from "./ModeBlock"

describe("ModeSplit", () => {
  it("renders children inside the split container", () => {
    render(
      <ModeSplit>
        <span>Split child</span>
      </ModeSplit>
    )
    expect(screen.getByText("Split child")).toBeInTheDocument()
  })

  it("applies the base split class alongside a custom className", () => {
    render(
      <ModeSplit className="custom-split" data-testid="split">
        content
      </ModeSplit>
    )
    const el = screen.getByTestId("split")
    expect(el).toHaveClass("hds-modes-split", "custom-split")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <ModeSplit data-testid="split" title="hint">
        content
      </ModeSplit>
    )
    const el = screen.getByTestId("split")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("DIV")
  })
})

describe("ModeBlock", () => {
  it("renders label, title and children", () => {
    render(
      <ModeBlock label="Mode A" title="First Mode">
        Description text
      </ModeBlock>
    )
    expect(screen.getByText("Mode A")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "First Mode" })).toBeInTheDocument()
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("renders as an article element with the mode-block class and custom className", () => {
    render(
      <ModeBlock label="l" title="t" className="custom-mode">
        body
      </ModeBlock>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-mode-block", "custom-mode")
  })

  it("does not render a list when items is omitted", () => {
    render(
      <ModeBlock label="l" title="t">
        body
      </ModeBlock>
    )
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("renders a list item for each entry when items is provided", () => {
    render(
      <ModeBlock label="l" title="t" items={["First", "Second"]}>
        body
      </ModeBlock>
    )
    const list = screen.getByRole("list")
    expect(list).toBeInTheDocument()
    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
  })

  it("does not apply the accent border class when primary is false or omitted", () => {
    render(
      <ModeBlock label="l" title="t">
        body
      </ModeBlock>
    )
    const article = screen.getByRole("article")
    expect(article).not.toHaveClass("hds-panel-accent-border")
  })

  it("applies the accent border class when primary is true", () => {
    render(
      <ModeBlock label="l" title="t" primary>
        body
      </ModeBlock>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-panel-accent-border")
  })

  it("spreads rest props onto the underlying Panel host", () => {
    render(
      <ModeBlock label="l" title="t" data-testid="mode-block">
        body
      </ModeBlock>
    )
    expect(screen.getByTestId("mode-block")).toBeInTheDocument()
  })
})
