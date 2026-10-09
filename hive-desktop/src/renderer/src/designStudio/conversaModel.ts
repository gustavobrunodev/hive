import { t } from '../i18n'
import { FONTES, type FonteId } from './model'
import type { Dor, DorCitada, DorVisivel, RelatorioDeFonte } from './relatorioModel'

/**
 * Design Studio — the pure rules of the chat field and the conversa do
 * Produto: the title, the Dores the home and the `@` list offer, the ready
 * questions, and how a reply's Dor marks become chips. Data and rules live in
 * a `.ts` (react-refresh), and every one of them is a case in a test.
 */

/** How long a conversation's title is (criterion 10, `home.js`). */
export const TITULO_LIMITE = 46

/** The title of a conversation started by `texto`: one line, its first 46 characters. */
export function tituloDaConversa(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, TITULO_LIMITE)
}

/** How the impact ranks, the heaviest first. */
const PESO: Record<Dor['impacto'], number> = { alto: 0, medio: 1, baixo: 2 }

/** "Dores em alta" (criterion 2): per Fonte, the two of greatest impact — on a tie, the greatest trend. */
export const EM_ALTA_POR_FONTE = 2

export function doresEmAlta(relatorio: RelatorioDeFonte): Dor[] {
  return [...relatorio.dores]
    .sort((a, b) => PESO[a.impacto] - PESO[b.impacto] || b.tendencia - a.tendencia)
    .slice(0, EM_ALTA_POR_FONTE)
}

/** How many Dores the `@` list shows (criterion 6). */
export const ARROBA_LIMITE = 9

/**
 * The `@` list (criterion 6): the Produto's Dores of its Relatórios in use,
 * by impact and, on a tie, by volume — at most nine. Typing after the `@`
 * narrows it by title.
 */
export function doresDoArroba(
  relatorios: readonly RelatorioDeFonte[] | null,
  produto: string,
  consulta = ''
): DorVisivel[] {
  const filtro = consulta.trim().toLocaleLowerCase('pt-BR')
  return (relatorios ?? [])
    .filter((relatorio) => relatorio.produto === produto)
    .flatMap((relatorio) => relatorio.dores.map((dor) => ({ dor, relatorio })))
    .filter(({ dor }) => filtro === '' || dor.titulo.toLocaleLowerCase('pt-BR').includes(filtro))
    .sort((a, b) => PESO[a.dor.impacto] - PESO[b.dor.impacto] || b.dor.volume - a.dor.volume)
    .slice(0, ARROBA_LIMITE)
}

/** The Produto's Relatórios in use, in the Fonte order. */
export function relatoriosDoProduto(
  relatorios: readonly RelatorioDeFonte[] | null,
  produto: string
): RelatorioDeFonte[] {
  return FONTES.flatMap((fonte) => {
    const relatorio = relatorios?.find((r) => r.produto === produto && r.fonte === fonte)
    return relatorio ? [relatorio] : []
  })
}

/** The Fontes of a Produto that have no Relatório yet, in the Fonte order. */
export function fontesSemRelatorio(
  relatorios: readonly RelatorioDeFonte[] | null,
  produto: string
): FonteId[] {
  const com = new Set(relatoriosDoProduto(relatorios, produto).map((r) => r.fonte))
  return FONTES.filter((fonte) => !com.has(fonte))
}

/** The ready questions of a conversa do Produto (criterion 13, `home.js`). */
export function perguntasProntas(): string[] {
  return [
    t('designStudio.conversa.perguntaCrescem'),
    t('designStudio.conversa.perguntaCompare'),
    t('designStudio.conversa.perguntaVoz'),
    t('designStudio.conversa.perguntaComecar')
  ]
}

/**
 * What a send says when the person wrote nothing (criterion 5 lets it go out
 * with only a Dor or only an attachment): the field's words in `composer.js`.
 */
export function textoDoEnvio(texto: string, dores: number, anexos: number): string {
  const escrito = texto.trim()
  if (escrito !== '') return escrito
  if (dores > 0) return t('designStudio.campo.resolverDores', dores)
  return anexos > 0 ? t('designStudio.campo.vejaAnexos') : ''
}

/** One run of a reply: its text, or a Dor it cites (criterion 12). */
export type TrechoDaResposta =
  { tipo: 'texto'; texto: string } | { tipo: 'dor'; citacao: DorCitada; dor: Dor; fonte: FonteId }

const MARCA = /\[\[dor:([^\]\s]+)\]\]/g

/**
 * A reply, cut where it cites a Dor (Landing: `[[dor:<id>]]`). A mark whose id
 * is a Dor of the Produto's Relatórios in use becomes that Dor's chip; any
 * other mark leaves the text, so no id the person cannot open is ever shown.
 */
export function trechosDaResposta(
  texto: string,
  relatorios: readonly RelatorioDeFonte[]
): TrechoDaResposta[] {
  const trechos: TrechoDaResposta[] = []
  let desde = 0
  const empurrar = (parte: string): void => {
    if (parte !== '') trechos.push({ tipo: 'texto', texto: parte })
  }
  for (const marca of texto.matchAll(MARCA)) {
    const inicio = marca.index ?? 0
    empurrar(texto.slice(desde, inicio))
    desde = inicio + marca[0].length
    const id = marca[1]
    const relatorio = relatorios.find((r) => r.dores.some((dor) => dor.id === id))
    const dor = relatorio?.dores.find((entry) => entry.id === id)
    if (relatorio && dor) {
      trechos.push({
        tipo: 'dor',
        citacao: { relatorio: relatorio.caminho, dor: dor.id },
        dor,
        fonte: relatorio.fonte
      })
    }
  }
  empurrar(texto.slice(desde))
  return trechos
}

/** The Dores that weigh most in a Relatório just generated (criterion 3): the first three of its ranking. */
export function doresQueMaisPesam(relatorio: RelatorioDeFonte, n = 3): Dor[] {
  return [...relatorio.dores].sort((a, b) => a.rank - b.rank).slice(0, n)
}

/** The heaviest Dor of a category — the best-ranked one (criterion 20, `perguntar-categoria`). */
export function dorDeMaiorPeso(relatorio: RelatorioDeFonte, categoria: string): Dor | null {
  return (
    [...relatorio.dores]
      .filter((dor) => dor.categoria === categoria)
      .sort((a, b) => a.rank - b.rank)[0] ?? null
  )
}
