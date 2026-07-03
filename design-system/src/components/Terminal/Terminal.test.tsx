import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Terminal } from "./Terminal"

describe("Terminal", () => {
  it("renders the title in the bar", () => {
    render(<Terminal title="zsh — hive" command="npm run build" />)
    expect(screen.getByText("zsh — hive")).toBeInTheDocument()
  })

  it("renders the command text", () => {
    render(<Terminal title="term" command="npm test" />)
    expect(screen.getByText("npm test")).toBeInTheDocument()
  })

  it("applies the cut class by default", () => {
    const { container } = render(<Terminal title="term" command="cmd" />)
    expect(container.firstChild).toHaveClass("hds-term", "cut")
  })

  it("omits the cut class when cut is false", () => {
    const { container } = render(<Terminal title="term" command="cmd" cut={false} />)
    expect(container.firstChild).toHaveClass("hds-term")
    expect(container.firstChild).not.toHaveClass("cut")
  })

  it("does not render output paragraph when output is omitted", () => {
    const { container } = render(<Terminal title="term" command="cmd" />)
    expect(container.querySelector(".hds-term-out")).not.toBeInTheDocument()
  })

  it("renders output text when provided", () => {
    render(<Terminal title="term" command="cmd" output="Build succeeded" />)
    expect(screen.getByText("Build succeeded")).toBeInTheDocument()
  })

  it("does not render phases block when phases is empty", () => {
    const { container } = render(<Terminal title="term" command="cmd" phases={[]} />)
    expect(container.querySelector(".hds-term-phases")).not.toBeInTheDocument()
  })

  it("renders phase chips when phases are provided", () => {
    render(
      <Terminal
        title="term"
        command="cmd"
        phases={[
          { label: "plan", active: true },
          { label: "build", active: false },
        ]}
      />
    )
    const plan = screen.getByText("plan")
    const build = screen.getByText("build")
    expect(plan).toBeInTheDocument()
    expect(build).toBeInTheDocument()
    expect(plan).toHaveClass("is-active")
    expect(build).not.toHaveClass("is-active")
  })

  it("passes through a custom className alongside the base classes", () => {
    const { container } = render(<Terminal title="term" command="cmd" className="custom-class" />)
    expect(container.firstChild).toHaveClass("hds-term", "cut", "custom-class")
  })

  it("spreads other rest props onto the host div", () => {
    render(<Terminal title="term" command="cmd" data-testid="term-el" aria-label="terminal" />)
    const el = screen.getByTestId("term-el")
    expect(el).toHaveAttribute("aria-label", "terminal")
    expect(el.tagName).toBe("DIV")
  })
})
