import { describe, expect, it } from 'vitest'
import { createAgentRegistry } from './agentRegistry'
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
})
