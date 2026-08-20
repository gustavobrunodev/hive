import { describe, expect, it } from 'vitest'
import { transcriptRuns } from './transcriptBackdrop'

describe('transcriptRuns', () => {
  it('returns one plain run when nothing has just arrived', () => {
    expect(transcriptRuns('uma frase', null)).toEqual([{ text: 'uma frase', fresh: false }])
  })

  it('marks exactly the range that landed', () => {
    expect(transcriptRuns('uma frase nova', [4, 9])).toEqual([
      { text: 'uma ', fresh: false },
      { text: 'frase', fresh: true },
      { text: ' nova', fresh: false }
    ])
  })

  it('marks a run that opens the field', () => {
    expect(transcriptRuns('olá mundo', [0, 3])).toEqual([
      { text: 'olá', fresh: true },
      { text: ' mundo', fresh: false }
    ])
  })

  it('marks a run that closes the field', () => {
    expect(transcriptRuns('olá mundo', [4, 9])).toEqual([
      { text: 'olá ', fresh: false },
      { text: 'mundo', fresh: true }
    ])
  })

  /**
   * The case that actually happens: a segment lands, and before the 600 ms mark
   * expires the user deletes part of what was there. The range now points past
   * the end of the string.
   */
  it('clamps a range the value has outgrown instead of slicing past the end', () => {
    expect(transcriptRuns('olá', [1, 99])).toEqual([
      { text: 'o', fresh: false },
      { text: 'lá', fresh: true }
    ])
    expect(transcriptRuns('olá', [50, 99])).toEqual([{ text: 'olá', fresh: false }])
  })

  it('treats an inverted range as empty rather than reversing the slice', () => {
    expect(transcriptRuns('olá mundo', [7, 2])).toEqual([
      { text: 'olá mun', fresh: false },
      { text: 'do', fresh: false }
    ])
  })

  it('always renders one run, so an empty field stays aligned', () => {
    expect(transcriptRuns('', null)).toEqual([{ text: '', fresh: false }])
    expect(transcriptRuns('', [0, 0])).toEqual([{ text: '', fresh: false }])
  })

  it('reproduces the value exactly — the mirror must not drift from the field', () => {
    for (const range of [null, [0, 0], [0, 5], [3, 8], [8, 8], [2, 99]] as const) {
      const value = 'texto com acentuação e emoji 🎙 no meio'
      const joined = transcriptRuns(value, range as never)
        .map((run) => run.text)
        .join('')
      expect(joined).toBe(value)
    }
  })
})
