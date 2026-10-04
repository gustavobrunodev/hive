import React from "react"
import { render, screen } from "@testing-library/react"
import { LogoDoAgente } from "./LogoDoAgente"

describe("LogoDoAgente", () => {
  it("é decorativo por padrão, com a cor própria do Claude", () => {
    const { container } = render(<LogoDoAgente agente="claude" />)
    const ladrilho = container.firstChild as HTMLElement
    expect(ladrilho).toHaveAttribute("aria-hidden", "true")
    expect(ladrilho).toHaveClass("dst-logo-agente", "dst-logo-agente--claude")
    expect(container.querySelector("path")).toHaveAttribute("fill", "#d97757")
  })

  it("o Devin segue a tinta do tema", () => {
    const { container } = render(<LogoDoAgente agente="devin" />)
    expect(container.querySelector("path")).toHaveAttribute("fill", "currentColor")
  })

  it("anuncia o nome quando pedido", () => {
    render(<LogoDoAgente agente="devin" anunciar />)
    expect(screen.getByRole("img", { name: "Devin" })).toBeInTheDocument()
  })

  it("aplica os tamanhos pequeno e grande", () => {
    const { container, rerender } = render(<LogoDoAgente agente="claude" tamanho="pequeno" />)
    expect(container.firstChild).toHaveClass("dst-logo-agente--pequeno")
    rerender(<LogoDoAgente agente="claude" tamanho="grande" />)
    expect(container.firstChild).toHaveClass("dst-logo-agente--grande")
  })
})
