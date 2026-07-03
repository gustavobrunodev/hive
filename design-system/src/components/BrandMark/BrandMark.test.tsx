import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BrandMark } from "./BrandMark"

describe("BrandMark", () => {
  it("renders the default letter", () => {
    render(<BrandMark />)

    expect(screen.getByText("Z")).toBeInTheDocument()
  })
})
