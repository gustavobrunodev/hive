import { describe, expect, it, vi } from 'vitest'
import {
  classifyNpmFailure,
  createAgentInstaller,
  tailLines,
  type AgentInstallEvent
} from './agentInstaller'
import type { AgentMeta, AgentRegistry } from './agentRegistry'
import { createFakeProcessRunner, type FakeProcessRunner } from './processRunner'

/**
 * agent-onboarding AO-R3/AO-R4. The picker's install button runs `npm i -g`
 * for the user; these tests pin the three things that decide whether that is
 * trustworthy: it runs the command the vendor documents, it believes the
 * **probe** rather than npm's exit code, and it says something specific when
 * it fails.
 */

function meta(over: Partial<AgentMeta> & { id: string }): AgentMeta {
  return {
    displayName: over.id,
    description: '',
    available: true,
    version: null,
    detectCommand: over.id,
    installHint: '',
    installable: true,
    installCommand: null,
    docsUrl: '',
    ...over
  }
}

function fakeRegistry(
  packages: Record<string, string | null>,
  refreshed: Record<string, AgentMeta | null> = {}
): { registry: AgentRegistry; refreshOne: ReturnType<typeof vi.fn> } {
  const refreshOne = vi.fn(async (id: string) => refreshed[id] ?? meta({ id }))
  const registry = {
    npmPackageFor: (id: string) => packages[id] ?? null,
    refreshOne
  } as unknown as AgentRegistry
  return { registry, refreshOne }
}

/** Collects the event stream, resolving once the terminal event lands. */
function collect(run: (onEvent: (event: AgentInstallEvent) => void) => () => void): {
  events: AgentInstallEvent[]
  settled: Promise<AgentInstallEvent[]>
  cancel: () => void
} {
  const events: AgentInstallEvent[] = []
  let resolveSettled: (value: AgentInstallEvent[]) => void = () => {}
  const settled = new Promise<AgentInstallEvent[]>((resolve) => (resolveSettled = resolve))
  const cancel = run((event) => {
    events.push(event)
    if (event.type !== 'progress') resolveSettled(events)
  })
  return { events, settled, cancel }
}

function runnerWith(script: Parameters<FakeProcessRunner['script']>[0]): FakeProcessRunner {
  const runner = createFakeProcessRunner()
  runner.script(script)
  return runner
}

describe('agentInstaller', () => {
  it('runs the documented `npm install -g <package>` for the agent', async () => {
    const runner = runnerWith({ chunks: [{ stream: 'stdout', data: 'added 1 package\n' }] })
    const { registry } = fakeRegistry({ 'claude-cli': '@anthropic-ai/claude-code' })
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { settled } = collect((onEvent) => installer.install('claude-cli', onEvent))
    await settled

    expect(runner.calls[0].command).toBe('npm')
    // The same command the vendor's docs give, so the result is
    // indistinguishable from a hand-run install (and `npm uninstall -g` works).
    expect(runner.calls[0].args).toEqual([
      'install',
      '-g',
      '@anthropic-ai/claude-code',
      '--no-fund',
      '--no-audit'
    ])
  })

  it('streams npm output as progress, then reports the re-probed agent', async () => {
    const runner = runnerWith({
      chunks: [
        { stream: 'stderr', data: 'reify:@anthropic-ai/claude-code\n' },
        { stream: 'stdout', data: 'added 214 packages in 12s\n' }
      ]
    })
    const installed = meta({ id: 'claude-cli', available: true, version: '2.1.226 (Claude Code)' })
    const { registry, refreshOne } = fakeRegistry(
      { 'claude-cli': '@anthropic-ai/claude-code' },
      { 'claude-cli': installed }
    )
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { settled } = collect((onEvent) => installer.install('claude-cli', onEvent))
    const events = await settled

    expect(
      events.filter((event) => event.type === 'progress').map((event) => event.message)
    ).toEqual(['reify:@anthropic-ai/claude-code', 'added 214 packages in 12s'])
    expect(refreshOne).toHaveBeenCalledWith('claude-cli')
    expect(events.at(-1)).toEqual({ type: 'done', agent: installed })
  })

  it('does not offer to install an agent with no npm package (AO-R4)', async () => {
    const runner = createFakeProcessRunner()
    const { registry } = fakeRegistry({ devin: null })
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { events, cancel } = collect((onEvent) => installer.install('devin', onEvent))

    expect(events).toEqual([{ type: 'error', reason: 'not-installable' }])
    // Nothing was spawned — the refusal is immediate, not a failed attempt.
    expect(runner.calls).toHaveLength(0)
    // The caller still gets a cancel it can call unconditionally on unmount.
    expect(() => cancel()).not.toThrow()
  })

  it('reports npm-missing when npm itself cannot be spawned', async () => {
    const runner = runnerWith({ spawnError: true })
    const { registry } = fakeRegistry({ 'claude-cli': '@anthropic-ai/claude-code' })
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { settled } = collect((onEvent) => installer.install('claude-cli', onEvent))

    expect(await settled).toEqual([{ type: 'error', reason: 'npm-missing' }])
  })

  it('classifies a failed install and keeps npm’s last words as the detail', async () => {
    const runner = runnerWith({
      code: 1,
      chunks: [
        { stream: 'stderr', data: 'npm ERR! code EACCES\nnpm ERR! syscall mkdir\n' },
        { stream: 'stderr', data: "npm ERR! Error: EACCES: permission denied, mkdir '/usr/lib'\n" }
      ]
    })
    const { registry } = fakeRegistry({ 'github-copilot': '@github/copilot' })
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { settled } = collect((onEvent) => installer.install('github-copilot', onEvent))
    const last = (await settled).at(-1)

    expect(last).toMatchObject({ type: 'error', reason: 'permission' })
    expect(last).toHaveProperty('detail', expect.stringContaining('EACCES'))
  })

  it('trusts the probe, not the exit code: npm succeeding with no runnable CLI is a failure', async () => {
    const runner = runnerWith({
      code: 0,
      chunks: [{ stream: 'stdout', data: 'added 1 package\n' }]
    })
    const { registry } = fakeRegistry(
      { 'claude-cli': '@anthropic-ai/claude-code' },
      { 'claude-cli': meta({ id: 'claude-cli', available: false }) }
    )
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { settled } = collect((onEvent) => installer.install('claude-cli', onEvent))

    expect((await settled).at(-1)).toMatchObject({ type: 'error', reason: 'not-detected' })
  })

  it('cancelling kills npm and stops delivering events', async () => {
    const runner = runnerWith({ delayMs: 50, chunks: [{ stream: 'stdout', data: 'working\n' }] })
    const { registry, refreshOne } = fakeRegistry({ 'claude-cli': '@anthropic-ai/claude-code' })
    const installer = createAgentInstaller({ processRunner: runner, registry })

    const { events, cancel } = collect((onEvent) => installer.install('claude-cli', onEvent))
    cancel()
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(events).toEqual([])
    expect(refreshOne).not.toHaveBeenCalled()
  })
})

describe('classifyNpmFailure', () => {
  it('names the two failures a user can act on, and admits when it cannot tell', () => {
    expect(classifyNpmFailure('npm ERR! code EACCES')).toBe('permission')
    expect(classifyNpmFailure('Error: EPERM: operation not permitted')).toBe('permission')
    expect(classifyNpmFailure('npm ERR! network request to registry failed')).toBe('network')
    expect(classifyNpmFailure('npm ERR! code ENOTFOUND')).toBe('network')
    expect(classifyNpmFailure('npm ERR! code E404 Not Found')).toBe('failed')
  })
})

describe('tailLines', () => {
  it('keeps the last non-empty lines and nothing when there are none', () => {
    expect(tailLines('a\n\nb\nc\n', 2)).toBe('b\nc')
    expect(tailLines('   \n\n')).toBeUndefined()
  })
})
