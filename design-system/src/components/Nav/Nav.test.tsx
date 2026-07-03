import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Nav } from "./Nav"

describe("Nav", () => {
  it("renders the brand link with default brandHref", () => {
    render(<Nav brand="Harness" />)
    const brandLink = screen.getByRole("link", { name: /Harness/ })
    expect(brandLink).toHaveAttribute("href", "#top")
  })

  it("renders the brand link with a custom brandHref", () => {
    render(<Nav brand="Harness" brandHref="/home" />)
    const brandLink = screen.getByRole("link", { name: /Harness/ })
    expect(brandLink).toHaveAttribute("href", "/home")
  })

  it("does not render the nav links landmark when links is empty", () => {
    render(<Nav brand="Harness" />)
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  it("renders nav links when provided", () => {
    render(
      <Nav
        brand="Harness"
        links={[
          { href: "/docs", label: "Docs" },
          { href: "/about", label: "About" },
        ]}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Navegação principal" })
    expect(nav).toBeInTheDocument()

    const docsLink = screen.getByRole("link", { name: "Docs" })
    expect(docsLink).toHaveAttribute("href", "/docs")

    const aboutLink = screen.getByRole("link", { name: "About" })
    expect(aboutLink).toHaveAttribute("href", "/about")
  })

  it("does not render a CTA button when cta is absent", () => {
    render(<Nav brand="Harness" />)
    expect(screen.queryByRole("link", { name: /CTA/ })).not.toBeInTheDocument()
  })

  it("renders the CTA button when provided", () => {
    render(<Nav brand="Harness" cta={{ href: "/start", label: "Get Started" }} />)
    const cta = screen.getByRole("link", { name: "Get Started" })
    expect(cta).toHaveAttribute("href", "/start")
    expect(cta).toHaveClass("hds-nav-cta")
  })

  it("applies the base class and merges a custom className", () => {
    const { container } = render(<Nav brand="Harness" className="extra" />)
    const header = container.querySelector("header")
    expect(header).toHaveClass("hds-nav", "extra")
  })

  it("spreads extra props onto the header element", () => {
    render(<Nav brand="Harness" data-testid="site-nav" />)
    expect(screen.getByTestId("site-nav")).toBeInTheDocument()
  })
})
