import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from "./Popover"

function renderPopover(contentProps: Record<string, unknown> = {}) {
  return render(
    <>
      <button type="button">Before</button>
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent {...contentProps}>
          <p>Popover body</p>
          <PopoverClose>Dismiss</PopoverClose>
        </PopoverContent>
      </Popover>
      <button type="button">After</button>
    </>
  )
}

describe("Popover", () => {
  it("is closed by default and opens via trigger click", async () => {
    const user = userEvent.setup()
    renderPopover()

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open popover" }))

    const content = await screen.findByText("Popover body")
    expect(content).toBeInTheDocument()
  })

  it("moves focus into the content on open", async () => {
    const user = userEvent.setup()
    renderPopover()

    await user.click(screen.getByRole("button", { name: "Open popover" }))
    const content = (await screen.findByText("Popover body")).closest(".hds-popover-content")

    await waitFor(() => {
      expect(content).toContainElement(document.activeElement as HTMLElement)
    })
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Open popover" }))
  })

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByRole("button", { name: "Open popover" })
    await user.click(trigger)
    await screen.findByText("Popover body")

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  })

  it("closes on outside click", async () => {
    const user = userEvent.setup()
    renderPopover()

    await user.click(screen.getByRole("button", { name: "Open popover" }))
    await screen.findByText("Popover body")

    await user.click(screen.getByRole("button", { name: "After" }))

    await waitFor(() => {
      expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
    })
  })

  it("closes when PopoverClose is clicked", async () => {
    const user = userEvent.setup()
    renderPopover()

    await user.click(screen.getByRole("button", { name: "Open popover" }))
    await screen.findByText("Popover body")

    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    await waitFor(() => {
      expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
    })
  })

  it("merges a custom className onto the content", async () => {
    const user = userEvent.setup()
    renderPopover({ className: "extra" })

    await user.click(screen.getByRole("button", { name: "Open popover" }))

    const content = await screen.findByText("Popover body")
    expect(content.closest(".hds-popover-content")).toHaveClass("hds-popover-content", "extra")
  })

  it("renders PopoverAnchor as an alternate positioning reference without affecting the trigger", async () => {
    const user = userEvent.setup()
    render(
      <Popover>
        <PopoverAnchor>
          <span data-testid="anchor">Anchor</span>
        </PopoverAnchor>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>
          <p>Anchored body</p>
        </PopoverContent>
      </Popover>
    )

    expect(screen.getByTestId("anchor")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open popover" }))
    expect(await screen.findByText("Anchored body")).toBeInTheDocument()
  })
})
