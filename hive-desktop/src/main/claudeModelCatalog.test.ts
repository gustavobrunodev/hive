import { describe, expect, it } from 'vitest'
import { detectClaudeCapabilities, detectProvider, prettifyModelId } from './claudeModelCatalog'
import type { AgentCapabilities, AgentOption } from './agentAdapter'

/**
 * Detection reads four kinds of file/env, so every test here hands it a fake
 * home: a `readJson` that answers per path, plus an env. No disk, no CLI, and
 * — the point — the Bedrock and Vertex paths become testable on a machine
 * that has neither.
 */
function detect(options: {
  files?: Record<string, unknown>
  env?: NodeJS.ProcessEnv
  workspace?: string
  platform?: NodeJS.Platform
}): AgentCapabilities {
  const files = options.files ?? {}
  return detectClaudeCapabilities({
    env: options.env ?? {},
    home: '/home/u',
    platform: options.platform ?? 'linux',
    ...(options.workspace ? { workspace: options.workspace } : {}),
    readJson: <T>(path: string) => (files[path] as T) ?? null
  })
}

const byId = (models: AgentOption[], id: string): AgentOption | undefined =>
  models.find((model) => model.id === id)

describe('detectClaudeCapabilities', () => {
  it('always offers the alias catalog, even with nothing on disk', () => {
    const caps = detect({})
    const ids = caps.models.map((model) => model.id)
    expect(ids).toContain('opus')
    expect(ids).toContain('sonnet')
    expect(ids).toContain('haiku')
    expect(ids).toContain('fable')
    expect(caps.efforts.map((effort) => effort.id)).toEqual([
      '',
      'low',
      'medium',
      'high',
      'xhigh',
      'max'
    ])
    expect(caps.provider).toEqual({ id: 'anthropic', detail: null })
  })

  // The `[1m]` aliases exist only because their window differs; a catalog that
  // gave every row 200k would make the context meter lie by 5x on them.
  it('gives the 1M aliases a 1M window and the rest 200k', () => {
    const { models } = detect({})
    expect(byId(models, 'sonnet[1m]')?.contextWindow).toBe(1_000_000)
    expect(byId(models, 'sonnet')?.contextWindow).toBe(200_000)
  })

  it('leads with a "use the CLI default" row whose id is the absent flag', () => {
    const { models } = detect({})
    expect(models[0].id).toBe('')
    expect(models[0].group).toBe('default')
    expect(models[0].traits).toContain('cli-default')
  })

  // The whole point of the default row: it says what it will actually do.
  it('names the model and effort the user configured as the defaults', () => {
    const caps = detect({
      files: { '/home/u/.claude/settings.json': { model: 'opus', effortLevel: 'xhigh' } }
    })
    expect(caps.defaults).toEqual({ model: 'opus', effort: 'xhigh' })
    expect(caps.models[0].resolvedId).toBe('opus')
    expect(caps.models[0].source).toBe('configured')
    expect(caps.efforts[0].resolvedId).toBe('xhigh')
  })

  it('lets a project override the user settings, and policy override the project', () => {
    const caps = detect({
      workspace: '/ws',
      files: {
        '/home/u/.claude/settings.json': { model: 'haiku' },
        '/ws/.claude/settings.json': { model: 'sonnet' },
        '/ws/.claude/settings.local.json': { model: 'opus' },
        '/etc/claude-code/managed-settings.json': { model: 'fable' }
      }
    })
    expect(caps.defaults?.model).toBe('fable')
  })

  it('looks for managed settings where each platform actually keeps them', () => {
    expect(
      detect({
        platform: 'win32',
        files: { 'C:\\ProgramData\\ClaudeCode\\managed-settings.json': { model: 'haiku' } }
      }).defaults?.model
    ).toBe('haiku')
    expect(
      detect({
        platform: 'darwin',
        files: {
          '/Library/Application Support/ClaudeCode/managed-settings.json': { model: 'haiku' }
        }
      }).defaults?.model
    ).toBe('haiku')
  })

  // The reported bug: the CLI pointed at Bedrock, the picker still showing the
  // four first-party aliases as if nothing had changed.
  it('detects Bedrock and leads with the ids configured for it', () => {
    const caps = detect({
      env: {
        CLAUDE_CODE_USE_BEDROCK: '1',
        AWS_REGION: 'us-east-1',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'us.anthropic.claude-opus-4-5-20251101-v1:0'
      }
    })
    expect(caps.provider).toEqual({ id: 'bedrock', detail: 'us-east-1' })
    expect(caps.modelSource).toBe('configured')

    const sonnet = byId(caps.models, 'us.anthropic.claude-sonnet-4-5-20250929-v1:0')
    expect(sonnet?.label).toBe('Claude Sonnet 4.5')
    expect(sonnet?.vendor).toBe('Amazon Bedrock')
    expect(sonnet?.group).toBe('recommended')
    // The aliases still work on Bedrock, so they stay reachable — just not as
    // the headline act, which is what the concrete ids now are.
    expect(byId(caps.models, 'sonnet')?.group).toBe('more')
  })

  it('honours the name and description an operator gave a configured model', () => {
    const caps = detect({
      env: {
        CLAUDE_CODE_USE_VERTEX: 'true',
        CLOUD_ML_REGION: 'us-east5',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-5@20251101',
        ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'Opus (produção)',
        ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION: 'Aprovado pelo time de segurança'
      }
    })
    expect(caps.provider).toEqual({ id: 'vertex', detail: 'us-east5' })
    const opus = byId(caps.models, 'claude-opus-4-5@20251101')
    expect(opus?.label).toBe('Opus (produção)')
    expect(opus?.description).toBe('Aprovado pelo time de segurança')
    // A machine-written description must not be shadowed by curated copy.
    expect(opus?.descriptionKey).toBeUndefined()
  })

  it('surfaces a pinned ANTHROPIC_MODEL and a custom model option', () => {
    const caps = detect({
      env: {
        ANTHROPIC_MODEL: 'claude-sonnet-5',
        ANTHROPIC_CUSTOM_MODEL_OPTION: 'internal-llm',
        ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: 'LLM interna'
      }
    })
    expect(byId(caps.models, 'claude-sonnet-5')).toBeDefined()
    expect(byId(caps.models, 'internal-llm')?.label).toBe('LLM interna')
  })

  // The strongest source available: rows the CLI itself cached for this
  // account, which is what makes the list follow an entitlement change.
  it("merges the CLI's own account model rows as detected", () => {
    const caps = detect({
      files: {
        '/home/u/.claude.json': {
          additionalModelOptionsCache: [
            {
              value: 'claude-fable-5[1m]',
              label: 'Fable',
              description: 'Fable 5 · Most capable for your hardest tasks'
            }
          ]
        }
      }
    })
    const fable = byId(caps.models, 'claude-fable-5[1m]')
    expect(fable?.source).toBe('detected')
    expect(fable?.description).toBe('Fable 5 · Most capable for your hardest tasks')
    expect(fable?.contextWindow).toBe(1_000_000)
    expect(caps.modelSource).toBe('detected')
  })

  it('accepts a bare model id in the account caches too', () => {
    const caps = detect({
      files: { '/home/u/.claude.json': { modelAccessCache: ['claude-opus-4-8'] } }
    })
    expect(byId(caps.models, 'claude-opus-4-8')?.label).toBe('Claude Opus 4.8')
  })

  it('reads the account file from CLAUDE_CONFIG_DIR when it is set', () => {
    const caps = detect({
      env: { CLAUDE_CONFIG_DIR: '/cfg' },
      files: { '/cfg/.claude.json': { modelAccessCache: ['claude-opus-4-8'] } }
    })
    expect(byId(caps.models, 'claude-opus-4-8')).toBeDefined()
  })

  // A hand-edited settings file is a normal thing to find, and it must not
  // take the picker down with it.
  it('survives unreadable or nonsense settings', () => {
    const caps = detect({
      files: {
        '/home/u/.claude/settings.json': { model: 42, env: { GOOD: 'yes', BAD: 7 } },
        '/home/u/.claude.json': { additionalModelOptionsCache: 'not-an-array' }
      }
    })
    expect(caps.defaults?.model).toBeNull()
    expect(caps.models.length).toBeGreaterThan(4)
  })

  it('marks the list as a catalog when nothing on the machine named a model', () => {
    const caps = detect({})
    expect(caps.modelSource).toBe('catalog')
    expect(caps.note).toBe('no-listing')
  })
})

describe('detectProvider', () => {
  it('reads the three explicit provider switches', () => {
    expect(detectProvider({ CLAUDE_CODE_USE_BEDROCK: 'yes' }).id).toBe('bedrock')
    expect(detectProvider({ CLAUDE_CODE_USE_VERTEX: 'on' }).id).toBe('vertex')
    expect(detectProvider({ CLAUDE_CODE_USE_FOUNDRY: '1' }).id).toBe('foundry')
  })

  it('treats a falsy switch as not set', () => {
    expect(detectProvider({ CLAUDE_CODE_USE_BEDROCK: '0' }).id).toBe('anthropic')
    expect(detectProvider({ CLAUDE_CODE_USE_BEDROCK: '' }).id).toBe('anthropic')
  })

  // A base URL is only a gateway when it points somewhere that isn't Anthropic;
  // pinning the official host is a normal thing to do and changes nothing.
  it('calls a foreign base URL a gateway and an Anthropic one first-party', () => {
    expect(detectProvider({ ANTHROPIC_BASE_URL: 'https://llm.acme.internal/v1' })).toEqual({
      id: 'gateway',
      detail: 'llm.acme.internal'
    })
    expect(detectProvider({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }).id).toBe('anthropic')
  })
})

describe('prettifyModelId', () => {
  it('turns a provider-qualified id into a readable name', () => {
    expect(prettifyModelId('us.anthropic.claude-sonnet-4-5-20250929-v1:0')).toBe(
      'Claude Sonnet 4.5'
    )
    expect(prettifyModelId('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(prettifyModelId('claude-fable-5[1m]')).toBe('Claude Fable 5 1M')
  })
})
