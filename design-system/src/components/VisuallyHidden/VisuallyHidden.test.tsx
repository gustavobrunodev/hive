import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { VisuallyHidden } from "./VisuallyHidden"

describe("VisuallyHidden", () => {
  it("renders its children so they stay queryable / in the accessibility tree", () => {
    render(<VisuallyHidden>Hidden label</VisuallyHidden>)
    expect(screen.getByText("Hidden label")).toBeInTheDocument()
  })

  it("applies Radix's visually-hidden clipping styles", () => {
    render(<VisuallyHidden>Hidden label</VisuallyHidden>)
    const node = screen.getByText("Hidden label")

    expect(node).toHaveStyle({
      position: "absolute",
      overflow: "hidden",
      whiteSpace: "nowrap",
    })
    expect(node.style.width).toBe("1px")
    expect(node.style.height).toBe("1px")
    expect(node.style.margin).toBe("-1px")
    expect(node.style.padding).toBe("0px")
    expect(node.style.border).toBe("0px")
  })

  it("renders a span and spreads extra props (className, data-testid, etc.)", () => {
    render(
      <VisuallyHidden data-testid="vh" className="extra">
        content
      </VisuallyHidden>
    )
    const node = screen.getByTestId("vh")

    expect(node.tagName).toBe("SPAN")
    expect(node).toHaveClass("extra")
  })
})
