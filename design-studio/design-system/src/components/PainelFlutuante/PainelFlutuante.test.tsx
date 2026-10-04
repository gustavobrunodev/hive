import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LinhaDoPainel, NavegacaoDeVariantes, PainelFlutuante, Sugestoes } from "./PainelFlutuante"

describe("PainelFlutuante", () => {
  it("é um dialog nomeado com alvo, tela, corpo e rodapé", async () => {
    const aoFechar = vi.fn()
    render(
      <PainelFlutuante rotulo="Inserir na tela Revisar" icone="inserir" titulo="Depois do bloco" subtitulo="Revisar · Proposta A" aoFechar={aoFechar} rodape={<button>Gerar</button>}>
        <p>corpo</p>
      </PainelFlutuante>
    )
    const painel = screen.getByRole("dialog", { name: "Inserir na tela Revisar" })
    expect(painel).toHaveTextContent("Depois do blocoRevisar · Proposta A")
    expect(screen.getByText("corpo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gerar" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(aoFechar).toHaveBeenCalled()
  })

  it("sem fechar, ícone, subtítulo nem rodapé", () => {
    const { container } = render(
      <PainelFlutuante rotulo="Ajustes" titulo="Ajustes da Proposta">
        <p>x</p>
      </PainelFlutuante>
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(container.querySelector(".dst-painel-flutuante__pe")).not.toBeInTheDocument()
    expect(container.querySelector("small")).not.toBeInTheDocument()
  })
})

describe("LinhaDoPainel", () => {
  it("põe rótulo e controle na mesma linha", () => {
    render(
      <LinhaDoPainel rotulo="Tamanho">
        <button>M</button>
      </LinhaDoPainel>
    )
    expect(screen.getByText("Tamanho").parentElement).toHaveClass("dst-painel-flutuante__linha")
  })
})

describe("Sugestoes", () => {
  it("marca uma e avisa a escolha", async () => {
    const aoMudar = vi.fn()
    render(<Sugestoes rotulo="Sugestões" valor="aviso" aoMudar={aoMudar} opcoes={[{ valor: "aviso", rotulo: "Aviso" }, { valor: "botao", rotulo: "Botão" }]} />)
    expect(screen.getByRole("group", { name: "Sugestões" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aviso" })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByRole("button", { name: "Botão" }))
    expect(aoMudar).toHaveBeenCalledWith("botao")
  })

  it("nenhuma marcada com valor null", () => {
    render(<Sugestoes rotulo="Sugestões" valor={null} aoMudar={() => {}} opcoes={[{ valor: "aviso", rotulo: "Aviso" }]} />)
    expect(screen.getByRole("button", { name: "Aviso" })).toHaveAttribute("aria-pressed", "false")
  })
})

describe("NavegacaoDeVariantes", () => {
  it("anuncia a Variante e navega", async () => {
    const aoAnterior = vi.fn()
    const aoProxima = vi.fn()
    render(<NavegacaoDeVariantes atual={2} total={3} nome="Aviso · Com ação" aoAnterior={aoAnterior} aoProxima={aoProxima} />)
    expect(screen.getByRole("status")).toHaveTextContent("Variante 2 de 3Aviso · Com ação")
    await userEvent.click(screen.getByRole("button", { name: "Próxima Variante" }))
    await userEvent.click(screen.getByRole("button", { name: "Variante anterior" }))
    expect(aoProxima).toHaveBeenCalled()
    expect(aoAnterior).toHaveBeenCalled()
  })

  it("desabilita as setas com uma só Variante", () => {
    render(<NavegacaoDeVariantes atual={1} total={1} nome="Única" aoAnterior={() => {}} aoProxima={() => {}} />)
    expect(screen.getByRole("button", { name: "Próxima Variante" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Variante anterior" })).toBeDisabled()
  })
})
