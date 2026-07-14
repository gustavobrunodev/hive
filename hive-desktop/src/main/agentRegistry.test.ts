import { describe, expect, it } from 'vitest'
import { createAgentRegistry } from './agentRegistry'
import { createFakeProcessRunner } from './processRunner'

describe('agentRegistry', () => {
  it('lists claude-cli as available and devin as an unavailable placeholder', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    const list = registry.list()

    const claude = list.find((a) => a.id === 'claude-cli')
    const devin = list.find((a) => a.id === 'devin')
    expect(claude?.available).toBe(true)
    expect(devin?.available).toBe(false)
    expect(devin?.displayName).toBe('Devin')
  })

  it('defaultId() is the first available agent (claude-cli)', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.defaultId()).toBe('claude-cli')
  })

  it('get() returns a live adapter for an available id and null for unavailable/unknown', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.get('claude-cli')).not.toBeNull()
    expect(registry.get('devin')).toBeNull()
    expect(registry.get('nope')).toBeNull()
  })

  it('get() memoizes the adapter (same instance across calls)', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.get('claude-cli')).toBe(registry.get('claude-cli'))
  })

  it('resolve() returns the requested available adapter', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    const resolved = registry.resolve('claude-cli')
    expect(resolved.id).toBe('claude-cli')
    expect(resolved.adapter).not.toBeNull()
  })

  it('resolve() falls back to the default for null/unknown/unavailable ids (AG-R2.2)', () => {
    const registry = createAgentRegistry(createFakeProcessRunner())
    expect(registry.resolve(null).id).toBe('claude-cli')
    expect(registry.resolve('nope').id).toBe('claude-cli')
    expect(registry.resolve('devin').id).toBe('claude-cli')
  })
})
