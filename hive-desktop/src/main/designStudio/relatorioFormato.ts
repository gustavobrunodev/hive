import { parse } from 'yaml'
import { isFonte, type FonteId } from './catalogo'

/**
 * Design Studio — the Relatório de Fonte file (decision 4, Landing 17):
 * Markdown with a YAML front matter. This module reads one and says whether it
 * is in the format. Nothing reads a Relatório that fails here — a file the
 * agent left half-written, or wrote in some other shape, is never on a screen.
 */

export const FORMATO = 'relatorio-de-fonte/1'

export type Impacto = 'alto' | 'medio' | 'baixo'

export interface Trecho {
  t: string
  quem: string
  texto: string
}

/**
 * One Evidência, in its Fonte's shape (Landing 17). One interface with every
 * field optional beyond `id`, because the folha draws whichever fields the
 * Fonte has: Likert a score and a comment, Voz the transcript, FullStory the
 * session.
 */
export interface Evidencia {
  id: string
  data?: string
  nota?: number
  texto?: string
  canal?: string
  perfil?: string
  duracao?: string
  motivo?: string
  rechamada?: boolean
  trechos?: Trecho[]
  dispositivo?: string
  tela?: string
  elemento?: string
  sinal?: string
  momento?: string
  detalhe?: string
}

export interface Dor {
  id: string
  rank: number
  titulo: string
  resumo: string
  tela?: string
  categoria: string
  volume: number
  impacto: Impacto
  /** % change, the last six weeks over the first six. */
  tendencia: number
  /** Thirteen weekly counts, oldest first (optional, Landing 17). */
  semanas?: number[]
  /** FullStory: the frustration signal. */
  sinal?: string
  /** Voz do Cliente: % of calls followed by another within seven days. */
  rechamada?: number
  evidencias: Evidencia[]
}

export interface Categoria {
  id: string
  nome: string
  volume: number
  participacao: number
  semanas: number[]
  insight: string
}

export interface RelatorioDeFonte {
  /** The file's path relative to `<raiz>`, with `/` — what a Dor citation carries (decision 4). */
  caminho: string
  produto: string
  fonte: FonteId
  periodo: { inicio: string; fim: string; dias: number }
  /** ISO 8601. The most recent Relatório is the one with the greatest `geradoEm`. */
  geradoEm: string
  geradoPor: { agente: string; modelo: string | null }
  volume: number
  destaque: string
  metodo: string
  dores: Dor[]
  categorias: Categoria[]
  /** The body, one entry per paragraph. */
  narrativa: string[]
}

/** The field a refused file failed on — the answer `readRelatorio` gives instead of a Relatório. */
export type CampoInvalido =
  | 'front-matter'
  | 'formato'
  | 'produto'
  | 'fonte'
  | 'periodo'
  | 'geradoEm'
  | 'geradoPor'
  | 'volume'
  | 'destaque'
  | 'metodo'
  | 'dores'
  | 'dores[].impacto'
  | 'categorias'

export type LeituraDeRelatorio =
  { ok: true; relatorio: RelatorioDeFonte } | { ok: false; campo: CampoInvalido }

type Registro = Record<string, unknown>

function registro(value: unknown): Registro | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Registro)
    : null
}

function texto(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function numero(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function numeros(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(numero)
}

const IMPACTOS: readonly string[] = ['alto', 'medio', 'baixo']

function periodoValido(value: unknown): boolean {
  const p = registro(value)
  return p !== null && texto(p.inicio) && texto(p.fim) && numero(p.dias) && p.dias > 0
}

function geradoPorValido(value: unknown): boolean {
  const g = registro(value)
  return (
    g !== null &&
    texto(g.agente) &&
    (g.modelo === undefined || g.modelo === null || typeof g.modelo === 'string')
  )
}

/** The optional fields of a Dor: absent, or of their type. */
function opcionaisValidos(d: Registro): boolean {
  return (
    typeof (d.resumo ?? '') === 'string' &&
    (d.tela === undefined || d.tela === null || typeof d.tela === 'string') &&
    (d.semanas === undefined || numeros(d.semanas))
  )
}

/** A Dor's own fields, apart from the impact (checked on its own, C13a). */
function dorValida(value: unknown): boolean {
  const d = registro(value)
  return (
    d !== null &&
    texto(d.id) &&
    numero(d.rank) &&
    texto(d.titulo) &&
    texto(d.categoria) &&
    numero(d.volume) &&
    numero(d.tendencia) &&
    opcionaisValidos(d) &&
    Array.isArray(d.evidencias) &&
    d.evidencias.every((e) => texto(registro(e)?.id))
  )
}

function categoriaValida(value: unknown): boolean {
  const c = registro(value)
  return (
    c !== null &&
    texto(c.id) &&
    texto(c.nome) &&
    numero(c.volume) &&
    numero(c.participacao) &&
    numeros(c.semanas) &&
    typeof (c.insight ?? '') === 'string'
  )
}

/** The checks, in the order decision 4 lists the fields. The first that fails names the refusal. */
const CHECKS: ReadonlyArray<[CampoInvalido, (front: Registro) => boolean]> = [
  ['formato', (f) => f.formato === FORMATO],
  ['produto', (f) => texto(f.produto)],
  ['fonte', (f) => isFonte(f.fonte)],
  ['periodo', (f) => periodoValido(f.periodo)],
  ['geradoEm', (f) => texto(f.geradoEm) && !Number.isNaN(Date.parse(f.geradoEm))],
  ['geradoPor', (f) => geradoPorValido(f.geradoPor)],
  ['volume', (f) => numero(f.volume) && f.volume >= 0],
  ['destaque', (f) => texto(f.destaque)],
  ['metodo', (f) => texto(f.metodo)],
  ['dores', (f) => Array.isArray(f.dores) && f.dores.every(dorValida)],
  [
    'dores[].impacto',
    (f) => (f.dores as unknown[]).every((d) => IMPACTOS.includes(String(registro(d)?.impacto)))
  ],
  ['categorias', (f) => Array.isArray(f.categorias) && f.categorias.every(categoriaValida)]
]

/** Validates a parsed front matter, answering the first field it fails on, or `null`. */
export function invalidField(front: unknown): CampoInvalido | null {
  const f = registro(front)
  if (!f) return 'front-matter'
  for (const [campo, check] of CHECKS) if (!check(f)) return campo
  return null
}

/** The body's paragraphs: blocks separated by a blank line, each folded onto one line. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter((block) => block !== '')
}

const FRONT_MATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/

/**
 * Reads a Relatório file's text. `caminho` is where it lives, relative to
 * `<raiz>` — it is part of the Relatório, because it is how a Dor is cited.
 */
export function readRelatorio(text: string, caminho: string): LeituraDeRelatorio {
  const match = FRONT_MATTER.exec(text)
  if (!match) return { ok: false, campo: 'front-matter' }
  let front: unknown
  try {
    front = parse(match[1])
  } catch {
    return { ok: false, campo: 'front-matter' }
  }
  const campo = invalidField(front)
  if (campo) return { ok: false, campo }
  const f = front as Registro
  const relatorio: RelatorioDeFonte = {
    caminho,
    produto: f.produto as string,
    fonte: f.fonte as FonteId,
    periodo: f.periodo as RelatorioDeFonte['periodo'],
    geradoEm: f.geradoEm as string,
    geradoPor: {
      agente: (f.geradoPor as Registro).agente as string,
      modelo: ((f.geradoPor as Registro).modelo as string | null | undefined) ?? null
    },
    volume: f.volume as number,
    destaque: f.destaque as string,
    metodo: f.metodo as string,
    dores: (f.dores as Dor[]).map((dor) => ({
      ...dor,
      resumo: dor.resumo ?? '',
      tela: dor.tela || undefined
    })),
    categorias: f.categorias as Categoria[],
    narrativa: paragraphs(match[2] ?? '')
  }
  return { ok: true, relatorio }
}
