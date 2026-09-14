import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SwatchPicker, type Swatch } from "./SwatchPicker"

const SWATCHES: Swatch[] = [
  { id: "violet", label: "Violeta", color: "var(--init-violet)" },
  { id: "sky", label: "Azul", color: "var(--init-sky)" },
  { id: "amber", label: "Âmbar", color: "var(--init-amber)" },
]

function setup(props: Partial<React.ComponentProps<typeof SwatchPicker>> = {}) {
  const onChange = vi.fn()
  render(
    <SwatchPicker
      swatches={SWATCHES}
      value="violet"
      onChange={onChange}
      ariaLabel="Cor da iniciativa"
      {...props}
    />
  )
  return onChange
}

describe("SwatchPicker", () => {
  it("exposes a radiogroup with one named radio per swatch", () => {
    setup()
    expect(screen.getByRole("radiogroup", { name: "Cor da iniciativa" })).toBeInTheDocument()
    // The name is the whole accessible content of a chip — a colour with no
    // name is a control a screen reader cannot describe at all.
    expect(screen.getByRole("radio", { name: "Âmbar" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(3)
  })

  it("marks only the selected swatch as checked", () => {
    setup()
    expect(screen.getByRole("radio", { name: "Violeta" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Azul" })).not.toBeChecked()
  })

  it("reports the picked swatch's id", async () => {
    const onChange = setup()
    await userEvent.click(screen.getByRole("radio", { name: "Azul" }))
    expect(onChange).toHaveBeenCalledWith("sky")
  })

  it("keeps one tab stop for the group, on the selected chip", () => {
    setup({ value: "amber" })
    expect(screen.getByRole("radio", { name: "Âmbar" })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("radio", { name: "Violeta" })).toHaveAttribute("tabindex", "-1")
  })

  it("still offers a tab stop when the value matches no swatch", () => {
    setup({ value: "nada-disso" })
    expect(screen.getByRole("radio", { name: "Violeta" })).toHaveAttribute("tabindex", "0")
  })

  it("moves the selection with the arrow keys, wrapping at the ends", async () => {
    const onChange = setup()
    screen.getByRole("radio", { name: "Violeta" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("sky")
    onChange.mockClear()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith("amber")
  })

  it("jumps to the ends with Home and End", async () => {
    const onChange = setup({ value: "sky" })
    screen.getByRole("radio", { name: "Azul" }).focus()
    await userEvent.keyboard("{End}")
    expect(onChange).toHaveBeenCalledWith("amber")
    onChange.mockClear()
    await userEvent.keyboard("{Home}")
    expect(onChange).toHaveBeenCalledWith("violet")
  })

  it("carries each swatch's colour as a custom property, so any palette works", () => {
    setup()
    expect(screen.getByRole("radio", { name: "Azul" }).getAttribute("style")).toContain(
      "--hds-swatch: var(--init-sky)"
    )
  })
})
