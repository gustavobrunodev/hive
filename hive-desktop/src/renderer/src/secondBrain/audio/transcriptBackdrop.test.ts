import { describe, expect, it } from 'vitest'
import { transcriptRuns } from './transcriptBackdrop'

describe('transcriptRuns', () => {
  it('returns one plain run when nothing has just arrived', () => {
    expect(transcriptRuns('uma frase', null)).toEqual([
      { text: 'uma frase', fresh: false, preview: false }
    ])
  })

  it('marks exactly the range that landed', () => {
    expect(transcriptRuns('uma frase nova', [4, 9])).toEqual([
      { text: 'uma ', fresh: false, preview: false },
      { text: 'frase', fresh: true, preview: false },
      { text: ' nova', fresh: false, preview: false }
    ])
  })

  it('marks a run that opens the field', () => {
    expect(transcriptRuns('olá mundo', [0, 3])).toEqual([
      { text: 'olá', fresh: true, preview: false },
      { text: ' mundo', fresh: false, preview: false }
    ])
  })

  it('marks a run that closes the field', () => {
    expect(transcriptRuns('olá mundo', [4, 9])).toEqual([
      { text: 'olá ', fresh: false, preview: false },
      { text: 'mundo', fresh: true, preview: false }
    ])
  })

  /**
   * The case that actually happens: a segment lands, and before the 600 ms mark
   * expires the user deletes part of what was there. The range now points past
   * the end of the string.
   */
  it('clamps a range the value has outgrown instead of slicing past the end', () => {
    expect(transcriptRuns('olá', [1, 99])).toEqual([
      { text: 'o', fresh: false, preview: false },
      { text: 'lá', fresh: true, preview: false }
    ])
    expect(transcriptRuns('olá', [50, 99])).toEqual([{ text: 'olá', fresh: false, preview: false }])
  })

  it('treats an inverted range as marking nothing rather than reversing the slice', () => {
    const runs = transcriptRuns('olá mundo', [7, 2])
    expect(runs.map((run) => run.text).join('')).toBe('olá mundo')
    expect(runs.every((run) => !run.fresh && !run.preview)).toBe(true)
  })

  it('always renders one run, so an empty field stays aligned', () => {
    expect(transcriptRuns('', null)).toEqual([{ text: '', fresh: false, preview: false }])
    expect(transcriptRuns('', [0, 0])).toEqual([{ text: '', fresh: false, preview: false }])
  })

  // VP-R2.9: the run a live pass is still revising. It reads differently from
  // `fresh` because it means the opposite thing — not "this arrived" but "this
  // has not arrived yet".
  describe('the provisional run', () => {
    it('marks the text the live pass is still revising', () => {
      expect(transcriptRuns('já escrito falando agora', null, [11, 24])).toEqual([
        { text: 'já escrito ', fresh: false, preview: false },
        { text: 'falando agora', fresh: false, preview: true }
      ])
    })

    it('cuts independently of the freshly-landed run', () => {
      expect(transcriptRuns('landed provisorio', [0, 6], [7, 17])).toEqual([
        { text: 'landed', fresh: true, preview: false },
        { text: ' ', fresh: false, preview: false },
        { text: 'provisorio', fresh: false, preview: true }
      ])
    })

    it('is clamped like any other range', () => {
      expect(transcriptRuns('curto', null, [2, 99])).toEqual([
        { text: 'cu', fresh: false, preview: false },
        { text: 'rto', fresh: false, preview: true }
      ])
    })
  })

  it('reproduces the value exactly — the mirror must not drift from the field', () => {
    const ranges = [null, [0, 0], [0, 5], [3, 8], [8, 8], [2, 99]] as const
    for (const range of ranges) {
      for (const preview of ranges) {
        const value = 'texto com acentuação e emoji 🎙 no meio'
        const joined = transcriptRuns(value, range as never, preview as never)
          .map((run) => run.text)
          .join('')
        expect(joined).toBe(value)
      }
    }
  })
})
