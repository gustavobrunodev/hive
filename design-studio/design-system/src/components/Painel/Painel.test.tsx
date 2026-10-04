import React from "react"
import { render, screen } from "@testing-library/react"
import { Painel } from "./Painel"

describe("Painel", () => {
  it("nomeia o painel pelo título e mostra a ação", () => {
    render(
      <Painel titulo="Dores por categoria" subtitulo="No período" idDoTitulo="t1" acao={<button>Ver tabela</button>}>
        corpo
      </Painel>
    )
    expect(screen.getByRole("region", { name: "Dores por categoria" })).toHaveTextContent("No período")
    expect(screen.getByRole("heading", { level: 2, name: "Dores por categoria" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ver tabela" })).toBeInTheDocument()
  })

  it("sem cabeçalho e como figure", () => {
    const { container } = render(<Painel como="figure">só corpo</Painel>)
    expect(container.querySelector("figure")).toHaveClass("dst-painel")
    expect(container.querySelector(".dst-painel__cab")).not.toBeInTheDocument()
    expect(container.querySelector("figure")).not.toHaveAttribute("aria-labelledby")
  })

  it("só ação, sem título", () => {
    const { container } = render(<Painel acao={<button>Ação</button>}>x</Painel>)
    expect(container.querySelector("h2")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument()
  })
})
