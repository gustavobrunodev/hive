import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createFakeProcessRunner, type FakeProcessRunner } from './processRunner'
import type { AgentCapabilities } from './agentAdapter'
import { detectDevinCapabilities } from './devinModelCatalog'

/** Runs detection with a scripted `devin models list` answer (or none at all). */
async function detect(options: {
  stdout?: string
  code?: number
  files?: Record<string, unknown>
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}): Promise<{ capabilities: AgentCapabilities; runner: FakeProcessRunner }> {
  const runner = createFakeProcessRunner()
  runner.script({
    ...(options.stdout !== undefined
      ? { chunks: [{ stream: 'stdout' as const, data: options.stdout }] }
      : {}),
    code: options.code ?? 0
  })
  const files = options.files ?? {}
  const capabilities = await detectDevinCapabilities({
    processRunner: runner,
    env: options.env ?? {},
    home: '/home/u',
    platform: options.platform ?? 'linux',
    readJson: <T>(path: string) => (files[path] as T) ?? null
  })
  return { capabilities, runner }
}

describe('detectDevinCapabilities', () => {
  // The reported bug in one line: Devin's models weren't appearing because the
  // adapter claimed it had none.
  it('offers models even with no CLI installed', async () => {
    const { capabilities } = await detect({ code: 1 })
    expect(capabilities.models.length).toBeGreaterThan(1)
    expect(capabilities.models.map((model) => model.id)).toContain('adaptive')
    expect(capabilities.note).toBe('probe-failed')
  })

  it('asks the CLI for its own list', async () => {
    const { runner } = await detect({ stdout: '[]' })
    expect(runner.calls[0].command).toBe('devin')
    expect(runner.calls[0].args).toEqual(['models', 'list', '--format', 'json'])
  })

  it('takes the listed models as detected, with their own copy', async () => {
    const { capabilities } = await detect({
      stdout: JSON.stringify([
        {
          id: 'swe-1-6-fast',
          display_name: 'SWE 1.6 Fast',
          description: 'Rápido para tarefas de engenharia',
          provider: 'Cognition',
          context_window: 300000
        },
        { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI' }
      ])
    })
    const swe = capabilities.models.find((model) => model.id === 'swe-1-6-fast')
    expect(swe).toMatchObject({
      label: 'SWE 1.6 Fast',
      description: 'Rápido para tarefas de engenharia',
      vendor: 'Cognition',
      contextWindow: 300_000,
      source: 'detected'
    })
    expect(capabilities.modelSource).toBe('detected')
    expect(capabilities.models.find((model) => model.id === 'gpt-5.2')?.label).toBe('GPT-5.2')
  })

  // The flag's schema isn't published, so every plausible wrapper is accepted
  // rather than betting the feature on one guess.
  it('accepts the list wrapped in an object, and bare id strings', async () => {
    const { capabilities } = await detect({ stdout: '{"models":["opus","gemini"]}' })
    expect(capabilities.models.map((model) => model.id)).toEqual(
      expect.arrayContaining(['opus', 'gemini'])
    )
  })

  it('finds the JSON inside a CLI banner', async () => {
    const { capabilities } = await detect({
      stdout: 'Devin CLI v1.2 — checking for updates…\n[{"id":"adaptive","name":"Adaptive"}]\n'
    })
    expect(capabilities.models.find((model) => model.id === 'adaptive')?.source).toBe('detected')
  })

  it('falls back to the catalog when the answer parses to nothing usable', async () => {
    const { capabilities } = await detect({ stdout: 'não foi possível listar' })
    expect(capabilities.note).toBe('probe-failed')
    expect(capabilities.models.map((model) => model.id)).toContain('swe')
  })

  it('marks a router model as one', async () => {
    const { capabilities } = await detect({ stdout: '[{"id":"adaptive","name":"Adaptive"}]' })
    expect(capabilities.models.find((model) => model.id === 'adaptive')?.traits).toContain('router')
  })

  it("names the user's own configured default on the automatic row", async () => {
    const { capabilities } = await detect({
      stdout: '[]',
      files: { '/home/u/.config/devin/config.json': { agent: { model: 'opus' } } }
    })
    expect(capabilities.defaults?.model).toBe('opus')
    expect(capabilities.models[0]).toMatchObject({ id: '', resolvedId: 'opus' })
  })

  it('reads the Windows config location', async () => {
    const { capabilities } = await detect({
      stdout: '[]',
      platform: 'win32',
      env: { APPDATA: 'C:/Users/u/AppData/Roaming' },
      // Keyed through `join` rather than a literal: this suite runs on POSIX,
      // where the separator the code produces is not the one Windows writes.
      files: {
        [join('C:/Users/u/AppData/Roaming', 'devin', 'config.json')]: {
          agent: { model: 'gemini' }
        }
      }
    })
    expect(capabilities.defaults?.model).toBe('gemini')
  })

  it('honours XDG_CONFIG_HOME on POSIX', async () => {
    const { capabilities } = await detect({
      stdout: '[]',
      env: { XDG_CONFIG_HOME: '/xdg' },
      files: { '/xdg/devin/config.json': { agent: { model: 'codex' } } }
    })
    expect(capabilities.defaults?.model).toBe('codex')
  })

  // Devin's autonomy dial is `--permission-mode`, a different axis; inventing
  // an effort ladder for it would put a control on screen that changes nothing.
  it('exposes no effort ladder', async () => {
    const { capabilities } = await detect({ stdout: '[]' })
    expect(capabilities.efforts).toEqual([])
    expect(capabilities.provider).toEqual({ id: 'cognition', detail: null })
  })
})
