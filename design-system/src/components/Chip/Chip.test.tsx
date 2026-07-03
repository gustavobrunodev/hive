import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Chip } from "./Chip"

describe("Chip", () => {
  it("renders children as text content", () => {
    render(<Chip>Label</Chip>)
    expect(screen.getByText("Label")).toBeInTheDocument()
  })

  it("defaults to the tag variant", () => {
    render(<Chip>Tag</Chip>)
    expect(screen.getByText("Tag")).toHaveClass("hds-chip", "hds-chip-tag")
  })

  it("renders the phase variant without the is-active class when inactive", () => {
    render(<Chip variant="phase">Phase</Chip>)
    const el = screen.getByText("Phase")
    expect(el).toHaveClass("hds-chip", "hds-chip-phase")
    expect(el).not.toHaveClass("is-active")
  })

  it("renders the phase variant with the is-active class when active", () => {
    render(
      <Chip variant="phase" active>
        Active Phase
      </Chip>
    )
    expect(screen.getByText("Active Phase")).toHaveClass("hds-chip-phase", "is-active")
  })

  it("does not apply is-active for non-phase variants even when active is true", () => {
    render(
      <Chip variant="tag" active>
        Tag Active
      </Chip>
    )
    expect(screen.getByText("Tag Active")).not.toHaveClass("is-active")
  })

  it("renders the agent variant", () => {
    render(<Chip variant="agent">Cursor</Chip>)
    expect(screen.getByText("Cursor")).toHaveClass("hds-chip", "hds-chip-agent")
  })

  it("renders the skill variant without tone-he by default", () => {
    render(<Chip variant="skill">harness-engineer</Chip>)
    const el = screen.getByText("harness-engineer")
    expect(el).toHaveClass("hds-chip", "hds-chip-skill")
    expect(el).not.toHaveClass("tone-he")
  })

  it("renders the skill variant with tone-he when tone='he'", () => {
    render(
      <Chip variant="skill" tone="he">
        harness-engineer
      </Chip>
    )
    expect(screen.getByText("harness-engineer")).toHaveClass("hds-chip-skill", "tone-he")
  })

  it("does not apply tone-he for non-skill variants even when tone='he'", () => {
    render(
      <Chip variant="tag" tone="he">
        Tag Tone
      </Chip>
    )
    expect(screen.getByText("Tag Tone")).not.toHaveClass("tone-he")
  })

  it("does not apply tone-he for skill variant when tone is not 'he'", () => {
    render(
      <Chip variant="skill" tone="other">
        Other Tone
      </Chip>
    )
    expect(screen.getByText("Other Tone")).not.toHaveClass("tone-he")
  })

  it("passes through a custom className alongside the base classes", () => {
    render(<Chip className="custom-class">Passthrough</Chip>)
    expect(screen.getByText("Passthrough")).toHaveClass("hds-chip", "hds-chip-tag", "custom-class")
  })

  it("spreads other rest props onto the host span", () => {
    render(
      <Chip data-testid="chip-el" title="hint">
        Rest
      </Chip>
    )
    const el = screen.getByTestId("chip-el")
    expect(el).toHaveAttribute("title", "hint")
    expect(el.tagName).toBe("SPAN")
  })
})
