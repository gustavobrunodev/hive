import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TypingIndicator } from "./TypingIndicator"

describe("TypingIndicator", () => {
  it("renders with role=status", () => {
    render(<TypingIndicator />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("uses the default accessible label", () => {
    render(<TypingIndicator />)
    expect(screen.getByRole("status")).toHaveTextContent("Assistant is responding")
  })

  it("accepts a custom label", () => {
    render(<TypingIndicator label="Bot is typing" />)
    expect(screen.getByRole("status")).toHaveTextContent("Bot is typing")
  })

  it("renders three decorative dots hidden from the accessibility tree", () => {
    const { container } = render(<TypingIndicator />)
    const dots = container.querySelectorAll(".hds-typing-indicator-dot")
    expect(dots).toHaveLength(3)
    dots.forEach((dot) => expect(dot).toHaveAttribute("aria-hidden", "true"))
  })

  it("merges a custom className", () => {
    render(<TypingIndicator className="extra" />)
    expect(screen.getByRole("status")).toHaveClass("hds-typing-indicator", "extra")
  })

  it("spreads extra native props", () => {
    render(<TypingIndicator data-testid="typing" />)
    expect(screen.getByTestId("typing")).toBeInTheDocument()
  })
})
