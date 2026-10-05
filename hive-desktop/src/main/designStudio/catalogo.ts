import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Design Studio — the catalog the module ships with (Landing 6 and 16): the
 * Produtos, their journey screens, and what each Fonte measures and in which
 * unit. A Produto's folder in `<raiz>` takes its `nome`; its sample data takes
 * its `id`.
 */

export const FONTES = ['likert', 'voz', 'fullstory'] as const
export type FonteId = (typeof FONTES)[number]

export function isFonte(value: unknown): value is FonteId {
  return typeof value === 'string' && (FONTES as readonly string[]).includes(value)
}

export interface ProdutoDoCatalogo {
  id: string
  nome: string
  descricao: string
  /** The journey's screens, in order — the buttons of "Onde dói". */
  telas: string[]
}

export interface FonteDoCatalogo {
  id: FonteId
  nome: string
  descricao: string
  /** What the Fonte counts in the period (`respostas`, `ligações`, `sessões`). */
  unidade: string
  /** What a Dor's volume counts (`menções`, `ligações`, `clientes afetados`). */
  unidadeDor: string
  /** The same, short enough for a note's footer (`clientes`). */
  unidadeNota: string
}

export interface Catalogo {
  produtos: ProdutoDoCatalogo[]
  fontes: FonteDoCatalogo[]
}

/** The catalog file, read from the module's resources. Throws when it is missing or malformed. */
export function readCatalogo(resourcesDir: string): Catalogo {
  const raw = JSON.parse(readFileSync(join(resourcesDir, 'catalogo.json'), 'utf-8')) as {
    formato?: string
    produtos?: ProdutoDoCatalogo[]
    fontes?: FonteDoCatalogo[]
  }
  if (raw.formato !== 'catalogo/1' || !Array.isArray(raw.produtos) || !Array.isArray(raw.fontes)) {
    throw new Error('catalogo.json fora do formato catalogo/1')
  }
  return { produtos: raw.produtos, fontes: raw.fontes }
}

/**
 * The volume each sample-data file declares — every Fonte's total in the
 * period, by Produto `nome` (Landing 19). What "Lendo <volume> <unidade>" and
 * "<volume> <unidade> no período" say before there is a Relatório. A file that
 * cannot be read counts nothing rather than failing the module.
 */
export function readVolumes(
  resourcesDir: string,
  catalogo: Catalogo
): Record<string, Partial<Record<FonteId, number>>> {
  const volumes: Record<string, Partial<Record<FonteId, number>>> = {}
  for (const produto of catalogo.produtos) {
    volumes[produto.nome] = {}
    for (const fonte of catalogo.fontes) {
      try {
        const file = JSON.parse(
          readFileSync(
            join(resourcesDir, 'dados-de-exemplo', produto.id, `${fonte.id}.json`),
            'utf-8'
          )
        ) as { volume?: unknown }
        if (typeof file.volume === 'number') volumes[produto.nome][fonte.id] = file.volume
      } catch {
        // Missing or unreadable: no volume to show.
      }
    }
  }
  return volumes
}
