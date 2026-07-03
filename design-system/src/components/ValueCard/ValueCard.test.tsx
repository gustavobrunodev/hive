import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ValueGrid, ValueCard } from "./ValueCard"

describe("ValueGrid", () => {
  it("renders children inside the grid container", () => {
    render(
      <ValueGrid>
        <span>Value A</span>
      </ValueGrid>
    )
    expect(screen.getByText("Value A")).toBeInTheDocument()
  })

  it("applies the base grid class alongside a custom className", () => {
    render(
      <ValueGrid className="custom-grid" data-testid="grid">
        content
      </ValueGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveClass("hds-val-grid", "custom-grid")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <ValueGrid data-testid="grid" title="hint">
        content
      </ValueGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("DIV")
  })
})

describe("ValueCard", () => {
  it("renders kicker, title and children", () => {
    render(
      <ValueCard kicker="Speed" title="Ship Faster">
        Description text
      </ValueCard>
    )
    expect(screen.getByText("Speed")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Ship Faster" })).toBeInTheDocument()
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("renders as an article element with panel classes and custom className", () => {
    render(
      <ValueCard kicker="k" title="Title" className="custom-value">
        body
      </ValueCard>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-val", "custom-value")
  })

  it("renders a hidden marker element before the kicker text", () => {
    const { container } = render(
      <ValueCard kicker="Speed" title="Title">
        body
      </ValueCard>
    )
    const marker = container.querySelector(".hds-val-k em")
    expect(marker).toBeInTheDocument()
    expect(marker).toHaveAttribute("aria-hidden", "true")
  })

  it("sets the --i custom property from index when provided", () => {
    render(
      <ValueCard kicker="k" title="Title" index={3}>
        body
      </ValueCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.getPropertyValue("--i")).toBe("3")
  })

  it("preserves an explicit style object when index is not provided", () => {
    render(
      <ValueCard kicker="k" title="Title" style={{ color: "red" }}>
        body
      </ValueCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.color).toBe("red")
    expect(article.style.getPropertyValue("--i")).toBe("")
  })

  it("spreads rest props onto the underlying Panel host", () => {
    render(
      <ValueCard kicker="k" title="Title" data-testid="value">
        body
      </ValueCard>
    )
    expect(screen.getByTestId("value")).toBeInTheDocument()
  })
})
