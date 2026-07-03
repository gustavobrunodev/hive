import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./Sheet"

function Fixture({ side }: { side?: "left" | "right" | "top" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent side={side}>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>Refine your results.</SheetDescription>
        <SheetClose>Close</SheetClose>
      </SheetContent>
    </Sheet>
  )
}

describe("Sheet", () => {
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
    const sheet = await screen.findByRole("dialog")
    expect(sheet).toHaveAttribute("aria-modal", "true")

    const title = screen.getByText("Filters")
    const description = screen.getByText("Refine your results.")
    expect(sheet).toHaveAttribute("aria-labelledby", title.id)
    expect(sheet).toHaveAttribute("aria-describedby", description.id)
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
    const overlay = document.querySelector(".hds-sheet-overlay")
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes via SheetClose and restores focus to the trigger", async () => {
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
    const sheet = await screen.findByRole("dialog")
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement))
  })

  it("defaults to the right side", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByText("Open"))
    const sheet = await screen.findByRole("dialog")
    expect(sheet).toHaveAttribute("data-side", "right")
  })

  it("sets data-side to the explicit side prop", async () => {
    const user = userEvent.setup()
    render(<Fixture side="left" />)

    await user.click(screen.getByText("Open"))
    const sheet = await screen.findByRole("dialog")
    expect(sheet).toHaveAttribute("data-side", "left")
  })

  it("merges a custom className", async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent className="extra">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    await user.click(screen.getByText("Open"))
    const sheet = await screen.findByRole("dialog")
    expect(sheet).toHaveClass("hds-sheet-content", "extra")
  })
})
