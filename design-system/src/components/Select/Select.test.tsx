import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select"

function BasicSelect(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  return (
    <Select defaultValue="apple" {...props}>
      <SelectTrigger aria-label="Fruit">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  )
}

function ControlledSelect() {
  const [value, setValue] = useState("apple")
  return (
    <>
      <span data-testid="value">{value}</span>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger aria-label="Fruit">
          <SelectValue placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
}

describe("Select", () => {
  it("renders a trigger showing the current value", () => {
    render(<BasicSelect />)
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Apple")
  })

  it("shows the placeholder when no value is set", () => {
    render(<BasicSelect defaultValue={undefined} />)
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Pick a fruit")
  })

  it("opens the listbox on trigger click and lists options", async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)

    await user.click(screen.getByRole("combobox", { name: "Fruit" }))
    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })

  it("selects an item via click", async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)

    await user.click(screen.getByRole("combobox", { name: "Fruit" }))
    await user.click(await screen.findByRole("option", { name: "Banana" }))

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Banana"))
  })

  it("navigates and selects via keyboard", async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)

    const trigger = screen.getByRole("combobox", { name: "Fruit" })
    trigger.focus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("listbox")).toBeInTheDocument()

    await user.keyboard("{ArrowDown}{Enter}")
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Banana"))
  })

  it("supports controlled value / onValueChange", async () => {
    const user = userEvent.setup()
    render(<ControlledSelect />)

    expect(screen.getByTestId("value")).toHaveTextContent("apple")

    await user.click(screen.getByRole("combobox", { name: "Fruit" }))
    await user.click(await screen.findByRole("option", { name: "Banana" }))

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("banana"))
  })

  it("a disabled trigger cannot be opened", async () => {
    const user = userEvent.setup()
    render(<BasicSelect disabled />)

    const trigger = screen.getByRole("combobox", { name: "Fruit" })
    expect(trigger).toHaveAttribute("data-disabled")
    await user.click(trigger)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("merges a custom className on the trigger", () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger aria-label="Fruit" className="extra">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveClass("hds-select-trigger", "extra")
  })
})
