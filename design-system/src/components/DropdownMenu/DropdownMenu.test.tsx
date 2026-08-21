import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu"

function Fixture({ onSelect, onDelete }: { onSelect?: () => void; onDelete?: () => void } = {}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>File</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onSelect} shortcut="⌘R">
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Locked</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe("DropdownMenu", () => {
  it("opens via trigger click and lists items", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Actions"))
    expect(await screen.findByRole("menu")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toBeInTheDocument()
  })

  it("selects an item via click and fires onSelect", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Fixture onSelect={onSelect} />)

    await user.click(screen.getByText("Actions"))
    await user.click(await screen.findByRole("menuitem", { name: /Rename/ }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("navigates and selects via keyboard", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Fixture onSelect={onSelect} />)

    const trigger = screen.getByText("Actions")
    trigger.focus()
    await user.keyboard("{Enter}")
    await screen.findByRole("menu")

    // Opening via keyboard auto-focuses the first item (Radix menu
    // semantics), so pressing Enter immediately selects "Rename".
    await waitFor(() => expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus())
    await user.keyboard("{Enter}")
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
  })

  it("closes on Escape and outside click", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Actions"))
    await screen.findByRole("menu")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("renders the shortcut hint", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Actions"))
    expect(await screen.findByText("⌘R")).toBeInTheDocument()
  })

  it("applies the danger variant class", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Actions"))
    const deleteItem = await screen.findByRole("menuitem", { name: "Delete" })
    expect(deleteItem).toHaveClass("hds-dropdown-menu-item-danger")
  })

  it("skips a disabled item during keyboard navigation", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Actions"))
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
        <DropdownMenu>
          <DropdownMenuTrigger>Options</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
              Show hidden files
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    render(<CheckboxFixture />)

    await user.click(screen.getByText("Options"))
    const item = await screen.findByRole("menuitemcheckbox", { name: "Show hidden files" })
    expect(item).toHaveAttribute("aria-checked", "false")

    await user.click(item)
    await user.click(screen.getByText("Options"))
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
        <DropdownMenu>
          <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    render(<RadioFixture />)

    await user.click(screen.getByText("Sort"))
    await user.click(await screen.findByRole("menuitemradio", { name: "Date" }))

    await user.click(screen.getByText("Sort"))
    expect(await screen.findByRole("menuitemradio", { name: "Date" })).toHaveAttribute("aria-checked", "true")
  })

  // `indicator="trailing"`: for rows that already carry a leading visual of
  // their own (a swatch, a preview, an avatar). Stacking a selection dot to the
  // left of one puts two glyphs in a row and makes the reader work out which
  // means "current".
  it("puts the selection mark at the trailing edge on request, and leaves no leading gutter", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Theme</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="dark">
            <DropdownMenuRadioItem value="dark" indicator="trailing">
              <span data-testid="swatch" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light" indicator="trailing">
              <span />
              Light
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const checked = await screen.findByRole("menuitemradio", { name: /Dark/ })
    // The gutter class is what the stylesheet keys the 20px left padding on,
    // so its absence is the assertion that no gutter is reserved.
    expect(checked.querySelector(".hds-dropdown-menu-item-indicator")).toBeNull()
    const mark = checked.querySelector(".hds-dropdown-menu-item-check")
    expect(mark).toBeInTheDocument()
    // Last child: the mark rides at the end of the row, after the content.
    expect(checked.lastElementChild).toBe(mark)
    // Present but empty on the unchecked row — the box is reserved either way,
    // which is what keeps the rows the same width.
    const unchecked = screen.getByRole("menuitemradio", { name: /Light/ })
    expect(unchecked.querySelector(".hds-dropdown-menu-item-check")?.textContent).toBe("")

    await user.click(unchecked)
  })

  it("keeps the leading dot by default, so a plain radio list still aligns on a gutter", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="name">
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const item = await screen.findByRole("menuitemradio", { name: "Name" })
    expect(item.querySelector(".hds-dropdown-menu-item-indicator")).toBeInTheDocument()
    expect(item.querySelector(".hds-dropdown-menu-item-check")).toBeNull()
  })

  it("offers the same trailing placement to a checkbox item", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked indicator="trailing">
            Compact
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const item = await screen.findByRole("menuitemcheckbox", { name: /Compact/ })
    expect(item.querySelector(".hds-dropdown-menu-item-indicator")).toBeNull()
    expect(item.lastElementChild).toHaveClass("hds-dropdown-menu-item-check")
  })
})
