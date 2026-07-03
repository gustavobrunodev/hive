import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HarnessMark } from "./HarnessMark"

describe("HarnessMark", () => {
  it("renders the default symbol variant", () => {
    render(<HarnessMark />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass("hds-hbmark")
  })

  it("renders the wordmark variant with default endorsement shown", () => {
    render(<HarnessMark variant="wordmark" />)

    expect(screen.getByText("Harness Builder")).toBeInTheDocument()
    expect(screen.getByText("Uma skill · HIVE")).toBeInTheDocument()
  })

  it("hides the endorsement when endorsement=false", () => {
    render(<HarnessMark variant="wordmark" endorsement={false} />)

    expect(screen.getByText("Harness Builder")).toBeInTheDocument()
    expect(screen.queryByText("Uma skill · HIVE")).not.toBeInTheDocument()
  })

  it("renders the icon variant with a default size and background when omitted", () => {
    render(<HarnessMark variant="icon" />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveClass("hds-hbmark-tile")
    expect(el).toHaveStyle({ width: "96px", height: "96px", background: "var(--bordo-2)" })
  })

  it("renders the icon variant with a custom size and background", () => {
    render(<HarnessMark variant="icon" size={64} background="var(--coral)" />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveStyle({ width: "64px", height: "64px", background: "var(--coral)" })
  })

  it("renders the horizontal variant with a default size when omitted", () => {
    render(<HarnessMark variant="horizontal" />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveClass("hds-hbmark-row")
    expect(el).toHaveStyle({ gap: "14px" })
    expect(screen.getByText("Harness Builder")).toBeInTheDocument()
  })

  it("renders the horizontal variant with a custom size", () => {
    render(<HarnessMark variant="horizontal" size={44} />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveStyle({ gap: "14px" })
  })

  it("renders the stacked variant with a default size when omitted", () => {
    render(<HarnessMark variant="stacked" />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveClass("hds-hbmark-stack")
    expect(screen.getByText("Harness Builder")).toBeInTheDocument()
  })

  it("renders the stacked variant with a custom size", () => {
    render(<HarnessMark variant="stacked" size={80} />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveClass("hds-hbmark-stack")
  })

  it("applies mono tone color to symbol and wordmark", () => {
    render(<HarnessMark variant="wordmark" tone="mono" color="#260a12" />)

    const name = screen.getByText("Harness Builder")
    expect(name).toHaveStyle({ color: "#260a12" })
  })

  it("falls back to currentColor for mono tone without an explicit color", () => {
    const { container } = render(<HarnessMark variant="symbol" tone="mono" />)

    const stroke = container.querySelector("polygon[fill='none']")
    expect(stroke).toHaveAttribute("stroke", "currentColor")
  })

  it("uses color tone by default (ignores color prop for wordmark text)", () => {
    render(<HarnessMark variant="wordmark" color="#260a12" />)

    const name = screen.getByText("Harness Builder")
    expect(name).toHaveStyle({ color: "var(--ink)" })
  })

  it("merges a custom className with the base class", () => {
    render(<HarnessMark className="extra" />)

    const el = screen.getByRole("img", { name: "Harness Builder" })
    expect(el).toHaveClass("hds-hbmark")
    expect(el).toHaveClass("extra")
  })

  it("spreads additional host props onto the root element", () => {
    render(<HarnessMark data-testid="mark" />)

    expect(screen.getByTestId("mark")).toBeInTheDocument()
  })
})
