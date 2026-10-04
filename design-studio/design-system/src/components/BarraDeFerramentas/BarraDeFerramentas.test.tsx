import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BarraFlutuante, Ferramenta, SeparadorDeFerramenta } from "./BarraDeFerramentas"

function Barra() {
  return (
    <BarraFlutuante rotulo="Ferramentas">
      <Ferramenta icone="selecionar" rotulo="Mover" pressionada={false} />
      <Ferramenta icone="inserir" rotulo="Inserir" pressionada />
      <SeparadorDeFerramenta />
      <Ferramenta icone="testar" rotulo="Testar" destaque disabled={false} />
      <Ferramenta icone="zoomMais" rotulo="Aumentar zoom" soIcone />
    </BarraFlutuante>
  )
}

describe("BarraDeFerramentas", () => {
  it("é uma toolbar nomeada com alternâncias e destaque", () => {
    render(<Barra />)
    expect(screen.getByRole("toolbar", { name: "Ferramentas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Inserir" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Mover" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Testar" })).not.toHaveAttribute("aria-pressed")
    expect(screen.getByRole("button", { name: "Testar" })).toHaveClass("dst-ferramenta--destaque")
    expect(screen.getByText("Aumentar zoom")).toHaveClass("dst-sr")
  })

  it("setas andam entre os botões em volta", async () => {
    render(<Barra />)
    await userEvent.click(screen.getByRole("button", { name: "Mover" }))
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("button", { name: "Inserir" })).toHaveFocus()
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(screen.getByRole("button", { name: "Aumentar zoom" })).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("button", { name: "Mover" })).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}")
    expect(screen.getByRole("button", { name: "Mover" })).toHaveFocus()
  })

  it("seta sem foco num botão não faz nada", async () => {
    render(<Barra />)
    const barra = screen.getByRole("toolbar")
    barra.tabIndex = -1
    barra.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(barra).toHaveFocus()
  })

  it("repassa o clique", async () => {
    const aoClicar = vi.fn()
    render(<Ferramenta icone="editar" rotulo="Editar" onClick={aoClicar} />)
    await userEvent.click(screen.getByRole("button", { name: "Editar" }))
    expect(aoClicar).toHaveBeenCalled()
  })
})
