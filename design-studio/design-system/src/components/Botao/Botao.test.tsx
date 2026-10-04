import React, { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Botao, BotaoEnviar, BotaoIcone } from "./Botao"

describe("Botao", () => {
  it("é um botão primário do tipo button por padrão", () => {
    render(<Botao>Gerar</Botao>)
    const botao = screen.getByRole("button", { name: "Gerar" })
    expect(botao).toHaveAttribute("type", "button")
    expect(botao).toHaveClass("dst-botao", "dst-botao--primario")
    expect(botao).not.toHaveClass("dst-botao--pequeno")
  })

  it("aplica variante, tamanho e ícone", () => {
    const { container } = render(
      <Botao variante="secundario" tamanho="pequeno" icone="ok">
        Inserir
      </Botao>
    )
    const botao = screen.getByRole("button", { name: "Inserir" })
    expect(botao).toHaveClass("dst-botao--secundario", "dst-botao--pequeno")
    expect(container.querySelector(".dst-ic")).toBeInTheDocument()
  })

  it("vira link com href", () => {
    render(<Botao href="/relatorio">Abrir</Botao>)
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/relatorio")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("chama o clique e respeita disabled", async () => {
    const aoClicar = vi.fn()
    const { rerender } = render(<Botao onClick={aoClicar}>Ir</Botao>)
    await userEvent.click(screen.getByRole("button"))
    expect(aoClicar).toHaveBeenCalledTimes(1)
    rerender(<Botao onClick={aoClicar} disabled>Ir</Botao>)
    await userEvent.click(screen.getByRole("button"))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it("repassa a ref ao elemento nativo", () => {
    const ref = createRef<HTMLButtonElement | HTMLAnchorElement>()
    render(<Botao ref={ref}>Ref</Botao>)
    expect(ref.current?.tagName).toBe("BUTTON")
  })

  it("aceita type submit", () => {
    render(<Botao type="submit">Enviar</Botao>)
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit")
  })
})

describe("BotaoIcone", () => {
  it("usa o rótulo como nome e dica", async () => {
    const aoClicar = vi.fn()
    const ref = createRef<HTMLButtonElement>()
    render(<BotaoIcone ref={ref} rotulo="Fechar" icone="fechar" onClick={aoClicar} />)
    const botao = screen.getByRole("button", { name: "Fechar" })
    expect(botao).toHaveAttribute("title", "Fechar")
    expect(ref.current).toBe(botao)
    await userEvent.click(botao)
    expect(aoClicar).toHaveBeenCalled()
  })
})

describe("BotaoEnviar", () => {
  it("tem nome padrão e pode ser desabilitado", () => {
    render(<BotaoEnviar disabled />)
    const botao = screen.getByRole("button", { name: "Enviar" })
    expect(botao).toBeDisabled()
    expect(botao).toHaveClass("dst-botao-enviar")
  })

  it("aceita outro rótulo e type", () => {
    render(<BotaoEnviar rotulo="Mandar" type="submit" />)
    expect(screen.getByRole("button", { name: "Mandar" })).toHaveAttribute("type", "submit")
  })
})
