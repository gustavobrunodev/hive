// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRecentQuestions, MAX_RECENT_QUESTIONS, rememberQuestion } from './askHistory'

const KEY = 'hive.brainQuestions'

describe('askHistory (SB-R9.4)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts empty and returns what was asked, newest first', () => {
    expect(loadRecentQuestions('/ws')).toEqual([])

    rememberQuestion('/ws', 'Como funciona o gate?')
    rememberQuestion('/ws', 'Quem cuida do deploy?')

    expect(loadRecentQuestions('/ws')).toEqual(['Quem cuida do deploy?', 'Como funciona o gate?'])
  })

  it('re-asking moves a question to the top instead of duplicating it, ignoring case', () => {
    rememberQuestion('/ws', 'Como funciona o gate?')
    rememberQuestion('/ws', 'Outra coisa')
    rememberQuestion('/ws', 'COMO FUNCIONA O GATE?')

    expect(loadRecentQuestions('/ws')).toEqual(['COMO FUNCIONA O GATE?', 'Outra coisa'])
  })

  it('trims, and refuses to remember an empty question', () => {
    rememberQuestion('/ws', '  Pergunta com espaços  ')
    expect(loadRecentQuestions('/ws')).toEqual(['Pergunta com espaços'])

    expect(rememberQuestion('/ws', '   ')).toEqual(['Pergunta com espaços'])
  })

  it('keeps only the last few', () => {
    for (let i = 0; i < MAX_RECENT_QUESTIONS + 4; i += 1) rememberQuestion('/ws', `Pergunta ${i}`)

    const recents = loadRecentQuestions('/ws')
    expect(recents).toHaveLength(MAX_RECENT_QUESTIONS)
    expect(recents[0]).toBe(`Pergunta ${MAX_RECENT_QUESTIONS + 3}`)
  })

  it('keeps each workspace’s memory separate', () => {
    rememberQuestion('/a', 'Pergunta de A')
    rememberQuestion('/b', 'Pergunta de B')

    expect(loadRecentQuestions('/a')).toEqual(['Pergunta de A'])
    expect(loadRecentQuestions('/b')).toEqual(['Pergunta de B'])
  })

  it('treats corrupt or hand-edited storage as no history', () => {
    localStorage.setItem(KEY, '{ not json')
    expect(loadRecentQuestions('/ws')).toEqual([])

    localStorage.setItem(KEY, JSON.stringify({ '/ws': ['ok', 42, '', null] }))
    expect(loadRecentQuestions('/ws')).toEqual(['ok'])

    localStorage.setItem(KEY, JSON.stringify(['not', 'a', 'map']))
    expect(loadRecentQuestions('/ws')).toEqual([])
  })

  it('still returns the updated list when storage refuses the write (quota, private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(rememberQuestion('/ws', 'Pergunta')).toEqual(['Pergunta'])
  })
})
