import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ScrollArea } from "./ScrollArea"

// jsdom performs no real layout: `ResizeObserver` is a no-op polyfill (see
// test/setup.ts), so Radix's overflow-driven scrollbar visibility (the
// default `type="hover"`/`"auto"` measurement) never resolves to `true`
// here — there's no real geometry to measure. `type="always"` bypasses
// that measurement and renders the scrollbar unconditionally, which is
// what lets these tests assert structural/DOM correctness without faking
// scroll geometry (see task gotchas).

describe("ScrollArea", () => {
  it("renders children inside the viewport", () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <p>Row one</p>
        <p>Row two</p>
      </ScrollArea>
    )

    const viewport = document.querySelector(".hds-scroll-area-viewport")
    expect(viewport).toBeInTheDocument()
    expect(screen.getByText("Row one")).toBeInTheDocument()
    expect(screen.getByText("Row two")).toBeInTheDocument()
    expect(viewport).toContainElement(screen.getByText("Row one"))
    expect(viewport).toContainElement(screen.getByText("Row two"))
  })

  it("renders a scrollbar element", () => {
    render(
      <ScrollArea type="always" data-testid="scroll-area">
        <p>Content</p>
      </ScrollArea>
    )

    const scrollbars = document.querySelectorAll(".hds-scroll-area-scrollbar")
    expect(scrollbars.length).toBeGreaterThan(0)
    expect(
      Array.from(scrollbars).some((el) => el.getAttribute("data-orientation") === "vertical")
    ).toBe(true)
  })

  it("merges a custom className onto the root", () => {
    render(
      <ScrollArea className="extra" data-testid="scroll-area">
        <p>Content</p>
      </ScrollArea>
    )

    expect(screen.getByTestId("scroll-area")).toHaveClass("hds-scroll-area", "extra")
  })

  it("spreads extra props onto the root", () => {
    render(
      <ScrollArea data-testid="scroll-area" aria-label="Message log">
        <p>Content</p>
      </ScrollArea>
    )

    const root = screen.getByTestId("scroll-area")
    expect(root).toHaveAttribute("aria-label", "Message log")
  })

  it("forwards a ref to the root element", () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <ScrollArea ref={ref} data-testid="scroll-area">
        <p>Content</p>
      </ScrollArea>
    )

    expect(ref.current).toBe(screen.getByTestId("scroll-area"))
  })

  it("forwards viewportRef to the actual scrollable viewport element", () => {
    const viewportRef = createRef<HTMLDivElement>()
    render(
      <ScrollArea viewportRef={viewportRef} data-testid="scroll-area">
        <p>Content</p>
      </ScrollArea>
    )

    expect(viewportRef.current).toBe(document.querySelector(".hds-scroll-area-viewport"))
  })
})
