import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./Command"

function BasicCommand({ onSelectFile }: { onSelectFile?: () => void } = {}) {
  return (
    <Command label="Test command">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty />
        <CommandGroup heading="Files">
          <CommandItem onSelect={onSelectFile} shortcut="⌘O">
            Open file
          </CommandItem>
          <CommandItem>New file</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>Rename</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

describe("Command", () => {
  it("renders items grouped under their headings", () => {
    render(<BasicCommand />)
    expect(screen.getByText("Files")).toBeInTheDocument()
    expect(screen.getByText("Open file")).toBeInTheDocument()
    expect(screen.getByText("New file")).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()
    expect(screen.getByText("Rename")).toBeInTheDocument()
  })

  it("filters items as the user types in the input", async () => {
    const user = userEvent.setup()
    render(<BasicCommand />)
    await user.type(screen.getByPlaceholderText("Search..."), "rename")

    await waitFor(() => {
      expect(screen.getByText("Rename")).toBeInTheDocument()
      expect(screen.queryByText("Open file")).not.toBeInTheDocument()
    })
  })

  it("shows CommandEmpty when no items match", async () => {
    const user = userEvent.setup()
    render(<BasicCommand />)
    await user.type(screen.getByPlaceholderText("Search..."), "zzzzz-no-match")

    await waitFor(() => expect(screen.getByText("No results found.")).toBeInTheDocument())
  })

  it("fires onSelect when an item is clicked", async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()
    render(<BasicCommand onSelectFile={onSelectFile} />)
    await user.click(screen.getByText("Open file"))
    expect(onSelectFile).toHaveBeenCalledTimes(1)
  })

  it("fires onSelect for the highlighted item on Enter", async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()
    render(<BasicCommand onSelectFile={onSelectFile} />)
    const input = screen.getByPlaceholderText("Search...")
    input.focus()
    await user.keyboard("{Enter}")
    expect(onSelectFile).toHaveBeenCalledTimes(1)
  })

  it("renders the shortcut slot", () => {
    render(<BasicCommand />)
    expect(screen.getByText("⌘O")).toBeInTheDocument()
  })

  it("CommandList has role=listbox and items have role=option", () => {
    render(<BasicCommand />)
    expect(screen.getByRole("listbox")).toBeInTheDocument()
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0)
  })

  it("merges a custom className on Command", () => {
    const { container } = render(
      <Command label="Test" className="extra">
        <CommandList>
          <CommandItem>Item</CommandItem>
        </CommandList>
      </Command>
    )
    expect(container.querySelector(".hds-command.extra")).toBeInTheDocument()
  })
})

describe("CommandDialog", () => {
  function Fixture() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open palette</button>
        <CommandDialog open={open} onOpenChange={setOpen} label="Command palette">
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty />
            <CommandItem>Go to file</CommandItem>
          </CommandList>
        </CommandDialog>
      </>
    )
  }

  it("is closed by default and opens via the open prop", async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByText("Open palette"))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("has aria-modal and an accessible (visually hidden) title", async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByText("Open palette"))

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(screen.getByText("Command palette")).toBeInTheDocument()
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByText("Open palette"))
    await screen.findByRole("dialog")

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("renders command items inside the dialog", async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByText("Open palette"))
    expect(await screen.findByText("Go to file")).toBeInTheDocument()
  })
})
