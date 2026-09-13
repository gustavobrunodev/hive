import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CodeFence } from "./CodeFence"

const SOURCE = 'const a = 1\n\nif (a) {\n  console.log("oi")\n}'

describe("CodeFence", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the block content and tags the language", () => {
    const { container } = render(
      <CodeFence code={SOURCE} language="ts">
        <code>{SOURCE}</code>
      </CodeFence>
    )
    expect(container.querySelector("pre code")?.textContent).toBe(SOURCE)
    expect(container.querySelector(".hds-fence-lang")?.textContent).toBe("ts")
  })

  it("leaves the tag off an untagged fence rather than inventing one", () => {
    const { container } = render(
      <CodeFence code="x">
        <code>x</code>
      </CodeFence>
    )
    expect(container.querySelector(".hds-fence-lang")).toBeNull()
  })

  /**
   * The contract that makes this component worth having: what it copies is the
   * `code` prop, never the rendered tree. Highlighted output is a pile of
   * spans, and reading its `textContent` inserts a space at every boundary —
   * code that no longer runs, from a control whose whole promise is that it
   * does.
   */
  it("copies the source it was given, not the text of what it rendered", async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(
      <CodeFence code={SOURCE} onCopy={onCopy}>
        <code>
          <span>const</span>
          <span> a = 1</span>
        </code>
      </CodeFence>
    )

    await user.click(screen.getByRole("button", { name: "Copiar" }))
    expect(onCopy).toHaveBeenCalledWith(SOURCE)
  })

  it("says it copied, then stops saying so", async () => {
    // `fireEvent`, not `userEvent`, for the click: user-event schedules its own
    // work on timers, and driving it under fake ones deadlocks — it waits for a
    // tick that only `advanceTimersByTime` can deliver, and that call is behind
    // the await it never returns from. The event this control listens for is a
    // plain click, so dispatching one is the whole interaction.
    vi.useFakeTimers()
    render(
      <CodeFence code="x" onCopy={vi.fn()} copyLabel="Copiar" copiedLabel="Copiado">
        <code>x</code>
      </CodeFence>
    )

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }))
    // The accessible name changes with the state, not just the visible text: a
    // control still announcing "Copiar" after a copy tells a screen-reader user
    // that nothing happened.
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1700)
    })
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument()
  })

  it("renders no control at all without an onCopy — it owns no clipboard of its own", () => {
    render(
      <CodeFence code="x">
        <code>x</code>
      </CodeFence>
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  /**
   * Anything the caller passes lands on the frame, because the frame is the
   * block. A host anchoring a scroll target to this component means the whole
   * thing — the `pre` inside starts one header-strip lower.
   */
  it("puts caller attributes on the frame, not on the inner pre", () => {
    const { container } = render(
      <CodeFence code="x" data-line="42" className="mine">
        <code>x</code>
      </CodeFence>
    )
    const frame = container.querySelector(".hds-fence")
    expect(frame?.getAttribute("data-line")).toBe("42")
    expect(frame?.classList.contains("mine")).toBe(true)
    expect(container.querySelector("pre")?.getAttribute("data-line")).toBeNull()
  })

  it("makes the scroller focusable, so a block wider than the column is reachable by keyboard", () => {
    const { container } = render(
      <CodeFence code="x">
        <code>x</code>
      </CodeFence>
    )
    expect(container.querySelector("pre")?.getAttribute("tabindex")).toBe("0")
  })
})
