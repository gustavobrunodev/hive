import { describe, expect, it, vi } from 'vitest'
import { createShellService } from './shellService'
import type { AgentRegistry } from './agentRegistry'
import type { ConfigStore } from './configStore'
import type { AgentAdapter, ShellBinding, ShellContext } from './agentAdapter'
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
    defaultId: () => adapters[0]?.id ?? '',
    get: (id: string) => (adapters.find((adapter) => adapter.id === id) as AgentAdapter) ?? null
  } as unknown as AgentRegistry
}

const claudeLike = {
  id: 'claude-cli',
  displayName: 'Claude CLI',
  commandName: 'claude',
  shellBinding: (shell: ShellInfo, context: ShellContext): ShellBinding =>
    shell.family === 'zsh'
      ? { support: 'native', runsIn: shell.id, env: { CLAUDE_CODE_SHELL: shell.path } }
      : {
          support: 'fallback',
          note: 'posix-bash-zsh-only',
          runsIn: context.available.find((entry) => entry.family === 'zsh')?.id ?? null,
          env: {}
        }
}

/** A Windows-shaped stand-in for the one case the whole feature turns on: cmd. */
const cmd: ShellInfo = {
  id: 'cmd',
  path: 'C:\\Windows\\System32\\cmd.exe',
  family: 'cmd',
  systemDefault: true
}
const gitBash: ShellInfo = {
  id: 'git-bash',
  path: 'C:\\Program Files\\Git\\bin\\bash.exe',
  family: 'bash',
  systemDefault: false
}
const windowsClaude = {
  id: 'claude-cli',
  displayName: 'Claude CLI',
  commandName: 'claude',
  shellBinding: (shell: ShellInfo): ShellBinding =>
    shell.id === 'git-bash'
      ? { support: 'native', note: 'windows-git-bash', runsIn: 'git-bash', env: {} }
      : { support: 'fallback', note: 'cmd-no-executor', runsIn: 'git-bash', env: {} }
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
    const marked = service.list().shells.filter((shell) => shell.automatic)
    expect(marked.map((shell) => shell.id)).toEqual(['zsh'])
  })

  it('carries each agent caveat as a code, never as a sentence (main holds no copy)', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [zsh, fish])
    const view = service.list()
    expect(view.shells[0].agents).toEqual([
      {
        agentId: 'claude-cli',
        displayName: 'Claude CLI',
        support: 'native',
        note: undefined,
        runsIn: 'zsh'
      }
    ])
    expect(view.shells[1].agents[0]).toMatchObject({
      support: 'fallback',
      note: 'posix-bash-zsh-only',
      runsIn: 'zsh'
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

  /**
   * The bug this feature was reopened for, at the level above the adapter. On
   * Windows the machine's own default is cmd — the one shell no agent executes
   * a command in — so "Automático = o padrão do sistema" shipped a default
   * guaranteed to fall back, and the user who never touched the setting got
   * whatever the CLI picked. Automatic now lands on a shell an agent runs in.
   */
  it('automatic skips the platform default when no agent can run in it', () => {
    const service = createShellService(
      fakeConfig(),
      fakeRegistry([windowsClaude]),
      () => [cmd, gitBash],
      'win32'
    )
    const view = service.list()
    expect(view.resolvedId).toBe('git-bash')
    expect(view.shells.filter((shell) => shell.automatic).map((shell) => shell.id)).toEqual([
      'git-bash'
    ])
  })

  it('automatic still follows the platform default when an agent runs in it', () => {
    // POSIX: $SHELL is both the machine's answer and one the CLI accepts, so
    // there is nothing to improve on and nothing to explain.
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [bash, zsh])
    expect(service.list().resolvedId).toBe('zsh')
  })

  it('automatic keeps the platform default when nothing else is better either', () => {
    const service = createShellService(
      fakeConfig(),
      fakeRegistry([windowsClaude]),
      () => [cmd],
      'win32'
    )
    expect(service.list().resolvedId).toBe('cmd')
  })

  it('carries the real command line for each row, and the platform it was built on', () => {
    const service = createShellService(fakeConfig(), fakeRegistry([claudeLike]), () => [zsh])
    const view = service.list()
    expect(view.platform).toBe(process.platform)
    // Drawn from `shellSpawnTarget`, so it is the argv, not a retelling of it.
    // The CLI's own path is whatever this machine resolved (or the bare name
    // where it isn't installed), so the assertion is on the shape around it —
    // `exec`, the quoting, the flags — which is the part that is ours.
    expect(view.shells[0].preview).toMatch(/^\/usr\/bin\/zsh -c exec '.*claude.*' '-p' '…'$/)
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
