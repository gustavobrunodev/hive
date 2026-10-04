import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MensagemDoAgente } from "./MensagemDoAgente"

describe("MensagemDoAgente", () => {
  it("é um artigo nomeado com cabeçalho e texto", () => {
    render(
      <MensagemDoAgente agente="claude" modelo="Sonnet" hora="11:14">
        <p>Inseri um aviso.</p>
      </MensagemDoAgente>
    )
    const msg = screen.getByRole("article", { name: "Claude, 11:14" })
    expect(msg).toHaveTextContent("ClaudeSonnet11:14Inseri um aviso.")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("carimbo, ações e Ponto de restauração clicável", async () => {
    const aoAbrirPonto = vi.fn()
    render(
      <MensagemDoAgente agente="devin" nome="Devin" hora="15:02" carimbo="Variante 2 aceita" acoes={["Editou a tela Confirmar"]} pontoDeRestauracao="Variante 2 aceita" aoAbrirPonto={aoAbrirPonto}>
        texto
      </MensagemDoAgente>
    )
    expect(screen.getByText("Variante 2 aceita", { selector: ".dst-msg__carimbo" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "O que o agente fez" })).toHaveTextContent("Editou a tela Confirmar")
    await userEvent.click(screen.getByRole("button", { name: "Ponto de restauração · Variante 2 aceita" }))
    expect(aoAbrirPonto).toHaveBeenCalled()
  })

  it("Ponto de restauração sem clique é texto", () => {
    render(
      <MensagemDoAgente agente="claude" hora="10:00" pontoDeRestauracao="Revisão">
        oi
      </MensagemDoAgente>
    )
    expect(screen.getByText(/Ponto de restauração · Revisão/)).toHaveClass("dst-msg__ponto")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
