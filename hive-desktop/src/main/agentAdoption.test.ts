import { describe, expect, it } from 'vitest'
import { reconcileAgents } from './agentAdoption'
import type { AgentMeta } from './agentRegistry'

function agent(id: string, available: boolean): AgentMeta {
  return {
    id,
    displayName: id,
    description: '',
    available,
    version: available ? '1.0.0' : null,
    detectCommand: id,
    installHint: '',
    installable: false,
    installCommand: null,
    docsUrl: ''
  }
}

describe('reconcileAgents — adopting an agent installed after onboarding', () => {
  it('enables an agent that was never offered before', () => {
    // The reported defect, exactly: `devin` detected, enabled set written at
    // onboarding, and no path from one to the other.
    const result = reconcileAgents({
      detected: [agent('claude-cli', true), agent('github-copilot', true), agent('devin', true)],
      enabled: ['claude-cli', 'github-copilot'],
      known: ['claude-cli', 'github-copilot']
    })

    expect(result.adopted).toEqual(['devin'])
    expect(result.enabled).toEqual(['claude-cli', 'github-copilot', 'devin'])
    expect(result.known).toContain('devin')
  })

  it('never re-enables an agent the user deliberately switched off', () => {
    // This is the reason `known` exists at all. `devin` is installed and
    // detected, and the user has turned it off in the profile sheet — a
    // preference that reverts on the next launch is worse than none.
    const result = reconcileAgents({
      detected: [agent('claude-cli', true), agent('devin', true)],
      enabled: ['claude-cli'],
      known: ['claude-cli', 'devin']
    })

    expect(result.adopted).toEqual([])
    expect(result.enabled).toBeNull()
  })

  it('adopts on a config that predates the record — the reporter’s own case', () => {
    // Migration. The first version of this seeded `known` from everything
    // detected and adopted nothing, which reads sensible and is wrong: run it
    // against the config actually on the reporter's disk and Devin is recorded
    // as "already offered" and enabled never. The whole fix would have shipped
    // without fixing the reported bug.
    const result = reconcileAgents({
      detected: [agent('claude-cli', true), agent('github-copilot', true), agent('devin', true)],
      enabled: ['claude-cli', 'github-copilot'],
      known: null
    })

    expect(result.adopted).toEqual(['devin'])
    expect(result.enabled).toEqual(['claude-cli', 'github-copilot', 'devin'])
    expect(result.known).toEqual(['claude-cli', 'github-copilot', 'devin'])
  })

  it('stops re-adopting once the choice has been recorded', () => {
    // The second half of the migration trade: the one-time re-enable is
    // recoverable *because* switching it off now writes the record that makes
    // the decision stick.
    const first = reconcileAgents({
      detected: [agent('claude-cli', true), agent('devin', true)],
      enabled: ['claude-cli'],
      known: null
    })
    expect(first.adopted).toEqual(['devin'])

    // The user switches Devin back off; `known` now holds it.
    const second = reconcileAgents({
      detected: [agent('claude-cli', true), agent('devin', true)],
      enabled: ['claude-cli'],
      known: first.known
    })

    expect(second.adopted).toEqual([])
    expect(second.enabled).toBeNull()
  })

  it('leaves onboarding alone: no enabled set yet means the setup screen owns it', () => {
    // `AgentSetup` also picks the default agent; writing an enabled set here
    // would let the user skip that.
    const result = reconcileAgents({
      detected: [agent('claude-cli', true)],
      enabled: null,
      known: null
    })

    expect(result).toEqual({ enabled: null, known: null, adopted: [] })
  })

  it('ignores an agent that is registered but not installed', () => {
    const result = reconcileAgents({
      detected: [agent('claude-cli', true), agent('devin', false)],
      enabled: ['claude-cli'],
      known: ['claude-cli']
    })

    expect(result.adopted).toEqual([])
    expect(result.known).toBeNull()
  })

  it('records a newly detected agent that was already enabled, without reporting news', () => {
    // It should not read as "new" the next time round either.
    const result = reconcileAgents({
      detected: [agent('claude-cli', true), agent('devin', true)],
      enabled: ['claude-cli', 'devin'],
      known: ['claude-cli']
    })

    expect(result.adopted).toEqual([])
    expect(result.enabled).toBeNull()
    expect(result.known).toEqual(['claude-cli', 'devin'])
  })

  it('says nothing to persist when the world has not changed', () => {
    const result = reconcileAgents({
      detected: [agent('claude-cli', true)],
      enabled: ['claude-cli'],
      known: ['claude-cli']
    })

    expect(result).toEqual({ enabled: null, known: null, adopted: [] })
  })
})
