import { describe, expect, it } from 'vitest'
import { createSkillOracle, resolveCommand, splitCommandMentions } from './commandMentions'

const oracle = createSkillOracle([
  { key: 'bmad-party-mode' },
  { key: 'bmad-advanced-elicitation' },
  { key: 'bmad-prd' }
])

/** Just the runnable pieces, as `label → key` — what a reader sees and what a click runs. */
function commands(text: string): Array<[string, string]> {
  return splitCommandMentions(text, oracle)
    .filter((segment) => segment.kind === 'command')
    .map((segment) => [segment.text, segment.key])
}

describe('createSkillOracle', () => {
  it('resolves a key that is in the catalog', () => {
    expect(oracle.has('bmad-party-mode')).toBe('bmad-party-mode')
  })

  it('answers null for anything not installed', () => {
    expect(oracle.has('bmad-does-not-exist')).toBeNull()
    expect(oracle.has('')).toBeNull()
  })
})

describe('resolveCommand', () => {
  it('resolves with or without the leading slash', () => {
    expect(resolveCommand('/bmad-prd', oracle)).toBe('bmad-prd')
    expect(resolveCommand('bmad-prd', oracle)).toBe('bmad-prd')
  })

  it('answers null for a name the catalog does not have', () => {
    expect(resolveCommand('/bmad-nope', oracle)).toBeNull()
  })
})

describe('splitCommandMentions', () => {
  it('links a mention mid-sentence and leaves the sentence alone', () => {
    const segments = splitCommandMentions(
      'invoque /bmad-party-mode se quiser múltiplas perspectivas.',
      oracle
    )
    expect(segments).toEqual([
      { kind: 'text', text: 'invoque ' },
      { kind: 'command', text: '/bmad-party-mode', key: 'bmad-party-mode' },
      { kind: 'text', text: ' se quiser múltiplas perspectivas.' }
    ])
  })

  it('links two mentions in the same sentence', () => {
    expect(
      commands(
        'invoque /bmad-party-mode ou /bmad-advanced-elicitation para exploração mais profunda.'
      )
    ).toEqual([
      ['/bmad-party-mode', 'bmad-party-mode'],
      ['/bmad-advanced-elicitation', 'bmad-advanced-elicitation']
    ])
  })

  it('gives back one text segment when nothing resolved, so nothing re-renders', () => {
    const text = 'Isso é 3/4 do total, não um comando.'
    expect(splitCommandMentions(text, oracle)).toEqual([{ kind: 'text', text }])
  })

  // The two failure modes of guessing, both of which the oracle makes impossible.
  it('never links something that only looks like a command', () => {
    expect(commands('Use /bin/bash ou and/or o operador ternário.')).toEqual([])
    expect(commands('A entrega foi em 03/09.')).toEqual([])
  })

  it('stops at the sentence punctuation instead of swallowing it', () => {
    expect(commands('Rode /bmad-prd, depois revise.')).toEqual([['/bmad-prd', 'bmad-prd']])
    expect(commands('Rode /bmad-prd.')).toEqual([['/bmad-prd', 'bmad-prd']])
    expect(commands('Rode (/bmad-prd) agora.')).toEqual([['/bmad-prd', 'bmad-prd']])
  })

  it('links a mention at the very start of the text', () => {
    expect(commands('/bmad-party-mode é divertido.')).toEqual([
      ['/bmad-party-mode', 'bmad-party-mode']
    ])
  })

  it('links nothing at all before the skill catalog has loaded', () => {
    // An empty oracle is "not loaded yet", and the honest render of that is
    // plain text — not a button that would run nothing.
    const empty = createSkillOracle([])
    expect(splitCommandMentions('invoque /bmad-party-mode agora', empty)).toEqual([
      { kind: 'text', text: 'invoque /bmad-party-mode agora' }
    ])
  })
})
