import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SkillGrid, SkillCard, SkillSpinePin } from "./SkillCard"

describe("SkillGrid", () => {
  it("renders children inside the grid container", () => {
    render(
      <SkillGrid>
        <span>Skill A</span>
      </SkillGrid>
    )
    expect(screen.getByText("Skill A")).toBeInTheDocument()
  })

  it("applies the base grid class alongside a custom className", () => {
    render(
      <SkillGrid className="custom-grid" data-testid="grid">
        content
      </SkillGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveClass("hds-skills", "custom-grid")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <SkillGrid data-testid="grid" title="hint">
        content
      </SkillGrid>
    )
    const el = screen.getByTestId("grid")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("DIV")
  })
})

describe("SkillSpinePin", () => {
  it("renders nothing but the wrapper when drive and delegate are empty", () => {
    const { container } = render(<SkillSpinePin />)
    const wrapper = container.querySelector(".hds-skill-spine-pin")
    expect(wrapper).toBeInTheDocument()
    expect(wrapper?.children.length).toBe(0)
  })

  it("renders the drive row with default label and chips when drive is provided", () => {
    render(<SkillSpinePin drive={["Design", "Review"]} />)
    expect(screen.getByText("Conduz")).toBeInTheDocument()
    expect(screen.getByText("Design")).toBeInTheDocument()
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.queryByText("Delega")).not.toBeInTheDocument()
  })

  it("renders the delegate row with default label and chips when delegate is provided", () => {
    render(<SkillSpinePin delegate={["Ops"]} />)
    expect(screen.getByText("Delega")).toBeInTheDocument()
    expect(screen.getByText("Ops")).toBeInTheDocument()
    expect(screen.queryByText("Conduz")).not.toBeInTheDocument()
  })

  it("renders both rows with custom labels when provided", () => {
    render(
      <SkillSpinePin
        driveLabel="Leads"
        drive={["Strategy"]}
        delegateLabel="Supports"
        delegate={["QA"]}
      />
    )
    expect(screen.getByText("Leads")).toBeInTheDocument()
    expect(screen.getByText("Strategy")).toBeInTheDocument()
    expect(screen.getByText("Supports")).toBeInTheDocument()
    expect(screen.getByText("QA")).toBeInTheDocument()
  })

  it("renders drive chips with the drive variant class", () => {
    render(<SkillSpinePin drive={["Design"]} />)
    expect(screen.getByText("Design")).toHaveClass("hds-pin-chip-drive")
  })

  it("renders delegate chips with the deleg variant class", () => {
    render(<SkillSpinePin delegate={["Ops"]} />)
    expect(screen.getByText("Ops")).toHaveClass("hds-pin-chip-deleg")
  })
})

describe("SkillCard", () => {
  it("renders role, title and children", () => {
    render(
      <SkillCard role="Engineer" title="Build Systems">
        Description text
      </SkillCard>
    )
    expect(screen.getByText("Engineer")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Build Systems" })).toBeInTheDocument()
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("renders as an article element with panel classes and custom className", () => {
    render(
      <SkillCard role="r" title="Title" className="custom-skill">
        body
      </SkillCard>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-skill", "custom-skill")
    expect(article).not.toHaveClass("hds-skill-lead")
  })

  it("applies the lead-card class and accent border when lead is true", () => {
    render(
      <SkillCard role="r" title="Title" lead>
        body
      </SkillCard>
    )
    const article = screen.getByRole("article")
    expect(article).toHaveClass("hds-skill", "hds-skill-lead")
  })

  it("does not render the number badge when number is omitted", () => {
    render(
      <SkillCard role="r" title="Title">
        body
      </SkillCard>
    )
    expect(document.querySelector(".hds-skill-num")).not.toBeInTheDocument()
  })

  it("renders the number badge when number is provided", () => {
    render(
      <SkillCard role="r" title="Title" number={3}>
        body
      </SkillCard>
    )
    expect(screen.getByText("3")).toHaveClass("hds-skill-num")
  })

  it("sets the --i custom property from index when provided", () => {
    render(
      <SkillCard role="r" title="Title" index={2}>
        body
      </SkillCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.getPropertyValue("--i")).toBe("2")
  })

  it("preserves an explicit style object when index is not provided", () => {
    render(
      <SkillCard role="r" title="Title" style={{ color: "red" }}>
        body
      </SkillCard>
    )
    const article = screen.getByRole("article")
    expect(article.style.color).toBe("red")
    expect(article.style.getPropertyValue("--i")).toBe("")
  })

  it("spreads rest props onto the underlying Panel host", () => {
    render(
      <SkillCard role="r" title="Title" data-testid="skill">
        body
      </SkillCard>
    )
    expect(screen.getByTestId("skill")).toBeInTheDocument()
  })
})
