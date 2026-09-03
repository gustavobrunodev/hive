import { readFileSync } from 'fs'
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

/**
 * A trimmed capture of a real `devin 3000.6.14 models list --format json`
 * (nine of its forty-four families, keeping every schema shape that appears:
 * `-fast`/`-priority` twins, `1M` twins, opaque `MODEL_PRIVATE_*` ids, a
 * single-variant family, and the variant-less router).
 *
 * A fixture, not a hand-written object: the whole defect this module closes
 * was a parser written against a shape nobody had looked at.
 */
const REAL_LISTING = readFileSync(join(__dirname, '__fixtures__', 'devinModelsList.json'), 'utf-8')

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

  describe('the shape the real CLI answers with', () => {
    // The bug: the parser looked for `models`/`data`/`items`/`results` and the
    // CLI answers `{"families":[…]}`, so detection returned nothing and the
    // picker silently fell back to a seven-row hand-written list. "Modelos não
    // são todos listados no Devin", exactly.
    it('reads the families envelope the flat-array parser never saw', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      expect(capabilities.note).toBeUndefined()
      expect(capabilities.modelSource).toBe('detected')
      const ids = capabilities.models.map((model) => model.id)
      expect(ids).toContain('claude-opus-5')
      expect(ids).toContain('gpt-5.6-terra')
      expect(ids).toContain('adaptive')
    })

    // Addressed by `slug`, not `family_uid`: the slug is what the CLI lists
    // back when it rejects an unknown model, so it is the spelling it accepts.
    it('addresses a family by the id the CLI itself accepts', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const haiku = capabilities.models.find((model) => model.label === 'Claude Haiku 4.5')
      expect(haiku?.id).toBe('claude-haiku-4.5')
    })

    it('carries the short names the user already types, for the search field', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      expect(capabilities.models.find((model) => model.id === 'claude-opus-5')?.aliases).toEqual([
        'opus'
      ])
    })

    it('groups by vendor, read off the family id', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const vendors = new Map(capabilities.models.map((model) => [model.id, model.vendor]))
      expect(vendors.get('claude-opus-5')).toBe('Anthropic')
      expect(vendors.get('gpt-5.6-terra')).toBe('OpenAI')
      expect(vendors.get('glm-5.2')).toBe('Z.ai')
      expect(vendors.get('adaptive')).toBe('Cognition')
    })
  })

  describe('the effort ladder, which is per model', () => {
    // The other half of the report: "mapeamento de effort por modelo também
    // não aparece". Devin has no `--effort` flag — the reasoning level IS the
    // model variant — so a single agent-wide ladder could never describe it.
    it("turns a family's variants into its own ladder, cheapest rung first", async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const opus = capabilities.models.find((model) => model.id === 'claude-opus-5')
      expect(opus?.efforts?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Baixo',
        'Médio',
        'Alto',
        'Extra',
        'Máximo'
      ])
      // Each rung's id is a Devin model id — the CLI has one flag for both axes.
      expect(opus?.efforts?.find((rung) => rung.label === 'Máximo')?.id).toBe('claude-opus-5-max')
      // The delegated rung sends no variant, so Devin's own default decides.
      expect(opus?.efforts?.[0].id).toBe('')
    })

    /**
     * The twins are a second axis — same thinking budget, priority capacity —
     * so they fold onto the rung they twin instead of doubling the ladder.
     * Ten reasoning levels in a ~48px-per-column ramp truncated "Máximo" and
     * "Máximo · rápido" to "Máximo" and "Máxi…": two adjacent steps that look
     * like the same thing, one of them looking broken.
     */
    it('folds a -fast twin onto its own rung instead of making it another one', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const rungs = capabilities.models.find((model) => model.id === 'claude-opus-5')?.efforts
      expect(rungs?.find((rung) => rung.id === 'claude-opus-5-max')?.fastId).toBe(
        'claude-opus-5-max-fast'
      )
      expect(rungs?.some((rung) => rung.id.endsWith('-fast'))).toBe(false)
    })

    it('folds a -priority twin the same way', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const rungs = capabilities.models.find((model) => model.id === 'gpt-5.6-terra')?.efforts
      expect(rungs?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Sem raciocínio',
        'Baixo',
        'Médio',
        'Alto',
        'Extra',
        'Máximo'
      ])
      expect(rungs?.find((rung) => rung.id === 'gpt-5-6-terra-high')?.fastId).toBe(
        'gpt-5-6-terra-high-priority'
      )
    })

    it('keeps a twin that has no rung to fold onto', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'only-fast',
              family_label: 'Only Fast',
              variants: [
                { model_uid: 'only-fast-low-fast', label: 'Only Fast Low Fast' },
                { model_uid: 'only-fast-high', label: 'Only Fast High' }
              ]
            }
          ]
        })
      })
      const rungs = capabilities.models.find((model) => model.id === 'only-fast')?.efforts
      // Dropping it would remove a model the account really has.
      expect(rungs?.map((rung) => rung.id)).toEqual(['', 'only-fast-low-fast', 'only-fast-high'])
    })

    // The CLI lists Opus as `medium, low, high, xhigh, max`; drawn in that
    // order the ramp is a mountain, not a climb.
    it('reorders the rungs the CLI listed out of order', async () => {
      const listed = JSON.parse(REAL_LISTING) as {
        families: Array<{ slug: string; variants: Array<{ model_uid: string }> }>
      }
      const raw = listed.families.find((family) => family.slug === 'claude-opus-5')
      expect(raw?.variants[0].model_uid).toBe('claude-opus-5-medium')
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const first = capabilities.models.find((model) => model.id === 'claude-opus-5')?.efforts?.[1]
      expect(first?.id).toBe('claude-opus-5-low')
    })

    it('reads the rung out of the label when the id is opaque', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      // `MODEL_PRIVATE_12`..`_15`, whose only statement of level is the prose.
      const gpt51 = capabilities.models.find((model) => model.id === 'gpt-5.1')
      expect(gpt51?.efforts?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Sem raciocínio',
        'Baixo',
        'Médio',
        'Alto'
      ])
    })

    it('strips the family name off a rung, and names the bare variant', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      // Labels here are "Claude Opus 4.6", "… Thinking", "… 1M", "… Thinking 1M".
      const opus46 = capabilities.models.find((model) => model.id === 'claude-opus-4.6')
      expect(opus46?.efforts?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Padrão',
        'Thinking',
        '1M',
        'Thinking 1M'
      ])
    })

    it('keeps a long-context twin beside its own rung, not at the end', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const glm = capabilities.models.find((model) => model.id === 'glm-5.2')
      // Unlike the speed twins, a `1M` twin really is a different rung: it
      // buys a different window, and there are only ever a handful.
      expect(glm?.efforts?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Sem raciocínio',
        'Sem raciocínio · 1M',
        'Alto',
        'Alto · 1M',
        'Máximo',
        'Máximo · 1M'
      ])
    })

    // A one-rung ramp is a control that cannot be moved.
    it('grows no ladder for a family with a single variant', async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      expect(capabilities.models.find((model) => model.id === 'adaptive')?.efforts).toBeUndefined()
      expect(
        capabilities.models.find((model) => model.id === 'claude-haiku-4.5')?.efforts
      ).toBeUndefined()
    })

    it("shows what a rung costs, in the CLI's own words", async () => {
      const { capabilities } = await detect({ stdout: REAL_LISTING })
      const max = capabilities.models
        .find((model) => model.id === 'claude-opus-5')
        ?.efforts?.find((rung) => rung.id === 'claude-opus-5-max')
      expect(max?.description).toContain('/ 1M Input')
      expect(max?.contextWindow).toBe(1_000_000)
    })
  })

  describe('an answer that is not the shape anyone expected', () => {
    // The schema is undocumented and the last parser bet on one reading of it.
    // These are the readings that must degrade rather than crash.
    it('skips a family with no usable id, and keeps the rest', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [{ family_label: 'Sem id' }, 42, null, { slug: 'real', family_label: 'Real' }]
        })
      })
      const ids = capabilities.models.map((model) => model.id)
      expect(ids).toContain('real')
      expect(ids).not.toContain('Sem id')
    })

    it('skips a variant with no usable id', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'x',
              family_label: 'X',
              variants: [{ label: 'sem uid' }, 7, { model_uid: 'x-low', label: 'X Low' }]
            }
          ]
        })
      })
      // One usable rung is not a ladder, so no ladder is grown.
      expect(capabilities.models.find((model) => model.id === 'x')?.efforts).toBeUndefined()
    })

    it("takes the family's window from its widest variant when it states none itself", async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'wide',
              family_label: 'Wide',
              variants: [
                { model_uid: 'wide-low', label: 'Wide Low', max_context_tokens: 200000 },
                { model_uid: 'wide-max', label: 'Wide Max', max_context_tokens: 1000000 },
                { model_uid: 'wide-odd', label: 'Wide Odd', max_context_tokens: 'muitos' }
              ]
            }
          ]
        })
      })
      const wide = capabilities.models.find((model) => model.id === 'wide')
      expect(wide?.contextWindow).toBe(1_000_000)
      expect(wide?.traits).toContain('long-context')
    })

    it("names an unknown vendor by the family's own first word, never 'Outros'", async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({ families: [{ slug: 'zephyr-9', family_label: 'Zephyr 9' }] })
      })
      expect(capabilities.models.find((model) => model.id === 'zephyr-9')?.vendor).toBe('Zephyr')
    })

    it('leaves a variant label alone when it does not start with the family name', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'odd',
              family_label: 'Odd',
              aliases: 'not-an-array',
              variants: [
                { model_uid: 'odd-1', label: 'Turbo' },
                { model_uid: 'odd-2', label: 'Odd' },
                { model_uid: 'odd-3', label: 'Oddly Specific' }
              ]
            }
          ]
        })
      })
      const odd = capabilities.models.find((model) => model.id === 'odd')
      expect(odd?.aliases).toBeUndefined()
      expect(odd?.efforts?.map((rung) => rung.label)).toEqual([
        'Automático',
        'Turbo',
        'Padrão',
        'Oddly Specific'
      ])
    })

    it('reads a cost tier as the weight class, the only signal the CLI gives', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'cheap',
              family_label: 'Cheap',
              variants: [
                { model_uid: 'cheap-low', label: 'Cheap Low', cost_tier: 'Free' },
                { model_uid: 'cheap-high', label: 'Cheap High', cost_tier: 'Low cost' }
              ]
            },
            {
              slug: 'mid',
              family_label: 'Mid',
              variants: [{ model_uid: 'mid', label: 'Mid', cost_tier: 'Med cost' }]
            }
          ]
        })
      })
      expect(capabilities.models.find((model) => model.id === 'cheap')?.traits).toContain('fast')
      expect(capabilities.models.find((model) => model.id === 'mid')?.traits).toContain('balanced')
    })

    it('falls back to the cost tier when a variant publishes no summary', async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [
            {
              slug: 'terse',
              family_label: 'Terse',
              variants: [
                { model_uid: 'terse-low', label: 'Terse Low', cost_tier: 'Low cost' },
                { model_uid: 'terse-high', label: 'Terse High', description: 'o mais forte' }
              ]
            }
          ]
        })
      })
      const rungs = capabilities.models.find((model) => model.id === 'terse')?.efforts
      expect(rungs?.find((rung) => rung.id === 'terse-low')?.description).toBe('Low cost')
      expect(rungs?.find((rung) => rung.id === 'terse-high')?.description).toBe('o mais forte')
    })

    it("passes a family's own published description through verbatim", async () => {
      const { capabilities } = await detect({
        stdout: JSON.stringify({
          families: [{ slug: 'd', family_label: 'D', description: 'O melhor para refatorações' }]
        })
      })
      expect(capabilities.models.find((model) => model.id === 'd')?.description).toBe(
        'O melhor para refatorações'
      )
    })
  })
})
