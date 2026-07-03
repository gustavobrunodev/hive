import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Kbd } from "./Kbd"

describe("Kbd", () => {
  it("renders as a <kbd> element", () => {
    render(<Kbd>K</Kbd>)
    const el = screen.getByText("K")
    expect(el.tagName).toBe("KBD")
  })

  it("renders its children", () => {
    render(<Kbd>Enter</Kbd>)
    expect(screen.getByText("Enter")).toBeInTheDocument()
  })

  it("renders symbol children such as ⌘", () => {
    render(<Kbd>⌘</Kbd>)
    expect(screen.getByText("⌘")).toBeInTheDocument()
  })

  it("applies the base hds-kbd class", () => {
    render(<Kbd>K</Kbd>)
    expect(screen.getByText("K")).toHaveClass("hds-kbd")
  })

  it("merges a custom className alongside the base class", () => {
    render(<Kbd className="custom-class">K</Kbd>)
    expect(screen.getByText("K")).toHaveClass("hds-kbd", "custom-class")
  })

  it("spreads extra native props onto the host element", () => {
    render(<Kbd title="Command key">⌘</Kbd>)
    const el = screen.getByText("⌘")
    expect(el).toHaveAttribute("title", "Command key")
  })
})
