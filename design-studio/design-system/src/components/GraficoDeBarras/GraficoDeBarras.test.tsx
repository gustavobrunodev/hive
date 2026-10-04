import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GraficoDeBarras } from "./GraficoDeBarras"

const categorias = [
  { id: "status", nome: "Status e avisos", volume: 1796, dores: 2 },
  { id: "cotacao", nome: "Cotação e taxas", volume: 388 },
]

describe("GraficoDeBarras", () => {
  it("figura nomeada com valores em pt-BR e ênfase", () => {
    const { container } = render(<GraficoDeBarras categorias={categorias} emFoco="cotacao" />)
    expect(screen.getByRole("figure", { name: "Dores por categoria" })).toBeInTheDocument()
    expect(screen.getByText("1.796 · 82%")).toBeInTheDocument()
    expect(screen.getByText("388 · 18%")).toBeInTheDocument()
    const linhas = container.querySelectorAll(".dst-graf-barras__linha")
    expect(linhas[1]).toHaveClass("dst-graf-barras__linha--enfase")
    expect((linhas[0]!.querySelector(".dst-graf-barras__barra") as HTMLElement).style.width).toBe("74%")
    expect(screen.queryByRole("button", { name: /Status/ })).not.toBeInTheDocument()
  })

  it("com aoFocar cada linha é um botão alternável", async () => {
    const aoFocar = vi.fn()
    render(<GraficoDeBarras categorias={categorias} emFoco="cotacao" aoFocar={aoFocar} />)
    expect(screen.getByRole("button", { name: /Cotação e taxas/ })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByRole("button", { name: /Status e avisos/ }))
    expect(aoFocar).toHaveBeenCalledWith("status")
  })

  it("recorte parte a barra em foco e mostra a legenda", () => {
    const { container } = render(<GraficoDeBarras categorias={categorias} emFoco="status" recorte={{ volume: 898, rotulo: "Estorno sem aviso" }} />)
    const parte = container.querySelector(".dst-graf-barras__barra--parte") as HTMLElement
    const resto = container.querySelector(".dst-graf-barras__barra--resto") as HTMLElement
    expect(parte.style.width).toBe("37%")
    expect(resto.style.width).toBe("37%")
    expect(screen.getByRole("list")).toHaveTextContent("Estorno sem avisoResto da categoria")
  })

  it("recorte igual ao total não parte a barra", () => {
    const { container } = render(<GraficoDeBarras categorias={categorias} emFoco="cotacao" recorte={{ volume: 388, rotulo: "A única Dor" }} />)
    expect(container.querySelector(".dst-graf-barras__barra--parte")).not.toBeInTheDocument()
  })

  it("Ver tabela troca o desenho pela tabela gêmea e volta", async () => {
    render(<GraficoDeBarras categorias={categorias} unidade="Menções" titulo="Por categoria" subtitulo="No período" />)
    await userEvent.click(screen.getByRole("button", { name: "Ver tabela" }))
    const tabela = screen.getByRole("table", { name: "Por categoria" })
    expect(within(tabela).getByRole("columnheader", { name: "Menções" })).toBeInTheDocument()
    expect(within(tabela).getByRole("row", { name: "Status e avisos 1.796 82% 2" })).toBeInTheDocument()
    expect(within(tabela).getByRole("row", { name: "Cotação e taxas 388 18% —" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ver gráfico" }))
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("sem categorias não quebra", () => {
    render(<GraficoDeBarras categorias={[]} />)
    expect(screen.getByRole("figure")).toBeInTheDocument()
  })
})
