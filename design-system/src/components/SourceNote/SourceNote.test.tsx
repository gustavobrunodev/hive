import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SourceNote, type SourceNoteFonte } from "./SourceNote"

const BASE = {
  title: "Não consigo ver o histórico maior que 90 dias",
  volume: "1.932 menções",
  impact: "alto" as const,
  impactLabel: "Alto",
  impactPrefix: "Impacto",
  trend: 14,
  trendLabel: "14%",
}

describe("SourceNote", () => {
  it.each<SourceNoteFonte>(["likert", "voz", "fullstory"])(
    "C18d: the fill is var(--source-%s-bg), and the ink is the same source's",
    (fonte) => {
      render(<SourceNote fonte={fonte} {...BASE} />)
      const note = screen.getByRole("button")
      expect(note).toHaveStyle({ background: `var(--source-${fonte}-bg)` })
      expect(note).toHaveStyle({ color: `var(--source-${fonte}-ink)` })
      expect(note).toHaveAttribute("data-fonte", fonte)
    }
  )

  it("shows the title, the volume with its unit, the impact and the trend", () => {
    render(<SourceNote fonte="likert" {...BASE} icon={<svg data-testid="glyph" />} />)
    const note = screen.getByRole("button")
    expect(note).toHaveTextContent(BASE.title)
    expect(note).toHaveTextContent("1.932 menções")
    expect(note).toHaveTextContent("14%")
    // The impact is a word — with its prefix for assistive tech only.
    expect(note).toHaveAccessibleName(/Impacto Alto/)
    expect(screen.getByTestId("glyph").closest("[aria-hidden]")).not.toBeNull()
  })

  it.each([
    [12, "up"],
    [-3, "down"],
    [0, "flat"],
  ])("draws the trend %i as %s", (trend, direction) => {
    const { container } = render(<SourceNote fonte="voz" {...BASE} trend={trend} />)
    expect(container.querySelector(".hds-note-trend")).toHaveAttribute("data-trend", direction)
  })

  it("is a plain button until it toggles a selection, then carries aria-pressed and the check", () => {
    const { container, rerender } = render(<SourceNote fonte="fullstory" {...BASE} />)
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed")
    expect(container.querySelector(".hds-note-check")).toBeNull()

    rerender(<SourceNote fonte="fullstory" {...BASE} pressed={false} />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
    expect(container.querySelector(".hds-note-check")).not.toHaveAttribute("data-on")

    rerender(<SourceNote fonte="fullstory" {...BASE} pressed />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector(".hds-note-check")).toHaveAttribute("data-on")
  })

  it("passes clicks, the tilt and extra styles through", () => {
    const onClick = vi.fn()
    render(<SourceNote fonte="likert" {...BASE} impactPrefix={undefined} tilt={-1.5} style={{ width: "200px" }} onClick={onClick} />)
    const note = screen.getByRole("button")
    fireEvent.click(note)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(note.style.getPropertyValue("--hds-note-tilt")).toBe("-1.5deg")
    expect(note).toHaveStyle({ width: "200px" })
    expect(note).toHaveAttribute("type", "button")
  })
})
