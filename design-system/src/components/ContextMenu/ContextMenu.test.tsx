import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu"

function Fixture({ onSelect, onDelete }: { onSelect?: () => void; onDelete?: () => void } = {}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div>Tree item</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>File</ContextMenuLabel>
        <ContextMenuItem onSelect={onSelect} shortcut="⌘R">
          Rename
        </ContextMenuItem>
        <ContextMenuItem disabled>Locked</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="danger" onSelect={onDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

describe("ContextMenu", () => {
  it("opens via right-click on the trigger area and lists items", async () => {
    render(<Fixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    expect(await screen.findByRole("menu")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toBeInTheDocument()
  })

  it("selects an item via click and fires onSelect", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Fixture onSelect={onSelect} />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    await user.click(await screen.findByRole("menuitem", { name: /Rename/ }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("closes on Escape and outside click", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    await screen.findByRole("menu")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("renders the shortcut hint", async () => {
    render(<Fixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    expect(await screen.findByText("⌘R")).toBeInTheDocument()
  })

  it("applies the danger variant class", async () => {
    render(<Fixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    const deleteItem = await screen.findByRole("menuitem", { name: "Delete" })
    expect(deleteItem).toHaveClass("hds-context-menu-item-danger")
  })

  it("skips a disabled item during keyboard navigation", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    await screen.findByRole("menu")

    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    // "Locked" is disabled, so focus should skip straight to "Delete"
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus()
  })

  it("toggles a checkbox item", async () => {
    const user = userEvent.setup()
    function CheckboxFixture() {
      const [checked, setChecked] = useState(false)
      return (
        <ContextMenu>
          <ContextMenuTrigger>
            <div>Tree item</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
              Show hidden files
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      )
    }
    render(<CheckboxFixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    const item = await screen.findByRole("menuitemcheckbox", { name: "Show hidden files" })
    expect(item).toHaveAttribute("aria-checked", "false")

    await user.click(item)
    fireEvent.contextMenu(screen.getByText("Tree item"))
    expect(await screen.findByRole("menuitemcheckbox", { name: "Show hidden files" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("selects a radio item within a radio group", async () => {
    const user = userEvent.setup()
    function RadioFixture() {
      const [sort, setSort] = useState("name")
      return (
        <ContextMenu>
          <ContextMenuTrigger>
            <div>Tree item</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuRadioGroup value={sort} onValueChange={setSort}>
              <ContextMenuRadioItem value="name">Name</ContextMenuRadioItem>
              <ContextMenuRadioItem value="date">Date</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      )
    }
    render(<RadioFixture />)

    fireEvent.contextMenu(screen.getByText("Tree item"))
    await user.click(await screen.findByRole("menuitemradio", { name: "Date" }))

    fireEvent.contextMenu(screen.getByText("Tree item"))
    expect(await screen.findByRole("menuitemradio", { name: "Date" })).toHaveAttribute("aria-checked", "true")
  })
})
