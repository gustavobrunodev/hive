import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FiltroDeGraficos } from "./FiltroDeGraficos"

const props = {
  periodos: [
    { valor: "13", rotulo: "90 dias" },
    { valor: "4", rotulo: "30 dias" },
  ],
  periodo: "13",
  grupos: [{ rotulo: "Cotação e taxas", dores: [{ id: "cam-v2", titulo: "Cotação diferente da simulada" }] }],
}

describe("FiltroDeGraficos", () => {
  it("período, Dor agrupada e sem Limpar quando não há recorte", () => {
    render(<FiltroDeGraficos {...props} aoMudarPeriodo={() => {}} dor="todas" aoMudarDor={() => {}} aoLimpar={() => {}} />)
    expect(screen.getByRole("group", { name: "Filtros dos gráficos" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Período" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /Dor/ })).toHaveValue("todas")
    expect(screen.getByRole("group", { name: "Cotação e taxas" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument()
  })

  it("avisa período e Dor, e limpa", async () => {
    const aoMudarPeriodo = vi.fn()
    const aoMudarDor = vi.fn()
    const aoLimpar = vi.fn()
    render(<FiltroDeGraficos {...props} aoMudarPeriodo={aoMudarPeriodo} dor="cam-v2" aoMudarDor={aoMudarDor} aoLimpar={aoLimpar} />)
    await userEvent.click(screen.getByRole("button", { name: "30 dias" }))
    expect(aoMudarPeriodo).toHaveBeenCalledWith("4")
    await userEvent.selectOptions(screen.getByRole("combobox"), "todas")
    expect(aoMudarDor).toHaveBeenCalledWith("todas")
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro" }))
    expect(aoLimpar).toHaveBeenCalled()
  })

  it("sem aoLimpar não mostra o botão nem com recorte", () => {
    render(<FiltroDeGraficos {...props} aoMudarPeriodo={() => {}} dor="cam-v2" aoMudarDor={() => {}} />)
    expect(screen.queryByRole("button", { name: "Limpar filtro" })).not.toBeInTheDocument()
  })
})
