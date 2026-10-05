import { t } from '../i18n'
import type { FonteId } from './model'

/**
 * Design Studio — the pure rules the Dores and Relatório pages share: which
 * Dores a column shows, how "Onde dói" counts, what the folha says, and how
 * numbers and dates are written. Types come from the bridge, as the renderer's
 * rule for anything that crosses the process boundary.
 */

type Bridge = Window['hive']['designStudio']
export type DadosDoModulo = Awaited<ReturnType<Bridge['dados']>>
export type Catalogo = DadosDoModulo['catalogo']
export type ProdutoDoCatalogo = Catalogo['produtos'][number]
export type FonteDoCatalogo = Catalogo['fontes'][number]
export type RelatorioDeFonte = DadosDoModulo['relatorios'][number]
export type Dor = RelatorioDeFonte['dores'][number]
export type Categoria = RelatorioDeFonte['categorias'][number]
export type Evidencia = Dor['evidencias'][number]
export type EventoDeGeracao = NonNullable<Awaited<ReturnType<Bridge['geracaoAtual']>>>

/** How a Dor is cited: the Relatório file (relative to `<raiz>`) and the Dor's id (decision 4). */
export interface DorCitada {
  relatorio: string
  dor: string
}

/** A Dor on screen, with where it came from. */
export interface DorVisivel {
  dor: Dor
  relatorio: RelatorioDeFonte
}

/** How many Dores a column shows (criterion 18). */
export const COLUNA_LIMITE = 5

const NUMERO = new Intl.NumberFormat('pt-BR')

/** A count, the Brazilian way: 1.932. */
export function formatNumber(value: number): string {
  return NUMERO.format(value)
}

/** The Relatório in use for a Produto and Fonte, out of the most recent ones. */
export function relatorioOf(
  relatorios: readonly RelatorioDeFonte[] | null,
  produto: string,
  fonte: FonteId
): RelatorioDeFonte | null {
  return relatorios?.find((r) => r.produto === produto && r.fonte === fonte) ?? null
}

/** A column's Dores: the first five of the ranking, in rank order. */
export function columnDores(relatorio: RelatorioDeFonte): Dor[] {
  return [...relatorio.dores].sort((a, b) => a.rank - b.rank).slice(0, COLUNA_LIMITE)
}

/** Every Dor visible on the Dores page of a Produto: the columns' Dores, across the Fontes. */
export function visibleDores(relatorios: readonly RelatorioDeFonte[]): DorVisivel[] {
  return relatorios.flatMap((relatorio) =>
    columnDores(relatorio).map((dor) => ({ dor, relatorio }))
  )
}

/** One button of "Onde dói". */
export interface TelaDeOndeDoi {
  tela: string
  contagem: number
  /** The screen with the most visible Dores (every screen tied at the top). */
  quente: boolean
  /** No visible Dor here: the button is disabled. */
  desabilitada: boolean
}

/**
 * "Onde dói" (criterion 20): one entry per screen of the journey, with how
 * many visible Dores sit on it. A Dor with no screen counts nowhere
 * (Unresolved 8).
 */
export function ondeDoi(
  telas: readonly string[],
  visiveis: readonly DorVisivel[]
): TelaDeOndeDoi[] {
  const contagem = new Map<string, number>()
  for (const { dor } of visiveis) {
    if (dor.tela) contagem.set(dor.tela, (contagem.get(dor.tela) ?? 0) + 1)
  }
  const maior = Math.max(0, ...telas.map((tela) => contagem.get(tela) ?? 0))
  return telas.map((tela) => {
    const n = contagem.get(tela) ?? 0
    return { tela, contagem: n, quente: n > 0 && n === maior, desabilitada: n === 0 }
  })
}

/** "Na mesma tela": the other visible Dores of the Dor's screen. */
export function sameScreen(
  visiveis: readonly DorVisivel[],
  citada: DorCitada,
  tela: string | undefined
): DorVisivel[] {
  if (!tela) return []
  return visiveis.filter(
    ({ dor, relatorio }) =>
      dor.tela === tela && !(dor.id === citada.dor && relatorio.caminho === citada.relatorio)
  )
}

/** A Dor's trend as text: "14%", or "estável". */
export function trendText(tendencia: number): string {
  return tendencia === 0
    ? t('designStudio.nota.estavel')
    : t('designStudio.nota.tendencia', Math.abs(tendencia))
}

/** The impact as a word. */
export function impactWord(impacto: Dor['impacto']): string {
  return t(`designStudio.impacto.${impacto}`)
}

/** One of the folha's three facts (criterion 21): its number, then its caption. */
export interface Fato {
  valor: string
  rotulo: string
}

/** The three facts, by the Dor's Fonte. */
export function factsOf(dor: Dor, relatorio: RelatorioDeFonte): Fato[] {
  const em90 = { valor: trendSigned(dor.tendencia), rotulo: t('designStudio.folha.em90Dias') }
  switch (relatorio.fonte) {
    case 'likert':
      return [
        { valor: formatNumber(dor.volume), rotulo: t('designStudio.folha.mencoes') },
        em90,
        { valor: formatNumber(relatorio.volume), rotulo: t('designStudio.folha.respostasLidas') }
      ]
    case 'voz':
      return [
        { valor: formatNumber(dor.volume), rotulo: t('designStudio.folha.ligacoes') },
        {
          valor: t('designStudio.folha.porcento', dor.rechamada ?? 0),
          rotulo: t('designStudio.folha.ligamDeNovo')
        },
        em90
      ]
    case 'fullstory':
      return [
        { valor: formatNumber(dor.volume), rotulo: t('designStudio.folha.clientesAfetados') },
        { valor: dor.sinal ?? '', rotulo: t('designStudio.folha.sinal') },
        em90
      ]
  }
}

/** The trend with its sign, for the folha's fact: "+14%", "−3%", "estável". */
export function trendSigned(tendencia: number): string {
  return t('designStudio.graficos.tendencia', tendencia)
}

const DIA_MS = 86_400_000

/** `AAAA-MM-DD` → a date at noon UTC, so no time zone moves it a day. */
function dayOf(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
}

/** "20 set 2026". */
export function formatDay(iso: string): string {
  const day = dayOf(iso)
  if (!day) return iso
  return `${day.getUTCDate()} ${t('designStudio.mes', day.getUTCMonth())} ${day.getUTCFullYear()}`
}

/** "1 jul a 29 set 2026" — the year once, when both ends share it. */
export function formatPeriod(periodo: { inicio: string; fim: string }): string {
  const inicio = dayOf(periodo.inicio)
  const fim = dayOf(periodo.fim)
  if (!inicio || !fim) return t('designStudio.periodo', periodo.inicio, periodo.fim)
  const head =
    inicio.getUTCFullYear() === fim.getUTCFullYear()
      ? `${inicio.getUTCDate()} ${t('designStudio.mes', inicio.getUTCMonth())}`
      : formatDay(periodo.inicio)
  return t('designStudio.periodo', head, formatDay(periodo.fim))
}

/** "29 set 2026, 08:40", in the local time of whoever is reading. */
export function formatGeneratedAt(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${when.getDate()} ${t('designStudio.mes', when.getMonth())} ${when.getFullYear()}, ${p(when.getHours())}:${p(when.getMinutes())}`
}

/** An Evidência's date as written in the folha: the day, and the time when it has one. */
export function formatEvidenceDate(data: string | undefined): string {
  if (!data) return ''
  const time = /T(\d{2}:\d{2})/.exec(data)?.[1]
  return time ? `${formatDay(data)}, ${time}` : formatDay(data)
}

/** The label of week `i` (0 = the oldest) of a period of 13 weeks ending at `fim`: "7 jul". */
export function weekLabel(fim: string, i: number, semanas = 13): string {
  const end = dayOf(fim)
  if (!end) return String(i + 1)
  const start = new Date(end.getTime() - (semanas * 7 - 1) * DIA_MS + i * 7 * DIA_MS)
  return `${start.getUTCDate()} ${t('designStudio.mes', start.getUTCMonth())}`
}

/** The highlight as a sentence: its first letter up. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The unit a Fonte's notes count in, from the catalog ("menções", "clientes"). */
export function unidadeNota(catalogo: Catalogo | null, fonte: FonteId): string {
  return catalogo?.fontes.find((entry) => entry.id === fonte)?.unidadeNota ?? ''
}

/** A gentle, stable tilt per note — the sticky-note look, never the same twice in a row. */
const TILTS = [-1.4, 1, -0.6, 1.4, -1, 0.7]
export function tiltFor(rank: number, fonte: FonteId): number {
  return TILTS[(rank + fonte.length) % TILTS.length]
}
