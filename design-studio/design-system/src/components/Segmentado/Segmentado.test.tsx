import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Segmentado } from "./Segmentado"

const opcoes = [
  { valor: "90", rotulo: "90 dias" },
  { valor: "60", rotulo: "60 dias" },
  { valor: "30", rotulo: "30 dias" },
] as const

describe("Segmentado", () => {
  it("é um grupo nomeado com a opção atual pressionada", () => {
    render(<Segmentado rotulo="Período" opcoes={opcoes} valor="90" aoMudar={() => {}} />)
    expect(screen.getByRole("group", { name: "Período" })).toHaveClass("dst-segmentado--padrao")
    expect(screen.getByRole("button", { name: "90 dias" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "false")
  })

  it("avisa a escolha", async () => {
    const aoMudar = vi.fn()
    render(<Segmentado rotulo="Período" opcoes={opcoes} valor="90" aoMudar={aoMudar} />)
    await userEvent.click(screen.getByRole("button", { name: "30 dias" }))
    expect(aoMudar).toHaveBeenCalledWith("30")
  })

  it("só ícone mantém o nome acessível e a dica", () => {
    render(
      <Segmentado
        forma="pill"
        rotulo="Tema"
        valor="claro"
        aoMudar={() => {}}
        opcoes={[{ valor: "claro", rotulo: "Claro", icone: "sol", soIcone: true }, { valor: "escuro", rotulo: "Escuro", icone: "lua" }]}
      />
    )
    const claro = screen.getByRole("button", { name: "Claro" })
    expect(claro).toHaveAttribute("title", "Claro")
    expect(screen.getByText("Claro")).toHaveClass("dst-sr")
    expect(screen.getByRole("button", { name: "Escuro" })).not.toHaveAttribute("title")
    expect(screen.getByRole("group")).toHaveClass("dst-segmentado--pill")
  })
})
