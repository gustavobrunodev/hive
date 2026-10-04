import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GraficoDeLinha } from "./GraficoDeLinha"

const serie = [
  { rotulo: "1 jul", valor: 28, total: 190 },
  { rotulo: "8 jul", valor: 27, total: 196 },
  { rotulo: "15 jul", valor: 33, total: 210 },
]

describe("GraficoDeLinha", () => {
  it("figura nomeada com escala, rótulos e último valor", () => {
    const { container } = render(<GraficoDeLinha serie={serie} nomeDaSerie="Cotação e taxas" largura={532} />)
    expect(screen.getByRole("figure", { name: "Recorrência semana a semana" })).toHaveTextContent("Cotação e taxas, semana a semana.")
    const textos = [...container.querySelectorAll(".dst-gl-tick")].map((t) => t.textContent)
    expect(textos).toEqual(["0", "10", "20", "30", "40", "1 jul", "8 jul", "15 jul"])
    expect(container.querySelector(".dst-gl-fim")).toHaveTextContent("33")
    expect(container.querySelector(".dst-graf-linha__caixa svg")).toHaveAttribute("width", "532")
    expect(container.querySelector(".dst-graf-dica")).not.toBeInTheDocument()
  })

  it("teclado anda pelas semanas e anuncia a leitura", async () => {
    render(<GraficoDeLinha serie={serie} nomeDaSerie="Cotação e taxas" largura={532} />)
    const caixa = screen.getByRole("group", { name: /Cotação e taxas, 3 semanas/ })
    await userEvent.tab()
    await userEvent.tab()
    expect(caixa).toHaveFocus()
    const vivo = caixa.querySelector("[aria-live]")!
    expect(vivo).toHaveTextContent("Semana de 15 jul: 33 ligações, Cotação e taxas. 16% das 210 ligações do Relatório nesta semana.")
    await userEvent.keyboard("{ArrowLeft}")
    expect(vivo).toHaveTextContent("Semana de 8 jul: 27 ligações")
    await userEvent.keyboard("{Home}")
    expect(vivo).toHaveTextContent("Semana de 1 jul")
    await userEvent.keyboard("{ArrowLeft}")
    expect(vivo).toHaveTextContent("Semana de 1 jul")
    await userEvent.keyboard("{End}")
    expect(vivo).toHaveTextContent("Semana de 15 jul")
    await userEvent.keyboard("{ArrowRight}")
    expect(vivo).toHaveTextContent("Semana de 15 jul")
    await userEvent.keyboard("a")
    expect(vivo).toHaveTextContent("Semana de 15 jul")
    await userEvent.keyboard("{Escape}")
    expect(vivo).toHaveTextContent("")
    await userEvent.keyboard("{ArrowRight}")
    expect(vivo).toHaveTextContent("Semana de 15 jul")
    await userEvent.tab()
    expect(vivo).toHaveTextContent("")
  })

  it("ponteiro mostra a mira e a dica, que vira de lado na borda", () => {
    const { container } = render(<GraficoDeLinha serie={serie} nomeDaSerie="Cotação" largura={532} unidade="menções" />)
    const caixa = container.querySelector(".dst-graf-linha__caixa")!
    fireEvent.pointerMove(caixa, { clientX: 52 })
    const dica = container.querySelector(".dst-graf-dica") as HTMLElement
    expect(dica).toHaveTextContent("Semana de 1 jul28Cotação15% das 190 menções do Relatório nesta semana")
    expect(dica.style.left).toBe("66px")
    expect(container.querySelector(".dst-gl-cruz")).toBeInTheDocument()
    fireEvent.pointerMove(caixa, { clientX: 468 })
    expect((container.querySelector(".dst-graf-dica") as HTMLElement).style.left).toBe("234px")
    fireEvent.pointerLeave(caixa)
    expect(container.querySelector(".dst-graf-dica")).not.toBeInTheDocument()
  })

  it("Ver tabela mostra semana, valor, total e participação", async () => {
    render(<GraficoDeLinha serie={[...serie, { rotulo: "22 jul", valor: 30 }]} nomeDaSerie="Cotação" largura={400} titulo="Recorrência" />)
    await userEvent.click(screen.getByRole("button", { name: "Ver tabela" }))
    const tabela = screen.getByRole("table", { name: "Recorrência" })
    expect(within(tabela).getByRole("row", { name: "1 jul 28 190 15%" })).toBeInTheDocument()
    expect(within(tabela).getByRole("row", { name: "22 jul 30 — —" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ver gráfico" }))
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("uma semana fica no meio e série vazia não quebra", () => {
    const { container, rerender } = render(<GraficoDeLinha serie={[{ rotulo: "1 jul", valor: 5 }]} nomeDaSerie="X" largura={400} />)
    expect(container.querySelector(".dst-gl-ponto")).toHaveAttribute("cx", String(52 + (400 - 52 - 64) / 2))
    fireEvent.focus(container.querySelector(".dst-graf-linha__caixa")!)
    expect(container.querySelector(".dst-graf-dica")).not.toHaveTextContent("do Relatório")
    rerender(<GraficoDeLinha serie={[]} nomeDaSerie="X" largura={400} />)
    expect(container.querySelector(".dst-gl-linha")).not.toBeInTheDocument()
    fireEvent.focus(container.querySelector(".dst-graf-linha__caixa")!)
    expect(container.querySelector(".dst-graf-dica")).not.toBeInTheDocument()
  })
})
