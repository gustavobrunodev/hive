import { createRef, useState, type ChangeEvent } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Textarea } from "./Textarea"

// jsdom performs no real layout, so `getComputedStyle`/`scrollHeight` never
// reflect actual rendered content there. These tests mock both at the DOM
// node level, following the same pattern as `useAutosizeTextarea.test.ts`,
// to exercise the autosize wiring deterministically without asserting on
// unavailable layout internals.

function mockComputedStyle(overrides: Record<string, string> = {}) {
  const base: Record<string, string> = {
    lineHeight: "20px",
    fontSize: "16px",
    paddingTop: "0px",
    paddingBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    display: "block",
    visibility: "visible",
    pointerEvents: "auto",
    ...overrides,
  }
  // RTL's role query and userEvent both call `getComputedStyle(node)` for
  // their own visibility/pointer-events checks (via `getPropertyValue`,
  // kebab-case), so the mock needs to satisfy that in addition to the
  // camelCase properties `useAutosizeTextarea` reads directly.
  const style = {
    ...base,
    getPropertyValue: (prop: string) => {
      const camel = prop.replace(/-([a-z])/g, (_match, c: string) => c.toUpperCase())
      return base[camel] ?? ""
    },
  }
  return vi.spyOn(window, "getComputedStyle").mockReturnValue(style as unknown as CSSStyleDeclaration)
}

function mockScrollHeight(node: HTMLElement, height: number) {
  Object.defineProperty(node, "scrollHeight", { configurable: true, value: height })
}

describe("Textarea", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a textarea", () => {
    render(<Textarea aria-label="Message" />)
    const textarea = screen.getByRole("textbox", { name: "Message" })
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveClass("hds-textarea")
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  it("wires the autosize hook without throwing and responds to value changes", async () => {
    const user = userEvent.setup()
    render(<Textarea aria-label="Message" minRows={1} maxRows={4} />)
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

    mockComputedStyle()
    mockScrollHeight(textarea, 20)

    await user.type(textarea, "a{enter}b{enter}c")
    mockScrollHeight(textarea, 60)
    await user.type(textarea, "{enter}d")

    // The effect re-ran and set an explicit pixel height in response to
    // the value change (rather than leaving the default empty style).
    expect(textarea.style.height).toMatch(/px$/)
  })

  it("fires onSubmit when Enter is pressed and submitOnEnter is truthy (default)", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Textarea aria-label="Message" onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox", { name: "Message" })

    await user.type(textarea, "hello{enter}")

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("does not fire onSubmit on Shift+Enter, and inserts a newline instead", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Textarea aria-label="Message" onSubmit={onSubmit} />)
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

    await user.type(textarea, "hello{Shift>}{enter}{/Shift}world")

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea.value).toBe("hello\nworld")
  })

  it("does not fire onSubmit when submitOnEnter is false", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Textarea aria-label="Message" onSubmit={onSubmit} submitOnEnter={false} />)
    const textarea = screen.getByRole("textbox", { name: "Message" })

    await user.type(textarea, "hello{enter}")

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not fire onSubmit when onSubmit is not passed", async () => {
    const user = userEvent.setup()
    render(<Textarea aria-label="Message" />)
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

    await expect(user.type(textarea, "hello{enter}")).resolves.not.toThrow()
    expect(textarea.value).toBe("hello\n")
  })

  it("sets aria-invalid and the error class when error is true", () => {
    render(<Textarea aria-label="Message" error />)
    const textarea = screen.getByRole("textbox", { name: "Message" })
    expect(textarea).toHaveAttribute("aria-invalid", "true")
    expect(textarea).toHaveClass("hds-textarea-error")
  })

  it("omits aria-invalid when error is false", () => {
    render(<Textarea aria-label="Message" />)
    const textarea = screen.getByRole("textbox", { name: "Message" })
    expect(textarea).not.toHaveAttribute("aria-invalid")
    expect(textarea).not.toHaveClass("hds-textarea-error")
  })

  it("is non-focusable and non-interactive when disabled", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <>
        <button type="button">Before</button>
        <Textarea aria-label="Message" disabled onChange={onChange} />
        <button type="button">After</button>
      </>
    )
    const textarea = screen.getByRole("textbox", { name: "Message" })
    expect(textarea).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Before" }))
    await user.tab()
    expect(textarea).not.toHaveFocus()
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus()

    await user.type(textarea, "hi", { skipClick: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("supports controlled usage via value/onChange", async () => {
    function Controlled() {
      const [value, setValue] = useState("")
      return (
        <Textarea
          aria-label="Message"
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        />
      )
    }
    const user = userEvent.setup()
    render(<Controlled />)
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement
    await user.type(textarea, "hi")
    expect(textarea.value).toBe("hi")
  })

  it("supports uncontrolled usage via defaultValue", () => {
    render(<Textarea aria-label="Message" defaultValue="preset" />)
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement
    expect(textarea.value).toBe("preset")
  })

  it("merges a custom className", () => {
    render(<Textarea aria-label="Message" className="extra" />)
    const textarea = screen.getByRole("textbox", { name: "Message" })
    expect(textarea).toHaveClass("hds-textarea", "extra")
  })

  it("forwards ref to the underlying textarea element and supports .focus()", () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea aria-label="Message" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Message" }))

    ref.current?.focus()
    expect(ref.current).toHaveFocus()
  })
})
