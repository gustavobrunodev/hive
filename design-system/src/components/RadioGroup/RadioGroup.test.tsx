import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RadioGroup, RadioGroupItem } from "./RadioGroup"

function BasicGroup(props: Partial<React.ComponentProps<typeof RadioGroup>> = {}) {
  return (
    <RadioGroup aria-label="Plan" defaultValue="free" {...props}>
      <RadioGroupItem value="free" aria-label="Free" />
      <RadioGroupItem value="pro" aria-label="Pro" />
      <RadioGroupItem value="enterprise" aria-label="Enterprise" />
    </RadioGroup>
  )
}

function ControlledGroup() {
  const [value, setValue] = useState("free")
  return (
    <>
      <span data-testid="value">{value}</span>
      <RadioGroup aria-label="Plan" value={value} onValueChange={setValue}>
        <RadioGroupItem value="free" aria-label="Free" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    </>
  )
}

describe("RadioGroup", () => {
  it("renders a radiogroup with radio items", () => {
    render(<BasicGroup />)
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(3)
  })

  it("marks the defaultValue item as checked", () => {
    render(<BasicGroup />)
    expect(screen.getByRole("radio", { name: "Free" })).toHaveAttribute("data-state", "checked")
    expect(screen.getByRole("radio", { name: "Pro" })).toHaveAttribute("data-state", "unchecked")
  })

  it("clicking an item selects it and deselects siblings", async () => {
    const user = userEvent.setup()
    render(<BasicGroup />)
    const free = screen.getByRole("radio", { name: "Free" })
    const pro = screen.getByRole("radio", { name: "Pro" })

    expect(free).toHaveAttribute("data-state", "checked")
    expect(pro).toHaveAttribute("data-state", "unchecked")

    await user.click(pro)

    expect(pro).toHaveAttribute("data-state", "checked")
    expect(free).toHaveAttribute("data-state", "unchecked")
  })

  it("moves selection between items via arrow-key navigation", async () => {
    const user = userEvent.setup()
    render(<BasicGroup />)
    const free = screen.getByRole("radio", { name: "Free" })
    const pro = screen.getByRole("radio", { name: "Pro" })
    const enterprise = screen.getByRole("radio", { name: "Enterprise" })

    free.focus()
    expect(free).toHaveFocus()

    // Radix's roving-focus defers the actual focus move to a setTimeout(0)
    // and only auto-selects on focus while an internal "arrow key is
    // physically held" ref is true (reset on keyup). `user.keyboard("{ArrowDown}")`
    // fires keydown+keyup back-to-back, resetting that ref before the
    // deferred focus/select runs — so we hold the key down explicitly and
    // release it only after the selection lands.
    await user.keyboard("{ArrowDown>}")
    await waitFor(() => expect(pro).toHaveFocus())
    await waitFor(() => expect(pro).toHaveAttribute("data-state", "checked"))
    await user.keyboard("{/ArrowDown}")
    expect(free).toHaveAttribute("data-state", "unchecked")

    await user.keyboard("{ArrowDown>}")
    await waitFor(() => expect(enterprise).toHaveFocus())
    await waitFor(() => expect(enterprise).toHaveAttribute("data-state", "checked"))
    await user.keyboard("{/ArrowDown}")
    expect(pro).toHaveAttribute("data-state", "unchecked")
  })

  it("supports controlled value / onValueChange", async () => {
    const user = userEvent.setup()
    render(<ControlledGroup />)

    expect(screen.getByTestId("value")).toHaveTextContent("free")

    await user.click(screen.getByRole("radio", { name: "Pro" }))

    expect(screen.getByTestId("value")).toHaveTextContent("pro")
    expect(screen.getByRole("radio", { name: "Pro" })).toHaveAttribute("data-state", "checked")
  })

  it("calls onValueChange with the new value", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <RadioGroup aria-label="Plan" defaultValue="free" onValueChange={onValueChange}>
        <RadioGroupItem value="free" aria-label="Free" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    )

    await user.click(screen.getByRole("radio", { name: "Pro" }))

    expect(onValueChange).toHaveBeenCalledWith("pro")
  })

  it("disables every item when the group is disabled", () => {
    render(<BasicGroup disabled />)
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled()
      expect(radio).toHaveAttribute("data-disabled")
    }
  })

  it("disables an individual item without affecting siblings", async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup aria-label="Plan" defaultValue="free">
        <RadioGroupItem value="free" aria-label="Free" />
        <RadioGroupItem value="pro" aria-label="Pro" disabled />
      </RadioGroup>
    )

    const pro = screen.getByRole("radio", { name: "Pro" })
    expect(pro).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Free" })).not.toBeDisabled()

    await user.click(pro)
    expect(pro).toHaveAttribute("data-state", "unchecked")
  })

  it("merges a custom className on the group and on an item", () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="free" className="extra-group">
        <RadioGroupItem value="free" aria-label="Free" className="extra-item" />
      </RadioGroup>
    )

    expect(screen.getByRole("radiogroup", { name: "Plan" })).toHaveClass("hds-radio-group", "extra-group")
    expect(screen.getByRole("radio", { name: "Free" })).toHaveClass("hds-radio-item", "extra-item")
  })
})
