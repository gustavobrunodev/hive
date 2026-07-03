import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Field } from "./Field"
import { Input } from "../Input/Input"

describe("Field", () => {
  it("associates the label with the control via htmlFor/id", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
  })

  it("uses the control's own id when one is already provided", () => {
    render(
      <Field label="Email">
        <Input id="email-field" />
      </Field>
    )
    const input = screen.getByLabelText("Email")
    expect(input).toHaveAttribute("id", "email-field")
  })

  it("renders a description and associates it via aria-describedby", () => {
    render(
      <Field label="Email" description="We'll never share it">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText("Email")
    const description = screen.getByText("We'll never share it")
    expect(input.getAttribute("aria-describedby")).toContain(description.id)
  })

  it("renders an error, sets aria-invalid, and associates the error via aria-describedby", () => {
    render(
      <Field label="Email" error="Required">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText("Email")
    const error = screen.getByRole("alert")
    expect(error).toHaveTextContent("Required")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input.getAttribute("aria-describedby")).toContain(error.id)
  })

  it("associates both description and error together", () => {
    render(
      <Field label="Email" description="Helper text" error="Required">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText("Email")
    const description = screen.getByText("Helper text")
    const error = screen.getByRole("alert")
    const describedBy = input.getAttribute("aria-describedby") ?? ""
    expect(describedBy).toContain(description.id)
    expect(describedBy).toContain(error.id)
  })

  it("does not set aria-invalid when there is no error", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>
    )
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid")
  })

  it("forwards required to the label and sets aria-required on the control", () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveAttribute("aria-required", "true")
  })

  it("merges a custom className on the wrapper", () => {
    const { container } = render(
      <Field label="Email" className="extra">
        <Input />
      </Field>
    )
    expect(container.firstChild).toHaveClass("hds-field", "extra")
  })

  it("throws when children is not a single valid element", () => {
    const originalError = console.error
    console.error = () => {}
    expect(() =>
      render(
        // @ts-expect-error intentionally invalid children for the runtime guard
        <Field label="Email">{"not an element"}</Field>
      )
    ).toThrow()
    console.error = originalError
  })
})
