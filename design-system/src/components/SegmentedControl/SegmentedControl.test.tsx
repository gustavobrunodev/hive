import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SegmentedControl, type SegmentedOption } from "./SegmentedControl"

const OPTIONS: SegmentedOption[] = [
  { id: "all", label: "Tudo", count: 128 },
  { id: "tools", label: "Ferramentas", count: 84, tone: "accent" },
  { id: "errors", label: "Erros", count: 3, tone: "danger" },
]

/** Renders the control with a spy onChange and returns the spy. */
function setup(props: Partial<React.ComponentProps<typeof SegmentedControl>> = {}) {
  const onChange = vi.fn()
  render(
    <SegmentedControl
      options={OPTIONS}
      value="all"
      onChange={onChange}
      ariaLabel="Filtrar eventos"
      {...props}
    />
  )
  return onChange
}

describe("SegmentedControl", () => {
  it("exposes a radiogroup with one radio per option", () => {
    setup()
    expect(screen.getByRole("radiogroup", { name: "Filtrar eventos" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(3)
  })

  it("marks only the selected option as checked", () => {
    setup({ value: "tools" })
    expect(screen.getByRole("radio", { name: /Ferramentas/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /Tudo/ })).not.toBeChecked()
  })

  it("keeps a single tab stop on the selected option", () => {
    setup({ value: "errors" })
    expect(screen.getByRole("radio", { name: /Erros/ })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("radio", { name: /Tudo/ })).toHaveAttribute("tabindex", "-1")
  })

  it("reports the clicked option", async () => {
    const onChange = setup()
    await userEvent.click(screen.getByRole("radio", { name: /Ferramentas/ }))
    expect(onChange).toHaveBeenCalledWith("tools")
  })

  it("renders counts, omitting the badge when count is undefined", () => {
    render(
      <SegmentedControl
        options={[
          { id: "a", label: "Com", count: 0 },
          { id: "b", label: "Sem" },
        ]}
        value="a"
        onChange={vi.fn()}
        ariaLabel="g"
      />
    )
    // `0` is a real tally and must render; only `undefined` omits the badge.
    expect(screen.getByRole("radio", { name: "Com 0" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Sem" })).toBeInTheDocument()
  })

  it("tones the count badge from the option", () => {
    setup()
    expect(screen.getByText("3")).toHaveAttribute("data-tone", "danger")
    expect(screen.getByText("128")).toHaveAttribute("data-tone", "neutral")
  })

  describe("keyboard", () => {
    it.each([
      ["{ArrowRight}", "all", "tools"],
      ["{ArrowDown}", "all", "tools"],
      ["{ArrowLeft}", "tools", "all"],
      ["{ArrowUp}", "tools", "all"],
      ["{Home}", "errors", "all"],
      ["{End}", "all", "errors"],
    ])("%s moves the selection from %s to %s", async (key, from, to) => {
      const onChange = setup({ value: from })
      await userEvent.click(screen.getByRole("radio", { checked: true }))
      onChange.mockClear()
      await userEvent.keyboard(key)
      expect(onChange).toHaveBeenCalledWith(to)
    })

    it("wraps around both ends", async () => {
      const onChange = setup({ value: "errors" })
      await userEvent.click(screen.getByRole("radio", { checked: true }))
      onChange.mockClear()
      await userEvent.keyboard("{ArrowRight}")
      expect(onChange).toHaveBeenCalledWith("all")
    })

    it("ignores keys it does not handle, leaving the selection alone", async () => {
      const onChange = setup()
      await userEvent.click(screen.getByRole("radio", { checked: true }))
      onChange.mockClear()
      await userEvent.keyboard("x")
      expect(onChange).not.toHaveBeenCalled()
    })

    it("re-commits the focused segment on Enter (native button activation)", async () => {
      const onChange = setup()
      await userEvent.click(screen.getByRole("radio", { checked: true }))
      onChange.mockClear()
      await userEvent.keyboard("{Enter}")
      expect(onChange).toHaveBeenCalledWith("all")
    })

    it("skips disabled options when moving", async () => {
      const onChange = vi.fn()
      render(
        <SegmentedControl
          options={[
            { id: "a", label: "A" },
            { id: "b", label: "B", disabled: true },
            { id: "c", label: "C" },
          ]}
          value="a"
          onChange={onChange}
          ariaLabel="g"
        />
      )
      await userEvent.click(screen.getByRole("radio", { name: "A" }))
      onChange.mockClear()
      await userEvent.keyboard("{ArrowRight}")
      expect(onChange).toHaveBeenCalledWith("c")
    })

    it("does nothing when every option is disabled", async () => {
      const onChange = vi.fn()
      render(
        <SegmentedControl
          options={[{ id: "a", label: "A", disabled: true }]}
          value="a"
          onChange={onChange}
          ariaLabel="g"
        />
      )
      screen.getByRole("radiogroup").focus()
      await userEvent.keyboard("{ArrowRight}")
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it("does not fire for a disabled option's click", async () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={[
          { id: "a", label: "A" },
          { id: "b", label: "B", disabled: true },
        ]}
        value="a"
        onChange={onChange}
        ariaLabel="g"
      />
    )
    await userEvent.click(screen.getByRole("radio", { name: "B" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("omits the indicator when nothing measures (no layout in jsdom)", () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="all" onChange={vi.fn()} ariaLabel="g" />
    )
    expect(container.querySelector(".hds-seg-thumb")).toBeNull()
  })

  it("positions the indicator over the selected segment once it measures", () => {
    // jsdom reports every offset as 0; stand in for a real layout engine.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(90)
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockReturnValue(42)
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="tools" onChange={vi.fn()} ariaLabel="g" />
    )
    const thumb = container.querySelector<HTMLElement>(".hds-seg-thumb")
    expect(thumb).not.toBeNull()
    expect(thumb?.style.transform).toBe("translateX(42px)")
    expect(thumb?.style.width).toBe("90px")
    vi.restoreAllMocks()
  })

  it("applies the size and a passed className to the track", () => {
    const { container } = render(
      <SegmentedControl
        options={OPTIONS}
        value="all"
        onChange={vi.fn()}
        ariaLabel="g"
        size="md"
        className="mine"
      />
    )
    expect(container.querySelector(".hds-seg")).toHaveClass("hds-seg-md", "mine")
  })
})
