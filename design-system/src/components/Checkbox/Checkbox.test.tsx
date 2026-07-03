import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Checkbox } from "./Checkbox"

describe("Checkbox", () => {
  it("renders with role checkbox, unchecked by default", () => {
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toHaveAttribute("aria-checked", "false")
    expect(checkbox).toHaveAttribute("data-state", "unchecked")
  })

  it("toggles via click (uncontrolled)", async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute("aria-checked", "true")
    expect(checkbox).toHaveAttribute("data-state", "checked")

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute("aria-checked", "false")
    expect(checkbox).toHaveAttribute("data-state", "unchecked")
  })

  it("toggles via Space key", async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })

    checkbox.focus()
    await user.keyboard(" ")
    expect(checkbox).toHaveAttribute("aria-checked", "true")
  })

  it("does not toggle via Enter key (native checkbox semantics — Space only)", async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })

    checkbox.focus()
    await user.keyboard("{Enter}")
    expect(checkbox).toHaveAttribute("aria-checked", "false")
  })

  it("supports controlled checked / onCheckedChange", async () => {
    const user = userEvent.setup()

    function ControlledCheckbox() {
      const [checked, setChecked] = useState<boolean | "indeterminate">(false)
      return <Checkbox aria-label="Newsletter" checked={checked} onCheckedChange={setChecked} />
    }

    render(<ControlledCheckbox />)
    const checkbox = screen.getByRole("checkbox", { name: "Newsletter" })
    expect(checkbox).toHaveAttribute("aria-checked", "false")

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute("aria-checked", "true")
  })

  it("calls onCheckedChange with the new value", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Accept terms" onCheckedChange={onCheckedChange} />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })

    await user.click(checkbox)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("renders the indeterminate state with the dash glyph, not the check glyph", () => {
    render(<Checkbox aria-label="Select all" checked="indeterminate" onCheckedChange={() => {}} />)
    const checkbox = screen.getByRole("checkbox", { name: "Select all" })
    expect(checkbox).toHaveAttribute("aria-checked", "mixed")
    expect(checkbox).toHaveAttribute("data-state", "indeterminate")

    expect(checkbox.querySelector(".hds-checkbox-icon-dash")).toBeInTheDocument()
  })

  it("renders the checked state with the check glyph present in the DOM", () => {
    render(<Checkbox aria-label="Accept terms" checked={true} onCheckedChange={() => {}} />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(checkbox.querySelector(".hds-checkbox-icon-check")).toBeInTheDocument()
  })

  it("renders no indicator glyphs while unchecked", () => {
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(checkbox.querySelector(".hds-checkbox-icon-check")).not.toBeInTheDocument()
    expect(checkbox.querySelector(".hds-checkbox-icon-dash")).not.toBeInTheDocument()
  })

  it("is non-focusable and non-interactive when disabled", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Accept terms" disabled onCheckedChange={onCheckedChange} />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })

    expect(checkbox).toBeDisabled()

    await user.tab()
    expect(checkbox).not.toHaveFocus()

    await user.click(checkbox)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(checkbox).toHaveAttribute("aria-checked", "false")
  })

  it("merges a custom className", () => {
    render(<Checkbox aria-label="Accept terms" className="extra" />)
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(checkbox).toHaveClass("hds-checkbox", "extra")
  })

  it("forwards a ref to the underlying button element", () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Checkbox aria-label="Accept terms" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
