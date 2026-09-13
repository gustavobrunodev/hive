import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { StageTracker, type StageTrackerStage } from "./StageTracker"

const STAGES: StageTrackerStage[] = [
  { id: "research", label: "Pesquisa", status: "done" },
  { id: "prd", label: "PRD", hint: "prd.md", status: "active" },
  { id: "arch", label: "Arquitetura", status: "pending" }
]

describe("StageTracker", () => {
  it("names the plan and lists one item per stage", () => {
    render(<StageTracker stages={STAGES} label="Fluxo BMAD" />)
    expect(screen.getByRole("list", { name: "Fluxo BMAD" })).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
  })

  it("marks the next stage with aria-current and nothing else", () => {
    render(<StageTracker stages={STAGES} label="Fluxo" />)
    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.hasAttribute("aria-current"))
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute("aria-current", "step")
  })

  it("says each stage's status in words, since the visual state is colour and shape", () => {
    render(<StageTracker stages={STAGES} label="Fluxo" />)
    const [first, second, third] = screen.getAllByRole("listitem")
    expect(first).toHaveTextContent("Pesquisa, concluída")
    expect(second).toHaveTextContent("PRD, próxima")
    expect(third).toHaveTextContent("Arquitetura, pendente")
  })

  it("takes translated status words", () => {
    render(
      <StageTracker
        stages={[{ id: "a", label: "Research", status: "pending" }]}
        label="Flow"
        statusLabels={{ done: "done", active: "up next", pending: "not started" }}
      />
    )
    expect(screen.getByRole("listitem")).toHaveTextContent("Research, not started")
  })

  it("is a read-only report until onSelect is given", () => {
    const { rerender } = render(<StageTracker stages={STAGES} label="Fluxo" />)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    rerender(<StageTracker stages={STAGES} label="Fluxo" onSelect={() => {}} />)
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("reports the id of the stage that was activated", async () => {
    const onSelect = vi.fn()
    render(<StageTracker stages={STAGES} label="Fluxo" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole("button", { name: /Arquitetura/ }))
    expect(onSelect).toHaveBeenCalledWith("arch")
  })

  it("lets a finished stage promise a different verb from an unstarted one", () => {
    render(
      <StageTracker
        stages={STAGES}
        label="Fluxo"
        onSelect={() => {}}
        actionLabels={{
          done: (label) => `Refazer ${label}`,
          active: (label) => `Iniciar ${label}`,
          pending: (label) => `Iniciar ${label}`
        }}
      />
    )
    expect(screen.getByRole("button", { name: "Refazer Pesquisa" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Iniciar PRD" })).toBeInTheDocument()
  })

  it("keeps a disabled stage out of the tab order instead of offering a dead click", () => {
    render(
      <StageTracker
        stages={[{ id: "a", label: "Histórias", status: "pending", disabled: true }]}
        label="Fluxo"
        onSelect={() => {}}
      />
    )
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(screen.getByText(/Histórias/)).toBeInTheDocument()
  })

  it("keeps the trailing slot outside the row's own activation", async () => {
    const onSelect = vi.fn()
    const onTrailing = vi.fn()
    render(
      <StageTracker
        stages={[
          {
            id: "prd",
            label: "PRD",
            status: "done",
            trailing: (
              <button type="button" onClick={onTrailing}>
                Abrir
              </button>
            )
          }
        ]}
        label="Fluxo"
        onSelect={onSelect}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }))
    expect(onTrailing).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("lights the wire into a stage only when the one above it is done", () => {
    render(<StageTracker stages={STAGES} label="Fluxo" />)
    const [first, second, third] = screen.getAllByRole("listitem")
    expect(first).not.toHaveAttribute("data-lit")
    expect(second).toHaveAttribute("data-lit")
    expect(third).not.toHaveAttribute("data-lit")
  })

  it("numbers unfinished stages by position so the plan reads as an order", () => {
    render(<StageTracker stages={STAGES} label="Fluxo" />)
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("says a stage's badge out loud — a chip nobody hears is not information", () => {
    render(
      <StageTracker
        stages={[{ id: "a", label: "Brainstorming", status: "pending", badge: "Opcional" }]}
        label="Fluxo"
        onSelect={() => {}}
        actionLabels={{ pending: (label) => `Iniciar ${label}` }}
      />
    )
    expect(screen.getByRole("button", { name: "Iniciar Brainstorming, Opcional" })).toBeInTheDocument()
  })

  it("keeps the cue out of the accessible name — the row's verb already says it", () => {
    render(
      <StageTracker
        stages={[{ id: "a", label: "PRD", status: "active", cue: "Iniciar" }]}
        label="Fluxo"
        onSelect={() => {}}
      />
    )
    const row = screen.getByRole("button")
    expect(row).toHaveAccessibleName(/PRD/)
    expect(row).not.toHaveAccessibleName(/Iniciar/)
  })

  describe("grouped into chapters", () => {
    const GROUPS = [
      { id: "analysis", label: "Análise", meta: "1/1" },
      { id: "planning", label: "Planejamento", meta: "0/2" }
    ]
    const GROUPED: StageTrackerStage[] = [
      { id: "research", group: "analysis", label: "Pesquisa", status: "done" },
      { id: "prd", group: "planning", label: "PRD", status: "active" },
      { id: "ux", group: "planning", label: "UX Design", status: "pending" }
    ]

    it("gives each chapter its own named list, under the plan's name", () => {
      render(<StageTracker stages={GROUPED} groups={GROUPS} label="Fluxo" />)
      expect(screen.getByRole("group", { name: "Fluxo" })).toBeInTheDocument()
      expect(screen.getByRole("list", { name: "Análise 1/1" })).toBeInTheDocument()
      expect(screen.getByRole("list", { name: "Planejamento 0/2" })).toBeInTheDocument()
    })

    it("keeps counting across the breaks, so the phases read as one flow", () => {
      render(<StageTracker stages={GROUPED} groups={GROUPS} label="Fluxo" />)
      // "Pesquisa" is done and wears a check, so the first ordinal on screen is
      // the PRD's — and it has to be 2, not the 1 a per-chapter count would give.
      expect(screen.getByText("2")).toBeInTheDocument()
      expect(screen.getByText("3")).toBeInTheDocument()
    })

    it("draws a declared chapter even while it is empty", () => {
      render(
        <StageTracker
          stages={[GROUPED[0]!]}
          groups={GROUPS}
          label="Fluxo"
        />
      )
      expect(screen.getByRole("list", { name: "Planejamento 0/2" })).toBeInTheDocument()
    })

    it("still runs the stage that was activated", async () => {
      const onSelect = vi.fn()
      render(<StageTracker stages={GROUPED} groups={GROUPS} label="Fluxo" onSelect={onSelect} />)
      await userEvent.click(screen.getByRole("button", { name: /UX Design/ }))
      expect(onSelect).toHaveBeenCalledWith("ux")
    })
  })
})
