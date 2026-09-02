import { describe, expect, it } from 'vitest'
import { buildToolOutput, buildToolParams } from './toolDetails'

/** The keys of a param list, in the order it renders. */
function keys(params: ReturnType<typeof buildToolParams>): string[] {
  return (params ?? []).map((param) => param.key)
}

describe('buildToolParams', () => {
  it('returns undefined for a tool that took no arguments', () => {
    expect(buildToolParams(undefined)).toBeUndefined()
    expect(buildToolParams({})).toBeUndefined()
  })

  it('leads with the call’s headline argument, whatever order the schema had it in', () => {
    const params = buildToolParams({
      timeout: 120000,
      description: 'roda os testes',
      command: 'npm test'
    })
    expect(keys(params)[0]).toBe('command')
  })

  it('keeps the remaining arguments in the schema’s own order', () => {
    const params = buildToolParams({ b: 'two', command: 'x', a: 'one' })
    expect(keys(params)).toEqual(['command', 'b', 'a'])
  })

  it('marks a multi-line value as a block', () => {
    const params = buildToolParams({ command: 'set -e\nnpm run build' })
    expect(params?.[0]).toMatchObject({ block: true })
  })

  it('marks a long single-line value as a block, since a row would ellipsize it', () => {
    const params = buildToolParams({ command: 'x'.repeat(80) })
    expect(params?.[0].block).toBe(true)
  })

  it('leaves a short value as a plain row', () => {
    const params = buildToolParams({ file_path: '/ws/a.ts' })
    expect(params?.[0].block).toBeUndefined()
  })

  it('flattens numbers and booleans', () => {
    const params = buildToolParams({ limit: 20, replace_all: false })
    expect(params).toEqual([
      { key: 'limit', value: '20' },
      { key: 'replace_all', value: 'false' }
    ])
  })

  it('renders an object argument as indented JSON, as a block', () => {
    const params = buildToolParams({ todos: [{ content: 'a', status: 'pending' }] })
    expect(params?.[0].block).toBe(true)
    expect(params?.[0].value).toContain('"content": "a"')
  })

  it('drops arguments with no value at all', () => {
    expect(buildToolParams({ command: 'ls', note: '   ', gone: null, missing: undefined })).toEqual(
      [{ key: 'command', value: 'ls' }]
    )
  })

  it('caps a long value and reports what it removed', () => {
    const params = buildToolParams({ prompt: 'x'.repeat(2500) })
    expect(params?.[0].value).toHaveLength(2000)
    expect(params?.[0].truncated).toBe(500)
  })

  it('caps how many arguments travel', () => {
    const input: Record<string, unknown> = {}
    for (let i = 0; i < 30; i += 1) input[`k${i}`] = i
    expect(buildToolParams(input)).toHaveLength(14)
  })

  it('omits the file body when a patch already renders it', () => {
    const input = { file_path: '/ws/a.ts', old_string: 'a', new_string: 'b', content: 'c' }
    expect(keys(buildToolParams(input, true))).toEqual(['file_path'])
    expect(keys(buildToolParams(input, false))).toEqual([
      'file_path',
      'old_string',
      'new_string',
      'content'
    ])
  })

  it('drops a value JSON has no representation for', () => {
    expect(keys(buildToolParams({ command: 'ls', onDone: () => undefined }))).toEqual(['command'])
  })

  it('does not take the panel down on a value that will not serialize', () => {
    const circular: Record<string, unknown> = { command: 'ls' }
    circular.self = circular
    expect(keys(buildToolParams(circular))).toEqual(['command'])
  })
})

describe('buildToolOutput', () => {
  it('reads a plain string result', () => {
    expect(buildToolOutput('ok')).toEqual({ text: 'ok', lines: 1 })
  })

  it('joins the text blocks of a block-list result', () => {
    const output = buildToolOutput([
      { type: 'text', text: 'primeira' },
      { type: 'text', text: 'segunda' }
    ])
    expect(output).toEqual({ text: 'primeira\nsegunda', lines: 2 })
  })

  it('skips blocks that carry no text rather than printing a JSON husk', () => {
    const output = buildToolOutput([
      { type: 'image', source: {} },
      { type: 'text', text: 'oi' }
    ])
    expect(output?.text).toBe('oi')
  })

  it('reads a block list an adapter filled with bare strings', () => {
    expect(buildToolOutput(['uma', 'outra'])).toEqual({ text: 'uma\noutra', lines: 2 })
  })

  it('steps over a null block instead of reading through it', () => {
    expect(buildToolOutput([null, 42, { type: 'text', text: 'oi' }])?.text).toBe('oi')
  })

  it('returns undefined when there was nothing to read at all', () => {
    expect(buildToolOutput(undefined)).toBeUndefined()
    expect(buildToolOutput([])).toBeUndefined()
    expect(buildToolOutput([{ type: 'image' }])).toBeUndefined()
  })

  it('distinguishes a tool that answered with nothing from one never captured', () => {
    expect(buildToolOutput('')).toEqual({ text: '', lines: 0 })
  })

  it('trims trailing whitespace so a result does not end in blank lines', () => {
    expect(buildToolOutput('feito\n\n  ')).toEqual({ text: 'feito', lines: 1 })
  })

  it('caps a long result and reports the true line count of the whole thing', () => {
    const long = Array.from({ length: 900 }, () => 'x'.repeat(20)).join('\n')
    const output = buildToolOutput(long)
    expect(output?.text).toHaveLength(8000)
    expect(output?.truncated).toBe(long.length - 8000)
    expect(output?.lines).toBe(900)
  })
})
