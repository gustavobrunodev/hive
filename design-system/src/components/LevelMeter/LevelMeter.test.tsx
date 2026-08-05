import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LevelMeter } from "./LevelMeter"

function bars(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hds-level-meter-bar"))
}

/** The nth bar, asserted to exist — the strict tsconfig requires the check. */
function bar(index: number): HTMLElement {
  const found = bars()[index]
  if (found === undefined) throw new Error(`no bar at index ${index}`)
  return found
}

describe("LevelMeter", () => {
  it("renders one bar per slot, regardless of how much history it was given", () => {
    render(<LevelMeter levels={[0.5]} bars={8} label="Nível" />)
    expect(bars()).toHaveLength(8)
  })

  it("defaults to 20 bars", () => {
    render(<LevelMeter levels={[]} label="Nível" />)
    expect(bars()).toHaveLength(20)
  })

  it("maps levels to bar heights, newest on the right", () => {
    render(<LevelMeter levels={[0.25, 1]} bars={3} label="Nível" />)
    // Padded on the left, so a meter that has just started reads as running.
    expect(bar(0).style.height).toBe("0%")
    expect(bar(1).style.height).toBe("25%")
    expect(bar(2).style.height).toBe("100%")
  })

  it("keeps only the most recent levels when history outgrows the track", () => {
    render(<LevelMeter levels={[0.1, 0.2, 0.3, 0.4]} bars={2} label="Nível" />)
    expect(bars()).toHaveLength(2)
    expect(bar(0).style.height).toBe("30%")
    expect(bar(1).style.height).toBe("40%")
  })

  it("clamps levels outside 0–1 instead of rendering a bar out of the track", () => {
    render(<LevelMeter levels={[-1, 4]} bars={2} label="Nível" />)
    expect(bar(0).style.height).toBe("0%")
    expect(bar(1).style.height).toBe("100%")
  })

  // The state the component exists for: a timer counts up identically whether a
  // microphone is capturing a voice or muted, so the flat line is the only thing
  // on screen that can answer "is this working?".
  it("flattens and says so when there is no signal", () => {
    render(<LevelMeter levels={[0, 0.01, 0]} bars={3} label="Nível" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-signal", "none")
  })

  it("reports a live signal as soon as one bar crosses the threshold", () => {
    render(<LevelMeter levels={[0, 0, 0.3]} bars={3} label="Nível" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-signal", "live")
  })

  it("treats an empty history as no signal rather than as unknown", () => {
    render(<LevelMeter levels={[]} bars={4} label="Nível" />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-signal", "none")
  })

  it("takes a custom silence threshold", () => {
    render(<LevelMeter levels={[0.2]} bars={2} label="Nível" silenceThreshold={0.5} />)
    expect(screen.getByRole("meter")).toHaveAttribute("data-signal", "none")
  })

  it("exposes the current level to assistive technology", () => {
    render(<LevelMeter levels={[0.1, 0.666]} bars={4} label="Nível do microfone" />)
    const meter = screen.getByRole("meter", { name: "Nível do microfone" })
    expect(meter).toHaveAttribute("aria-valuemin", "0")
    expect(meter).toHaveAttribute("aria-valuemax", "1")
    // Rounded: a value changing 20 times a second does not need 15 decimals.
    expect(meter).toHaveAttribute("aria-valuenow", "0.67")
  })

  it("passes through className and arbitrary div props", () => {
    render(<LevelMeter levels={[]} label="Nível" className="extra" data-testid="meter" />)
    const meter = screen.getByTestId("meter")
    expect(meter).toHaveClass("hds-level-meter")
    expect(meter).toHaveClass("extra")
  })
})
