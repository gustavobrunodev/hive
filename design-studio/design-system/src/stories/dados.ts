/* Dados de exemplo das histórias e dos testes de integração (sintéticos, como no app). */
import type { GrupoDeDores } from "../components/FiltroDeGraficos/FiltroDeGraficos"
import type { CategoriaDoGrafico } from "../components/GraficoDeBarras/GraficoDeBarras"
import type { PontoDaSerie } from "../components/GraficoDeLinha/GraficoDeLinha"

export const PERIODOS = [
  { valor: "13", rotulo: "90 dias" },
  { valor: "9", rotulo: "60 dias" },
  { valor: "4", rotulo: "30 dias" },
]

export const GRUPOS: GrupoDeDores[] = [
  {
    rotulo: "Status e avisos",
    dores: [
      { id: "cam-v1", titulo: "Minha transação de câmbio estornou e não recebi nenhuma notificação" },
      { id: "cam-v3", titulo: "Não entendo o motivo da remessa recusada" },
    ],
  },
  { rotulo: "Cotação e taxas", dores: [{ id: "cam-v2", titulo: "A cotação cobrada foi diferente da simulada" }] },
  { rotulo: "Cadastro do beneficiário", dores: [{ id: "cam-v4", titulo: "Não sei onde corrigir o IBAN" }] },
]

export const CATEGORIAS: CategoriaDoGrafico[] = [
  { id: "status", nome: "Status e avisos", volume: 1796, dores: 2 },
  { id: "cotacao", nome: "Cotação e taxas", volume: 388, dores: 1 },
  { id: "beneficiario", nome: "Cadastro do beneficiário", volume: 241, dores: 1 },
  { id: "confirmacao", nome: "Confirmação e limites", volume: 167, dores: 1 },
]

/** Volume de cada Dor dentro da sua categoria, para o recorte das barras. */
export const VOLUME_DA_DOR: Record<string, { categoria: string; volume: number }> = {
  "cam-v1": { categoria: "status", volume: 1284 },
  "cam-v3": { categoria: "status", volume: 512 },
  "cam-v2": { categoria: "cotacao", volume: 388 },
  "cam-v4": { categoria: "beneficiario", volume: 241 },
}

const SEMANAS = ["1 jul", "8 jul", "15 jul", "22 jul", "29 jul", "5 ago", "12 ago", "19 ago", "26 ago", "2 set", "9 set", "16 set", "23 set"]
const TOTAIS = [190, 196, 201, 205, 199, 194, 188, 203, 207, 202, 196, 201, 210]
const SERIES: Record<string, number[]> = {
  status: [128, 133, 139, 141, 136, 133, 129, 140, 145, 141, 136, 140, 155],
  cotacao: [28, 27, 29, 32, 30, 29, 27, 32, 31, 32, 28, 30, 33],
  beneficiario: [18, 19, 18, 20, 19, 18, 17, 19, 19, 18, 19, 18, 19],
  confirmacao: [13, 12, 13, 13, 12, 13, 13, 13, 12, 13, 13, 12, 15],
}

/** A série semanal de uma categoria (as últimas `semanas`). */
export function serieDaCategoria(categoria: string, semanas = 13): PontoDaSerie[] {
  const valores = SERIES[categoria] ?? SERIES.cotacao!
  return SEMANAS.map((rotulo, i) => ({ rotulo, valor: valores[i]!, total: TOTAIS[i]! })).slice(-semanas)
}
