import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SORT,
  DEFAULT_WINDOW,
  INITIATIVE_ALL,
  INITIATIVE_NONE,
  filterByInitiative,
  filterByWindow,
  groupTimestamp,
  groupsFor,
  isActivityWindow,
  isConversationSort,
  sortConversations,
  sortLabel,
  windowFloor,
  windowLabel
} from './conversationFilters'
import type { ChatSessionMeta } from './sessionMeta'

/**
 * The conversation list's lens (nav-redesign) — the filter and the order, as
 * pure functions. Both surfaces that list conversations share these, so a bug
 * here is a bug in two places at once.
 */
const DAY = 86_400_000

/** Noon, so a `setHours(0,0,0,0)` day boundary is unambiguous whatever the runner's TZ. */
const NOON = new Date(2026, 8, 7, 12, 0, 0, 0).getTime()

function meta(overrides: Partial<ChatSessionMeta>): ChatSessionMeta {
  return {
    id: 'a',
    title: 'Conversa',
    createdAt: NOON,
    updatedAt: NOON,
    messageCount: 1,
    agent: 'claude-cli',
    preview: '',
    ...overrides
  }
}

describe('conversationFilters — the activity window', () => {
  it('defaults to showing everything, in last-activity order', () => {
    // A filter that starts narrow reads as data loss on first open.
    expect(DEFAULT_WINDOW).toBe('all')
    expect(DEFAULT_SORT).toBe('activity')
  })

  it('"Todos" has no floor at all', () => {
    expect(windowFloor('all', NOON)).toBeNull()
  })

  it('cuts on calendar days, so "1 dia" means "Hoje"', () => {
    const startOfToday = new Date(NOON)
    startOfToday.setHours(0, 0, 0, 0)
    expect(windowFloor('1d', NOON)).toBe(startOfToday.getTime())
    // 7 days ends exactly where the "Últimos 7 dias" heading ends (today − 6),
    // and 30 where "Últimos 30 dias" does (today − 29). If these drift, the
    // list hides a row under a heading that says it should be there.
    expect(windowFloor('7d', NOON)).toBe(startOfToday.getTime() - 6 * DAY)
    expect(windowFloor('30d', NOON)).toBe(startOfToday.getTime() - 29 * DAY)
  })

  it('keeps only the conversations inside the window', () => {
    const sessions = [
      meta({ id: 'today', updatedAt: NOON }),
      meta({ id: 'two-days', updatedAt: NOON - 2 * DAY }),
      meta({ id: 'ten-days', updatedAt: NOON - 10 * DAY })
    ]
    expect(filterByWindow(sessions, '1d', NOON).map((s) => s.id)).toEqual(['today'])
    expect(filterByWindow(sessions, '3d', NOON).map((s) => s.id)).toEqual(['today', 'two-days'])
    expect(filterByWindow(sessions, '30d', NOON).map((s) => s.id)).toEqual([
      'today',
      'two-days',
      'ten-days'
    ])
    expect(filterByWindow(sessions, 'all', NOON)).toHaveLength(3)
  })

  it('never mutates the caller’s array (it is React state)', () => {
    const sessions = [meta({ id: 'a' })]
    expect(filterByWindow(sessions, 'all', NOON)).not.toBe(sessions)
  })
})

describe('conversationFilters — the order', () => {
  const sessions = [
    meta({ id: 'b', title: 'épico 2', createdAt: NOON - 5 * DAY, updatedAt: NOON - 1 * DAY }),
    meta({ id: 'c', title: 'Epico 10', createdAt: NOON - 1 * DAY, updatedAt: NOON - 5 * DAY }),
    meta({ id: 'a', title: 'Alfa', createdAt: NOON - 3 * DAY, updatedAt: NOON - 3 * DAY })
  ]

  it('orders by last activity, newest first', () => {
    expect(sortConversations(sessions, 'activity').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it('orders by creation, newest first', () => {
    expect(sortConversations(sessions, 'created').map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('orders by name accent- and case-insensitively, with numbers read as numbers', () => {
    // "épico 2" before "Epico 10": a code-point sort would put É after E and 10
    // before 2, which is two different kinds of wrong in one comparison.
    expect(sortConversations(sessions, 'name').map((s) => s.title)).toEqual([
      'Alfa',
      'épico 2',
      'Epico 10'
    ])
  })

  it('falls back to the id so equal rows never shuffle between renders', () => {
    const tied = [
      meta({ id: 'z', title: 'Igual' }),
      meta({ id: 'a', title: 'Igual' }),
      meta({ id: 'm', title: 'Igual' })
    ]
    expect(sortConversations(tied, 'name').map((s) => s.id)).toEqual(['a', 'm', 'z'])
    expect(sortConversations(tied, 'activity').map((s) => s.id)).toEqual(['a', 'm', 'z'])
  })

  it('untitled conversations sort under their fallback label, not under empty string', () => {
    const list = [meta({ id: 'a', title: 'Zebra' }), meta({ id: 'b', title: '' })]
    // "Conversa sem título" < "Zebra", so the untitled one leads — an empty
    // string would have sorted it first for the wrong reason.
    expect(sortConversations(list, 'name').map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('drops the recency headings for name order only', () => {
    expect(groupsFor('activity')).toBe(true)
    expect(groupsFor('created')).toBe(true)
    // "Hoje" over an alphabetical list is a heading that lies about why the
    // rows are next to each other.
    expect(groupsFor('name')).toBe(false)
  })

  it('cuts the headings on the timestamp the list is sorted by', () => {
    // Otherwise a heading contradicts the order the control says is in force:
    // grouped by last activity while sorted by creation date, a conversation
    // created minutes ago but untouched for a week renders *below* an older one
    // that was replied to this morning.
    const entry = meta({ createdAt: NOON - 5 * DAY, updatedAt: NOON })
    expect(groupTimestamp(entry, 'activity')).toBe(NOON)
    expect(groupTimestamp(entry, 'created')).toBe(NOON - 5 * DAY)
  })
})

describe('conversationFilters — labels and guards', () => {
  it('names every window and order', () => {
    expect(windowLabel('1d')).toBe('1 dia')
    expect(windowLabel('3d')).toBe('3 dias')
    expect(windowLabel('7d')).toBe('7 dias')
    expect(windowLabel('30d')).toBe('30 dias')
    expect(windowLabel('all')).toBe('Todos')
    expect(sortLabel('name')).toBe('Nome')
    expect(sortLabel('created')).toBe('Recém-criadas')
    expect(sortLabel('activity')).toBe('Última atividade')
  })

  it('guards the values that arrive as strings from a menu', () => {
    expect(isActivityWindow('7d')).toBe(true)
    expect(isActivityWindow('7 dias')).toBe(false)
    expect(isActivityWindow(7)).toBe(false)
    expect(isConversationSort('name')).toBe(true)
    expect(isConversationSort('nome')).toBe(false)
    expect(isConversationSort(null)).toBe(false)
  })
})

describe('filterByInitiative', () => {
  const rows = [
    meta({ id: 'a', initiativePath: 'docs/iniciativas/R1/testes' }),
    meta({ id: 'b', initiativePath: 'docs/iniciativas/R2/portal' }),
    meta({ id: 'c' }),
    meta({ id: 'd', initiativePath: null })
  ]

  it('keeps everything by default, so a surface that never sets it is unchanged', () => {
    expect(filterByInitiative(rows, INITIATIVE_ALL).map((row) => row.id)).toEqual([
      'a',
      'b',
      'c',
      'd'
    ])
  })

  it('narrows to one demand', () => {
    expect(filterByInitiative(rows, 'docs/iniciativas/R1/testes').map((row) => row.id)).toEqual([
      'a'
    ])
  })

  it('treats "no demand" as a real answer, not an absence', () => {
    // Both shapes of "none" — the field missing entirely (a conversation from
    // before the tag existed) and an explicit null.
    expect(filterByInitiative(rows, INITIATIVE_NONE).map((row) => row.id)).toEqual(['c', 'd'])
  })

  it('never hands back the caller’s array, which is React state', () => {
    expect(filterByInitiative(rows, INITIATIVE_ALL)).not.toBe(rows)
  })
})
