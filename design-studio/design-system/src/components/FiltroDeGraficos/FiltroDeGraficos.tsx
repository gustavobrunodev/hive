import React from "react"
import { cx } from "../../utils/cx"
import { Botao } from "../Botao/Botao"
import { Icone } from "../Icone/Icone"
import { Segmentado } from "../Segmentado/Segmentado"
import "./FiltroDeGraficos.css"

export type GrupoDeDores = { rotulo: string; dores: { id: string; titulo: string }[] }

export type FiltroDeGraficosProps = {
  periodos: readonly { valor: string; rotulo: string }[]
  periodo: string
  aoMudarPeriodo: (periodo: string) => void
  /** Dores agrupadas por categoria (viram `optgroup`). */
  grupos: GrupoDeDores[]
  /** Id da Dor filtrada ou `"todas"`. */
  dor: string
  aoMudarDor: (dor: string) => void
  /** Mostra "Limpar filtro" quando há uma Dor filtrada. */
  aoLimpar?: () => void
  className?: string
}

/** A linha de filtros acima dos Gráficos do Relatório: período e Dor. */
export function FiltroDeGraficos({ periodos, periodo, aoMudarPeriodo, grupos, dor, aoMudarDor, aoLimpar, className }: FiltroDeGraficosProps) {
  return (
    <div className={cx("dst-filtro-graficos", className)} role="group" aria-label="Filtros dos gráficos">
      <Segmentado rotulo="Período" opcoes={periodos} valor={periodo} aoMudar={aoMudarPeriodo} />
      <label className="dst-filtro-graficos__dor">
        <span>Dor</span>
        <select value={dor} onChange={(e) => aoMudarDor(e.target.value)}>
          <option value="todas">Todas as Dores</option>
          {grupos.map((g) => (
            <optgroup key={g.rotulo} label={g.rotulo}>
              {g.dores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.titulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Icone nome="baixo" />
      </label>
      {aoLimpar && dor !== "todas" && (
        <Botao variante="terciario" icone="fechar" onClick={aoLimpar}>
          Limpar filtro
        </Botao>
      )}
    </div>
  )
}
