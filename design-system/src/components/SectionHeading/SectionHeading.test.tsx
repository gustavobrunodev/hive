import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SectionHeading } from "./SectionHeading"

describe("SectionHeading", () => {
  it("renders the heading text and rule, without eyebrow or lead by default", () => {
    render(<SectionHeading>Our Process</SectionHeading>)

    expect(screen.getByRole("heading", { level: 2, name: "Our Process" })).toBeInTheDocument()
    expect(screen.queryByText(/./, { selector: ".hds-eyebrow" })).not.toBeInTheDocument()
    expect(document.querySelector(".hds-lead")).not.toBeInTheDocument()
    expect(document.querySelector(".hds-rule")).toBeInTheDocument()
  })

  it("renders the eyebrow when provided", () => {
    render(<SectionHeading eyebrow="Step One">Our Process</SectionHeading>)

    expect(screen.getByText("Step One")).toBeInTheDocument()
    expect(screen.getByText("Step One")).toHaveClass("hds-eyebrow")
  })

  it("renders the lead paragraph when provided", () => {
    render(<SectionHeading lead="A short description.">Our Process</SectionHeading>)

    const lead = screen.getByText("A short description.")
    expect(lead).toBeInTheDocument()
    expect(lead.tagName).toBe("P")
    expect(lead).toHaveClass("hds-lead")
  })

  it("applies the id to the heading element", () => {
    render(<SectionHeading id="process-heading">Our Process</SectionHeading>)

    const heading = screen.getByRole("heading", { level: 2, name: "Our Process" })
    expect(heading).toHaveAttribute("id", "process-heading")
  })

  it("merges a custom className with the base class and forwards extra props", () => {
    const { container } = render(
      <SectionHeading className="extra" data-testid="section-heading">
        Our Process
      </SectionHeading>
    )

    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass("hds-s-head")
    expect(root).toHaveClass("extra")
    expect(root).toHaveAttribute("data-testid", "section-heading")
  })
})
