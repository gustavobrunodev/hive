import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip"

function Fixture() {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

describe("Tooltip", () => {
  it("shows the content on trigger hover", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await user.hover(screen.getByText("Hover me"))
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful hint"))
  })

  it("shows the content on trigger keyboard focus", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.tab()
    expect(screen.getByText("Hover me")).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful hint"))
  })

  it("gives the content role=tooltip and links it via aria-describedby", async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.hover(screen.getByText("Hover me"))
    const content = await screen.findByRole("tooltip")
    expect(content).toHaveTextContent("Helpful hint")

    const trigger = screen.getByText("Hover me")
    await waitFor(() => expect(trigger).toHaveAttribute("aria-describedby", content.id))
  })

  it("hides the content on unhover", async () => {
    const user = userEvent.setup()
    // jsdom returns an all-zero getBoundingClientRect() for every element,
    // which degenerates Radix's trigger-to-content "hoverable content" grace
    // area polygon and can make it look like the pointer never truly leaves.
    // disableHoverableContent sidesteps that geometry entirely so this test
    // exercises pure open/close mechanics instead of an unmeasurable polygon.
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip disableHoverableContent>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    await user.hover(screen.getByText("Hover me"))
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument())

    await user.unhover(screen.getByText("Hover me"))
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument())
  })

  it("merges a custom className on the content", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent className="extra">Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    await user.hover(screen.getByText("Hover me"))
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument())
    const visibleContent = document.querySelector(".hds-tooltip-content")
    expect(visibleContent).toHaveClass("hds-tooltip-content", "extra")
  })
})
