import { describe, expect, it } from 'vitest'
import {
  extractMentions,
  filterMentionFiles,
  formatFileSize,
  highlightParts,
  insertMention,
  matchRanges,
  mentionQueryAt,
  mentionSegments,
  rankMentionFiles
} from './composerMentions'

describe('mentionQueryAt', () => {
  it('opens on a leading @ and tracks the query up to the caret', () => {
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQueryAt('@prd', 4)).toEqual({ start: 0, query: 'prd' })
  })

  it('opens on an @ after whitespace, mid-message', () => {
    expect(mentionQueryAt('veja @docs/pr', 13)).toEqual({ start: 5, query: 'docs/pr' })
    expect(mentionQueryAt('linha um\n@arq', 13)).toEqual({ start: 9, query: 'arq' })
  })

  it('does not open mid-word, after a closed token, or when the caret left the token', () => {
    expect(mentionQueryAt('c@', 2)).toBeNull()
    expect(mentionQueryAt('@docs/prd.md e mais', 19)).toBeNull()
    // caret before the @ sees no token
    expect(mentionQueryAt('oi @a', 2)).toBeNull()
  })

  it('leaves e-mail addresses alone (the @ is not preceded by whitespace)', () => {
    expect(mentionQueryAt('escreva para contato@exemplo.com', 32)).toBeNull()
  })

  it('does not reopen on a double sigil', () => {
    expect(mentionQueryAt('@@', 2)).toBeNull()
  })

  it('still opens on a # in prose — the old sigil is inert now', () => {
    expect(mentionQueryAt('veja #docs', 10)).toBeNull()
  })
})

describe('insertMention', () => {
  it('replaces the open token with @path plus a trailing space and places the caret after it', () => {
    const result = insertMention(
      'veja @pr por favor'.slice(0, 8),
      { start: 5, query: 'pr' },
      8,
      'docs/prd.md'
    )
    expect(result.value).toBe('veja @docs/prd.md ')
    expect(result.caret).toBe('veja @docs/prd.md '.length)
  })

  it('preserves text after the caret', () => {
    const result = insertMention('antes @q depois', { start: 6, query: 'q' }, 8, 'a.txt')
    expect(result.value).toBe('antes @a.txt  depois')
  })
})

describe('matchRanges', () => {
  it('reports a substring hit as one contiguous run', () => {
    expect(matchRanges('docs/prd.md', 'prd')).toEqual([{ start: 5, end: 8 }])
  })

  it('is case- and accent-insensitive, with offsets into the original label', () => {
    expect(matchRanges('Ação.md', 'ACAO')).toEqual([{ start: 0, end: 4 }])
    expect(matchRanges('README.md', 'readme')).toEqual([{ start: 0, end: 6 }])
  })

  it('reports the fuzzy subsequence positions, merging adjacent characters', () => {
    expect(matchRanges('src/renderer/app.tsx', 'srapp')).toEqual([
      { start: 0, end: 2 },
      { start: 13, end: 16 }
    ])
  })

  it('reports nothing for an empty query or a label the query does not match', () => {
    expect(matchRanges('docs/prd.md', '')).toEqual([])
    expect(matchRanges('docs/prd.md', 'zzz')).toEqual([])
  })
})

describe('filterMentionFiles', () => {
  const files = [
    'README.md',
    'docs/prd.md',
    'docs/nested/prd-notes.md',
    'docs/meu-prd.md',
    'src/main/index.ts',
    'src/renderer/app.tsx'
  ]

  it('empty query lists shallow files first, capped', () => {
    const result = filterMentionFiles(files, '', 3)
    expect(result[0]).toBe('README.md')
    expect(result).toHaveLength(3)
  })

  it('ranks basename prefix over substring over path matches', () => {
    const ranked = filterMentionFiles(files, 'prd')
    expect(ranked[0]).toBe('docs/prd.md')
    expect(ranked).toContain('docs/nested/prd-notes.md')
    // `meu-prd.md` only *contains* the query, so it ranks under both prefixes.
    expect(ranked.indexOf('docs/meu-prd.md')).toBeGreaterThan(
      ranked.indexOf('docs/nested/prd-notes.md')
    )
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

describe('highlightParts', () => {
  it('splits one line into matched and unmatched runs', () => {
    expect(highlightParts('prd.md', [{ start: 0, end: 3 }])).toEqual([
      { text: 'prd', match: true },
      { text: '.md', match: false }
    ])
  })

  it('clips ranges to the slice, using the slice offset into the full path', () => {
    // `docs/prd.md` matched at 5..8; the file-name slice starts at 5.
    expect(highlightParts('prd.md', [{ start: 5, end: 8 }], 5)).toEqual([
      { text: 'prd', match: true },
      { text: '.md', match: false }
    ])
    // The same ranges against the directory slice highlight nothing.
    expect(highlightParts('docs', [{ start: 5, end: 8 }], 0)).toEqual([
      { text: 'docs', match: false }
    ])
  })

  it('splits a fuzzy match across the slash exactly where it landed', () => {
    const path = 'src/renderer/app.tsx'
    const ranges = matchRanges(path, 'srapp')
    expect(highlightParts('src/renderer', ranges)).toEqual([
      { text: 'sr', match: true },
      { text: 'c/renderer', match: false }
    ])
    expect(highlightParts('app.tsx', ranges, 13)).toEqual([
      { text: 'app', match: true },
      { text: '.tsx', match: false }
    ])
  })

  it('returns the whole text as one unmatched run when nothing matched', () => {
    expect(highlightParts('prd.md', [])).toEqual([{ text: 'prd.md', match: false }])
  })

  it('emits no trailing empty run when the match reaches the end of the text', () => {
    expect(highlightParts('prd', [{ start: 0, end: 3 }])).toEqual([{ text: 'prd', match: true }])
  })

  it('always reassembles the exact input', () => {
    const path = 'docs/nested/prd-notes.md'
    const joined = highlightParts(path, matchRanges(path, 'dnpn'))
      .map((part) => part.text)
      .join('')
    expect(joined).toBe(path)
  })
})

describe('rankMentionFiles', () => {
  it('reports every match, not just the page it returns', () => {
    const files = ['a/prd.md', 'b/prd.md', 'c/prd.md', 'd/prd.md']
    expect(rankMentionFiles(files, 'prd', 2)).toEqual({
      items: ['a/prd.md', 'b/prd.md'],
      total: 4
    })
  })
})

describe('mentionSegments / extractMentions', () => {
  const known = new Set(['docs/prd.md', 'a.txt'])

  it('marks only tokens that reference real workspace files', () => {
    const segments = mentionSegments('veja @docs/prd.md e @fulano', known)
    expect(segments).toEqual([
      { text: 'veja ', mention: false },
      { text: '@docs/prd.md', mention: true },
      { text: ' e @fulano', mention: false }
    ])
  })

  it('leaves an e-mail address unmarked even when its domain names a file', () => {
    const segments = mentionSegments('contato@a.txt agora', new Set(['a.txt']))
    expect(segments).toEqual([{ text: 'contato@a.txt agora', mention: false }])
  })

  it('emits no trailing empty run when the value ends on a mention', () => {
    expect(mentionSegments('@a.txt', known)).toEqual([{ text: '@a.txt', mention: true }])
  })

  // A combining mark folds to nothing of its own; `normalize` must still hand
  // back a string of the same length, or every match offset after it is wrong.
  // Spelled with an escape because the decomposed and precomposed forms of
  // "á" are indistinguishable in an editor and have different lengths.
  it('keeps offsets aligned across a character that folds away entirely', () => {
    const decomposed = 'a\u0301bc'
    expect(decomposed).toHaveLength(4)
    expect(matchRanges(decomposed, 'bc')).toEqual([{ start: 2, end: 4 }])
  })

  it('segments always reassemble the exact input (backdrop alignment contract)', () => {
    const value = 'a @a.txt\n@docs/prd.md fim @nada'
    const joined = mentionSegments(value, known)
      .map((segment) => segment.text)
      .join('')
    expect(joined).toBe(value)
  })

  it('extractMentions returns unique valid paths in order of appearance', () => {
    const refs = extractMentions('@a.txt olha @docs/prd.md de novo @a.txt @fake', known)
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
