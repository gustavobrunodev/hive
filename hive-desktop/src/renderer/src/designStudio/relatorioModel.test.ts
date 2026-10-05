import { describe, expect, it } from 'vitest'
import { relatorio } from './__tests__/fixtures'
import {
  capitalize,
  factsOf,
  formatDay,
  formatEvidenceDate,
  formatGeneratedAt,
  formatPeriod,
  relatorioOf,
  sameScreen,
  tiltFor,
  trendSigned,
  trendText,
  unidadeNota,
  visibleDores,
  weekLabel
} from './relatorioModel'
import { CATALOGO } from './__tests__/fixtures'
import { moduleDefaultAgent } from './model'
import {
  categoriesIn,
  dorWeeks,
  insightsOrder,
  lastWeeks,
  pct,
  recorteOf,
  weeksOf
} from './graficosModel'

/** The module's pure rules: how dates, numbers and the folha's facts are written, and the charts' recortes. */
describe('relatorioModel', () => {
  it('writes days, periods and generation times the Brazilian way', () => {
    expect(formatDay('2026-09-20')).toBe('20 set 2026')
    expect(formatDay('ontem')).toBe('ontem')
    expect(formatPeriod({ inicio: '2026-07-07', fim: '2026-10-04' })).toBe('7 jul a 4 out 2026')
    expect(formatPeriod({ inicio: '2025-12-01', fim: '2026-02-28' })).toBe(
      '1 dez 2025 a 28 fev 2026'
    )
    expect(formatPeriod({ inicio: 'x', fim: 'y' })).toBe('x a y')
    expect(formatGeneratedAt('não é data')).toBe('não é data')
    expect(formatGeneratedAt(new Date(2026, 8, 29, 8, 5).toISOString())).toBe('29 set 2026, 08:05')
    expect(formatEvidenceDate(undefined)).toBe('')
    expect(formatEvidenceDate('2026-09-23T10:42')).toBe('23 set 2026, 10:42')
    expect(weekLabel('2026-10-04', 0)).toBe('6 jul')
    expect(weekLabel('2026-10-04', 12)).toBe('28 set')
    expect(weekLabel('fim', 3)).toBe('4')
  })

  it('writes trends with and without a sign', () => {
    expect(trendText(14)).toBe('14%')
    expect(trendText(-3)).toBe('3%')
    expect(trendText(0)).toBe('estável')
    expect(trendSigned(14)).toBe('+14%')
    expect(trendSigned(-3)).toBe('−3%')
    expect(trendSigned(0)).toBe('estável')
    expect(capitalize('a nota')).toBe('A nota')
  })

  it('reads the facts a Voz or FullStory Dor lacks as zero or blank', () => {
    const voz = relatorio('Pix', 'voz', [{}])
    voz.dores[0].rechamada = undefined
    expect(factsOf(voz.dores[0], voz)[1]).toEqual({ valor: '0%', rotulo: 'ligam de novo' })
    const fs = relatorio('Pix', 'fullstory', [{}])
    fs.dores[0].sinal = undefined
    expect(factsOf(fs.dores[0], fs)[1]).toEqual({ valor: '', rotulo: 'sinal' })
  })

  it('finds a Relatório, a note’s unit, the same-screen Dores and a stable tilt', () => {
    const r = relatorio('Pix', 'likert', [{ tela: 'Valor' }, { tela: 'Valor' }])
    expect(relatorioOf(null, 'Pix', 'likert')).toBeNull()
    expect(relatorioOf([r], 'Pix', 'voz')).toBeNull()
    expect(unidadeNota(null, 'fullstory')).toBe('')
    expect(unidadeNota(CATALOGO, 'fullstory')).toBe('clientes')
    expect(
      sameScreen(visibleDores([r]), { relatorio: r.caminho, dor: 'likert-1' }, undefined)
    ).toEqual([])
    expect(
      sameScreen(visibleDores([r]), { relatorio: r.caminho, dor: 'likert-1' }, 'Valor')
    ).toHaveLength(1)
    expect(tiltFor(1, 'voz')).toBe(tiltFor(1, 'voz'))
    expect(tiltFor(1, 'voz')).not.toBe(tiltFor(2, 'voz'))
  })
})

describe('the module default agent (Unresolved 14)', () => {
  const ambos = [
    { id: 'claude-cli', available: true },
    { id: 'devin', available: true }
  ]
  it.each([
    ['claude-cli', ambos, 'claude-cli'],
    ['devin', ambos, 'devin'],
    [
      'github-copilot',
      [
        { id: 'claude-cli', available: false },
        { id: 'devin', available: true }
      ],
      'devin'
    ],
    ['github-copilot', ambos, 'claude-cli'],
    [null, [], 'claude-cli']
  ] as const)('Hive default %s → %s', (padrao, disponiveis, esperado) => {
    expect(moduleDefaultAgent(padrao, disponiveis, {}).id).toBe(esperado)
  })

  it('takes the model from that agent’s pin, and the name the person knows', () => {
    expect(moduleDefaultAgent('devin', [], { devin: { model: 'swe' } })).toEqual({
      id: 'devin',
      nome: 'Devin',
      modelo: 'swe'
    })
    expect(moduleDefaultAgent('claude-cli', [], {})).toEqual({
      id: 'claude-cli',
      nome: 'Claude',
      modelo: null
    })
  })
})

describe('graficosModel', () => {
  const r = relatorio('Câmbio', 'likert', [
    { categoria: 'a', volume: 400 },
    { categoria: 'b', volume: 300 }
  ])

  it('cuts windows of 13, 9 and 4 weeks', () => {
    expect([weeksOf(90), weeksOf(60), weeksOf(30)]).toEqual([13, 9, 4])
    expect(weeksOf(45 as never)).toBe(13)
    expect(lastWeeks([1, 2, 3, 4, 5], 2)).toEqual([4, 5])
    expect(pct(1, 0)).toBe(0)
  })

  it('reads a recorte with no data as zeros (Unresolved 13)', () => {
    const vazio = relatorio('Câmbio', 'likert', [], { categorias: [] })
    const recorte = recorteOf(vazio, 30, null, null)
    expect(recorte.categorias).toEqual([])
    expect(recorte.enfase).toBeUndefined()
    expect(recorte.serie).toEqual([])
    expect(recorte.total).toBe(0)
    expect(insightsOrder(recorte)).toEqual([])
  })

  it('scales a Dor with no weeks of its own by its share of the category', () => {
    const [a] = categoriesIn(r, 4)
    const dor = { ...r.dores[0], semanas: undefined }
    const semanas = dorWeeks(dor, a, 4)
    expect(semanas).toHaveLength(4)
    expect(dorWeeks(dor, undefined, 4)).toEqual([])
  })

  it('puts a filtered Dor’s category first in the insights, and ignores an unknown Dor', () => {
    const comDor = recorteOf(r, 90, 'likert-2', null)
    expect(comDor.enfase?.categoria.id).toBe('b')
    expect(insightsOrder(comDor)[0].categoria.id).toBe('b')
    expect(recorteOf(r, 90, 'nao-existe', null).dor).toBeNull()
  })
})
