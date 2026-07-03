import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PromptInput } from "./PromptInput"

describe("PromptInput", () => {
  it("renders the textarea with the given placeholder", () => {
    render(<PromptInput onSubmit={() => {}} placeholder="Ask anything..." />)
    expect(screen.getByPlaceholderText("Ask anything...")).toBeInTheDocument()
  })

  it("disables send while the textarea is empty", () => {
    render(<PromptInput onSubmit={() => {}} />)
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("enables send once text is entered, and disables again for whitespace-only text", async () => {
    const user = userEvent.setup()
    render(<PromptInput onSubmit={() => {}} />)
    const textarea = screen.getByRole("textbox")

    await user.type(textarea, "Hello")
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()

    await user.clear(textarea)
    await user.type(textarea, "   ")
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("clicking send calls onSubmit with the trimmed value and clears the textarea (uncontrolled)", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PromptInput onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox")

    await user.type(textarea, "  Hello world  ")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(onSubmit).toHaveBeenCalledWith("Hello world")
    expect(textarea).toHaveValue("")
  })

  it("pressing Enter submits", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PromptInput onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox")

    await user.type(textarea, "Hi{Enter}")
    expect(onSubmit).toHaveBeenCalledWith("Hi")
  })

  it("Shift+Enter inserts a newline instead of submitting", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PromptInput onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox")

    await user.type(textarea, "Line one{Shift>}{Enter}{/Shift}Line two")
    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue("Line one\nLine two")
  })

  it("streaming disables send even with non-empty text", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = render(<PromptInput onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "Hello")
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()

    rerender(<PromptInput onSubmit={onSubmit} streaming />)
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("disabled disables both the textarea and send", () => {
    render(<PromptInput onSubmit={() => {}} disabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("in controlled mode, does not clear the value itself after submit (the app owns it)", async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState("")
      const onSubmit = vi.fn()
      return (
        <>
          <PromptInput value={value} onChange={setValue} onSubmit={onSubmit} />
          <span data-testid="submit-count">{onSubmit.mock.calls.length}</span>
        </>
      )
    }
    render(<Controlled />)
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "Hello")
    await user.click(screen.getByRole("button", { name: "Send" }))

    // the app didn't update `value` in response to onSubmit, so the text
    // stays exactly as the app left it — PromptInput never mutates a
    // controlled value on its own.
    expect(textarea).toHaveValue("Hello")
  })

  it("renders the attachments slot", () => {
    render(<PromptInput onSubmit={() => {}} attachments={<span data-testid="chip">file.png</span>} />)
    expect(screen.getByTestId("chip")).toBeInTheDocument()
  })

  it("renders the toolbar slot", () => {
    render(<PromptInput onSubmit={() => {}} toolbar={<button>Attach</button>} />)
    expect(screen.getByRole("button", { name: "Attach" })).toBeInTheDocument()
  })

  it("merges a custom className", () => {
    const { container } = render(<PromptInput onSubmit={() => {}} className="extra" />)
    expect(container.firstChild).toHaveClass("hds-prompt-input", "extra")
  })
})
