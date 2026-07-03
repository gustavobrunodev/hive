import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion"

function SingleAccordion({ className }: { className?: string } = {}) {
  return (
    <Accordion type="single" collapsible className={className}>
      <AccordionItem value="one">
        <AccordionTrigger>Section one</AccordionTrigger>
        <AccordionContent>Content one</AccordionContent>
      </AccordionItem>
      <AccordionItem value="two">
        <AccordionTrigger>Section two</AccordionTrigger>
        <AccordionContent>Content two</AccordionContent>
      </AccordionItem>
      <AccordionItem value="three" disabled>
        <AccordionTrigger>Section three</AccordionTrigger>
        <AccordionContent>Content three</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function MultipleAccordion() {
  return (
    <Accordion type="multiple">
      <AccordionItem value="one">
        <AccordionTrigger>Section one</AccordionTrigger>
        <AccordionContent>Content one</AccordionContent>
      </AccordionItem>
      <AccordionItem value="two">
        <AccordionTrigger>Section two</AccordionTrigger>
        <AccordionContent>Content two</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe("Accordion", () => {
  it("renders items with triggers, all closed by default", () => {
    render(<SingleAccordion />)

    expect(screen.getByRole("button", { name: "Section one" })).toHaveAttribute("data-state", "closed")
    expect(screen.getByRole("button", { name: "Section two" })).toHaveAttribute("data-state", "closed")
    expect(screen.queryByText("Content one")).not.toBeInTheDocument()
    expect(screen.queryByText("Content two")).not.toBeInTheDocument()
  })

  it("clicking a trigger toggles its data-state and shows/hides its content", async () => {
    const user = userEvent.setup()
    render(<SingleAccordion />)

    const triggerOne = screen.getByRole("button", { name: "Section one" })
    await user.click(triggerOne)

    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "open"))
    expect(await screen.findByText("Content one")).toBeInTheDocument()

    await user.click(triggerOne)

    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "closed"))
    await waitFor(() => expect(screen.queryByText("Content one")).not.toBeInTheDocument())
  })

  it("type=single closes a previously-open item when another opens", async () => {
    const user = userEvent.setup()
    render(<SingleAccordion />)

    const triggerOne = screen.getByRole("button", { name: "Section one" })
    const triggerTwo = screen.getByRole("button", { name: "Section two" })

    await user.click(triggerOne)
    expect(await screen.findByText("Content one")).toBeInTheDocument()

    await user.click(triggerTwo)

    await waitFor(() => expect(triggerTwo).toHaveAttribute("data-state", "open"))
    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "closed"))
    expect(screen.queryByText("Content one")).not.toBeInTheDocument()
    expect(screen.getByText("Content two")).toBeInTheDocument()
  })

  it("type=multiple allows multiple items open simultaneously", async () => {
    const user = userEvent.setup()
    render(<MultipleAccordion />)

    const triggerOne = screen.getByRole("button", { name: "Section one" })
    const triggerTwo = screen.getByRole("button", { name: "Section two" })

    await user.click(triggerOne)
    await user.click(triggerTwo)

    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "open"))
    await waitFor(() => expect(triggerTwo).toHaveAttribute("data-state", "open"))
    expect(screen.getByText("Content one")).toBeInTheDocument()
    expect(screen.getByText("Content two")).toBeInTheDocument()
  })

  it("toggles open via keyboard Enter and Space on a focused trigger", async () => {
    const user = userEvent.setup()
    render(<SingleAccordion />)

    const triggerOne = screen.getByRole("button", { name: "Section one" })
    triggerOne.focus()
    await user.keyboard("{Enter}")

    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "open"))

    await user.keyboard(" ")

    await waitFor(() => expect(triggerOne).toHaveAttribute("data-state", "closed"))
  })

  it("moves focus between triggers with ArrowDown/ArrowUp", async () => {
    const user = userEvent.setup()
    render(<SingleAccordion />)

    const triggerOne = screen.getByRole("button", { name: "Section one" })
    const triggerTwo = screen.getByRole("button", { name: "Section two" })

    triggerOne.focus()
    await user.keyboard("{ArrowDown}")
    expect(triggerTwo).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(triggerOne).toHaveFocus()
  })

  it("a disabled item's trigger is non-interactive", async () => {
    const user = userEvent.setup()
    render(<SingleAccordion />)

    const triggerThree = screen.getByRole("button", { name: "Section three" })
    expect(triggerThree).toBeDisabled()

    await user.click(triggerThree)
    expect(triggerThree).toHaveAttribute("data-state", "closed")
    expect(screen.queryByText("Content three")).not.toBeInTheDocument()
  })

  it("merges a custom className onto the trigger", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="one">
          <AccordionTrigger className="extra">Section one</AccordionTrigger>
          <AccordionContent>Content one</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    expect(screen.getByRole("button", { name: "Section one" })).toHaveClass("hds-accordion-trigger", "extra")
  })

  it("merges a custom className onto the root", () => {
    const { container } = render(<SingleAccordion className="extra" />)
    expect(container.querySelector(".hds-accordion")).toHaveClass("hds-accordion", "extra")
  })
})
