import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Empty } from "./Empty"

describe("Empty", () => {
  it("renders the required title", () => {
    render(<Empty title="No files yet" />)
    expect(screen.getByText("No files yet")).toBeInTheDocument()
  })

  it("does not render an icon when not provided", () => {
    const { container } = render(<Empty title="No files yet" />)
    expect(container.querySelector(".hds-empty-icon")).not.toBeInTheDocument()
  })

  it("renders the icon slot when provided", () => {
    render(<Empty title="No files yet" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId("icon")).toBeInTheDocument()
    expect(screen.getByTestId("icon").parentElement).toHaveClass("hds-empty-icon")
  })

  it("marks the icon slot as decorative", () => {
    const { container } = render(<Empty title="No files yet" icon={<svg />} />)
    expect(container.querySelector(".hds-empty-icon")).toHaveAttribute("aria-hidden", "true")
  })

  it("does not render a description when not provided", () => {
    const { container } = render(<Empty title="No files yet" />)
    expect(container.querySelector(".hds-empty-description")).not.toBeInTheDocument()
  })

  it("renders the description when provided", () => {
    render(<Empty title="No files yet" description="Drop a file to get started." />)
    expect(screen.getByText("Drop a file to get started.")).toBeInTheDocument()
  })

  it("does not render an action when not provided", () => {
    const { container } = render(<Empty title="No files yet" />)
    expect(container.querySelector(".hds-empty-action")).not.toBeInTheDocument()
  })

  it("renders arbitrary children in the action slot and forwards interactions", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Empty title="No files yet" action={<button onClick={onClick}>Upload file</button>} />
    )
    const actionButton = screen.getByRole("button", { name: "Upload file" })
    expect(actionButton).toBeInTheDocument()
    await user.click(actionButton)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("merges a custom className with the base class", () => {
    render(<Empty title="No files yet" className="extra" data-testid="empty" />)
    const el = screen.getByTestId("empty")
    expect(el).toHaveClass("hds-empty", "extra")
  })

  it("spreads other rest props onto the host element", () => {
    render(<Empty title="No files yet" data-testid="empty" role="status" />)
    expect(screen.getByTestId("empty")).toHaveAttribute("role", "status")
  })
})
