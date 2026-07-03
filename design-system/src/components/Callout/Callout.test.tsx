import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Callout } from "./Callout"

describe("Callout", () => {
  test("renders limits variant by default with icon and children", () => {
    render(<Callout>Some limits copy</Callout>)

    const text = screen.getByText("Some limits copy")
    expect(text.tagName).toBe("P")

    const wrapper = text.parentElement as HTMLElement
    expect(wrapper).toHaveClass("hds-callout", "hds-callout-limits")
    expect(wrapper).not.toHaveClass("cut-sm")

    const icon = screen.getByText("!")
    expect(icon).toHaveClass("hds-callout-icon")
    expect(icon).toHaveAttribute("aria-hidden", "true")
  })

  test("renders limits variant with custom icon and cut modifier", () => {
    render(
      <Callout variant="limits" icon="*" cut>
        Cut copy
      </Callout>,
    )

    const wrapper = screen.getByText("Cut copy").parentElement as HTMLElement
    expect(wrapper).toHaveClass("hds-callout", "hds-callout-limits", "cut-sm")
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  test("renders gate variant with default label", () => {
    render(<Callout variant="gate">Gate copy</Callout>)

    const label = screen.getByText("Gate")
    expect(label.tagName).toBe("B")
    expect(label).toHaveClass("hds-callout-label")

    const wrapper = label.parentElement as HTMLElement
    expect(wrapper).toHaveClass("hds-callout", "hds-callout-gate")

    const content = screen.getByText("Gate copy")
    expect(content.tagName).toBe("SPAN")
  })

  test("renders gate variant with custom label", () => {
    render(
      <Callout variant="gate" label="Blocked">
        Custom gate copy
      </Callout>,
    )

    expect(screen.getByText("Blocked")).toBeInTheDocument()
    expect(screen.getByText("Custom gate copy")).toBeInTheDocument()
  })

  test("passes through className and rest props", () => {
    render(
      <Callout variant="gate" className="extra" data-testid="callout">
        Passthrough
      </Callout>,
    )

    const wrapper = screen.getByTestId("callout")
    expect(wrapper).toHaveClass("hds-callout", "hds-callout-gate", "extra")
  })
})
