import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DotsBackground } from "./DotsBackground"

describe("DotsBackground", () => {
  it("renders a hidden dots overlay div", () => {
    const { container } = render(<DotsBackground />)
    const el = container.querySelector(".dots")
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute("aria-hidden", "true")
    expect(el?.tagName).toBe("DIV")
  })
})
