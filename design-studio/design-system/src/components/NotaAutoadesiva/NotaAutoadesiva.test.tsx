import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NotaAutoadesiva } from "./NotaAutoadesiva"

describe("NotaAutoadesiva", () => {
  it("sem aoClicar não é botão e diz Fonte, impacto e tendência", () => {
    const { container } = render(
      <NotaAutoadesiva fonte="voz" titulo="Estorno sem aviso" volume="1.284 ligações" impacto="alto" tendencia={{ direcao: "sobe", valor: "31%" }} descricao="Minha transação estornou" />
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    const nota = container.firstChild as HTMLElement
    expect(nota).toHaveClass("dst-nota", "dst-nota--voz")
    expect(nota).toHaveAttribute("title", "Minha transação estornou")
    expect(nota).toHaveTextContent("Voz do Cliente: Estorno sem aviso1.284 ligaçõesImpacto AltoAlta de 31%")
  })

  it("com aoClicar vira botão alternável", async () => {
    const aoClicar = vi.fn()
    render(<NotaAutoadesiva fonte="likert" titulo="Histórico curto" aoClicar={aoClicar} marcada />)
    const botao = screen.getByRole("button", { name: /Histórico curto/ })
    expect(botao).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(botao)
    expect(aoClicar).toHaveBeenCalled()
  })

  it("limita o giro e aplica o tamanho grande", () => {
    const { container, rerender } = render(<NotaAutoadesiva fonte="fullstory" titulo="Rage click" giro={5} tamanho="grande" />)
    const nota = container.firstChild as HTMLElement
    expect(nota.style.getPropertyValue("--r")).toBe("1.8deg")
    expect(nota).toHaveClass("dst-nota--grande")
    expect(container.querySelector(".dst-nota__pe")).not.toBeInTheDocument()
    rerender(<NotaAutoadesiva fonte="fullstory" titulo="Rage click" giro={-9} impacto="medio" />)
    expect((container.firstChild as HTMLElement).style.getPropertyValue("--r")).toBe("-1.8deg")
    expect(screen.getByText("Médio")).toHaveClass("dst-nota__impacto--medio")
  })
})
