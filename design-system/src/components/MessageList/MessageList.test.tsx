import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { MessageList } from "./MessageList"

function getViewport(): HTMLDivElement {
  return document.querySelector(".hds-scroll-area-viewport") as HTMLDivElement
}

/** jsdom reports 0 for scrollHeight/clientHeight (no real layout) and they're read-only getters — override them per-test to simulate scroll geometry. */
function mockGeometry(viewport: HTMLDivElement, { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(viewport, "scrollHeight", { value: scrollHeight, configurable: true })
  Object.defineProperty(viewport, "clientHeight", { value: clientHeight, configurable: true })
  Object.defineProperty(viewport, "scrollTop", { value: scrollTop, writable: true, configurable: true })
}

describe("MessageList", () => {
  it("renders its children", () => {
    render(
      <MessageList>
        <div>Message one</div>
        <div>Message two</div>
      </MessageList>
    )
    expect(screen.getByText("Message one")).toBeInTheDocument()
    expect(screen.getByText("Message two")).toBeInTheDocument()
  })

  it("scrolls to the bottom on mount", () => {
    render(
      <MessageList>
        <div>Message</div>
      </MessageList>
    )
    const viewport = getViewport()
    mockGeometry(viewport, { scrollHeight: 500, clientHeight: 200, scrollTop: 0 })
    // scrollTop is asserted indirectly via the "jump to latest" button being
    // absent by default (isPinned starts true) — see next test for the
    // scrolled-away case, which is the behavior that actually matters here.
    expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument()
  })

  it("shows the jump-to-latest button once the user scrolls away from the bottom", () => {
    render(
      <MessageList bottomThreshold={80}>
        <div>Message</div>
      </MessageList>
    )
    const viewport = getViewport()
    mockGeometry(viewport, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 })

    fireEvent.scroll(viewport)
    expect(screen.getByText("Jump to latest")).toBeInTheDocument()
  })

  it("hides the jump-to-latest button once scrolled back within the threshold", () => {
    render(
      <MessageList bottomThreshold={80}>
        <div>Message</div>
      </MessageList>
    )
    const viewport = getViewport()
    mockGeometry(viewport, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 })
    fireEvent.scroll(viewport)
    expect(screen.getByText("Jump to latest")).toBeInTheDocument()

    mockGeometry(viewport, { scrollHeight: 1000, clientHeight: 200, scrollTop: 780 })
    fireEvent.scroll(viewport)
    expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument()
  })

  it("clicking jump-to-latest scrolls to bottom and hides the button", async () => {
    const user = userEvent.setup()
    render(
      <MessageList>
        <div>Message</div>
      </MessageList>
    )
    const viewport = getViewport()
    mockGeometry(viewport, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 })
    fireEvent.scroll(viewport)
    const button = screen.getByText("Jump to latest")

    await user.click(button)
    expect(viewport.scrollTop).toBe(1000)
    expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument()
  })

  it("accepts a custom jumpToLatestLabel", () => {
    render(
      <MessageList jumpToLatestLabel="New messages">
        <div>Message</div>
      </MessageList>
    )
    const viewport = getViewport()
    mockGeometry(viewport, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 })
    fireEvent.scroll(viewport)
    expect(screen.getByText("New messages")).toBeInTheDocument()
  })

  it("merges a custom className on the root", () => {
    const { container } = render(
      <MessageList className="extra">
        <div>Message</div>
      </MessageList>
    )
    expect(container.firstChild).toHaveClass("hds-message-list", "extra")
  })
})
