import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Skeleton } from "./Skeleton"

describe("Skeleton", () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it("renders a div with the shimmer class", () => {
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId("sk")
    expect(el.tagName).toBe("DIV")
    expect(el).toHaveClass("hds-skeleton")
    expect(el).not.toHaveClass("hds-skeleton-static")
  })

  it("forwards ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>()
    render(<Skeleton data-testid="sk" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toBe(screen.getByTestId("sk"))
  })

  it("passes through width, height, and className so consumers can compose shapes", () => {
    render(<Skeleton data-testid="sk" className="avatar-sk" style={{ width: 40, height: 40, borderRadius: "50%" }} />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveClass("hds-skeleton")
    expect(el).toHaveClass("avatar-sk")
    expect(el).toHaveStyle({ width: "40px", height: "40px", borderRadius: "50%" })
  })

  it("supports a text-line shape via fixed height and full width", () => {
    render(<Skeleton data-testid="sk" style={{ width: "100%", height: 16 }} />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveStyle({ width: "100%", height: "16px" })
  })

  it("renders decorative semantics: role=presentation and aria-hidden=true", () => {
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveAttribute("role", "presentation")
    expect(el).toHaveAttribute("aria-hidden", "true")
  })

  it("is not exposed by an accessible role query (decorative, not a status)", () => {
    render(<Skeleton data-testid="sk" />)
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("animates by default when reduced motion is not preferred", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveClass("hds-skeleton")
    expect(el).not.toHaveClass("hds-skeleton-static")
  })

  it("collapses the shimmer to a static appearance when prefers-reduced-motion is set", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveClass("hds-skeleton")
    expect(el).toHaveClass("hds-skeleton-static")
  })

  it("falls back to animated (non-static) when matchMedia is unavailable", () => {
    // @ts-expect-error - simulate an environment without matchMedia support
    delete window.matchMedia
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId("sk")
    expect(el).not.toHaveClass("hds-skeleton-static")
  })

  it("allows consumers to override the default role/aria-hidden via props", () => {
    render(<Skeleton data-testid="sk" aria-hidden="false" />)
    const el = screen.getByTestId("sk")
    expect(el).toHaveAttribute("aria-hidden", "false")
  })
})
