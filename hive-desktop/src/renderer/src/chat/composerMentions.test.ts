import { describe, expect, it } from 'vitest'
import {
  extractMentions,
  filterMentionFiles,
  formatFileSize,
  insertMention,
  mentionQueryAt,
  mentionSegments
} from './composerMentions'

describe('mentionQueryAt', () => {
  it('opens on a leading # and tracks the query up to the caret', () => {
    expect(mentionQueryAt('#', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQueryAt('#prd', 4)).toEqual({ start: 0, query: 'prd' })
  })

  it('opens on a # after whitespace, mid-message', () => {
    expect(mentionQueryAt('veja #docs/pr', 13)).toEqual({ start: 5, query: 'docs/pr' })
    expect(mentionQueryAt('linha um\n#arq', 13)).toEqual({ start: 9, query: 'arq' })
  })

  it('does not open mid-word (c#), after a closed token, or when the caret left the token', () => {
    expect(mentionQueryAt('c#', 2)).toBeNull()
    expect(mentionQueryAt('#docs/prd.md e mais', 19)).toBeNull()
    // caret before the # sees no token
    expect(mentionQueryAt('oi #a', 2)).toBeNull()
  })

  it('does not reopen on a double hash', () => {
    expect(mentionQueryAt('##', 2)).toBeNull()
  })
})

describe('insertMention', () => {
  it('replaces the open token with #path plus a trailing space and places the caret after it', () => {
    const result = insertMention(
      'veja #pr por favor'.slice(0, 8),
      { start: 5, query: 'pr' },
      8,
      'docs/prd.md'
    )
    expect(result.value).toBe('veja #docs/prd.md ')
    expect(result.caret).toBe('veja #docs/prd.md '.length)
  })

  it('preserves text after the caret', () => {
    const result = insertMention('antes #q depois', { start: 6, query: 'q' }, 8, 'a.txt')
    expect(result.value).toBe('antes #a.txt  depois')
  })
})

describe('filterMentionFiles', () => {
  const files = [
    'README.md',
    'docs/prd.md',
    'docs/nested/prd-notes.md',
    'src/main/index.ts',
    'src/renderer/app.tsx'
  ]

  it('empty query lists shallow files first, capped', () => {
    const result = filterMentionFiles(files, '', 3)
    expect(result[0]).toBe('README.md')
    expect(result).toHaveLength(3)
  })

  it('ranks basename prefix over substring over path matches', () => {
    expect(filterMentionFiles(files, 'prd')[0]).toBe('docs/prd.md')
    expect(filterMentionFiles(files, 'prd')).toContain('docs/nested/prd-notes.md')
  })

  it('matches path substrings and fuzzy subsequences, case-insensitively', () => {
    expect(filterMentionFiles(files, 'main')).toContain('src/main/index.ts')
    expect(filterMentionFiles(files, 'srapp')).toContain('src/renderer/app.tsx')
    expect(filterMentionFiles(files, 'readme')).toContain('README.md')
  })

  it('returns nothing for a query with no match', () => {
    expect(filterMentionFiles(files, 'zzz-inexistente')).toEqual([])
  })
})

describe('mentionSegments / extractMentions', () => {
  const known = new Set(['docs/prd.md', 'a.txt'])

  it('marks only tokens that reference real workspace files', () => {
    const segments = mentionSegments('veja #docs/prd.md e #hashtag', known)
    expect(segments).toEqual([
      { text: 'veja ', mention: false },
      { text: '#docs/prd.md', mention: true },
      { text: ' e #hashtag', mention: false }
    ])
  })

  it('segments always reassemble the exact input (backdrop alignment contract)', () => {
    const value = 'a #a.txt\n#docs/prd.md fim #nada'
    const joined = mentionSegments(value, known)
      .map((segment) => segment.text)
      .join('')
    expect(joined).toBe(value)
  })

  it('extractMentions returns unique valid paths in order of appearance', () => {
    const refs = extractMentions('#a.txt olha #docs/prd.md de novo #a.txt #fake', known)
    expect(refs).toEqual(['a.txt', 'docs/prd.md'])
  })
})

describe('formatFileSize', () => {
  it('formats bytes, KB and MB compactly', () => {
    expect(formatFileSize(640)).toBe('640 B')
    expect(formatFileSize(2355)).toBe('2,3 KB')
    expect(formatFileSize(1_258_291)).toBe('1,2 MB')
    expect(formatFileSize(150 * 1024)).toBe('150 KB')
  })
})
