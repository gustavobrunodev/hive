import { describe, expect, it } from 'vitest'
import { isLongBody, LONG_BODY_CHARS, splitCommandMessage } from './commandMessage'

describe('splitCommandMessage', () => {
  it('reads a bare invocation as command only', () => {
    expect(splitCommandMessage('/bmad-prd')).toEqual({
      command: 'bmad-prd',
      args: '',
      body: ''
    })
  })

  it('separates arguments that ride on the command line', () => {
    expect(splitCommandMessage('/second-brain-query como fazemos deploy?')).toEqual({
      command: 'second-brain-query',
      args: 'como fazemos deploy?',
      body: ''
    })
  })

  it('separates material sent under the command — the ingestion shape', () => {
    const text = '/second-brain-ingest second-brain/raw/ingest-x.md\n\nA squad decidiu migrar.'
    expect(splitCommandMessage(text)).toEqual({
      command: 'second-brain-ingest',
      args: 'second-brain/raw/ingest-x.md',
      body: 'A squad decidiu migrar.'
    })
  })

  it('keeps the body intact, blank lines and all', () => {
    const body = 'Primeiro parágrafo.\n\nSegundo parágrafo.\n- um item'
    const result = splitCommandMessage(`/x arq.md\n\n${body}`)
    expect(result?.body).toBe(body)
  })

  it('accepts a body that follows a single newline', () => {
    expect(splitCommandMessage('/x\nlogo abaixo')?.body).toBe('logo abaixo')
  })

  it('treats ordinary prose as prose', () => {
    expect(splitCommandMessage('como faço deploy?')).toBeNull()
    expect(splitCommandMessage('')).toBeNull()
  })

  it('does not mistake a slash inside prose for an invocation', () => {
    expect(splitCommandMessage('veja src/main/index.ts')).toBeNull()
    expect(splitCommandMessage('a resposta é 3/4')).toBeNull()
  })

  it('requires the slash to open the message', () => {
    expect(splitCommandMessage(' /bmad-prd')).toBeNull()
    expect(splitCommandMessage('rode /bmad-prd')).toBeNull()
  })

  it('rejects a lone slash and a slash starting with punctuation', () => {
    expect(splitCommandMessage('/')).toBeNull()
    expect(splitCommandMessage('/-nope')).toBeNull()
  })

  it('accepts the name shapes real skills use — digits, colons, dashes', () => {
    expect(splitCommandMessage('/plugin:skill-2')?.command).toBe('plugin:skill-2')
  })

  it('tolerates a trailing carriage return from a pasted prompt', () => {
    expect(splitCommandMessage('/bmad-prd\r\nassunto')).toEqual({
      command: 'bmad-prd',
      args: '',
      body: 'assunto'
    })
  })
})

describe('isLongBody', () => {
  it('leaves a short body expanded', () => {
    expect(isLongBody('uma nota curta')).toBe(false)
    expect(isLongBody('x'.repeat(LONG_BODY_CHARS))).toBe(false)
  })

  it('collapses a transcript-sized body', () => {
    expect(isLongBody('x'.repeat(LONG_BODY_CHARS + 1))).toBe(true)
  })
})
