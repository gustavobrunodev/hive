import React from "react"
import { render, screen } from "@testing-library/react"
import { MolduraDeAparelho } from "./MolduraDeAparelho"

describe("MolduraDeAparelho", () => {
  it("é uma figura com o nome da tela e o conteúdo", () => {
    render(
      <MolduraDeAparelho nome="Revisar" emFoco>
        <p>tela</p>
      </MolduraDeAparelho>
    )
    const figura = screen.getByRole("figure", { name: "Revisar · em foco" })
    expect(figura).toHaveClass("dst-moldura--pronto")
    expect(figura).not.toHaveAttribute("aria-busy")
    expect(screen.getByText("tela")).toBeInTheDocument()
  })

  it("criando mostra o esqueleto e fica ocupado", () => {
    const { container } = render(<MolduraDeAparelho nome="Revisar" estado="criando" legenda="Claude está desenhando…" realce />)
    const figura = screen.getByRole("figure")
    expect(figura).toHaveAttribute("aria-busy", "true")
    expect(figura).toHaveClass("dst-moldura--realce")
    expect(screen.getByText("Claude está desenhando…")).toBeInTheDocument()
    expect(container.querySelectorAll(".dst-moldura__esqueleto i")).toHaveLength(6)
  })

  it("na fila diz e esmaece; desktop usa a janela com endereço", () => {
    const { container } = render(<MolduraDeAparelho nome="Confirmar" estado="na-fila" dispositivo="desktop" url="app.local" />)
    expect(screen.getByText("na fila")).toBeInTheDocument()
    expect(screen.getByRole("figure")).toHaveClass("dst-moldura--na-fila")
    expect(container.querySelector(".dst-moldura__janela")).toBeInTheDocument()
    expect(screen.getByText("app.local")).toBeInTheDocument()
  })

  it("sem foco nem legenda, só o nome", () => {
    render(<MolduraDeAparelho nome="Acompanhar" />)
    expect(screen.getByRole("figure", { name: "Acompanhar" })).toBeInTheDocument()
  })
})
