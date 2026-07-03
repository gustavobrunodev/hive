import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SteppedList, SteppedListItem } from "./SteppedList"

describe("SteppedList", () => {
  it("renders an ol element with the base class", () => {
    render(<SteppedList data-testid="list" />)
    const el = screen.getByTestId("list")
    expect(el.tagName).toBe("OL")
    expect(el).toHaveClass("hds-steps-list")
  })

  it("applies a custom className alongside the base class", () => {
    render(<SteppedList data-testid="list" className="custom-list" />)
    expect(screen.getByTestId("list")).toHaveClass("hds-steps-list", "custom-list")
  })

  it("renders children passed to it", () => {
    render(
      <SteppedList>
        <li>Item one</li>
      </SteppedList>
    )
    expect(screen.getByText("Item one")).toBeInTheDocument()
  })

  it("spreads rest props onto the host ol element", () => {
    render(<SteppedList data-testid="list" title="hint" />)
    expect(screen.getByTestId("list")).toHaveAttribute("title", "hint")
  })
})

describe("SteppedListItem", () => {
  it("renders the title and description", () => {
    render(<SteppedListItem title="Step title" description="Step description" />)
    expect(screen.getByText("Step title")).toBeInTheDocument()
    expect(screen.getByText("Step description")).toBeInTheDocument()
  })

  it("renders title in an element with the hds-st-t class", () => {
    render(<SteppedListItem title="Step title" description="Step description" />)
    expect(screen.getByText("Step title")).toHaveClass("hds-st-t")
  })

  it("renders description in an element with the hds-st-d class", () => {
    render(<SteppedListItem title="Step title" description="Step description" />)
    expect(screen.getByText("Step description")).toHaveClass("hds-st-d")
  })

  it("renders empty title/description containers when omitted", () => {
    render(<SteppedListItem data-testid="item" />)
    const item = screen.getByTestId("item")
    expect(item.querySelector(".hds-st-t")).toBeInTheDocument()
    expect(item.querySelector(".hds-st-t")).toBeEmptyDOMElement()
    expect(item.querySelector(".hds-st-d")).toBeInTheDocument()
    expect(item.querySelector(".hds-st-d")).toBeEmptyDOMElement()
  })

  it("renders children in addition to title and description", () => {
    render(
      <SteppedListItem title="Step title" description="Step description">
        <span>Extra content</span>
      </SteppedListItem>
    )
    expect(screen.getByText("Extra content")).toBeInTheDocument()
  })

  it("applies a custom className to the li element", () => {
    render(<SteppedListItem data-testid="item" className="custom-item" />)
    expect(screen.getByTestId("item")).toHaveClass("custom-item")
  })

  it("renders as a li element", () => {
    render(<SteppedListItem data-testid="item" />)
    expect(screen.getByTestId("item").tagName).toBe("LI")
  })

  it("spreads rest props onto the host li element", () => {
    render(<SteppedListItem data-testid="item" aria-label="hint" />)
    expect(screen.getByTestId("item")).toHaveAttribute("aria-label", "hint")
  })
})
