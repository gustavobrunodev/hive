import type { Categoria, Dor, RelatorioDeFonte } from './relatorioModel'

/**
 * Design Studio — the Gráficos view's numbers (P12, criteria 27–28): the
 * period window, the categories in it, the category in emphasis, the line's
 * series and the summary. Pure, so every recorte is a case.
 *
 * The weeks come from the Relatório itself (`categorias[].semanas`, and the
 * optional `dores[].semanas`, Landing 17). A recorte with no data reads as
 * zeros — bars, line and table alike (Unresolved 13).
 */

/** The three periods of the filter, as weeks of the Relatório's thirteen. */
export const PERIODOS = [
  { dias: 90, semanas: 13 },
  { dias: 60, semanas: 9 },
  { dias: 30, semanas: 4 }
] as const

export type Dias = (typeof PERIODOS)[number]['dias']

export function weeksOf(dias: Dias): number {
  return PERIODOS.find((periodo) => periodo.dias === dias)?.semanas ?? 13
}

/** The last `n` weeks of a series. */
export function lastWeeks(semanas: readonly number[], n: number): number[] {
  return semanas.slice(Math.max(0, semanas.length - n))
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** A category inside the window: its weeks, its total and its share of the window. */
export interface CategoriaNaJanela {
  categoria: Categoria
  semanas: number[]
  volume: number
  participacao: number
  dores: Dor[]
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** The categories with at least one Dor, inside the window, the largest first. */
export function categoriesIn(relatorio: RelatorioDeFonte, n: number): CategoriaNaJanela[] {
  const janelas = relatorio.categorias
    .map((categoria) => {
      const semanas = lastWeeks(categoria.semanas, n)
      return {
        categoria,
        semanas,
        volume: sum(semanas),
        participacao: 0,
        dores: relatorio.dores.filter((dor) => dor.categoria === categoria.id)
      }
    })
    .filter((entry) => entry.dores.length > 0)
  const total = sum(janelas.map((entry) => entry.volume))
  return janelas
    .map((entry) => ({ ...entry, participacao: pct(entry.volume, total) }))
    .sort((a, b) => b.volume - a.volume)
}

/**
 * A Dor's weeks inside the window: its own series when the Relatório has one;
 * otherwise its category's, scaled by the Dor's share of the category over the
 * whole period.
 */
export function dorWeeks(dor: Dor, categoria: CategoriaNaJanela | undefined, n: number): number[] {
  if (dor.semanas && dor.semanas.length > 0) return lastWeeks(dor.semanas, n)
  const inteira = sum(categoria?.categoria.semanas ?? [])
  const parte = inteira > 0 ? dor.volume / inteira : 0
  return (categoria?.semanas ?? []).map((value) => Math.round(value * parte))
}

/** What the Gráficos view shows for one recorte. */
export interface Recorte {
  semanas: number
  categorias: CategoriaNaJanela[]
  total: number
  /** The category in emphasis: the filtered Dor's, the chosen one, or the largest. */
  enfase: CategoriaNaJanela | undefined
  dor: Dor | null
  /** The filtered Dor's volume in the window — the emphasised part of its category's bar. */
  dorVolume: number
  /** The line: the filtered Dor's weeks, or the category in emphasis'. */
  serie: number[]
}

export function recorteOf(
  relatorio: RelatorioDeFonte,
  dias: Dias,
  dorId: string | null,
  categoriaId: string | null
): Recorte {
  const semanas = weeksOf(dias)
  const categorias = categoriesIn(relatorio, semanas)
  const dor = dorId === null ? null : (relatorio.dores.find((entry) => entry.id === dorId) ?? null)
  const escolhida = dor ? dor.categoria : categoriaId
  const enfase = categorias.find((entry) => entry.categoria.id === escolhida) ?? categorias[0]
  const serieDaDor = dor ? dorWeeks(dor, enfase, semanas) : null
  return {
    semanas,
    categorias,
    total: sum(categorias.map((entry) => entry.volume)),
    enfase,
    dor,
    dorVolume: serieDaDor ? sum(serieDaDor) : 0,
    serie: serieDaDor ?? enfase?.semanas ?? []
  }
}

/** The insights, in the order the chart reads: with a Dor filtered, its category first. */
export function insightsOrder(recorte: Recorte): CategoriaNaJanela[] {
  if (!recorte.dor || !recorte.enfase) return recorte.categorias
  const enfase = recorte.enfase
  return [enfase, ...recorte.categorias.filter((entry) => entry !== enfase)]
}
