import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CaseGrid, CaseCard } from "./CaseCard"

describe("CaseGrid", () => {
  it("renders children inside the grid container", () => {
    render(
      <CaseGrid>
        <span>Card A</span>
      </CaseGrid>
    )
    expect(screen.getByText("Card A")).toBeInTheDocument()
  })

  it("applies the base grid class alongside a custom className", () => {
    render(
      <CaseGrid className="custom-grid" data-testid="grid">
        content
      </CaseGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveClass("hds-cases", "custom-grid")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <CaseGrid data-testid="grid" title="hint">
        content
      </CaseGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("DIV")
  })
})

describe("CaseCard", () => {
  it("renders tag, title and children", () => {
    render(
      <CaseCard tag="Case Study" title="Great Result">
        Description text
      </CaseCard>
    )
    expect(screen.getByText("Case Study")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Great Result" })).toBeInTheDocument()
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("renders as an article element with panel classes and custom className", () => {
    render(
      <CaseCard tag="t" title="Title" className="custom-case">
        body
      </CaseCard>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-case", "custom-case")
  })

  it("does not render the prompt block when prompt is omitted", () => {
    render(
      <CaseCard tag="t" title="Title">
        body
      </CaseCard>
    )
    expect(screen.queryByText("›")).not.toBeInTheDocument()
  })

  it("renders the prompt block when prompt is provided", () => {
    render(
      <CaseCard tag="t" title="Title" prompt="Do the thing">
        body
      </CaseCard>
    )
    expect(screen.getByText("Do the thing")).toBeInTheDocument()
    expect(screen.getByText("›")).toBeInTheDocument()
  })

  it("does not render a mode badge when mode is omitted", () => {
    render(
      <CaseCard tag="t" title="Title">
        body
      </CaseCard>
    )
    expect(screen.queryByText("Automation")).not.toBeInTheDocument()
  })

  it("renders a muted mode badge when mode is provided", () => {
    render(
      <CaseCard tag="t" title="Title" mode="Automation">
        body
      </CaseCard>
    )
    const badge = screen.getByText("Automation")
    expect(badge).toHaveClass("hds-badge-muted")
  })

  it("sets the --i custom property from index when provided", () => {
    render(
      <CaseCard tag="t" title="Title" index={2}>
        body
      </CaseCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.getPropertyValue("--i")).toBe("2")
  })

  it("preserves an explicit style object when index is not provided", () => {
    render(
      <CaseCard tag="t" title="Title" style={{ color: "red" }}>
        body
      </CaseCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.color).toBe("red")
    expect(article.style.getPropertyValue("--i")).toBe("")
  })

  it("spreads rest props onto the underlying Panel host", () => {
    render(
      <CaseCard tag="t" title="Title" data-testid="case">
        body
      </CaseCard>
    )
    expect(screen.getByTestId("case")).toBeInTheDocument()
  })
})
