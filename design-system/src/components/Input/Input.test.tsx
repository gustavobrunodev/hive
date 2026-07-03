import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Input } from "./Input"

describe("Input", () => {
  it("renders a text input", () => {
    render(<Input aria-label="Name" />)
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass("hds-input")
  })

  it("forwards ref to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input aria-label="Name" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Name" }))
  })

  it("renders the startIcon slot when provided", () => {
    render(<Input aria-label="Search" startIcon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId("icon")).toBeInTheDocument()
    const wrapper = screen.getByTestId("icon").closest(".hds-input-icon")
    expect(wrapper).toBeInTheDocument()
  })

  it("does not render an icon wrapper when startIcon is absent", () => {
    render(<Input aria-label="Name" />)
    expect(document.querySelector(".hds-input-icon")).not.toBeInTheDocument()
  })

  it("sets aria-invalid and the error class when error is true", () => {
    render(<Input aria-label="Email" error />)
    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveClass("hds-input-error")
  })

  it("omits aria-invalid when error is false", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(input).not.toHaveClass("hds-input-error")
  })

  it("is non-focusable and non-interactive when disabled", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <>
        <button type="button">Before</button>
        <Input aria-label="Name" disabled onChange={onChange} />
        <button type="button">After</button>
      </>
    )
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Before" }))
    await user.tab()
    expect(input).not.toHaveFocus()
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus()

    await user.type(input, "hi", { skipClick: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("fires onChange when the user types", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input aria-label="Name" onChange={onChange} />)
    const input = screen.getByRole("textbox", { name: "Name" })
    await user.type(input, "hi")
    expect(onChange).toHaveBeenCalled()
    expect(input).toHaveValue("hi")
  })

  it("merges a custom className onto the input when there is no icon", () => {
    render(<Input aria-label="Name" className="extra" />)
    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).toHaveClass("hds-input", "extra")
  })

  it("merges a custom className onto the wrapper when an icon is present", () => {
    render(<Input aria-label="Search" className="extra" startIcon={<svg data-testid="icon" />} />)
    const wrapper = screen.getByTestId("icon").closest(".hds-input-icon")
    expect(wrapper).toHaveClass("hds-input-icon", "extra")
  })

  it("applies the error wrapper class when startIcon and error are combined", () => {
    render(<Input aria-label="Search" error startIcon={<svg data-testid="icon" />} />)
    const wrapper = screen.getByTestId("icon").closest(".hds-input-icon")
    expect(wrapper).toHaveClass("hds-input-icon-error")
    const input = screen.getByRole("textbox", { name: "Search" })
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
