import React, { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { Seletor } from "./Seletor"

describe("Seletor", () => {
  it("anuncia o menu que abre e mostra valor e complemento", () => {
    render(<Seletor valor="Novo Protótipo" complemento="· Câmbio" icone="camadas" />)
    const botao = screen.getByRole("button", { name: "Novo Protótipo · Câmbio" })
    expect(botao).toHaveAttribute("aria-haspopup", "menu")
    expect(botao).not.toHaveAttribute("aria-expanded")
  })

  it("troca o ícone pela logo do agente e informa o estado aberto", () => {
    const { container } = render(<Seletor valor="Claude" agente="claude" icone="camadas" aberto />)
    expect(container.querySelector(".dst-logo-agente--claude")).toBeInTheDocument()
    expect(container.querySelectorAll(".dst-ic")).toHaveLength(1)
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
  })

  it("funciona sem ícone e repassa a ref", () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Seletor ref={ref} valor="Sonnet" />)
    expect(ref.current).toBe(screen.getByRole("button", { name: "Sonnet" }))
  })
})
