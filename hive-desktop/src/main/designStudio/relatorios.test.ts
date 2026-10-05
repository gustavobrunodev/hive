import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readCatalogo } from './catalogo'
import { frenteValida, gravarRelatorio, relatorioTexto } from './__tests__/fixtures'
import {
  isRelatorioFile,
  latestRelatorios,
  listRelatorios,
  nextRelatorioName,
  relatorioAt
} from './relatorios'

/**
 * Design Studio — the Relatórios on disk (decision 3, Landing 18): which files
 * count, which one is in use, and how a path from the renderer is read.
 */

const RESOURCES = join(__dirname, '..', '..', '..', 'resources', 'design-studio')
let root: string

beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), 'hive-relatorios-')), 'Design Studio')
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

describe('the Relatórios on disk', () => {
  it('counts only visible .md files', () => {
    expect(isRelatorioFile('2026-10-04-90d.md')).toBe(true)
    expect(isRelatorioFile('.2026-10-04-90d.md.parcial')).toBe(false)
    expect(isRelatorioFile('.oculto.md')).toBe(false)
    expect(isRelatorioFile('notas.txt')).toBe(false)
  })

  it('lists the valid ones, most recent first, skipping the rest', () => {
    gravarRelatorio(
      root,
      'Pix',
      'voz',
      '2026-10-01-90d.md',
      relatorioTexto(
        frenteValida({ geradoEm: '2026-10-01T10:00:00Z' }, { produto: 'Pix', fonte: 'voz' })
      )
    )
    gravarRelatorio(
      root,
      'Pix',
      'voz',
      '2026-10-03-90d.md',
      relatorioTexto(
        frenteValida({ geradoEm: '2026-10-03T10:00:00Z' }, { produto: 'Pix', fonte: 'voz' })
      )
    )
    gravarRelatorio(root, 'Pix', 'voz', '2026-10-04-90d.md', 'não é um Relatório')
    gravarRelatorio(
      root,
      'Pix',
      'voz',
      '.2026-10-04-90d-2.md.parcial',
      relatorioTexto(frenteValida({}, { produto: 'Pix', fonte: 'voz' }))
    )
    // A valid file in the wrong folder: its Fonte is not the folder's.
    gravarRelatorio(
      root,
      'Pix',
      'voz',
      '2026-10-02-90d.md',
      relatorioTexto(frenteValida({}, { produto: 'Pix', fonte: 'likert' }))
    )
    // …nor its Produto.
    gravarRelatorio(
      root,
      'Pix',
      'voz',
      '2026-09-30-90d.md',
      relatorioTexto(frenteValida({}, { produto: 'Câmbio', fonte: 'voz' }))
    )
    mkdirSync(join(root, 'Pix', 'relatorios', 'voz', 'pasta.md'))
    expect(listRelatorios(root, 'Pix', 'voz').map((r) => r.caminho)).toEqual([
      'Pix/relatorios/voz/2026-10-03-90d.md',
      'Pix/relatorios/voz/2026-10-01-90d.md'
    ])
  })

  it('answers the most recent of every Produto × Fonte that has one', () => {
    const catalogo = readCatalogo(RESOURCES)
    expect(latestRelatorios(root, catalogo)).toEqual([])
    gravarRelatorio(
      root,
      'Câmbio',
      'fullstory',
      '2026-10-04-90d.md',
      relatorioTexto(frenteValida({}, { produto: 'Câmbio', fonte: 'fullstory' }))
    )
    gravarRelatorio(root, 'Extrato', 'likert', '2026-10-04-90d.md', relatorioTexto(frenteValida()))
    expect(latestRelatorios(root, catalogo).map((r) => `${r.produto}/${r.fonte}`)).toEqual([
      'Câmbio/fullstory',
      'Extrato/likert'
    ])
  })

  it('reads one by its path relative to <raiz>, and nothing outside the Relatório shape', () => {
    gravarRelatorio(root, 'Extrato', 'likert', '2026-10-04-90d.md', relatorioTexto(frenteValida()))
    expect(relatorioAt(root, 'Extrato/relatorios/likert/2026-10-04-90d.md')?.destaque).toBe(
      '31% das respostas com nota 1 ou 2'
    )
    writeFileSync(join(root, '..', 'fora.md'), relatorioTexto(frenteValida()))
    for (const caminho of [
      'Extrato/relatorios/likert/sumiu.md',
      '../fora.md',
      'Extrato/relatorios/likert/../../../../fora.md',
      'Extrato/outra/likert/2026-10-04-90d.md',
      'Extrato/relatorios/nps/2026-10-04-90d.md',
      'Extrato/relatorios/likert',
      'Extrato/relatorios/likert/sub/2026-10-04-90d.md',
      'Extrato/relatorios/likert/.2026-10-04-90d.md',
      ''
    ]) {
      expect(relatorioAt(root, caminho), caminho).toBeNull()
    }
  })

  it('names the next Relatório of the day by the smallest free suffix among the .md', () => {
    const dir = join(root, 'Pix', 'relatorios', 'likert')
    expect(nextRelatorioName(dir, '2026-10-04')).toBe('2026-10-04-90d.md')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.2026-10-04-90d.md.parcial'), '')
    expect(nextRelatorioName(dir, '2026-10-04')).toBe('2026-10-04-90d.md')
    writeFileSync(join(dir, '2026-10-04-90d.md'), '')
    writeFileSync(join(dir, '2026-10-04-90d-3.md'), '')
    expect(nextRelatorioName(dir, '2026-10-04')).toBe('2026-10-04-90d-2.md')
    writeFileSync(join(dir, '2026-10-04-90d-2.md'), '')
    expect(nextRelatorioName(dir, '2026-10-04')).toBe('2026-10-04-90d-4.md')
    expect(nextRelatorioName(dir, '2026-10-05')).toBe('2026-10-05-90d.md')
  })
})
