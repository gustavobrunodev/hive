import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Reveal, Stagger } from "./Reveal"
import * as useRevealModule from "../../hooks/useReveal"

function mockUseReveal(isIn: boolean) {
  return vi.spyOn(useRevealModule, "useReveal").mockReturnValue([{ current: null }, isIn])
}

describe("Reveal", () => {
  it("renders a div by default", () => {
    mockUseReveal(false)
    render(<Reveal data-testid="reveal">content</Reveal>)
    const el = screen.getByTestId("reveal")
    expect(el.tagName).toBe("DIV")
    expect(el).toHaveClass("reveal")
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  it("renders the element passed via `as`", () => {
    mockUseReveal(false)
    render(
      <Reveal as="section" data-testid="reveal">
        content
      </Reveal>
    )
    expect(screen.getByTestId("reveal").tagName).toBe("SECTION")
  })

  it("does not apply the `in` class when not yet revealed", () => {
    mockUseReveal(false)
    render(<Reveal data-testid="reveal">content</Reveal>)
    const el = screen.getByTestId("reveal")
    expect(el).toHaveClass("reveal")
    expect(el).not.toHaveClass("in")
  })

  it("applies the `in` class once revealed", () => {
    mockUseReveal(true)
    render(<Reveal data-testid="reveal">content</Reveal>)
    const el = screen.getByTestId("reveal")
    expect(el).toHaveClass("reveal", "in")
  })

  it("merges a custom className with the base class", () => {
    mockUseReveal(false)
    render(
      <Reveal className="custom" data-testid="reveal">
        content
      </Reveal>
    )
    expect(screen.getByTestId("reveal")).toHaveClass("reveal", "custom")
  })

  it("spreads rest props onto the host element", () => {
    mockUseReveal(false)
    render(
      <Reveal data-testid="reveal" title="hint">
        content
      </Reveal>
    )
    expect(screen.getByTestId("reveal")).toHaveAttribute("title", "hint")
  })
})

describe("Stagger", () => {
  it("renders a div by default", () => {
    mockUseReveal(false)
    render(<Stagger data-testid="stagger">content</Stagger>)
    const el = screen.getByTestId("stagger")
    expect(el.tagName).toBe("DIV")
    expect(el).toHaveClass("stagger")
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  it("renders the element passed via `as`", () => {
    mockUseReveal(false)
    render(
      <Stagger as="ul" data-testid="stagger">
        content
      </Stagger>
    )
    expect(screen.getByTestId("stagger").tagName).toBe("UL")
  })

  it("does not apply the `in` class when not yet revealed", () => {
    mockUseReveal(false)
    render(<Stagger data-testid="stagger">content</Stagger>)
    const el = screen.getByTestId("stagger")
    expect(el).toHaveClass("stagger")
    expect(el).not.toHaveClass("in")
  })

  it("applies the `in` class once revealed", () => {
    mockUseReveal(true)
    render(<Stagger data-testid="stagger">content</Stagger>)
    const el = screen.getByTestId("stagger")
    expect(el).toHaveClass("stagger", "in")
  })

  it("merges a custom className with the base class", () => {
    mockUseReveal(false)
    render(
      <Stagger className="custom" data-testid="stagger">
        content
      </Stagger>
    )
    expect(screen.getByTestId("stagger")).toHaveClass("stagger", "custom")
  })

  it("spreads rest props onto the host element", () => {
    mockUseReveal(false)
    render(
      <Stagger data-testid="stagger" title="hint">
        content
      </Stagger>
    )
    expect(screen.getByTestId("stagger")).toHaveAttribute("title", "hint")
  })
})
