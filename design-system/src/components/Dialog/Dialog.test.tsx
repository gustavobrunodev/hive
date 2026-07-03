import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./Dialog"

function Fixture() {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirm</DialogTitle>
        <DialogDescription>Are you sure?</DialogDescription>
        <DialogClose>Close</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  it("is closed by default and opens via the trigger", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByText("Open"))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("has aria-modal and correctly associated title/description", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Open"))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")

    const title = screen.getByText("Confirm")
    const description = screen.getByText("Are you sure?")
    expect(dialog).toHaveAttribute("aria-labelledby", title.id)
    expect(dialog).toHaveAttribute("aria-describedby", description.id)
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Open"))
    await screen.findByRole("dialog")

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes on outside click", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Open"))
    await screen.findByRole("dialog")

    // Radix's modal Dialog sets pointer-events:none on <body> while open, so
    // clicking body directly is (correctly) refused by user-event's pointer
    // safety check. The overlay itself is what DismissableLayer listens to
    // for outside-pointer-down, so click that instead.
    const overlay = document.querySelector(".hds-dialog-overlay")
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes via DialogClose and restores focus to the trigger", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    const trigger = screen.getByText("Open")
    await user.click(trigger)
    await screen.findByRole("dialog")

    await user.click(screen.getByText("Close"))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("moves focus into the content on open", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Open"))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
  })

  it("applies the cut-sm class when cut is true", async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent cut>
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveClass("cut-sm")
  })

  it("merges a custom className", async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="extra">
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveClass("hds-dialog-content", "extra")
  })
})
