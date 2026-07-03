import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Avatar } from "./Avatar"

describe("Avatar", () => {
  it("renders the fallback when no src is provided (default delayMs)", async () => {
    render(<Avatar fallback="AB" alt="Ada Lovelace" />)
    expect(await screen.findByText("AB")).toBeInTheDocument()
  })

  it("renders the fallback when the image fails to load (realistic jsdom default)", async () => {
    render(<Avatar src="https://example.com/avatar.png" alt="Ada Lovelace" fallback="AB" delayMs={0} />)
    expect(await screen.findByText("AB")).toBeInTheDocument()
    // jsdom never actually loads the image, so no <img> should be visible.
    expect(screen.queryByRole("img", { name: "Ada Lovelace" })).not.toBeInTheDocument()
  })

  it("renders at the default md pixel size (32px)", () => {
    render(<Avatar data-testid="avatar" fallback="AB" delayMs={0} />)
    const avatar = screen.getByTestId("avatar")
    expect(avatar.style.width).toBe("32px")
    expect(avatar.style.height).toBe("32px")
  })

  it("renders at the sm/lg named scale sizes", () => {
    const { rerender } = render(<Avatar data-testid="avatar" fallback="AB" size="sm" delayMs={0} />)
    let avatar = screen.getByTestId("avatar")
    expect(avatar.style.width).toBe("24px")
    expect(avatar.style.height).toBe("24px")

    rerender(<Avatar data-testid="avatar" fallback="AB" size="lg" delayMs={0} />)
    avatar = screen.getByTestId("avatar")
    expect(avatar.style.width).toBe("40px")
    expect(avatar.style.height).toBe("40px")
  })

  it("renders at an exact pixel size when size is a number", () => {
    render(<Avatar data-testid="avatar" fallback="AB" size={48} delayMs={0} />)
    const avatar = screen.getByTestId("avatar")
    expect(avatar.style.width).toBe("48px")
    expect(avatar.style.height).toBe("48px")
  })

  it("renders no status dot when status is omitted", () => {
    render(<Avatar data-testid="avatar" fallback="AB" delayMs={0} />)
    const avatar = screen.getByTestId("avatar")
    expect(avatar.querySelector(".hds-avatar-status")).not.toBeInTheDocument()
  })

  it.each([
    ["online", "hds-avatar-status-online"],
    ["offline", "hds-avatar-status-offline"],
    ["away", "hds-avatar-status-away"],
    ["busy", "hds-avatar-status-busy"],
  ] as const)("renders the %s status dot with the %s class", (status, expectedClass) => {
    render(<Avatar data-testid="avatar" fallback="AB" status={status} delayMs={0} />)
    const avatar = screen.getByTestId("avatar")
    const dot = avatar.querySelector(".hds-avatar-status")
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveClass("hds-avatar-status", expectedClass)
  })

  it("merges a custom className", () => {
    render(<Avatar data-testid="avatar" fallback="AB" className="extra" delayMs={0} />)
    const avatar = screen.getByTestId("avatar")
    expect(avatar).toHaveClass("hds-avatar", "extra")
  })

  it("forwards a ref to the underlying span element", () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(<Avatar fallback="AB" ref={ref} delayMs={0} />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })
})
