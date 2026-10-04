import React from "react"
import { render, screen } from "@testing-library/react"
import { MensagemDaPessoa } from "./MensagemDaPessoa"

describe("MensagemDaPessoa", () => {
  it("balão com citações e hora", () => {
    const { container } = render(
      <MensagemDaPessoa hora="14:12" citacoes={[{ fonte: "voz", titulo: "Estorno sem aviso" }]}>
        <p>Resolve o estorno.</p>
      </MensagemDaPessoa>
    )
    expect(screen.getByRole("article", { name: "Você, 14:12" })).toBeInTheDocument()
    expect(container.querySelector(".dst-msg-pessoa__bolha")).toHaveTextContent("Resolve o estorno.")
    expect(screen.getByTitle("Estorno sem aviso")).toBeInTheDocument()
    expect(screen.getByText("14:12")).toHaveClass("dst-msg-pessoa__hora")
  })

  it("seleção no lugar do balão, com origem", () => {
    const { container } = render(
      <MensagemDaPessoa hora="11:14" origem="Ponto de inserção no canvas" selecao={{ elemento: "Depois do bloco", pedido: "Um aviso" }}>
        ignorado
      </MensagemDaPessoa>
    )
    expect(container.querySelector(".dst-msg-pessoa__bolha")).not.toBeInTheDocument()
    expect(screen.queryByText("ignorado")).not.toBeInTheDocument()
    expect(screen.getByText("Um aviso")).toBeInTheDocument()
    expect(screen.getByText("Ponto de inserção no canvas · 11:14")).toBeInTheDocument()
  })

  it("seleção sem pedido", () => {
    const { container } = render(<MensagemDaPessoa hora="09:00" selecao={{ elemento: "Título", icone: "editar" }} />)
    expect(container.querySelector("small")).not.toBeInTheDocument()
  })
})
