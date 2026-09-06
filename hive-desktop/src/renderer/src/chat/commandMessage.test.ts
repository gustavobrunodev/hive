import { describe, expect, it } from 'vitest'
import { isLongMessage, LONG_MESSAGE_CHARS, userMessageSegments } from './commandMessage'
import { createSkillOracle } from './commandMentions'

const oracle = createSkillOracle([
  { key: 'bmad-prd' },
  { key: 'second-brain-ingest' },
  { key: 'plugin:skill-2' }
])
const files = new Set(['docs/escopo.md', 'src/main/index.ts'])

/** The whole point of the module: the runs put the message back together. */
function rejoin(text: string): string {
  return userMessageSegments(text, files, oracle)
    .map((segment) => segment.text)
    .join('')
}

describe('userMessageSegments', () => {
  it('marks the leading command and leaves the rest as prose', () => {
    expect(userMessageSegments('/bmad-prd revisar o escopo', files, oracle)).toEqual([
      { kind: 'command', text: '/bmad-prd' },
      { kind: 'text', text: ' revisar o escopo' }
    ])
  })

  it('reads a bare invocation as one command run', () => {
    expect(userMessageSegments('/bmad-prd', files, oracle)).toEqual([
      { kind: 'command', text: '/bmad-prd' }
    ])
  })

  it('marks file references alongside the command', () => {
    expect(userMessageSegments('/bmad-prd a partir de @docs/escopo.md', files, oracle)).toEqual([
      { kind: 'command', text: '/bmad-prd' },
      { kind: 'text', text: ' a partir de ' },
      { kind: 'file', text: '@docs/escopo.md' }
    ])
  })

  it('marks file references in a message with no command at all', () => {
    expect(userMessageSegments('veja @src/main/index.ts', files, oracle)).toEqual([
      { kind: 'text', text: 'veja ' },
      { kind: 'file', text: '@src/main/index.ts' }
    ])
  })

  it('keeps material sent under the command — the ingestion shape — as prose', () => {
    const text = '/second-brain-ingest\n\nA squad decidiu migrar.'
    expect(userMessageSegments(text, files, oracle)).toEqual([
      { kind: 'command', text: '/second-brain-ingest' },
      { kind: 'text', text: '\n\nA squad decidiu migrar.' }
    ])
  })

  it('returns ordinary prose as a single run', () => {
    expect(userMessageSegments('como faço deploy?', files, oracle)).toEqual([
      { kind: 'text', text: 'como faço deploy?' }
    ])
  })

  it('leaves a command the workspace does not have as plain prose', () => {
    expect(userMessageSegments('/bmda-prd revisar', files, oracle)).toEqual([
      { kind: 'text', text: '/bmda-prd revisar' }
    ])
  })

  it('leaves an @reference to a file that does not exist as plain prose', () => {
    expect(userMessageSegments('veja @docs/inventado.md', files, oracle)).toEqual([
      { kind: 'text', text: 'veja @docs/inventado.md' }
    ])
  })

  it('does not mistake a slash inside prose for an invocation', () => {
    expect(userMessageSegments('a resposta é 3/4', files, oracle)).toEqual([
      { kind: 'text', text: 'a resposta é 3/4' }
    ])
    expect(userMessageSegments('rode /bmad-prd depois', files, oracle)).toEqual([
      { kind: 'text', text: 'rode /bmad-prd depois' }
    ])
  })

  it('accepts the name shapes real skills use — digits, colons, dashes', () => {
    expect(userMessageSegments('/plugin:skill-2 vai', files, oracle)[0]).toEqual({
      kind: 'command',
      text: '/plugin:skill-2'
    })
  })

  it('puts the message back together character for character', () => {
    const samples = [
      '',
      '/bmad-prd',
      '/bmad-prd revisar @docs/escopo.md e @src/main/index.ts',
      'texto @docs/escopo.md com acento — ção',
      '/second-brain-ingest\r\nassunto'
    ]
    for (const sample of samples) expect(rejoin(sample)).toBe(sample)
  })
})

describe('isLongMessage', () => {
  it('leaves a short message expanded', () => {
    expect(isLongMessage('uma nota curta')).toBe(false)
    expect(isLongMessage('x'.repeat(LONG_MESSAGE_CHARS))).toBe(false)
  })

  it('collapses a transcript-sized message', () => {
    expect(isLongMessage('x'.repeat(LONG_MESSAGE_CHARS + 1))).toBe(true)
  })
})
