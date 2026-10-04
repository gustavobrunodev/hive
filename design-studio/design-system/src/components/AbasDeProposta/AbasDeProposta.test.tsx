import React, { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AbasDeProposta, type Proposta } from "./AbasDeProposta"

const propostas: Proposta[] = [
  { id: "atual", nome: "Atual" },
  { id: "a", nome: "A · Status que avisa", estado: "ativa" },
  { id: "c", nome: "C · Aviso no topo", estado: "descartada" },
]

function Controlado({ aoCriar }: { aoCriar?: () => void }) {
  const [sel, setSel] = useState("atual")
  return <AbasDeProposta propostas={propostas} selecionada={sel} aoSelecionar={setSel} aoCriar={aoCriar} />
}

describe("AbasDeProposta", () => {
  it("é uma tablist com só a selecionada no Tab e o estado dito", () => {
    render(<Controlado />)
    expect(screen.getByRole("tablist", { name: "Propostas" })).toBeInTheDocument()
    const atual = screen.getByRole("tab", { name: "Atual" })
    expect(atual).toHaveAttribute("aria-selected", "true")
    expect(atual).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("tab", { name: "A · Status que avisa (ativa)" })).toHaveAttribute("tabindex", "-1")
    expect(screen.getByRole("tab", { name: "C · Aviso no topo (descartada)" })).toHaveClass("dst-abas-proposta__aba--descartada")
    expect(screen.queryByRole("button", { name: "Nova" })).not.toBeInTheDocument()
  })

  it("setas, Home e End trocam de aba e levam o foco", async () => {
    render(<Controlado />)
    await userEvent.click(screen.getByRole("tab", { name: "Atual" }))
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: /A · Status/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /A · Status/ })).toHaveFocus()
    await userEvent.keyboard("{End}")
    expect(screen.getByRole("tab", { name: /C · Aviso/ })).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Atual" })).toHaveFocus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(screen.getByRole("tab", { name: /C · Aviso/ })).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: "Atual" })).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("a")
    expect(screen.getByRole("tab", { name: "Atual" })).toHaveAttribute("aria-selected", "true")
  })

  it("clique seleciona e Nova chama aoCriar", async () => {
    const aoCriar = vi.fn()
    render(<Controlado aoCriar={aoCriar} />)
    await userEvent.click(screen.getByRole("tab", { name: /C · Aviso/ }))
    expect(screen.getByRole("tab", { name: /C · Aviso/ })).toHaveAttribute("aria-selected", "true")
    await userEvent.click(screen.getByRole("button", { name: "Nova" }))
    expect(aoCriar).toHaveBeenCalled()
  })
})
