import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
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

  /**
   * The dismiss guard, driven through Radix's own outside-interaction path.
   *
   * A modal popover opened inside a dialog turns the dialog content
   * `pointer-events: none`, so the hit-test delivers every click over the
   * dialog to the dialog's *overlay* — and `react-dialog` decides the dismissal
   * on the `click` that follows, by which time the popover has deregistered.
   * These two cases are that exact sequence, dispatched by hand (jsdom has no
   * layout, so the panel's box is stubbed and the coordinates are the whole
   * point).
   */
  describe("dismiss guard", () => {
    /** Puts a real box on the panel — jsdom reports zeros for everything. */
    function measure(node: Element): void {
      vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
        x: 100,
        y: 80,
        left: 100,
        top: 80,
        right: 500,
        bottom: 380,
        width: 400,
        height: 300,
        toJSON: () => ({}),
      } as DOMRect)
    }

    /** The pointerdown → click pair Radix's deferred check reads, on the overlay. */
    async function clickOverlayAt(x: number, y: number): Promise<void> {
      const overlay = document.querySelector(".hds-dialog-overlay") as Element
      const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }
      await act(async () => {
        overlay.dispatchEvent(new MouseEvent("pointerdown", init))
        overlay.dispatchEvent(new MouseEvent("pointerup", init))
        overlay.dispatchEvent(new MouseEvent("click", init))
        // The deferred dismissal is dispatched from a `setTimeout(0)`.
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }

    it("keeps the dialog open when the pointer went down on the panel", async () => {
      const user = userEvent.setup()
      render(<Fixture />)
      await user.click(screen.getByText("Open"))
      const dialog = await screen.findByRole("dialog")
      measure(dialog)

      await clickOverlayAt(300, 200)
      expect(screen.queryByRole("dialog")).toBeInTheDocument()
    })

    it("still closes on a click beside the panel", async () => {
      const user = userEvent.setup()
      render(<Fixture />)
      await user.click(screen.getByText("Open"))
      const dialog = await screen.findByRole("dialog")
      measure(dialog)

      await clickOverlayAt(40, 200)
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    })
  })
})
