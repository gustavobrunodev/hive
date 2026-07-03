import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Table, Pkg, Stack, Cond } from "./Table"

describe("Table", () => {
  it("renders children inside a table element wrapped in hds-table-wrap", () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </Table>
    )
    expect(screen.getByText("Cell")).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveClass("hds-table")
  })

  it("applies the cut class by default", () => {
    render(
      <Table data-testid="wrap">
        <tbody />
      </Table>
    )
    expect(screen.getByTestId("wrap")).toHaveClass("hds-table-wrap", "cut")
  })

  it("omits the cut class when cut is false", () => {
    render(
      <Table cut={false} data-testid="wrap">
        <tbody />
      </Table>
    )
    const el = screen.getByTestId("wrap")
    expect(el).toHaveClass("hds-table-wrap")
    expect(el).not.toHaveClass("cut")
  })

  it("passes through a custom className alongside the base classes", () => {
    render(
      <Table className="custom-wrap" data-testid="wrap">
        <tbody />
      </Table>
    )
    expect(screen.getByTestId("wrap")).toHaveClass("hds-table-wrap", "cut", "custom-wrap")
  })

  it("spreads other rest props onto the wrapper host div", () => {
    render(
      <Table data-testid="wrap" title="hint">
        <tbody />
      </Table>
    )
    const el = screen.getByTestId("wrap")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("DIV")
  })
})

describe("Pkg", () => {
  it("renders children as text content", () => {
    render(<Pkg>@hive/design-system</Pkg>)
    expect(screen.getByText("@hive/design-system")).toBeInTheDocument()
  })

  it("applies the base hds-pkg class", () => {
    render(<Pkg>pkg-name</Pkg>)
    expect(screen.getByText("pkg-name")).toHaveClass("hds-pkg")
  })

  it("passes through a custom className", () => {
    render(<Pkg className="custom-pkg">pkg-name</Pkg>)
    expect(screen.getByText("pkg-name")).toHaveClass("hds-pkg", "custom-pkg")
  })

  it("spreads rest props onto the host span", () => {
    render(
      <Pkg data-testid="pkg-el" title="hint">
        pkg
      </Pkg>
    )
    const el = screen.getByTestId("pkg-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})

describe("Stack", () => {
  it("renders children as text content", () => {
    render(<Stack>React + TS</Stack>)
    expect(screen.getByText("React + TS")).toBeInTheDocument()
  })

  it("applies the base hds-stack class", () => {
    render(<Stack>Stack Item</Stack>)
    expect(screen.getByText("Stack Item")).toHaveClass("hds-stack")
  })

  it("passes through a custom className", () => {
    render(<Stack className="custom-stack">Stack Item</Stack>)
    expect(screen.getByText("Stack Item")).toHaveClass("hds-stack", "custom-stack")
  })

  it("spreads rest props onto the host span", () => {
    render(
      <Stack data-testid="stack-el" title="hint">
        stack
      </Stack>
    )
    const el = screen.getByTestId("stack-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})

describe("Cond", () => {
  it("renders children as text content", () => {
    render(<Cond>optional</Cond>)
    expect(screen.getByText("optional")).toBeInTheDocument()
  })

  it("applies the base hds-cond class", () => {
    render(<Cond>Conditional</Cond>)
    expect(screen.getByText("Conditional")).toHaveClass("hds-cond")
  })

  it("passes through a custom className", () => {
    render(<Cond className="custom-cond">Conditional</Cond>)
    expect(screen.getByText("Conditional")).toHaveClass("hds-cond", "custom-cond")
  })

  it("spreads rest props onto the host span", () => {
    render(
      <Cond data-testid="cond-el" title="hint">
        cond
      </Cond>
    )
    const el = screen.getByTestId("cond-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})
