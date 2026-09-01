import { describe, expect, it } from 'vitest'
import {
  applyPreview,
  previewText,
  stripPreview,
  type FieldState,
  type PreviewRun
} from './previewRun'

/**
 * The rules that let provisional text sit in a field the user is also editing.
 * Asserted against plain strings, because that is what they are about: every
 * one of them is a claim about which characters survive.
 */

const field = (value: string, caret = value.length): FieldState => ({
  value,
  selectionStart: caret,
  selectionEnd: caret
})

describe('applyPreview', () => {
  it('writes provisional text at the caret and reports the run it occupies', () => {
    const applied = applyPreview(field('olá'), null, 'bom dia')
    expect(applied.write.value).toBe('olá bom dia')
    expect(applied.run).toEqual({ range: [4, 11], text: 'bom dia' })
  })

  it('replaces the run in place as the guess grows, without stacking spaces', () => {
    const first = applyPreview(field('olá'), null, 'bom')
    const second = applyPreview(field(first.write.value, first.write.caret), first.run, 'bom dia')
    expect(second.write.value).toBe('olá bom dia')
    expect(second.run).toEqual({ range: [4, 11], text: 'bom dia' })

    const third = applyPreview(
      field(second.write.value, second.write.caret),
      second.run,
      'bom dia a todos'
    )
    expect(third.write.value).toBe('olá bom dia a todos')
  })

  it('shrinks as well as grows — a later guess may be shorter', () => {
    const long = applyPreview(field(''), null, 'uma frase bem comprida')
    const short = applyPreview(field(long.write.value, long.write.caret), long.run, 'uma frase')
    expect(short.write.value).toBe('Uma frase')
  })

  it('leaves no run behind when it commits, so the next guess opens a new one', () => {
    const guess = applyPreview(field('olá'), null, 'bom dia')
    const final = applyPreview(
      field(guess.write.value, guess.write.caret),
      guess.run,
      'Bom dia!',
      true
    )
    expect(final.write.value).toBe('olá Bom dia!')
    expect(final.run).toBeNull()
  })

  it('reports no run for empty text — a zero-width mark is worse than none', () => {
    const applied = applyPreview(field('olá'), null, '')
    expect(applied.run).toBeNull()
    expect(applied.write.value).toBe('olá')
  })

  it('clears the provisional text when the guess becomes empty', () => {
    const guess = applyPreview(field('olá'), null, 'bom dia')
    const cleared = applyPreview(field(guess.write.value, guess.write.caret), guess.run, '')
    expect(cleared.write.value).toBe('olá ')
    expect(cleared.run).toBeNull()
  })
})

describe('stripPreview — the identity check', () => {
  const run: PreviewRun = { range: [4, 11], text: 'bom dia' }

  it('takes the run out and puts the caret back where it was', () => {
    expect(stripPreview(field('olá bom dia'), run)).toEqual({
      value: 'olá ',
      selectionStart: 4,
      selectionEnd: 4
    })
  })

  /**
   * The defect this prevents, and the reason the run carries its text: offsets
   * go stale the instant the user types, and a stale offset does not fail
   * loudly — it silently deletes the wrong characters. Someone editing the
   * start of their draft while dictating must never lose what they typed.
   */
  it('refuses to cut when the field no longer holds what was written there', () => {
    const edited = field('OUTRA COISA ENTIRELY')
    expect(stripPreview(edited, run)).toBe(edited)
  })

  it('refuses to cut when the range runs past the end of a shortened field', () => {
    const shortened = field('olá')
    expect(stripPreview(shortened, run)).toBe(shortened)
  })

  it('is a no-op with no run', () => {
    const untouched = field('olá')
    expect(stripPreview(untouched, null)).toBe(untouched)
  })
})

describe('previewText', () => {
  it('puts the segment being transcribed before the phrase still being spoken', () => {
    expect(previewText('primeira frase', 'segunda em curso')).toBe(
      'primeira frase segunda em curso'
    )
  })

  it('is just whichever half exists', () => {
    expect(previewText('', 'só a aberta')).toBe('só a aberta')
    expect(previewText('só a fechada', '')).toBe('só a fechada')
    expect(previewText('', '')).toBe('')
  })
})
