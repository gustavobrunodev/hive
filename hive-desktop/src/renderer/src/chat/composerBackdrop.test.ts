import { describe, expect, it } from 'vitest'
import { composerBackdrop, type BackdropSegment } from './composerBackdrop'

const FILES = new Set(['docs/prd.md', 'src/main.ts'])

/** What the backdrop actually renders, joined — the alignment contract. */
function rendered(segments: BackdropSegment[]): string {
  return segments.map((segment) => segment.text).join('')
}

function marked(segments: BackdropSegment[], flag: 'mention' | 'fresh'): string {
  return segments
    .filter((segment) => segment[flag])
    .map((segment) => segment.text)
    .join('')
}

describe('composerBackdrop', () => {
  it('marks a mention when nothing was just dictated', () => {
    const segments = composerBackdrop('revisa @docs/prd.md agora', FILES, null)
    expect(marked(segments, 'mention')).toBe('@docs/prd.md')
    expect(marked(segments, 'fresh')).toBe('')
  })

  it('marks exactly the run a segment landed in', () => {
    const value = 'revisa o arquivo'
    const segments = composerBackdrop(value, FILES, [9, 16])
    expect(marked(segments, 'fresh')).toBe('arquivo')
  })

  it('splits a mention token when the fresh run cuts across it', () => {
    // Dictation landed mid-token — the mark follows the characters, not the
    // token they happen to sit in.
    const value = 'veja @docs/prd.md'
    const segments = composerBackdrop(value, FILES, [5, 11])
    expect(marked(segments, 'fresh')).toBe('@docs/')
    // The whole token is still a mention, across both pieces.
    expect(marked(segments, 'mention')).toBe('@docs/prd.md')
  })

  it('carries both flags on a run that is a mention AND freshly inserted', () => {
    const value = 'veja @docs/prd.md'
    const segments = composerBackdrop(value, FILES, [5, 17])
    const both = segments.filter((segment) => segment.mention && segment.fresh)
    expect(both.map((segment) => segment.text).join('')).toBe('@docs/prd.md')
  })

  it('marks a fresh run that spans several mentions and the text between them', () => {
    const value = 'a @docs/prd.md b @src/main.ts c'
    const segments = composerBackdrop(value, FILES, [0, value.length])
    expect(marked(segments, 'fresh')).toBe(value)
    expect(marked(segments, 'mention')).toBe('@docs/prd.md@src/main.ts')
  })

  // The contract the prop itself documents: drift misaligns every highlight
  // after it, and nothing on screen says so — only this assertion can.
  it('reproduces the value character for character, in every configuration', () => {
    const values = [
      '',
      'sem marcações',
      'revisa @docs/prd.md agora',
      '@docs/prd.md',
      'acentuação e emoji 🐝 no meio',
      'quebra\nde linha @src/main.ts\nfim',
      '  espaços  duplos  ',
      '@naoexiste fica texto puro'
    ]
    const ranges: (readonly [number, number] | null)[] = [
      null,
      [0, 0],
      [0, 1],
      [2, 7],
      [5, 11],
      [0, 999],
      [-5, 3]
    ]

    for (const value of values) {
      for (const range of ranges) {
        expect(rendered(composerBackdrop(value, FILES, range)), `${value} / ${range}`).toBe(value)
      }
    }
  })

  it('never emits an empty run, except as the single run of an empty composer', () => {
    const segments = composerBackdrop('abc', FILES, [0, 3])
    expect(segments.every((segment) => segment.text !== '')).toBe(true)

    const empty = composerBackdrop('', FILES, null)
    expect(empty).toEqual([{ text: '', mention: false, fresh: false, preview: false }])
  })

  // A transcription resolves asynchronously; the user may have edited or
  // cleared the field in between. A stale range must mark less, never shift.
  it('clamps a stale range instead of trusting it', () => {
    const value = 'curto'
    expect(marked(composerBackdrop(value, FILES, [2, 900]), 'fresh')).toBe('rto')
    expect(marked(composerBackdrop(value, FILES, [-4, 2]), 'fresh')).toBe('cu')
    expect(marked(composerBackdrop(value, FILES, [900, 950]), 'fresh')).toBe('')
    // Empty and inverted ranges mark nothing at all.
    expect(marked(composerBackdrop(value, FILES, [3, 3]), 'fresh')).toBe('')
    expect(marked(composerBackdrop(value, FILES, [4, 1]), 'fresh')).toBe('')
  })

  it('leaves an unknown @token as plain text, fresh or not', () => {
    const segments = composerBackdrop('sobre @naoexiste', FILES, [6, 16])
    expect(marked(segments, 'mention')).toBe('')
    expect(marked(segments, 'fresh')).toBe('@naoexiste')
  })

  // VP-R2.9 — the provisional run dictation is still revising. It is a separate
  // flag, not a stronger `fresh`: one says text arrived, the other says it has
  // not, and the composer paints them differently for that reason.
  describe('the provisional run', () => {
    it('marks the run the live pass is revising, alongside the mentions', () => {
      const segments = composerBackdrop('veja @src/main.ts falando', FILES, null, [18, 25])
      expect(segments).toEqual([
        { text: 'veja ', mention: false, fresh: false, preview: false },
        { text: '@src/main.ts', mention: true, fresh: false, preview: false },
        { text: ' ', mention: false, fresh: false, preview: false },
        { text: 'falando', mention: false, fresh: false, preview: true }
      ])
    })

    it('cuts a mention token that a provisional run only partly covers', () => {
      // The mark follows characters, never the token they happen to sit in.
      const segments = composerBackdrop('@src/main.ts', FILES, null, [0, 4])
      expect(segments).toEqual([
        { text: '@src', mention: true, fresh: false, preview: true },
        { text: '/main.ts', mention: true, fresh: false, preview: false }
      ])
    })

    it('keeps the two marks independent when both are present', () => {
      const segments = composerBackdrop('landed guess', FILES, [0, 6], [7, 12])
      expect(segments).toEqual([
        { text: 'landed', mention: false, fresh: true, preview: false },
        { text: ' ', mention: false, fresh: false, preview: false },
        { text: 'guess', mention: false, fresh: false, preview: true }
      ])
    })

    it('still concatenates back to the value, with both marks in play', () => {
      const value = 'veja @src/main.ts e depois fale mais'
      const joined = composerBackdrop(value, FILES, [5, 17], [27, 36])
        .map((segment) => segment.text)
        .join('')
      expect(joined).toBe(value)
    })
  })
})
