import { createRef, useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { HighlightedTextarea } from "./HighlightedTextarea"

/** Marks `[start, end)` — the shape a live-transcription caller actually uses. */
function markRange(value: string, start: number, end: number) {
  return [
    <span key="a">{value.slice(0, start)}</span>,
    <span key="b" data-fresh="true">
      {value.slice(start, end)}
    </span>,
    <span key="c">{value.slice(end)}</span>,
  ]
}

describe("HighlightedTextarea", () => {
  it("renders a real textarea the caller can type into", async () => {
    const user = userEvent.setup()
    function Harness() {
      const [value, setValue] = useState("")
      return (
        <HighlightedTextarea
          aria-label="Transcrição"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          highlight={(current) => current}
        />
      )
    }
    render(<Harness />)
    const field = screen.getByLabelText("Transcrição")
    await user.type(field, "olá")
    expect(field).toHaveValue("olá")
  })

  it("mirrors the value into a backdrop that is hidden from assistive tech", () => {
    const { container } = render(
      <HighlightedTextarea
        aria-label="Transcrição"
        value="uma frase"
        onChange={() => {}}
        highlight={(value) => markRange(value, 4, 9)}
      />
    )
    const backdrop = container.querySelector(".hds-hl-textarea-backdrop")
    expect(backdrop).toHaveAttribute("aria-hidden", "true")
    // The mirror must carry the *whole* string, or the tint drifts.
    expect(backdrop).toHaveTextContent("uma frase")
    expect(backdrop?.querySelector("[data-fresh]")).toHaveTextContent("frase")
  })

  it("does not duplicate the text for a screen reader — only the field is read", () => {
    render(
      <HighlightedTextarea
        aria-label="Transcrição"
        value="uma frase"
        onChange={() => {}}
        highlight={(value) => value}
      />
    )
    // One accessible node with the value; the mirror is aria-hidden.
    expect(screen.getAllByDisplayValue("uma frase")).toHaveLength(1)
  })

  it("keeps the backdrop scrolled with the field, so the tint follows the text", () => {
    const { container } = render(
      <HighlightedTextarea
        aria-label="Transcrição"
        value="linha"
        onChange={() => {}}
        highlight={(value) => value}
      />
    )
    const backdrop = container.querySelector(".hds-hl-textarea-backdrop") as HTMLDivElement
    const field = screen.getByLabelText("Transcrição") as HTMLTextAreaElement
    Object.defineProperty(field, "scrollTop", { value: 42, writable: true })
    field.dispatchEvent(new Event("scroll", { bubbles: true }))
    expect(backdrop.scrollTop).toBe(42)
  })

  it("still calls a caller's own onScroll", () => {
    const onScroll = vi.fn()
    render(
      <HighlightedTextarea
        aria-label="Transcrição"
        value="linha"
        onChange={() => {}}
        onScroll={onScroll}
        highlight={(value) => value}
      />
    )
    screen
      .getByLabelText("Transcrição")
      .dispatchEvent(new Event("scroll", { bubbles: true }))
    expect(onScroll).toHaveBeenCalled()
  })

  it("marks the mode it is in, orthogonally to focus", () => {
    const { container, rerender } = render(
      <HighlightedTextarea
        aria-label="Transcrição"
        value=""
        onChange={() => {}}
        highlight={(value) => value}
      />
    )
    const wrapper = container.querySelector(".hds-hl-textarea")
    expect(wrapper).not.toHaveAttribute("data-active")

    rerender(
      <HighlightedTextarea
        aria-label="Transcrição"
        value=""
        onChange={() => {}}
        active
        highlight={(value) => value}
      />
    )
    expect(container.querySelector(".hds-hl-textarea")).toHaveAttribute("data-active", "true")
  })

  it("forwards a ref to the textarea itself, not the wrapper", () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(
      <HighlightedTextarea
        ref={ref}
        aria-label="Transcrição"
        value=""
        onChange={() => {}}
        highlight={(value) => value}
      />
    )
    expect(ref.current?.tagName).toBe("TEXTAREA")
  })
})
