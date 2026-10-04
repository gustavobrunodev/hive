import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChipDeDor, ChipDeFonte } from "./ChipDeFonte"

describe("ChipDeFonte", () => {
  it("é decorativo por padrão, na cor da Fonte", () => {
    const { container } = render(<ChipDeFonte fonte="voz" />)
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
    expect(container.firstChild).toHaveClass("dst-chip-fonte--voz")
  })

  it("anuncia o nome da Fonte e muda de tamanho", () => {
    render(<ChipDeFonte fonte="fullstory" tamanho="g" anunciar />)
    expect(screen.getByRole("img", { name: "FullStory" })).toHaveClass("dst-chip-fonte--g")
  })
})

describe("ChipDeDor", () => {
  it("mostra o título inteiro na dica e sem botão por padrão", () => {
    render(<ChipDeDor fonte="likert" titulo="Não sei quando o dinheiro chega lá fora" />)
    expect(screen.getByTitle("Não sei quando o dinheiro chega lá fora")).toHaveClass("dst-chip-dor")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("remove a citação pelo botão nomeado", async () => {
    const aoRemover = vi.fn()
    render(<ChipDeDor fonte="voz" titulo="Estorno sem aviso" aoRemover={aoRemover} />)
    await userEvent.click(screen.getByRole("button", { name: "Tirar a citação: Estorno sem aviso" }))
    expect(aoRemover).toHaveBeenCalledTimes(1)
  })
})
