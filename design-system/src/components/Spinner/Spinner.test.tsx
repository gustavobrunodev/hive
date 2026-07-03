import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Spinner } from "./Spinner"

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }))
  )
}

describe("Spinner", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders with role=status", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("uses the default 'Loading' accessible name", () => {
    render(<Spinner />)
    // jsdom's accessible-name computation doesn't reliably pick up
    // VisuallyHidden (clip-based) descendant text — assert the visually-
    // hidden node's text content directly instead (matches Label's tests).
    expect(screen.getByRole("status")).toHaveTextContent("Loading")
  })

  it("accepts a custom label", () => {
    render(<Spinner label="Submitting" />)
    expect(screen.getByRole("status")).toHaveTextContent("Submitting")
  })

  it("resolves named sizes to pixel dimensions", () => {
    render(<Spinner size="sm" />)
    const status = screen.getByRole("status")
    expect(status).toHaveStyle({ width: "16px", height: "16px" })
  })

  it("defaults to the md size", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toHaveStyle({ width: "24px", height: "24px" })
  })

  it("accepts an exact pixel size", () => {
    render(<Spinner size={40} />)
    expect(screen.getByRole("status")).toHaveStyle({ width: "40px", height: "40px" })
  })

  it("merges a custom className", () => {
    render(<Spinner className="extra" />)
    expect(screen.getByRole("status")).toHaveClass("hds-spinner", "extra")
  })

  it("has no data-reduced-motion attribute when the query does not match", () => {
    mockMatchMedia(false)
    render(<Spinner />)
    expect(screen.getByRole("status")).not.toHaveAttribute("data-reduced-motion")
  })

  it("sets data-reduced-motion when prefers-reduced-motion matches", () => {
    mockMatchMedia(true)
    render(<Spinner />)
    expect(screen.getByRole("status")).toHaveAttribute("data-reduced-motion", "true")
  })

  it("does not throw when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined)
    expect(() => render(<Spinner />)).not.toThrow()
  })
})
