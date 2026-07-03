import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Separator } from "./Separator"

describe("Separator", () => {
  it("renders horizontal by default", () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId("sep")
    expect(sep).toHaveAttribute("data-orientation", "horizontal")
    expect(sep).toHaveClass("hds-separator")
  })

  it("renders vertical via orientation prop", () => {
    render(<Separator orientation="vertical" data-testid="sep" />)
    const sep = screen.getByTestId("sep")
    expect(sep).toHaveAttribute("data-orientation", "vertical")
  })

  it("is decorative by default and has no role=separator", () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId("sep")
    expect(sep).not.toHaveAttribute("role", "separator")
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
  })

  it("sets role=separator when decorative is false", () => {
    render(<Separator decorative={false} data-testid="sep" />)
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })

  it("merges a custom className with the base class", () => {
    render(<Separator className="extra" data-testid="sep" />)
    const sep = screen.getByTestId("sep")
    expect(sep).toHaveClass("hds-separator", "extra")
  })
})
