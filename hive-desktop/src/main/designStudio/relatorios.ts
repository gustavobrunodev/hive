import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, relative, resolve, sep } from 'path'
import type { Catalogo, FonteId } from './catalogo'
import { isFonte } from './catalogo'
import { readRelatorio, type LeituraDeRelatorio, type RelatorioDeFonte } from './relatorioFormato'

/**
 * Design Studio — the Relatórios on disk (decision 3, Landing 18).
 *
 * `<raiz>/<Produto>/relatorios/<fonte>/<AAAA-MM-DD>-90d[-k].md`. A Relatório
 * is a `.md` file whose name does not start with a dot — the generation's
 * working copy (`.<nome>.parcial`) is not one, and neither is anything that
 * fails the format. The most recent is the greatest `geradoEm`, never the
 * greatest name: two of the same day sort by suffix, and a suffix is a count,
 * not a clock.
 */

/** The folder a Produto's Relatórios of one Fonte live in. */
export function relatoriosDir(root: string, produto: string, fonte: FonteId): string {
  return join(root, produto, 'relatorios', fonte)
}

/** A file name that is a Relatório: `.md`, and not a hidden working copy. */
export function isRelatorioFile(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.')
}

/** `caminho` relative to `<raiz>`, always with `/` — the shape a citation carries. */
function caminhoDe(produto: string, fonte: FonteId, arquivo: string): string {
  return [produto, 'relatorios', fonte, arquivo].join('/')
}

/** Reads one file and checks it belongs where it sits: its Produto and Fonte are its folders'. */
export function readRelatorioFile(
  root: string,
  produto: string,
  fonte: FonteId,
  arquivo: string
): LeituraDeRelatorio {
  let text: string
  try {
    text = readFileSync(join(relatoriosDir(root, produto, fonte), arquivo), 'utf-8')
  } catch {
    return { ok: false, campo: 'front-matter' }
  }
  const leitura = readRelatorio(text, caminhoDe(produto, fonte, arquivo))
  if (!leitura.ok) return leitura
  if (leitura.relatorio.produto !== produto) return { ok: false, campo: 'produto' }
  if (leitura.relatorio.fonte !== fonte) return { ok: false, campo: 'fonte' }
  return leitura
}

/** Every valid Relatório of a Produto and Fonte, the most recent first. */
export function listRelatorios(root: string, produto: string, fonte: FonteId): RelatorioDeFonte[] {
  let names: string[]
  try {
    names = readdirSync(relatoriosDir(root, produto, fonte))
  } catch {
    return []
  }
  return names
    .filter(isRelatorioFile)
    .map((name) => readRelatorioFile(root, produto, fonte, name))
    .flatMap((leitura) => (leitura.ok ? [leitura.relatorio] : []))
    .sort((a, b) => Date.parse(b.geradoEm) - Date.parse(a.geradoEm))
}

/** The Relatório in use for a Produto and Fonte: the most recent valid one, or `null`. */
export function latestRelatorio(
  root: string,
  produto: string,
  fonte: FonteId
): RelatorioDeFonte | null {
  return listRelatorios(root, produto, fonte)[0] ?? null
}

/** The most recent Relatório of every Produto × Fonte that has one. */
export function latestRelatorios(root: string, catalogo: Catalogo): RelatorioDeFonte[] {
  return catalogo.produtos.flatMap((produto) =>
    catalogo.fontes.flatMap((fonte) => {
      const relatorio = latestRelatorio(root, produto.nome, fonte.id)
      return relatorio ? [relatorio] : []
    })
  )
}

/**
 * One Relatório by its `caminho` (relative to `<raiz>`), or `null` when the
 * file is gone, is not in the format, or is not a Relatório path at all. The
 * path comes from the renderer, so one that climbs out of `<raiz>` reads as
 * absent rather than as a file somewhere else on disk.
 */
export function relatorioAt(root: string, caminho: string): RelatorioDeFonte | null {
  const full = resolve(root, caminho)
  const inside = relative(resolve(root), full)
  if (inside.startsWith('..') || inside.startsWith(sep) || inside === '') return null
  const [produto, pasta, fonte, arquivo, ...extra] = inside.split(sep)
  if (pasta !== 'relatorios' || !isFonte(fonte) || !arquivo || extra.length > 0) return null
  if (!isRelatorioFile(arquivo)) return null
  const leitura = readRelatorioFile(root, produto, fonte, arquivo)
  return leitura.ok ? leitura.relatorio : null
}

/**
 * The name the next Relatório of the day gets (Landing 3, amended):
 * `<dia>-90d.md`, then `-2`, `-3`… — the smallest suffix no `.md` in the
 * folder has yet. Working copies do not hold a name.
 */
export function nextRelatorioName(dir: string, dia: string): string {
  const taken = new Set(existsSync(dir) ? readdirSync(dir).filter(isRelatorioFile) : [])
  if (!taken.has(`${dia}-90d.md`)) return `${dia}-90d.md`
  for (let suffix = 2; ; suffix += 1) {
    const name = `${dia}-90d-${suffix}.md`
    if (!taken.has(name)) return name
  }
}
