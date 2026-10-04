import React from "react"
import { render, screen, within } from "@testing-library/react"
import { Insight, PainelDeInsights } from "./Insight"

describe("Insight", () => {
  it("lado com números, corpo com autoria, passo, Dores e ações", () => {
    render(
      <PainelDeInsights subtitulo="O que o agente lê">
        <Insight
          foco
          titulo="Cotação e taxas"
          agente="claude"
          numeros={[{ rotulo: "do volume", valor: "15%" }]}
          proximoPasso="Travar a cotação."
          dores={[{ fonte: "voz", titulo: "Cotação diferente" }]}
          acoes={<button>Resolver esta Dor</button>}
        >
          <p>A taxa muda.</p>
        </Insight>
      </PainelDeInsights>
    )
    expect(screen.getByRole("region", { name: "Insights por categoria" })).toHaveTextContent("O que o agente lê")
    const insight = screen.getByRole("article", { name: "Cotação e taxas" })
    expect(insight).toHaveClass("dst-insight--foco")
    expect(within(insight).getByRole("heading", { level: 3, name: "Cotação e taxas" })).toBeInTheDocument()
    expect(within(insight).getByRole("definition")).toHaveTextContent("15%")
    expect(insight).toHaveTextContent("ClaudeA taxa muda.Próximo passo: Travar a cotação.")
    expect(within(insight).getByTitle("Cotação diferente")).toBeInTheDocument()
    expect(within(insight).getByRole("button", { name: "Resolver esta Dor" })).toBeInTheDocument()
  })

  it("mínimo, com outro nome de agente", () => {
    const { container } = render(
      <Insight titulo="Status" agente="devin" nomeDoAgente="Devin (SWE)" numeros={[]}>
        texto
      </Insight>
    )
    expect(screen.getByText("Devin (SWE)")).toBeInTheDocument()
    expect(container.querySelector(".dst-insight__passo")).not.toBeInTheDocument()
    expect(container.querySelector(".dst-insight__dores")).not.toBeInTheDocument()
    expect(container.querySelector(".dst-insight__acoes")).not.toBeInTheDocument()
  })
})
