import { createElement } from "react"
import { render, screen } from "@testing-library/react"
import { act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useControllableState } from "./useControllableState"

type HarnessProps = {
  value?: string
  defaultValue: string
  onChange?: (value: string) => void
}

function Harness({ value, defaultValue, onChange }: HarnessProps) {
  const [current, setValue] = useControllableState({ value, defaultValue, onChange })
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "value" }, current),
    createElement("button", { onClick: () => setValue("next") }, "set")
  )
}

describe("useControllableState", () => {
  it("uncontrolled mode: updates internal state and calls onChange", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(createElement(Harness, { defaultValue: "initial", onChange }))

    expect(screen.getByTestId("value").textContent).toBe("initial")

    await user.click(screen.getByRole("button", { name: "set" }))

    expect(screen.getByTestId("value").textContent).toBe("next")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("next")
  })

  it("controlled mode: setValue does not update state on its own, but calls onChange", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(createElement(Harness, { value: "controlled", defaultValue: "initial", onChange }))

    expect(screen.getByTestId("value").textContent).toBe("controlled")

    await user.click(screen.getByRole("button", { name: "set" }))

    // Parent never re-supplied a new `value` prop, so the rendered value
    // must remain exactly what the controlling parent last passed in.
    expect(screen.getByTestId("value").textContent).toBe("controlled")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("next")
  })

  it("controlled mode: reflects the value prop once the parent re-supplies it", () => {
    const { rerender } = render(
      createElement(Harness, { value: "controlled", defaultValue: "initial" })
    )
    expect(screen.getByTestId("value").textContent).toBe("controlled")

    rerender(createElement(Harness, { value: "updated", defaultValue: "initial" }))
    expect(screen.getByTestId("value").textContent).toBe("updated")
  })

  it("defaultValue is only used on initial mount (later prop changes are ignored in uncontrolled mode)", () => {
    const { rerender } = render(createElement(Harness, { defaultValue: "initial" }))
    expect(screen.getByTestId("value").textContent).toBe("initial")

    rerender(createElement(Harness, { defaultValue: "changed" }))

    // useState's initializer only runs once; a later defaultValue change
    // must not retroactively alter already-initialized internal state.
    expect(screen.getByTestId("value").textContent).toBe("initial")
  })

  it("uncontrolled mode: works without an onChange handler", async () => {
    const user = userEvent.setup()
    render(createElement(Harness, { defaultValue: "initial" }))

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "set" }))
    })

    expect(screen.getByTestId("value").textContent).toBe("next")
  })
})
