import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./AlertDialog"

function Fixture({ onAction }: { onAction?: () => void } = {}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete file?</AlertDialogTitle>
        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="danger" onClick={onAction}>
          Delete
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe("AlertDialog", () => {
  it("opens via the trigger with role=alertdialog and aria-modal", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
  })

  it("associates title and description", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    const dialog = await screen.findByRole("alertdialog")
    const title = screen.getByText("Delete file?")
    const description = screen.getByText("This cannot be undone.")
    expect(dialog).toHaveAttribute("aria-labelledby", title.id)
    expect(dialog).toHaveAttribute("aria-describedby", description.id)
  })

  it("does NOT close on Escape", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    await screen.findByRole("alertdialog")

    await user.keyboard("{Escape}")
    // give any (incorrect) close a moment to happen, then assert it didn't
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("does NOT close on outside click", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    await screen.findByRole("alertdialog")

    const overlay = document.querySelector(".hds-alert-dialog-overlay")
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("closes via AlertDialogCancel", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    await screen.findByRole("alertdialog")

    await user.click(screen.getByText("Cancel"))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("closes via AlertDialogAction and fires its onClick", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<Fixture onAction={onAction} />)

    await user.click(screen.getByText("Delete"))
    await screen.findByRole("alertdialog")

    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onAction).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("applies the danger variant class to the action", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Delete"))
    await screen.findByRole("alertdialog")
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("hds-alert-dialog-action-danger")
  })

  it("restores focus to the trigger on close", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    const trigger = screen.getByText("Delete")
    await user.click(trigger)
    await screen.findByRole("alertdialog")

    await user.click(screen.getByText("Cancel"))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
