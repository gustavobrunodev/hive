import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { detectCopilotCapabilities } from './copilotModelCatalog'
import type { AgentCapabilities } from './agentAdapter'

function detect(
  options: { files?: Record<string, unknown>; env?: NodeJS.ProcessEnv } = {}
): AgentCapabilities {
  const files = options.files ?? {}
  return detectCopilotCapabilities({
    env: options.env ?? {},
    home: '/home/u',
    readJson: <T>(path: string) => (files[path] as T) ?? null
  })
}

describe('detectCopilotCapabilities', () => {
  it('offers a vendor-spanning catalog and no effort ladder', () => {
    const caps = detect()
    const vendors = new Set(caps.models.map((model) => model.vendor).filter(Boolean))
    expect(vendors).toEqual(new Set(['Anthropic', 'OpenAI', 'Google']))
    // Verified against the installed CLI's own option list: no such flag.
    expect(caps.efforts).toEqual([])
    expect(caps.provider).toEqual({ id: 'github', detail: null })
  })

  // Copilot fetches its list from the GitHub API at session start and offers
  // no listing command, so the picker has to say the list is a catalog rather
  // than imply it measured one.
  it('always admits the list is a known-models catalog', () => {
    expect(detect().note).toBe('no-listing')
  })

  it('picks up the model the user chose in the Copilot CLI', () => {
    const caps = detect({
      files: { [join('/home/u/.copilot', 'config.json')]: { model: 'gpt-5.1' } }
    })
    expect(caps.defaults?.model).toBe('gpt-5.1')
    expect(caps.models[0]).toMatchObject({ id: '', resolvedId: 'gpt-5.1' })
    expect(caps.modelSource).toBe('configured')
  })

  it('honours COPILOT_HOME', () => {
    const caps = detect({
      env: { COPILOT_HOME: '/cfg' },
      files: { [join('/cfg', 'config.json')]: { selectedModel: 'gpt-5' } }
    })
    expect(caps.defaults?.model).toBe('gpt-5')
  })

  // A model GitHub adds tomorrow must not vanish just because Hive's catalog
  // predates it.
  it('keeps a chosen model the catalog has never heard of', () => {
    const caps = detect({
      files: { [join('/home/u/.copilot', 'config.json')]: { model: 'grok-9' } }
    })
    expect(caps.models.find((model) => model.id === 'grok-9')?.source).toBe('configured')
  })

  it('leads with the automatic row and falls back to catalog provenance', () => {
    const caps = detect()
    expect(caps.models[0].id).toBe('')
    expect(caps.modelSource).toBe('catalog')
  })
})
