import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RampSelect, type RampStep } from "./RampSelect"

const STEPS: RampStep[] = [
  { id: "low", label: "Baixo", description: "Responde rápido" },
  { id: "medium", label: "Médio", description: "Equilíbrio" },
  { id: "high", label: "Alto", description: "Raciocina mais" },
  { id: "max", label: "Máx", description: "O máximo, e o mais lento" },
]

const AUTO: RampStep = { id: "", label: "Auto", description: "Deixa a CLI decidir" }

function setup(props: Partial<React.ComponentProps<typeof RampSelect>> = {}) {
  const onChange = vi.fn()
  const view = render(
    <RampSelect
      steps={STEPS}
      value="medium"
      onChange={onChange}
      ariaLabel="Nível de esforço"
      {...props}
    />
  )
  return { onChange, ...view }
}

/** The visual claim under test: which rungs read as filled. */
function filled(): string[] {
  return screen
    .getAllByRole("radio")
    .filter((node) => node.hasAttribute("data-filled"))
    .map((node) => node.textContent ?? "")
}

/** …and which read as "this is what a click here would buy". */
function previewed(): string[] {
  return screen
    .getAllByRole("radio")
    .filter((node) => node.hasAttribute("data-preview"))
    .map((node) => node.textContent ?? "")
}

describe("RampSelect", () => {
  it("exposes one radio per step in a named group", () => {
    setup()
    const group = screen.getByRole("radiogroup", { name: "Nível de esforço" })
    expect(within(group).getAllByRole("radio")).toHaveLength(4)
    expect(screen.getByRole("radio", { name: /Médio/ })).toBeChecked()
  })

  it("fills every rung up to the selection, not just the selected one", () => {
    setup({ value: "high" })
    expect(filled()).toEqual(["Baixo", "Médio", "Alto"])
  })

  it("climbs: each rung's bar is taller than the one before it", () => {
    const { container } = setup()
    const heights = Array.from(container.querySelectorAll<HTMLElement>(".hds-ramp-bar")).map(
      (bar) => Number.parseFloat(bar.style.getPropertyValue("--hds-ramp-height"))
    )
    expect(heights).toHaveLength(4)
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i] ?? 0).toBeGreaterThan(heights[i - 1] ?? 0)
    }
  })

  it("reports the chosen step", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByRole("radio", { name: /Máx/ }))
    expect(onChange).toHaveBeenCalledWith("max")
  })

  it("shows the selected step's description", () => {
    setup({ value: "max" })
    expect(screen.getByText("O máximo, e o mais lento")).toBeInTheDocument()
  })

  it("moves the selection with the arrow keys from a single tab stop", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.tab()
    expect(screen.getByRole("radio", { name: /Médio/ })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("high")
  })

  it("wraps at the ends and jumps with Home/End", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ value: "low" })
    await user.tab()
    await user.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith("max")
    await user.keyboard("{End}")
    expect(onChange).toHaveBeenCalledWith("max")
    await user.keyboard("{Home}")
    expect(onChange).toHaveBeenCalledWith("low")
  })

  describe("with a delegated option", () => {
    it("offers it beside the ramp and leaves every bar unfilled when it is chosen", () => {
      setup({ autoStep: AUTO, value: "" })
      expect(screen.getByRole("radio", { name: /Auto/ })).toBeChecked()
      expect(filled()).toEqual([])
    })

    it("keeps it reachable by keyboard as the first option", async () => {
      const user = userEvent.setup()
      const { onChange } = setup({ autoStep: AUTO, value: "low" })
      await user.tab()
      await user.keyboard("{ArrowLeft}")
      expect(onChange).toHaveBeenCalledWith("")
    })

    it("still fills the ramp normally once a real rung is chosen", () => {
      setup({ autoStep: AUTO, value: "medium" })
      expect(filled()).toEqual(["Baixo", "Médio"])
    })
  })

  describe("the hover preview", () => {
    it("fills ahead of the pointer, above the current selection", async () => {
      const user = userEvent.setup()
      setup({ value: "low" })
      await user.hover(screen.getByRole("radio", { name: /Alto/ }))
      expect(previewed()).toEqual(["Médio", "Alto"])
    })

    it("previews nothing at or below the selection — that is already filled", async () => {
      const user = userEvent.setup()
      setup({ value: "high" })
      await user.hover(screen.getByRole("radio", { name: /Baixo/ }))
      expect(previewed()).toEqual([])
    })

    it("clears when the pointer leaves the track", async () => {
      const user = userEvent.setup()
      const { container } = setup({ value: "low" })
      await user.hover(screen.getByRole("radio", { name: /Máx/ }))
      expect(previewed()).not.toEqual([])
      await user.unhover(container.querySelector(".hds-ramp-track") as HTMLElement)
      expect(previewed()).toEqual([])
    })

    it("does not preview from the delegated option — it is not on the scale", async () => {
      const user = userEvent.setup()
      setup({ autoStep: AUTO, value: "low" })
      await user.hover(screen.getByRole("radio", { name: /Auto/ }))
      expect(previewed()).toEqual([])
    })
  })

  it("can be asked for the ramp without the description line", () => {
    const { container } = setup({ showDescription: false })
    expect(container.querySelector(".hds-ramp-description")).toBeNull()
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-describedby")
  })

  it("ignores keys that are not part of the contract", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.tab()
    await user.keyboard("{PageDown}")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("never reports a disabled step", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({
      steps: STEPS.map((step) => (step.id === "medium" ? { ...step, disabled: true } : step)),
    })
    await user.click(screen.getByRole("radio", { name: /Médio/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("falls back when the selection has nothing to say", () => {
    setup({ steps: [{ id: "low", label: "Baixo" }], value: "low", descriptionFallback: "—" })
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
