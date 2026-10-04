import React, { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FiltroDeGraficos, GraficoDeBarras, GraficoDeLinha, Insight, PainelDeInsights } from "../../src"
import { CATEGORIAS, GRUPOS, PERIODOS, VOLUME_DA_DOR, serieDaCategoria } from "../../src/stories/dados"

/* Os Gráficos do Relatório: filtro, barras, linha e insights lendo o mesmo estado. */

function Relatorio() {
  const [periodo, setPeriodo] = useState("13")
  const [dor, setDor] = useState("todas")
  const [foco, setFoco] = useState("cotacao")
  const recorteDor = dor !== "todas" ? VOLUME_DA_DOR[dor] : undefined
  const emFoco = recorteDor ? recorteDor.categoria : foco
  const nome = CATEGORIAS.find((c) => c.id === emFoco)!.nome
  const tituloDor = GRUPOS.flatMap((g) => g.dores).find((d) => d.id === dor)?.titulo
  return (
    <div>
      <FiltroDeGraficos periodos={PERIODOS} periodo={periodo} aoMudarPeriodo={setPeriodo} grupos={GRUPOS} dor={dor} aoMudarDor={setDor} aoLimpar={() => setDor("todas")} />
      <GraficoDeBarras categorias={CATEGORIAS} emFoco={emFoco} aoFocar={(id) => { setDor("todas"); setFoco(id) }} recorte={recorteDor && tituloDor ? { volume: recorteDor.volume, rotulo: tituloDor } : undefined} />
      <GraficoDeLinha serie={serieDaCategoria(emFoco, Number(periodo))} nomeDaSerie={nome} largura={532} />
      <PainelDeInsights>
        {CATEGORIAS.map((c) => (
          <Insight key={c.id} titulo={c.nome} agente="claude" numeros={[{ rotulo: "do volume", valor: `${c.volume}` }]} foco={c.id === emFoco}>
            <p>Leitura de {c.nome}.</p>
          </Insight>
        ))}
      </PainelDeInsights>
    </div>
  )
}

describe("fluxo: Gráficos do Relatório", () => {
  it("trocar a categoria move a ênfase nas barras, na linha e nos insights", async () => {
    render(<Relatorio />)
    expect(screen.getByRole("button", { name: /Cotação e taxas/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("article", { name: "Cotação e taxas" })).toHaveClass("dst-insight--foco")

    await userEvent.click(screen.getByRole("button", { name: /Status e avisos/ }))
    expect(screen.getByRole("button", { name: /Status e avisos/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("figure", { name: "Recorrência semana a semana" })).toHaveTextContent("Status e avisos, semana a semana.")
    expect(screen.getByRole("article", { name: "Status e avisos" })).toHaveClass("dst-insight--foco")
    expect(screen.getByRole("article", { name: "Cotação e taxas" })).not.toHaveClass("dst-insight--foco")
  })

  it("filtrar uma Dor parte a barra da categoria dela e Limpar desfaz", async () => {
    const { container } = render(<Relatorio />)
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Dor/ }), "cam-v1")
    expect(screen.getByRole("button", { name: /Status e avisos/ })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector(".dst-graf-barras__barra--parte")).toBeInTheDocument()
    expect(within(screen.getByRole("figure", { name: "Dores por categoria" })).getByRole("list")).toHaveTextContent("Minha transação de câmbio estornou")

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro" }))
    expect(container.querySelector(".dst-graf-barras__barra--parte")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cotação e taxas/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("o período encurta a série e a leitura acompanha", async () => {
    const { container } = render(<Relatorio />)
    await userEvent.click(screen.getByRole("button", { name: "30 dias" }))
    const semanas = [...container.querySelectorAll(".dst-graf-linha__caixa .dst-gl-tick")].map((t) => t.textContent).filter((t) => /[a-z]/.test(t ?? ""))
    expect(semanas).toEqual(["2 set", "9 set", "16 set", "23 set"])
    const caixa = screen.getByRole("group", { name: /4 semanas/ })
    fireEvent.focus(caixa)
    expect(caixa.querySelector("[aria-live]")).toHaveTextContent("Semana de 23 set: 33 ligações, Cotação e taxas. 16% das 210 ligações do Relatório nesta semana.")
  })

  it("a tabela gêmea das barras traz os mesmos números", async () => {
    render(<Relatorio />)
    const barras = screen.getByRole("figure", { name: "Dores por categoria" })
    await userEvent.click(within(barras).getByRole("button", { name: "Ver tabela" }))
    expect(within(barras).getByRole("row", { name: "Status e avisos 1.796 69% 2" })).toBeInTheDocument()
    expect(within(barras).getByRole("row", { name: "Cotação e taxas 388 15% 1" })).toBeInTheDocument()
  })
})
