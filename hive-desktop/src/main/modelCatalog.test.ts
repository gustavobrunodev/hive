import { describe, expect, it } from 'vitest'
import { createFakeProcessRunner } from './processRunner'
import {
  asRecord,
  asText,
  mergeOptions,
  parseJsonLoose,
  readJsonFile,
  runCapture,
  strongestSource
} from './modelCatalog'
import type { AgentOption } from './agentAdapter'

describe('mergeOptions', () => {
  const curated: AgentOption[] = [
    {
      id: 'sonnet',
      label: 'Sonnet',
      descriptionKey: 'claude.sonnet',
      contextWindow: 200_000,
      traits: ['balanced'],
      group: 'recommended',
      source: 'catalog'
    }
  ]

  it('keeps the curated reading order and appends genuinely new rows', () => {
    const merged = mergeOptions(curated, [{ id: 'novo', label: 'Novo', source: 'detected' }])
    expect(merged.map((option) => option.id)).toEqual(['sonnet', 'novo'])
  })

  // The precedence rule the whole layered catalog rests on.
  it('lets a stronger source overwrite the copy of a weaker one', () => {
    const [sonnet] = mergeOptions(curated, [
      { id: 'sonnet', label: 'Sonnet 5', description: 'o que a CLI disse', source: 'detected' }
    ])
    expect(sonnet.label).toBe('Sonnet 5')
    expect(sonnet.description).toBe('o que a CLI disse')
    expect(sonnet.source).toBe('detected')
    // Curated copy and machine copy are two channels for one line; keeping
    // both would render the description twice.
    expect(sonnet.descriptionKey).toBeUndefined()
  })

  it('does not let a weaker source overwrite a stronger one', () => {
    const detected: AgentOption[] = [{ id: 'sonnet', label: 'Sonnet 5', source: 'detected' }]
    const [sonnet] = mergeOptions(detected, [{ id: 'sonnet', label: 'Sonnet', source: 'catalog' }])
    expect(sonnet.label).toBe('Sonnet 5')
  })

  // A detected row rarely carries a window; losing the curated one would take
  // the context meter's denominator with it.
  it('keeps fields the winning row never mentioned', () => {
    const [sonnet] = mergeOptions(curated, [
      { id: 'sonnet', label: 'Sonnet 5', source: 'detected' }
    ])
    expect(sonnet.contextWindow).toBe(200_000)
    expect(sonnet.traits).toEqual(['balanced'])
  })
})

describe('strongestSource', () => {
  it('reports the best claim any row can make', () => {
    expect(strongestSource([{ id: 'a', label: 'A', source: 'catalog' }])).toBe('catalog')
    expect(
      strongestSource([
        { id: 'a', label: 'A', source: 'catalog' },
        { id: 'b', label: 'B', source: 'configured' }
      ])
    ).toBe('configured')
    expect(
      strongestSource([
        { id: 'a', label: 'A', source: 'configured' },
        { id: 'b', label: 'B', source: 'detected' }
      ])
    ).toBe('detected')
  })

  it('treats a row with no stated source as a catalog row', () => {
    expect(strongestSource([{ id: 'a', label: 'A' }])).toBe('catalog')
  })
})

describe('parseJsonLoose', () => {
  it('parses clean JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  // CLIs print update notices and banners to stdout more often than their docs
  // admit; a probe that gives up on the first stray line is a probe that fails
  // on a Tuesday for no reason the user can see.
  it('finds the JSON inside surrounding chatter', () => {
    expect(parseJsonLoose('atualizando…\n[{"id":"x"}]\nfeito')).toEqual([{ id: 'x' }])
  })

  it('answers null for nothing usable', () => {
    expect(parseJsonLoose('nada aqui')).toBeNull()
    expect(parseJsonLoose(null)).toBeNull()
  })
})

describe('runCapture', () => {
  it('returns stdout when the command succeeds', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    expect(await runCapture(runner, 'devin', ['models'])).toBe('ok')
  })

  it('answers null on a non-zero exit', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'meia resposta' }], code: 2 })
    expect(await runCapture(runner, 'devin', ['models'])).toBeNull()
  })

  // A hung listing must not pin the picker open while the user waits.
  it('kills and gives up on a command that outlives the timeout', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'tarde demais' }], delayMs: 400 })
    expect(await runCapture(runner, 'devin', ['models'], { timeoutMs: 5 })).toBeNull()
    expect(runner.kills[0]).toContain('SIGTERM')
  })

  it('runs the probe in the workspace when given one', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ code: 0 })
    await runCapture(runner, 'devin', ['models'], { cwd: '/ws' })
    expect(runner.calls[0].opts).toEqual({ cwd: '/ws' })
  })
})

describe('small readers', () => {
  it('reads a missing file as null instead of throwing', () => {
    expect(readJsonFile('/nao/existe/config.json')).toBeNull()
  })

  it('asText trims and rejects empties', () => {
    expect(asText('  x ')).toBe('x')
    expect(asText('   ')).toBeNull()
    expect(asText(7)).toBeNull()
  })

  it('asRecord accepts only plain objects', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
    expect(asRecord([1])).toBeNull()
    expect(asRecord(null)).toBeNull()
  })
})
