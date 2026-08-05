import { describe, expect, it } from 'vitest'
import { joinTranscript } from './transcriptJoin'

/** Appends at the end of `value`, which is the common case. */
function append(value: string, text: string): ReturnType<typeof joinTranscript> {
  return joinTranscript(value, value.length, value.length, text)
}

describe('joinTranscript', () => {
  // One case per row of design.md §2's join table.
  it('capitalizes the first word of an empty composer', () => {
    expect(append('', 'olá')).toMatchObject({ value: 'Olá', caret: 3, range: [0, 3] })
  })

  it('does not double a space the user already typed', () => {
    expect(append('revisa o ', 'arquivo')).toMatchObject({ value: 'revisa o arquivo' })
  })

  it('inserts the missing space when the draft ends on a word', () => {
    const result = append('revisa o', 'arquivo')
    expect(result.value).toBe('revisa o arquivo')
    // The space is NOT part of the inserted run — the landing mark covers the
    // words that arrived, not the seam.
    expect(result.range).toEqual([9, 16])
    expect(result.caret).toBe(16)
  })

  it('starts a new sentence after a sentence-ending mark', () => {
    expect(append('feito.', 'agora vai')).toMatchObject({ value: 'feito. Agora vai' })
    expect(append('feito!', 'agora vai')).toMatchObject({ value: 'feito! Agora vai' })
    expect(append('feito?', 'agora vai')).toMatchObject({ value: 'feito? Agora vai' })
    expect(append('feito…', 'agora vai')).toMatchObject({ value: 'feito… Agora vai' })
    expect(append('(feito.)', 'agora vai')).toMatchObject({ value: '(feito.) Agora vai' })
    expect(append('feito. ', 'agora vai')).toMatchObject({ value: 'feito. Agora vai' })
  })

  it('does not start a sentence after an abbreviating comma or a plain word', () => {
    expect(append('feito,', 'agora vai')).toMatchObject({ value: 'feito, agora vai' })
    expect(append('feito', 'agora vai')).toMatchObject({ value: 'feito agora vai' })
  })

  it('never puts a space before punctuation', () => {
    expect(append('lista', ', e mais')).toMatchObject({ value: 'lista, e mais' })
    expect(append('pronto', '.')).toMatchObject({ value: 'pronto.' })
    expect(append('era 50', '%')).toMatchObject({ value: 'era 50%' })
  })

  it('replaces a selection rather than appending to it', () => {
    const result = joinTranscript('abc def', 0, 3, 'xyz')
    expect(result.value).toBe('Xyz def')
    expect(result.range).toEqual([0, 3])
    expect(result.caret).toBe(3)
  })

  it('keeps the text after the caret when dictating into the middle of a draft', () => {
    const result = joinTranscript('antes depois', 5, 5, 'no meio')
    expect(result.value).toBe('antes no meio depois')
    expect(result.caret).toBe(13)
    expect(result.value.slice(...result.range)).toBe('no meio')
  })

  it('spaces the right-hand seam too, instead of welding onto what follows', () => {
    const result = joinTranscript('depois', 0, 0, 'antes')
    expect(result.value).toBe('Antes depois')
    // The caret sits right after the words that arrived, in front of the space
    // added for the text that follows — so the next segment continues here.
    expect(result.caret).toBe(5)
    expect(result.value.slice(...result.range)).toBe('Antes')

    // Punctuation on the right still hugs, and existing whitespace is not doubled.
    expect(joinTranscript(', e mais', 0, 0, 'lista').value).toBe('Lista, e mais')
    expect(joinTranscript(' depois', 0, 0, 'antes').value).toBe('Antes depois')
  })

  it('treats a whitespace-only draft as an empty one', () => {
    const result = append('  ', 'olá')
    expect(result.value).toBe('  Olá')
    expect(result.range).toEqual([2, 5])
  })

  it('capitalizes an accented first letter without splitting it', () => {
    expect(append('', 'ótimo trabalho')).toMatchObject({ value: 'Ótimo trabalho' })
    // A leading astral character is one unit, not two surrogate halves.
    expect(append('', '🐝 abelha').value).toBe('🐝 abelha')
  })

  it('joins across an accented boundary without mangling it', () => {
    const result = append('configuração', 'pronta')
    expect(result.value).toBe('configuração pronta')
    expect(result.value.slice(...result.range)).toBe('pronta')
  })

  it('is a no-op for an empty or whitespace-only segment, leaving the caret alone', () => {
    for (const text of ['', '   ', '\n']) {
      const result = joinTranscript('revisa o ', 4, 4, text)
      expect(result.value).toBe('revisa o ')
      expect(result.caret).toBe(4)
      expect(result.range).toEqual([4, 4])
    }
  })

  it('trims the segment the engine hands back', () => {
    expect(append('revisa', '  o arquivo  ')).toMatchObject({ value: 'revisa o arquivo' })
  })

  it('clamps a selection that is out of range or inverted', () => {
    // Past the end (a stale caret after the value shrank).
    expect(joinTranscript('abc', 99, 99, 'fim').value).toBe('abc fim')
    // Inverted (end before start) collapses to a caret at `start`.
    const inverted = joinTranscript('abcdef', 4, 1, 'x')
    expect(inverted.value).toBe('abcd x ef')
    // Negative start.
    expect(joinTranscript('abc', -5, -5, 'olá').value).toBe('Olá abc')
  })

  it('inserts consecutive segments in a row, each landing after the last', () => {
    let value = ''
    let caret = 0
    for (const text of ['primeira frase.', 'segunda frase.', 'terceira']) {
      const result = joinTranscript(value, caret, caret, text)
      value = result.value
      caret = result.caret
    }
    expect(value).toBe('Primeira frase. Segunda frase. Terceira')
    expect(caret).toBe(value.length)
  })
})
