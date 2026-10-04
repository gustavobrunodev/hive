import React from "react"
import { render, screen } from "@testing-library/react"
import { MiraDeInsercao, PreviaDeInsercao, VagaDeInsercao } from "./Inserir"

describe("Inserir", () => {
  it("a mira é decorativa e posicionada", () => {
    const { container } = render(<MiraDeInsercao rotulo="Inserir depois do bloco" topo={154} esquerda={20} largura={320} />)
    const mira = container.firstChild as HTMLElement
    expect(mira).toHaveAttribute("aria-hidden", "true")
    expect(mira.style.top).toBe("154px")
    expect(mira.style.left).toBe("20px")
    expect(mira.style.width).toBe("320px")
    expect(mira).toHaveTextContent("Inserir depois do bloco")
  })

  it("a vaga anuncia o texto e fica ocupada enquanto gera", () => {
    const { rerender } = render(<VagaDeInsercao gerando tamanho="g">Gerando Variante 1 de 3…</VagaDeInsercao>)
    const vaga = screen.getByRole("status")
    expect(vaga).toHaveTextContent("Gerando Variante 1 de 3…")
    expect(vaga).toHaveAttribute("aria-busy", "true")
    expect(vaga).toHaveClass("dst-vaga--g", "dst-vaga--gerando")
    rerender(<VagaDeInsercao>Aviso</VagaDeInsercao>)
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy")
    expect(screen.getByRole("status")).toHaveClass("dst-vaga--m")
  })

  it("a prévia envolve a Variante", () => {
    render(
      <PreviaDeInsercao>
        <p>Variante</p>
      </PreviaDeInsercao>
    )
    expect(screen.getByText("Variante").parentElement).toHaveClass("dst-previa")
  })
})
