import React from "react"
import { render, screen } from "@testing-library/react"
import { Icone } from "./Icone"
import { icones } from "../../icones/icones"

describe("Icone", () => {
  it("é decorativo sem rótulo", () => {
    const { container } = render(<Icone nome="raio" />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).not.toHaveAttribute("role")
    expect(svg).toHaveClass("dst-ic")
    const d = /d="([^"]+)"/.exec(icones.raio)![1]
    expect(svg.querySelector("path")).toHaveAttribute("d", d)
  })

  it("vira imagem com nome acessível quando recebe rótulo", () => {
    render(<Icone nome="alerta" rotulo="Atenção" />)
    expect(screen.getByRole("img", { name: "Atenção" })).toBeInTheDocument()
  })

  it("usa o tamanho pedido e traço sem preenchimento", () => {
    const { container } = render(<Icone nome="ok" tamanho={24} className="extra" />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("width", "24")
    expect(svg).toHaveAttribute("fill", "none")
    expect(svg).toHaveClass("extra")
  })

  it("preenche só o mais3", () => {
    const { container } = render(<Icone nome="mais3" />)
    expect(container.querySelector("svg")).toHaveAttribute("fill", "currentColor")
  })
})
