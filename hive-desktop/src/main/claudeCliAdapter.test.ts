import { describe, expect, it, vi } from 'vitest'
import { createFakeProcessRunner, type ProcessHandle, type ProcessRunner } from './processRunner'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import type { AgentAdapter, AgentEvent } from './agentAdapter'

/** Pulls exactly `count` events off a session's `events` async-iterable. */
async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) {
    const { value } = await iterator.next()
    out.push(value)
  }
  return out
}

/**
 * Wraps a `FakeProcessRunner`'s `run()` so every returned `ProcessHandle`'s
 * `kill()` is observable via a spy, without changing fake-runner behavior
 * otherwise. Used to prove `stop()` reaches the real process handle.
 */
function withKillSpy(runner: ProcessRunner): {
  runner: ProcessRunner
  killSpy: ReturnType<typeof vi.fn>
} {
  const killSpy = vi.fn()
  const wrapped: ProcessRunner = {
    run(command, args, opts) {
      const handle = runner.run(command, args, opts)
      const spiedHandle: ProcessHandle = {
        output: handle.output,
        exitCode: handle.exitCode,
        kill(signal) {
          killSpy(signal)
          handle.kill(signal)
        }
      }
      return spiedHandle
    }
  }
  return { runner: wrapped, killSpy }
}

describe('ClaudeCliAdapter — contract', () => {
  it('structurally satisfies AgentAdapter: id, displayName, capabilities(), startSession() all present and well-typed', () => {
    const adapter: AgentAdapter = createClaudeCliAdapter(createFakeProcessRunner())

    expect(adapter.id).toBe('claude-cli')
    expect(adapter.displayName).toBe('Claude CLI')
    expect(typeof adapter.capabilities).toBe('function')
    expect(typeof adapter.startSession).toBe('function')

    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })
    expect(typeof session.send).toBe('function')
    expect(typeof session.runWorkflow).toBe('function')
    expect(typeof session.stop).toBe('function')
    expect(typeof session.events[Symbol.asyncIterator]).toBe('function')
  })

  it('capabilities() returns non-empty, well-formed, curated model/effort lists and supportsAttachments: false', () => {
    const adapter = createClaudeCliAdapter(createFakeProcessRunner())
    const caps = adapter.capabilities()

    expect(caps.models.length).toBeGreaterThan(0)
    expect(caps.efforts.length).toBeGreaterThan(0)
    for (const model of caps.models) {
      expect(typeof model.id).toBe('string')
      expect(model.id.length).toBeGreaterThan(0)
      expect(typeof model.label).toBe('string')
      expect(model.label.length).toBeGreaterThan(0)
    }
    for (const effort of caps.efforts) {
      expect(typeof effort.id).toBe('string')
      expect(effort.id.length).toBeGreaterThan(0)
      expect(typeof effort.label).toBe('string')
      expect(effort.label.length).toBeGreaterThan(0)
    }
    expect(caps.supportsAttachments).toBe(false)
  })
})

describe('ClaudeCliAdapter — session turns', () => {
  it('a scripted successful turn streams token event(s) followed by a done event, in order', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: 'Hello' },
        { stream: 'stdout', data: ', world' }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'hi there' })
    const events = await take(session.events, 3)

    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ', world' },
      { type: 'done' }
    ])

    // Sanity check on the invocation: cwd is the workspace, model/effort/
    // permission-mode are forwarded as flags (all verified live against a
    // real `claude` binary — see claudeCliAdapter.ts header).
    expect(fakeRunner.calls).toHaveLength(1)
    expect(fakeRunner.calls[0].command).toBe('claude')
    expect(fakeRunner.calls[0].args).toEqual([
      '-p',
      'hi there',
      '--model',
      'claude-sonnet-4-5',
      '--effort',
      'medium',
      '--permission-mode',
      'acceptEdits'
    ])
    expect(fakeRunner.calls[0].opts).toEqual({ cwd: '/ws' })
  })

  it('a scripted non-zero exit produces an error event', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ chunks: [{ stream: 'stderr', data: 'boom' }], code: 1 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'low'
    })

    session.send({ text: 'do a thing' })
    const events = await take(session.events, 2)

    expect(events[0]).toEqual({ type: 'token', text: 'boom' })
    expect(events[1].type).toBe('error')
    expect((events[1] as { type: 'error'; message: string }).message).toContain('code 1')
  })

  it('runWorkflow() spawns a turn (placeholder command) and does not crash', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: 'working on it' }], code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'high'
    })

    expect(() => session.runWorkflow({ key: 'prd' })).not.toThrow()
    const events = await take(session.events, 2)

    expect(events).toEqual([{ type: 'token', text: 'working on it' }, { type: 'done' }])
    expect(fakeRunner.calls[0].args).toContain('Run the "prd" workflow.')
  })

  it("stop() calls the underlying process handle's kill()", async () => {
    const { runner: spiedRunner, killSpy } = withKillSpy(createFakeProcessRunner())
    // No script queued: the fake runner's default is an immediately-
    // successful empty process, which is fine here — this test only cares
    // that `stop()` reaches `kill()`, not about timing/output.
    const adapter = createClaudeCliAdapter(spiedRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'hi' })
    session.stop()

    expect(killSpy).toHaveBeenCalledTimes(1)
  })

  it('stop() before any turn has started is a safe no-op', () => {
    const adapter = createClaudeCliAdapter(createFakeProcessRunner())
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    expect(() => session.stop()).not.toThrow()
  })

  // chat-controls (CC-R1.5): a user stop() ends the turn with `interrupted`,
  // NOT `error` — a deliberate interrupt is a normal outcome, so the UI keeps
  // partial output and shows no error Alert.
  it('a user stop() mid-turn emits an interrupted event, not error', async () => {
    const fakeRunner = createFakeProcessRunner()
    // delayMs keeps the turn "running" so stop() lands before it settles.
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: 'partial' }], code: 0, delayMs: 50 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'long task' })
    session.stop()

    const events = await take(session.events, 1)
    expect(events).toEqual([{ type: 'interrupted' }])
  })

  it('after an interrupt, a fresh turn still ends in done (session stays usable)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0, delayMs: 50 }) // first turn, interrupted
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 }) // second turn
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'first' })
    session.stop()
    await take(session.events, 1) // drain the interrupted event

    session.send({ text: 'second' })
    const events = await take(session.events, 2)
    expect(events).toEqual([{ type: 'token', text: 'ok' }, { type: 'done' }])
  })
})
