import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Button } from "./Button"

describe("Button", () => {
  it("renders as a link when href is present", () => {
    render(<Button href="/about">Go</Button>)
    const link = screen.getByRole("link", { name: "Go" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/about")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders as a button when href is absent", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: "Click me" })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute("type", "button")
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("applies primary variant classes by default", () => {
    render(<Button>Primary</Button>)
    const button = screen.getByRole("button", { name: "Primary" })
    expect(button).toHaveClass("hds-btn", "hds-btn-primary")
  })

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole("button", { name: "Ghost" })
    expect(button).toHaveClass("hds-btn", "hds-btn-ghost")
  })

  it("renders the arrow indicator when arrow is true", () => {
    render(<Button arrow>With Arrow</Button>)
    const button = screen.getByRole("button", { name: /With Arrow/ })
    const arrow = button.querySelector(".hds-btn-arrow")
    expect(arrow).toBeInTheDocument()
    expect(arrow).toHaveAttribute("aria-hidden", "true")
  })

  it("does not render the arrow indicator by default", () => {
    render(<Button>No Arrow</Button>)
    const button = screen.getByRole("button", { name: "No Arrow" })
    expect(button.querySelector(".hds-btn-arrow")).not.toBeInTheDocument()
  })

  it("applies cut-sm class by default (cut=true)", () => {
    render(<Button>Cut</Button>)
    const button = screen.getByRole("button", { name: "Cut" })
    expect(button).toHaveClass("cut-sm")
  })

  it("omits cut-sm class when cut is false", () => {
    render(<Button cut={false}>No Cut</Button>)
    const button = screen.getByRole("button", { name: "No Cut" })
    expect(button).not.toHaveClass("cut-sm")
  })

  it("merges a custom className", () => {
    render(<Button className="extra">Classy</Button>)
    const button = screen.getByRole("button", { name: "Classy" })
    expect(button).toHaveClass("hds-btn", "extra")
  })

  it("fires onClick for button variant", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Press</Button>)
    await user.click(screen.getByRole("button", { name: "Press" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("spreads extra props onto the anchor for the link branch", () => {
    render(
      <Button href="/docs" target="_blank" rel="noreferrer">
        Docs
      </Button>
    )
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noreferrer")
  })

  // Every Radix `asChild` trigger hands the child a ref; dropping it leaves the
  // popper with no anchor, which is how a wired-up split button ends up opening
  // its menu off-screen. Both branches must forward.
  it("forwards its ref to the underlying button", () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Press</Button>)
    expect(ref.current).toBe(screen.getByRole("button", { name: "Press" }))
  })

  it("forwards its ref to the underlying anchor for the link branch", () => {
    const ref = createRef<HTMLAnchorElement>()
    render(
      <Button ref={ref} href="/docs">
        Docs
      </Button>
    )
    expect(ref.current).toBe(screen.getByRole("link", { name: "Docs" }))
  })
})
