import { describe, expect, it } from 'vitest'
import { frenteValida, relatorioTexto, type Frente } from './__tests__/fixtures'
import { invalidField, paragraphs, readRelatorio } from './relatorioFormato'

/**
 * Design Studio — the format of a Relatório de Fonte (decision 4). The
 * validator is the gate every screen reads behind: one accepted file, and one
 * refusal per required field, each missing or invalid.
 */

const CAMINHO = 'Extrato/relatorios/likert/2026-10-04-90d.md'

/** The front matter without `campo`. */
function sem(campo: string): Frente {
  const frente = frenteValida()
  delete frente[campo]
  return frente
}

describe('readRelatorio', () => {
  it('C13a: accepts a file with every field of decision 4', () => {
    const leitura = readRelatorio(relatorioTexto(frenteValida()), CAMINHO)
    expect(leitura.ok).toBe(true)
    if (!leitura.ok) return
    expect(leitura.relatorio).toMatchObject({
      caminho: CAMINHO,
      produto: 'Extrato',
      fonte: 'likert',
      volume: 18240,
      destaque: '31% das respostas com nota 1 ou 2',
      geradoPor: { agente: 'Claude', modelo: 'sonnet' },
      narrativa: ['Primeiro parágrafo.', 'Segundo parágrafo.']
    })
    expect(leitura.relatorio.dores).toHaveLength(6)
    expect(leitura.relatorio.categorias[0].semanas).toHaveLength(13)
  })

  it.each([
    ['formato', sem('formato')],
    ['formato', frenteValida({ formato: 'relatorio-de-fonte/2' })],
    ['produto', sem('produto')],
    ['produto', frenteValida({ produto: '  ' })],
    ['fonte', sem('fonte')],
    ['fonte', frenteValida({ fonte: 'nps' })],
    ['periodo', sem('periodo')],
    ['periodo', frenteValida({ periodo: { inicio: '2026-07-07', fim: '2026-10-04' } })],
    ['geradoEm', sem('geradoEm')],
    ['geradoEm', frenteValida({ geradoEm: 'ontem à tarde' })],
    ['geradoPor', sem('geradoPor')],
    ['geradoPor', frenteValida({ geradoPor: { modelo: 'sonnet' } })],
    ['volume', sem('volume')],
    ['volume', frenteValida({ volume: -1 })],
    ['destaque', sem('destaque')],
    ['destaque', frenteValida({ destaque: '' })],
    ['metodo', sem('metodo')],
    ['metodo', frenteValida({ metodo: 42 })],
    ['dores', sem('dores')],
    ['dores', frenteValida({ dores: [{ id: 'sem-titulo', rank: 1 }] })],
    ['categorias', sem('categorias')],
    ['categorias', frenteValida({ categorias: [{ id: 'x', nome: 'X', volume: 1 }] })]
  ])('C13a: refuses a file whose %s is missing or invalid (%#)', (campo, frente) => {
    expect(readRelatorio(relatorioTexto(frente), CAMINHO)).toEqual({ ok: false, campo })
  })

  it('C13a: refuses a Dor whose impacto is outside alto, medio and baixo', () => {
    const frente = frenteValida()
    ;(frente.dores as Array<Record<string, unknown>>)[2].impacto = 'altíssimo'
    expect(readRelatorio(relatorioTexto(frente), CAMINHO)).toEqual({
      ok: false,
      campo: 'dores[].impacto'
    })
  })

  it('refuses text with no front matter, or front matter that is not YAML', () => {
    expect(readRelatorio('# Relatório\n\nsem front matter', CAMINHO)).toEqual({
      ok: false,
      campo: 'front-matter'
    })
    expect(readRelatorio('---\nformato: [aberto\n---\n', CAMINHO)).toEqual({
      ok: false,
      campo: 'front-matter'
    })
    expect(readRelatorio('---\n- uma\n- lista\n---\n', CAMINHO)).toEqual({
      ok: false,
      campo: 'front-matter'
    })
  })

  it('reads an empty ranking, a missing model and a Dor with no screen', () => {
    const frente = frenteValida({ geradoPor: { agente: 'Devin' } }, { dores: 3 })
    const leitura = readRelatorio(relatorioTexto(frente, []), CAMINHO)
    expect(leitura.ok).toBe(true)
    if (!leitura.ok) return
    expect(leitura.relatorio.geradoPor).toEqual({ agente: 'Devin', modelo: null })
    expect(leitura.relatorio.dores[2].tela).toBeUndefined()
    expect(leitura.relatorio.narrativa).toEqual([])
    expect(readRelatorio(relatorioTexto(frenteValida({ dores: [] })), CAMINHO).ok).toBe(true)
  })

  it('takes a front matter written as JSON — YAML reads it too', () => {
    const text = `---\n${JSON.stringify(frenteValida())}\n---\nCorpo.`
    expect(readRelatorio(text, CAMINHO).ok).toBe(true)
  })
})

describe('the pieces', () => {
  it('folds each body block onto one line, one paragraph per block', () => {
    expect(paragraphs('Um\ndois.\n\n\nTrês.\r\n\r\nQuatro.  \n')).toEqual([
      'Um dois.',
      'Três.',
      'Quatro.'
    ])
  })

  it('names the front matter itself when it is not a map', () => {
    expect(invalidField(null)).toBe('front-matter')
    expect(invalidField(frenteValida())).toBeNull()
  })
})
