import React from "react"
import { render, screen } from "@testing-library/react"
import { Pilula, PilulaDeImpacto, Tendencia } from "./Pilula"

describe("PilulaDeImpacto", () => {
  it.each([
    ["alto", "Alto"],
    ["medio", "Médio"],
    ["baixo", "Baixo"],
  ] as const)("nível %s mostra a palavra e o ícone", (nivel, palavra) => {
    const { container } = render(<PilulaDeImpacto nivel={nivel} />)
    expect(screen.getByText(palavra)).toHaveClass("dst-pilula", `dst-pilula--${nivel}`)
    expect(container.querySelector(".dst-ic")).toBeInTheDocument()
  })

  it("aceita outra palavra", () => {
    render(<PilulaDeImpacto nivel="alto" rotulo="Impacto alto" />)
    expect(screen.getByText("Impacto alto")).toBeInTheDocument()
  })
})

describe("Pilula", () => {
  it("funciona sem ícone", () => {
    const { container } = render(<Pilula tom="neutra">Rascunho</Pilula>)
    expect(screen.getByText("Rascunho")).toHaveClass("dst-pilula--neutra")
    expect(container.querySelector(".dst-ic")).not.toBeInTheDocument()
  })
})

describe("Tendencia", () => {
  it("diz a direção para leitor de tela", () => {
    render(<Tendencia direcao="sobe" valor="22%" />)
    const tendencia = screen.getByTitle("Comparado aos 90 dias anteriores")
    expect(tendencia).toHaveTextContent("Alta de 22%")
    expect(tendencia).toHaveClass("dst-tendencia--sobe")
  })

  it("queda e estável", () => {
    const { rerender } = render(<Tendencia direcao="desce" valor="8%" comparacao="Último mês" />)
    expect(screen.getByTitle("Último mês")).toHaveTextContent("Queda de 8%")
    rerender(<Tendencia direcao="igual" valor="0%" />)
    expect(screen.getByTitle("Comparado aos 90 dias anteriores")).toHaveTextContent("estável")
  })
})
