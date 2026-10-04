import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Lateral } from "./Lateral"

const itens = [
  { id: "inicio", rotulo: "Início", icone: "inicio" as const, href: "#inicio" },
  { id: "dores", rotulo: "Dores", icone: "dor" as const },
]

describe("Lateral", () => {
  it("marca o item atual e diferencia link de botão", () => {
    render(<Lateral itens={itens} atual="inicio" />)
    const nav = screen.getByRole("complementary", { name: "Navegação" })
    expect(within(nav).getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByRole("button", { name: "Dores" })).not.toHaveAttribute("aria-current")
    expect(screen.getByText("Dados de exemplo")).toBeInTheDocument()
  })

  it("navega, recolhe e começa", async () => {
    const aoNavegar = vi.fn()
    const aoRecolher = vi.fn()
    const aoClicar = vi.fn()
    render(<Lateral itens={itens} aoNavegar={aoNavegar} aoRecolher={aoRecolher} novo={{ rotulo: "Nova conversa", aoClicar }} />)
    await userEvent.click(screen.getByRole("button", { name: "Dores" }))
    expect(aoNavegar).toHaveBeenCalledWith("dores")
    await userEvent.click(screen.getByRole("button", { name: "Recolher a barra lateral" }))
    expect(aoRecolher).toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Nova conversa" }))
    expect(aoClicar).toHaveBeenCalled()
  })

  it("recentes, rodapé, tema e conta", async () => {
    const aoMudarTema = vi.fn()
    const aoNavegar = vi.fn()
    render(
      <Lateral
        itens={itens}
        atual="remessa"
        aoNavegar={aoNavegar}
        novo={{ rotulo: "Nova conversa", href: "#novo" }}
        recentes={[
          { id: "remessa", titulo: "Remessa sem susto", subtitulo: "Câmbio · há 12 min", icone: "camadas", href: "#r" },
          { id: "extrato", titulo: "Extrato", subtitulo: "Extrato · ontem", icone: "camadas" },
        ]}
        rodape={[{ id: "config", rotulo: "Configurações", icone: "config", href: "#config" }]}
        tema="claro"
        aoMudarTema={aoMudarTema}
        conta={{ nome: "Marina Alves", papel: "PM", iniciais: "MA" }}
        exemplo={false}
      />
    )
    expect(screen.getByText("Recentes")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Remessa sem susto/ })).toHaveAttribute("aria-current", "page")
    await userEvent.click(screen.getByRole("button", { name: /Extrato/ }))
    expect(aoNavegar).toHaveBeenCalledWith("extrato")
    expect(screen.getByRole("link", { name: "Nova conversa" })).toHaveAttribute("href", "#novo")
    expect(screen.getByRole("link", { name: "Configurações" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Tema escuro" }))
    expect(aoMudarTema).toHaveBeenCalledWith("escuro")
    expect(screen.getByText("Marina Alves")).toBeInTheDocument()
    expect(screen.queryByText("Dados de exemplo")).not.toBeInTheDocument()
  })

  it("recolhida esconde os nomes só da vista e some com os Recentes", () => {
    const { container } = render(
      <Lateral itens={itens} recolhida aoRecolher={() => {}} recentes={[{ id: "r", titulo: "Remessa", subtitulo: "Câmbio", icone: "camadas" }]} conta={{ nome: "Marina", papel: "PM", iniciais: "MA" }} />
    )
    expect(container.firstChild).toHaveClass("dst-lateral--recolhida")
    expect(screen.getByText("Início")).toHaveClass("dst-sr")
    expect(screen.queryByText("Recentes")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Abrir a barra lateral" })).toBeInTheDocument()
    expect(screen.getByText("Marina").parentElement).toHaveClass("dst-sr")
  })
})
