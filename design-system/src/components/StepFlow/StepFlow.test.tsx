import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StepFlow, type StepFlowStep } from "./StepFlow"

const STEPS: StepFlowStep[] = [
  { id: "a", label: "Preparar", status: "done" },
  { id: "b", label: "Autorizar", hint: "no navegador", status: "active" },
  { id: "c", label: "Conectar", status: "pending" }
]

describe("StepFlow", () => {
  it("names the flow and lists one item per step", () => {
    render(<StepFlow steps={STEPS} label="Entrada na AWS" />)
    const list = screen.getByRole("list", { name: "Entrada na AWS" })
    expect(list).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
  })

  it("marks the active step with aria-current and nothing else", () => {
    render(<StepFlow steps={STEPS} label="Fluxo" />)
    const current = screen.getAllByRole("listitem").filter((item) => item.hasAttribute("aria-current"))
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute("aria-current", "step")
  })

  it("says each step's status in words, since the visual state is colour and shape", () => {
    render(<StepFlow steps={STEPS} label="Fluxo" />)
    expect(screen.getByText(/Preparar/)).toHaveTextContent("Preparar, concluído")
    expect(screen.getByText(/Autorizar/)).toHaveTextContent("Autorizar, em andamento")
    expect(screen.getByText(/Conectar/)).toHaveTextContent("Conectar, pendente")
  })

  it("takes translated status words", () => {
    render(
      <StepFlow
        steps={[{ id: "a", label: "Prepare", status: "failed" }]}
        label="Flow"
        statusLabels={{ pending: "waiting", active: "running", done: "done", failed: "failed" }}
      />
    )
    expect(screen.getByText(/Prepare/)).toHaveTextContent("Prepare, failed")
  })

  it("carries each step's status on the item, so CSS draws state without a class per state", () => {
    render(<StepFlow steps={STEPS} label="Fluxo" />)
    const [first, second, third] = screen.getAllByRole("listitem")
    expect(first).toHaveAttribute("data-status", "done")
    expect(second).toHaveAttribute("data-status", "active")
    expect(third).toHaveAttribute("data-status", "pending")
  })

  it("lights the wire into a step whose predecessor is done", () => {
    render(<StepFlow steps={STEPS} label="Fluxo" />)
    const [first, second, third] = screen.getAllByRole("listitem")
    expect(first).not.toHaveAttribute("data-lit")
    expect(second).toHaveAttribute("data-lit")
    expect(third).not.toHaveAttribute("data-lit")
  })

  it("renders a hint only when there is one", () => {
    render(<StepFlow steps={STEPS} label="Fluxo" />)
    expect(screen.getByText("no navegador")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")[0]?.querySelector(".hds-stepflow-hint")).toBeNull()
  })

  it("defaults to vertical and takes horizontal", () => {
    const { rerender } = render(<StepFlow steps={STEPS} label="Fluxo" />)
    expect(screen.getByRole("list")).toHaveAttribute("data-orientation", "vertical")
    rerender(<StepFlow steps={STEPS} label="Fluxo" orientation="horizontal" />)
    expect(screen.getByRole("list")).toHaveAttribute("data-orientation", "horizontal")
  })
})
