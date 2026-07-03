import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Slider } from "./Slider"

describe("Slider", () => {
  it("renders a single thumb for a single-value slider", () => {
    render(<Slider defaultValue={[50]} min={0} max={100} />)
    const thumbs = screen.getAllByRole("slider")
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "50")
  })

  it("renders two thumbs for a range (two-value) slider", () => {
    render(<Slider defaultValue={[20, 80]} min={0} max={100} />)
    const thumbs = screen.getAllByRole("slider")
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "20")
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "80")
  })

  it("derives thumb count from a controlled value array", () => {
    render(<Slider value={[10, 40, 90]} min={0} max={100} onValueChange={() => {}} />)
    expect(screen.getAllByRole("slider")).toHaveLength(3)
  })

  it("falls back to a single thumb when neither value nor defaultValue is given", () => {
    render(<Slider min={0} max={100} />)
    expect(screen.getAllByRole("slider")).toHaveLength(1)
  })

  it("supports controlled mode via value + onValueChange", async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState([30])
      return (
        <Slider
          value={value}
          onValueChange={setValue}
          min={0}
          max={100}
          step={1}
        />
      )
    }
    render(<Controlled />)
    const thumb = screen.getByRole("slider")
    expect(thumb).toHaveAttribute("aria-valuenow", "30")

    thumb.focus()
    await user.keyboard("{ArrowRight}")
    expect(thumb).toHaveAttribute("aria-valuenow", "31")
  })

  it("moves a focused thumb's value on ArrowRight and ArrowLeft", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    function Controlled() {
      const [value, setValue] = useState([50])
      return (
        <Slider
          value={value}
          onValueChange={(next) => {
            setValue(next)
            onValueChange(next)
          }}
          min={0}
          max={100}
          step={5}
        />
      )
    }
    render(<Controlled />)
    const thumb = screen.getByRole("slider")
    thumb.focus()

    await user.keyboard("{ArrowRight}")
    expect(onValueChange).toHaveBeenLastCalledWith([55])
    expect(thumb).toHaveAttribute("aria-valuenow", "55")

    await user.keyboard("{ArrowLeft}")
    expect(onValueChange).toHaveBeenLastCalledWith([50])
    expect(thumb).toHaveAttribute("aria-valuenow", "50")
  })

  it("moves the correct thumb in a range slider via arrow keys", async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState([20, 80])
      return (
        <Slider value={value} onValueChange={setValue} min={0} max={100} step={1} />
      )
    }
    render(<Controlled />)
    const thumbs = screen.getAllByRole("slider")
    thumbs[1]!.focus()
    await user.keyboard("{ArrowLeft}")

    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "20")
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "79")
  })

  it("is non-interactive when disabled", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Slider defaultValue={[50]} disabled onValueChange={onValueChange} min={0} max={100} />
    )
    const [thumb] = screen.getAllByRole("slider")
    expect(thumb).not.toHaveAttribute("tabindex")
    expect(thumb?.closest(".hds-slider")).toHaveAttribute("data-disabled")

    thumb?.focus()
    await user.keyboard("{ArrowRight}")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("merges a custom className", () => {
    render(<Slider defaultValue={[50]} className="extra" min={0} max={100} />)
    const root = document.querySelector(".hds-slider")
    expect(root).toHaveClass("hds-slider", "extra")
  })

  it("forwards a ref to the root element", () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(<Slider ref={ref} defaultValue={[50]} min={0} max={100} />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
    expect(ref.current).toHaveClass("hds-slider")
  })
})
