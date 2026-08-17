import { describe, expect, it, vi } from 'vitest'
import { createShellService } from './shellService'
import type { AgentRegistry } from './agentRegistry'
import type { ConfigStore } from './configStore'
import type { AgentAdapter, ShellBinding } from './agentAdapter'
import type { ShellInfo } from './shellCatalog'

/**
 * agent-terminal (AT-R2/AT-R4/AT-R5). This module joins three sources that can
 * each be right while the join is wrong — what's installed, what was picked,
 * and what each agent makes of it — so the cases below are about the seams:
 * a choice whose shell was uninstalled, an agent with no binding at all, and
 * an id arriving over IPC that no machine ever had.
 */

const zsh: ShellInfo = { id: 'zsh', path: '/usr/bin/zsh', family: 'zsh', systemDefault: true }
const bash: ShellInfo = { id: 'bash', path: '/bin/bash', family: 'bash', systemDefault: false }
const fish: ShellInfo = { id: 'fish', path: '/usr/bin/fish', family: 'fish', systemDefault: false }

function fakeConfig(initial: string | null = null): ConfigStore & { value: string | null } {
  const store = {
    value: initial,
    getAgentShell: () => store.value,
    setAgentShell: (id: string | null) => {
      store.value = id
    },
    getEnabledAgents: () => ['claude-cli']
  }
  return store as unknown as ConfigStore & { value: string | null }
}

function fakeRegistry(adapters: Array<Partial<AgentAdapter> & { id: string }>): AgentRegistry {
  return {
    ids: () => adapters.map((adapter) => adapter.id),
    get: (id: string) => (adapters.find((adapter) => adapter.id === id) as AgentAdapter) ?? null
  } as unknown as AgentRegistry
}

const claudeLike = {
  id: 'claude-cli',
  displayName: 'Claude CLI',
  shellBinding: (shell: ShellInfo): ShellBinding =>
    shell.family === 'zsh'
      ? { support: 'native', env: { CLAUDE_CODE_SHELL: shell.path } }
      : { support: 'launch-only', note: 'posix-bash-zsh-only', env: {} }
}

describe('ShellService.list', () => {
  it('reports what a turn would run in right now, with automatic unselected', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [bash, zsh])
    const view = service.list()
    expect(view.selectedId).toBeNull()
    expect(view.resolvedId).toBe('zsh')
    expect(view.missingSelection).toBe(false)
    expect(view.shells.map((shell) => shell.id)).toEqual(['bash', 'zsh'])
  })

  it('marks exactly the row automatic resolves to', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [bash, zsh])
    const marked = service.list().shells.filter((shell) => shell.systemDefault)
    expect(marked.map((shell) => shell.id)).toEqual(['zsh'])
  })

  it('carries each agent caveat as a code, never as a sentence (main holds no copy)', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [zsh, fish])
    const view = service.list()
    expect(view.shells[0].agents).toEqual([
      { agentId: 'claude-cli', displayName: 'Claude CLI', support: 'native', note: undefined }
    ])
    expect(view.shells[1].agents[0]).toMatchObject({
      support: 'launch-only',
      note: 'posix-bash-zsh-only'
    })
  })

  it('treats an adapter with no binding as launch-only rather than claiming support', () => {
    const service = createShellService(
      fakeConfig(),
      fakeRegistry([{ id: 'claude-cli', displayName: 'Sem binding' }]),
      () => [zsh]
    )
    expect(service.list().shells[0].agents[0]).toMatchObject({
      support: 'launch-only',
      note: 'no-cli-binding'
    })
  })

  it('flags a choice whose shell is no longer installed, and keeps it on disk (D-AT-4)', () => {
    const config = fakeConfig('git-bash')
    const service = createShellService(config, fakeRegistry([claudeLike]), () => [zsh, bash])
    const view = service.list()
    expect(view.missingSelection).toBe(true)
    expect(view.selectedId).toBe('git-bash')
    expect(view.resolvedId).toBe('zsh')
    // Not erased: reinstalling Git Bash restores the user's choice by itself.
    expect(config.value).toBe('git-bash')
  })

  it('caches detection and re-runs it only when asked', () => {
    const detect = vi.fn(() => [zsh])
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), detect)
    service.list()
    service.list()
    expect(detect).toHaveBeenCalledTimes(1)
    service.list(true)
    expect(detect).toHaveBeenCalledTimes(2)
  })

  it('falls back to every registered agent when the user has none enabled', () => {
    const config = {
      getAgentShell: () => null,
      setAgentShell: () => {},
      getEnabledAgents: () => null
    } as unknown as ConfigStore
    const service = createShellService(
      config,
      fakeRegistry([claudeLike, { id: 'devin', displayName: 'Devin' }]),
      () => [zsh]
    )
    expect(service.list().shells[0].agents.map((agent) => agent.agentId)).toEqual([
      'claude-cli',
      'devin'
    ])
  })
})

describe('ShellService.select / current', () => {
  it('persists a detected shell and applies it to the next turn', () => {
    const config = fakeConfig()
    const service = createShellService(config, fakeRegistry([claudeLike]), () => [zsh, bash])
    service.select('bash')
    expect(config.value).toBe('bash')
    expect(service.current()?.path).toBe('/bin/bash')
  })

  it('ignores an id no machine reported, instead of persisting an unresolvable choice', () => {
    const config = fakeConfig('bash')
    const service = createShellService(config, fakeRegistry([claudeLike]), () => [zsh, bash])
    service.select('nao-existe')
    expect(config.value).toBe('bash')
  })

  it('null restores automatic', () => {
    const config = fakeConfig('bash')
    const service = createShellService(config, fakeRegistry([claudeLike]), () => [zsh, bash])
    service.select(null)
    expect(config.value).toBeNull()
    expect(service.current()?.id).toBe('zsh')
  })

  it('current() is null when the machine reported no shell at all', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [])
    expect(service.current()).toBeNull()
    expect(service.list().resolvedId).toBeNull()
  })
})
