import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CampoDoChat } from "./CampoDoChat"

const base = { valor: "", aoMudar: () => {}, aoEnviar: () => {} }

describe("CampoDoChat", () => {
  it("tem campo rotulado e enviar desabilitado quando vazio", () => {
    render(<CampoDoChat {...base} />)
    expect(screen.getByRole("textbox", { name: "Mensagem para o agente" })).toHaveAttribute("placeholder", "Peça uma mudança, cite uma Dor com @…")
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Anexar arquivo ou print" })).not.toBeInTheDocument()
  })

  it("repassa o texto digitado", async () => {
    const aoMudar = vi.fn()
    render(<CampoDoChat {...base} aoMudar={aoMudar} />)
    await userEvent.type(screen.getByRole("textbox"), "a")
    expect(aoMudar).toHaveBeenCalledWith("a")
  })

  it("envia com Enter e pelo botão, com o texto aparado", async () => {
    const aoEnviar = vi.fn()
    render(<CampoDoChat {...base} valor="  oi  " aoEnviar={aoEnviar} />)
    await userEvent.type(screen.getByRole("textbox"), "{Enter}")
    expect(aoEnviar).toHaveBeenLastCalledWith({ texto: "oi", citacoes: [] })
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(aoEnviar).toHaveBeenCalledTimes(2)
  })

  it("Shift+Enter não envia e Enter vazio também não", async () => {
    const aoEnviar = vi.fn()
    const { rerender } = render(<CampoDoChat {...base} valor="oi" aoEnviar={aoEnviar} />)
    await userEvent.type(screen.getByRole("textbox"), "{Shift>}{Enter}{/Shift}")
    expect(aoEnviar).not.toHaveBeenCalled()
    rerender(<CampoDoChat {...base} valor="   " aoEnviar={aoEnviar} />)
    await userEvent.type(screen.getByRole("textbox"), "{Enter}")
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it("uma Dor citada já permite enviar e pode ser removida", async () => {
    const aoEnviar = vi.fn()
    const aoRemoverCitacao = vi.fn()
    const citacoes = [{ id: "d1", fonte: "voz" as const, titulo: "Estorno sem aviso" }]
    render(<CampoDoChat {...base} citacoes={citacoes} aoEnviar={aoEnviar} aoRemoverCitacao={aoRemoverCitacao} />)
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(aoEnviar).toHaveBeenCalledWith({ texto: "", citacoes })
    await userEvent.click(screen.getByRole("button", { name: "Tirar a citação: Estorno sem aviso" }))
    expect(aoRemoverCitacao).toHaveBeenCalledWith("d1")
  })

  it("citação sem aoRemoverCitacao não mostra o botão de remover", () => {
    render(<CampoDoChat {...base} citacoes={[{ id: "d1", fonte: "likert", titulo: "Histórico curto" }]} />)
    expect(screen.queryByRole("button", { name: /Tirar a citação/ })).not.toBeInTheDocument()
  })

  it("anexar, gravar e os seletores", async () => {
    const aoAnexar = vi.fn()
    const aoGravar = vi.fn()
    const { rerender, container } = render(
      <CampoDoChat {...base} aoAnexar={aoAnexar} aoGravar={aoGravar} seletores={<span>proto</span>} agente={<span>agente</span>} tamanho="compacto" />
    )
    expect(container.firstChild).toHaveClass("dst-campo-chat--compacto")
    expect(screen.getByText("proto")).toBeInTheDocument()
    expect(screen.getByText("agente")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Anexar arquivo ou print" }))
    expect(aoAnexar).toHaveBeenCalled()
    const mic = screen.getByRole("button", { name: "Falar com o agente" })
    expect(mic).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(mic)
    expect(aoGravar).toHaveBeenCalled()
    rerender(<CampoDoChat {...base} aoGravar={aoGravar} gravando rotulo="Pedido" />)
    expect(screen.getByRole("button", { name: "Parar de gravar" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "Pedido" })).toBeInTheDocument()
  })
})
