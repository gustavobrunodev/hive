import React from "react"
import { render, screen } from "@testing-library/react"
import { Marca, Sinal } from "./Sinal"

describe("Sinal", () => {
  it("é decorativo por padrão e usa as cores do tema", () => {
    const { container } = render(<Sinal />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveAttribute("width", "30")
    expect(container.querySelector("rect")).toHaveAttribute("fill", "var(--acento)")
  })

  it("ganha nome acessível com rótulo", () => {
    render(<Sinal rotulo="Design Studio" tamanho={48} />)
    expect(screen.getByRole("img", { name: "Design Studio" })).toHaveAttribute("width", "48")
  })
})

describe("Marca", () => {
  it("vira link com href", () => {
    render(<Marca href="#inicio" />)
    expect(screen.getByRole("link", { name: "Design Studio" })).toHaveAttribute("href", "#inicio")
  })

  it("sem href é texto, e soSinal esconde o nome só da vista", () => {
    const { container } = render(<Marca soSinal />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByText("Design Studio")).toHaveClass("dst-sr")
    expect(container.firstChild).toHaveClass("dst-marca")
  })
})
