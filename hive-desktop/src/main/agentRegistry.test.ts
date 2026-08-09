import { describe, expect, it } from 'vitest'
import { createAgentRegistry, parseVersionOutput } from './agentRegistry'
import { createFakeProcessRunner } from './processRunner'

describe('agentRegistry (multi-agent)', () => {
  it('registers claude-cli, github-copilot and devin as real adapters', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.ids()).toEqual(['claude-cli', 'github-copilot', 'devin'])
    expect(registry.get('claude-cli')).not.toBeNull()
    expect(registry.get('github-copilot')).not.toBeNull()
    expect(registry.get('devin')).not.toBeNull()
    expect(registry.get('nope')).toBeNull()
  })

  it('defaultId() is claude-cli', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.defaultId()).toBe('claude-cli')
  })

  it('get() memoizes the adapter (same instance across calls)', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.get('devin')).toBe(registry.get('devin'))
  })

  it('detect() reports available:true for a CLI whose --version probe spawns', async () => {
    const runner = createFakeProcessRunner()
    // Default fake behavior is an immediately-successful process (exit 0) → present.
    const registry = createAgentRegistry(runner)
    const metas = await registry.detect()

    expect(metas.map((m) => m.id)).toEqual(['claude-cli', 'github-copilot', 'devin'])
    expect(metas.every((m) => m.available)).toBe(true)
    // Every meta carries install guidance for the disabled-card affordance.
    for (const meta of metas) {
      expect(meta.installHint.length).toBeGreaterThan(0)
      expect(meta.docsUrl.startsWith('http')).toBe(true)
    }
    // One `<cmd> --version` probe per agent.
    expect(runner.calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'claude --version',
      'copilot --version',
      'devin --version'
    ])
  })

  it('detect() reports available:false for a CLI whose binary is missing (spawn error)', async () => {
    const runner = createFakeProcessRunner()
    runner.script({}) // claude → present
    runner.script({ spawnError: true }) // copilot → missing (ENOENT)
    runner.script({ spawnError: true }) // devin → missing
    const registry = createAgentRegistry(runner)
    const metas = await registry.detect()

    expect(metas.find((m) => m.id === 'claude-cli')?.available).toBe(true)
    expect(metas.find((m) => m.id === 'github-copilot')?.available).toBe(false)
    expect(metas.find((m) => m.id === 'devin')?.available).toBe(false)
  })

  it('detect() caches results; refresh re-probes', async () => {
    const runner = createFakeProcessRunner()
    const registry = createAgentRegistry(runner)

    await registry.detect()
    const callsAfterFirst = runner.calls.length
    await registry.detect() // cached — no new probes
    expect(runner.calls.length).toBe(callsAfterFirst)

    await registry.detect(true) // refresh — probes again
    expect(runner.calls.length).toBe(callsAfterFirst * 2)
  })

  it('resolve() returns the requested adapter, or falls back to the default for null/unknown', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.resolve('devin').id).toBe('devin')
    expect(registry.resolve(null).id).toBe('claude-cli')
    expect(registry.resolve('nope').id).toBe('claude-cli')
  })

  // --- agent-onboarding (M17) ---------------------------------------------

  it('keeps the version a detected CLI answered with, as the evidence the card shows', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: '2.1.226 (Claude Code)\n' }] })
    runner.script({ spawnError: true })
    runner.script({ spawnError: true })
    const metas = await createAgentRegistry(runner).detect()

    expect(metas.find((m) => m.id === 'claude-cli')?.version).toBe('2.1.226 (Claude Code)')
    // An agent that isn't there has no version to report — not an empty string.
    expect(metas.find((m) => m.id === 'devin')?.version).toBeNull()
  })

  it('marks only the npm-published CLIs installable, with the command it would run (AO-R4)', async () => {
    const metas = await createAgentRegistry(createFakeProcessRunner()).detect()
    const byId = Object.fromEntries(metas.map((meta) => [meta.id, meta]))

    expect(byId['claude-cli'].installable).toBe(true)
    expect(byId['claude-cli'].installCommand).toBe('npm install -g @anthropic-ai/claude-code')
    expect(byId['github-copilot'].installCommand).toBe('npm install -g @github/copilot')
    // Devin needs an account and a browser login Hive can't perform.
    expect(byId['devin'].installable).toBe(false)
    expect(byId['devin'].installCommand).toBeNull()
  })

  it('refreshOne() re-probes a single agent and folds the answer into the cache', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ spawnError: true }) // claude → missing on the first sweep
    const registry = createAgentRegistry(runner)
    await registry.detect()
    expect((await registry.detect()).find((m) => m.id === 'claude-cli')?.available).toBe(false)

    const callsBefore = runner.calls.length
    runner.script({ chunks: [{ stream: 'stdout', data: '2.1.226\n' }] })
    const refreshed = await registry.refreshOne('claude-cli')

    expect(refreshed?.available).toBe(true)
    // Exactly one probe — the other two agents' results were still good.
    expect(runner.calls.length).toBe(callsBefore + 1)
    // …and the cached sweep now agrees, so no restart is needed (AO-R2).
    expect((await registry.detect()).find((m) => m.id === 'claude-cli')?.available).toBe(true)
    expect(await registry.refreshOne('nope')).toBeNull()
  })

  it('npmPackageFor()/describe() answer for a known id and refuse an unknown one', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.npmPackageFor('github-copilot')).toBe('@github/copilot')
    expect(registry.npmPackageFor('devin')).toBeNull()
    expect(registry.npmPackageFor('nope')).toBeNull()
    expect(registry.describe('devin')?.detectCommand).toBe('devin')
    expect(registry.describe('nope')).toBeNull()
  })
})

describe('parseVersionOutput', () => {
  it('keeps the first non-empty line, strips ANSI, and caps a banner', () => {
    expect(parseVersionOutput('\n\n2.1.226 (Claude Code)\nextra\n')).toBe('2.1.226 (Claude Code)')
    expect(parseVersionOutput('[32m1.4.0[0m')).toBe('1.4.0')
    expect(parseVersionOutput('   \n ')).toBeNull()
    expect(parseVersionOutput('x'.repeat(80))).toHaveLength(60)
  })
})
