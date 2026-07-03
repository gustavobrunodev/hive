import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Resizable, ResizableHandle, ResizablePanel } from "./Resizable"

function BasicResizable(props: Partial<React.ComponentProps<typeof Resizable>> = {}) {
  return (
    <Resizable aria-label="Workspace" {...props}>
      <ResizablePanel id="left" defaultSize={30} minSize={10} maxSize={60}>
        Left content
      </ResizablePanel>
      <ResizableHandle aria-label="Resize" />
      <ResizablePanel id="right" defaultSize={70}>
        Right content
      </ResizablePanel>
    </Resizable>
  )
}

describe("Resizable", () => {
  it("renders both panels' content", () => {
    render(<BasicResizable />)
    expect(screen.getByText("Left content")).toBeInTheDocument()
    expect(screen.getByText("Right content")).toBeInTheDocument()
  })

  it("renders the handle with role=separator and aria-orientation", () => {
    render(<BasicResizable />)
    const handle = screen.getByRole("separator")
    expect(handle).toHaveAttribute("aria-orientation")
  })

  it("defaults to horizontal orientation (vertical separator)", () => {
    render(<BasicResizable />)
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical")
  })

  it("supports vertical group orientation (horizontal separator)", () => {
    render(<BasicResizable orientation="vertical" />)
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal")
  })

  it("the handle is keyboard-focusable", async () => {
    const user = userEvent.setup()
    render(<BasicResizable />)
    await user.tab()
    expect(screen.getByRole("separator")).toHaveFocus()
  })

  it("forwards disabled to the separator as aria-disabled", () => {
    render(<BasicResizable />)
    render(
      <Resizable aria-label="Disabled workspace">
        <ResizablePanel id="a">A</ResizablePanel>
        <ResizableHandle aria-label="Resize" disabled />
        <ResizablePanel id="b">B</ResizablePanel>
      </Resizable>
    )
    const handles = screen.getAllByRole("separator")
    expect(handles[handles.length - 1]).toHaveAttribute("aria-disabled", "true")
  })

  it("renders the visual grip only when withGrip is true", () => {
    const { container, rerender } = render(
      <Resizable aria-label="Workspace">
        <ResizablePanel id="a">A</ResizablePanel>
        <ResizableHandle aria-label="Resize" />
        <ResizablePanel id="b">B</ResizablePanel>
      </Resizable>
    )
    expect(container.querySelector(".hds-resizable-handle-grip")).not.toBeInTheDocument()

    rerender(
      <Resizable aria-label="Workspace">
        <ResizablePanel id="a">A</ResizablePanel>
        <ResizableHandle aria-label="Resize" withGrip />
        <ResizablePanel id="b">B</ResizablePanel>
      </Resizable>
    )
    expect(container.querySelector(".hds-resizable-handle-grip")).toBeInTheDocument()
  })

  it("merges a custom className on the group, panel, and handle", () => {
    const { container } = render(
      <Resizable aria-label="Workspace" className="extra-group">
        <ResizablePanel id="a" className="extra-panel">
          A
        </ResizablePanel>
        <ResizableHandle aria-label="Resize" className="extra-handle" />
        <ResizablePanel id="b">B</ResizablePanel>
      </Resizable>
    )
    expect(container.querySelector(".hds-resizable.extra-group")).toBeInTheDocument()
    expect(container.querySelector(".hds-resizable-panel.extra-panel")).toBeInTheDocument()
    expect(container.querySelector(".hds-resizable-handle.extra-handle")).toBeInTheDocument()
  })
})
