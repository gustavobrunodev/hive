import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Footer } from "./Footer"

describe("Footer", () => {
  it("renders brand and tagline", () => {
    render(<Footer brand="Hive" tagline="Build things that last." />)

    expect(screen.getByText("Hive")).toBeInTheDocument()
    expect(screen.getByText("Build things that last.")).toBeInTheDocument()
  })

  it("does not render the bottom row when bottomItems is empty", () => {
    const { container } = render(<Footer brand="Hive" tagline="Tagline" />)

    expect(container.querySelector(".hds-ft-bottom")).not.toBeInTheDocument()
  })

  it("renders bottom links with correct hrefs", () => {
    render(
      <Footer
        brand="Hive"
        tagline="Tagline"
        bottomItems={[
          <a href="/privacy">Privacy</a>,
          <a href="/terms">Terms</a>,
        ]}
      />,
    )

    const privacy = screen.getByRole("link", { name: "Privacy" })
    const terms = screen.getByRole("link", { name: "Terms" })

    expect(privacy).toHaveAttribute("href", "/privacy")
    expect(terms).toHaveAttribute("href", "/terms")
  })

  it("forwards className and rest props to the footer element", () => {
    render(<Footer brand="Hive" tagline="Tagline" className="extra" data-testid="ft" />)

    const footer = screen.getByTestId("ft")
    expect(footer).toHaveClass("hds-ft")
    expect(footer).toHaveClass("extra")
  })
})
