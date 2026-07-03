import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Switch } from "./Switch"

describe("Switch", () => {
  it("renders with the switch role, unchecked by default", () => {
    render(<Switch aria-label="Airplane mode" />)
    const toggle = screen.getByRole("switch", { name: "Airplane mode" })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("applies the hds-switch base class", () => {
    render(<Switch aria-label="Airplane mode" />)
    expect(screen.getByRole("switch")).toHaveClass("hds-switch")
  })

  it("toggles via click in uncontrolled mode", async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="Airplane mode" />)
    const toggle = screen.getByRole("switch", { name: "Airplane mode" })

    expect(toggle).toHaveAttribute("data-state", "unchecked")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("data-state", "checked")
    expect(toggle).toHaveAttribute("aria-checked", "true")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("toggles via the Space key when focused", async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="Airplane mode" />)
    const toggle = screen.getByRole("switch", { name: "Airplane mode" })

    await user.tab()
    expect(toggle).toHaveFocus()
    await user.keyboard(" ")
    expect(toggle).toHaveAttribute("data-state", "checked")
    await user.keyboard(" ")
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("supports controlled mode via checked + onCheckedChange", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()

    function Controlled() {
      const [checked, setChecked] = useState(false)
      return (
        <Switch
          aria-label="Notifications"
          checked={checked}
          onCheckedChange={(next) => {
            onCheckedChange(next)
            setChecked(next)
          }}
        />
      )
    }

    render(<Controlled />)
    const toggle = screen.getByRole("switch", { name: "Notifications" })

    expect(toggle).toHaveAttribute("data-state", "unchecked")
    await user.click(toggle)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(toggle).toHaveAttribute("data-state", "checked")
  })

  it("does not change state when checked is controlled without a change handler acting on it", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Locked" checked={false} onCheckedChange={onCheckedChange} />)
    const toggle = screen.getByRole("switch", { name: "Locked" })

    await user.click(toggle)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    // Parent chose not to update `checked`, so the rendered state stays put.
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("is non-focusable and non-interactive when disabled", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Disabled toggle" disabled onCheckedChange={onCheckedChange} />)
    const toggle = screen.getByRole("switch", { name: "Disabled toggle" })

    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute("data-disabled", "")

    await user.tab()
    expect(toggle).not.toHaveFocus()

    await user.click(toggle)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(toggle).toHaveAttribute("data-state", "unchecked")
  })

  it("merges a custom className with the base class", () => {
    render(<Switch aria-label="Airplane mode" className="extra" />)
    const toggle = screen.getByRole("switch", { name: "Airplane mode" })
    expect(toggle).toHaveClass("hds-switch", "extra")
  })

  it("forwards a ref to the underlying button element", () => {
    let node: HTMLButtonElement | null = null
    render(
      <Switch
        aria-label="Ref test"
        ref={(el) => {
          node = el
        }}
      />
    )
    expect(node).not.toBeNull()
    expect((node as unknown as HTMLElement)?.tagName).toBe("BUTTON")
  })
})
