import { describe, expect, it } from 'vitest'
import { fonteName, fonteOfPath, recentConversations, RECENTES_LIMIT, salutation } from './model'
import { HOME_ROUTE, isOpenConversation, navSection, type DesignRoute } from './routes'

describe('recentConversations', () => {
  const rows = [5, 1, 9, 3, 7, 2, 8, 4, 6].map((n) => ({ id: `c${n}`, updatedAt: n }))

  it('keeps the seven most recently updated, newest first', () => {
    expect(RECENTES_LIMIT).toBe(7)
    expect(recentConversations(rows).map((row) => row.id)).toEqual([
      'c9',
      'c8',
      'c7',
      'c6',
      'c5',
      'c4',
      'c3'
    ])
  })

  it('lists fewer when there are fewer, and none when there are none', () => {
    expect(recentConversations(rows.slice(0, 2)).map((row) => row.id)).toEqual(['c5', 'c1'])
    expect(recentConversations([])).toEqual([])
  })

  it('leaves the listing it was handed untouched', () => {
    const copy = rows.map((row) => row.id)
    recentConversations(rows)
    expect(rows.map((row) => row.id)).toEqual(copy)
  })
})

describe('salutation', () => {
  it.each([
    [0, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [23, 'Boa noite']
  ])('at %i h says "%s"', (hour, expected) => {
    expect(salutation(hour)).toBe(expected)
  })
})

describe('fonteOfPath', () => {
  it.each([
    ['Câmbio/relatorios/likert/2026-10-04-90d.md', 'likert'],
    ['Pix/relatorios/voz/2026-10-04-90d-2.md', 'voz'],
    ['Extrato\\relatorios\\fullstory\\2026-10-04-90d.md', 'fullstory']
  ])('reads the Fonte folder of %s', (path, fonte) => {
    expect(fonteOfPath(path)).toBe(fonte)
  })

  it.each([
    'Pix/outra-coisa.md',
    'Pix/relatorios/likert',
    'Pix/prototipos/likert/a.md',
    'Pix/relatorios/athena/a.md'
  ])('names no Fonte for %s', (path) => {
    expect(fonteOfPath(path)).toBeNull()
  })

  it('gives each Fonte its display name', () => {
    expect([fonteName('likert'), fonteName('voz'), fonteName('fullstory')]).toEqual([
      'Likert',
      'Voz do Cliente',
      'FullStory'
    ])
  })
})

describe('routes', () => {
  it('opens on the home', () => {
    expect(HOME_ROUTE).toEqual({ pagina: 'inicio' })
  })

  it.each<[DesignRoute, string | null]>([
    [{ pagina: 'inicio' }, 'inicio'],
    [{ pagina: 'dores' }, 'dores'],
    [{ pagina: 'relatorios' }, 'relatorios'],
    [{ pagina: 'relatorio', relatorio: 'Pix/relatorios/voz/a.md' }, 'relatorios'],
    [{ pagina: 'conversa', produto: 'Pix', conversa: 'c1' }, null]
  ])('marks the navigation item for %j', (route, section) => {
    expect(navSection(route)).toBe(section)
  })

  it('identifies an open conversation by Produto and id together', () => {
    const route: DesignRoute = { pagina: 'conversa', produto: 'Pix', conversa: 'c1' }
    expect(isOpenConversation(route, 'Pix', 'c1')).toBe(true)
    expect(isOpenConversation(route, 'Câmbio', 'c1')).toBe(false)
    expect(isOpenConversation(route, 'Pix', 'c2')).toBe(false)
    expect(isOpenConversation({ pagina: 'inicio' }, 'Pix', 'c1')).toBe(false)
  })
})
