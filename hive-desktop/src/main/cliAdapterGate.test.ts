import { describe, expect, it, vi } from 'vitest'
import { createCliAgentSession, type CliAdapterConfig } from './cliAdapterCore'
import { createFakeProcessRunner } from './processRunner'
import type { AgentEvent, AgentSession } from './agentAdapter'

/**
 * The shared engine's two new powers (aws-bedrock): a **gate** that runs before
 * a turn spawns, and a **one-shot retry** for a `--resume` handle the CLI no
 * longer recognises.
 *
 * Both exist because of the same reported failure, and both are tested here on
 * the generic engine rather than through the Claude adapter — they are engine
 * behaviour, and an adapter is free to use neither.
 */

/** Drains a session's events until a terminal one, and returns everything seen. */
async function drain(session: AgentSession): Promise<AgentEvent[]> {
  const seen: AgentEvent[] = []
  for await (const event of session.events) {
    seen.push(event)
    if (event.type === 'done' || event.type === 'error' || event.type === 'interrupted') break
  }
  return seen
}

function sessionWith(
  runner: ReturnType<typeof createFakeProcessRunner>,
  config: Partial<Parameters<typeof createCliAgentSession>[2]>
): AgentSession {
  return createCliAgentSession(runner, { workspace: '/ws' }, {
    command: 'fake',
    errorLabel: 'fake',
    buildArgs: (prompt, turn) => ['-p', prompt, ...(turn.resume ? ['--resume', turn.resume] : [])],
    ...config
  } as CliAdapterConfig)
}

describe('preflight gate', () => {
  it('spawns nothing until the gate resolves, then runs the turn normally', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'oi' }], code: 0 })
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const session = sessionWith(runner, {
      preflight: async () => {
        await gate
        return { ok: true }
      }
    })
    session.send({ text: 'oi' })
    await Promise.resolve()
    expect(runner.calls).toHaveLength(0)
    release()
    const events = await drain(session)
    expect(runner.calls).toHaveLength(1)
    expect(events[events.length - 1].type).toBe('done')
  })

  it('fails the turn with the gate message, having spawned nothing', async () => {
    const runner = createFakeProcessRunner()
    const session = sessionWith(runner, {
      preflight: () => Promise.resolve({ ok: false, message: 'aws-auth:canceled' })
    })
    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session)
    expect(runner.calls).toHaveLength(0)
    expect(events).toEqual([{ type: 'error', message: 'aws-auth:canceled', turnId: 't1' }])
  })

  it('lets the gate narrate into the turn while it works', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    const session = sessionWith(runner, {
      preflight: (context) => {
        context.emit({ type: 'auth', provider: 'aws', phase: 'waiting', turnId: context.turnId })
        return Promise.resolve({ ok: true })
      }
    })
    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session)
    expect(events[0]).toEqual({ type: 'auth', provider: 'aws', phase: 'waiting', turnId: 't1' })
  })

  it('a turn stopped while the gate is open settles as interrupted and never spawns', async () => {
    // Stop has to work while the turn has no process at all — it may be sitting
    // in a browser login, which is the longest a turn ever waits for anything.
    const runner = createFakeProcessRunner()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const session = sessionWith(runner, {
      preflight: async () => {
        await gate
        return { ok: true }
      }
    })
    session.send({ text: 'oi', turnId: 't1' })
    await Promise.resolve()
    session.interrupt('t1')
    release()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(runner.calls).toHaveLength(0)
    const events = await drain(session)
    expect(events[0]).toEqual({ type: 'interrupted', turnId: 't1' })
  })

  it('gates every entry point, including a workflow command', async () => {
    const runner = createFakeProcessRunner()
    const preflight = vi.fn().mockResolvedValue({ ok: true })
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    const session = sessionWith(runner, { preflight })
    session.runWorkflow({ key: 'bmad-prd' })
    await drain(session)
    expect(preflight).toHaveBeenCalledOnce()
  })
})

describe('retry without a dead resume handle', () => {
  const STALE = 'No conversation found with session ID: 8d2c3ac9'

  it('re-runs the turn once without --resume, and the answer arrives normally', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: STALE }], code: 1 })
    runner.script({ chunks: [{ stream: 'stdout', data: 'resposta' }], code: 0 })
    const session = sessionWith(runner, {
      retryWithoutResume: (detail) => detail.includes('No conversation found')
    })
    session.send({ text: 'oi', resume: 'dead-id', turnId: 't1' })
    const events = await drain(session)
    expect(runner.calls[0].args).toContain('--resume')
    expect(runner.calls[1].args).not.toContain('--resume')
    expect(events.some((event) => event.type === 'error')).toBe(false)
    expect(events[events.length - 1].type).toBe('done')
  })

  it('does not retry when the turn had already produced output', async () => {
    // A retry there would repeat text the transcript already shows.
    const runner = createFakeProcessRunner()
    runner.script({
      chunks: [
        { stream: 'stdout', data: 'metade da resposta' },
        { stream: 'stderr', data: STALE }
      ],
      code: 1
    })
    const session = sessionWith(runner, { retryWithoutResume: () => true })
    session.send({ text: 'oi', resume: 'dead-id' })
    const events = await drain(session)
    expect(runner.calls).toHaveLength(1)
    expect(events[events.length - 1].type).toBe('error')
  })

  it('does not retry a turn that had no resume handle to blame', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: STALE }], code: 1 })
    const session = sessionWith(runner, { retryWithoutResume: () => true })
    session.send({ text: 'oi' })
    await drain(session)
    expect(runner.calls).toHaveLength(1)
  })

  it('gives up after the second attempt rather than looping', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: STALE }], code: 1 })
    runner.script({ chunks: [{ stream: 'stderr', data: STALE }], code: 1 })
    const session = sessionWith(runner, { retryWithoutResume: () => true })
    session.send({ text: 'oi', resume: 'dead-id' })
    const events = await drain(session)
    expect(runner.calls).toHaveLength(2)
    expect(events[events.length - 1].type).toBe('error')
  })
})

describe('describeFailure', () => {
  it('replaces the CLI text with the app-level code when there is one', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: 'Error running awsAuthRefresh' }], code: 1 })
    const session = sessionWith(runner, { describeFailure: () => 'aws-auth:sso-expired' })
    session.send({ text: 'oi' })
    const events = await drain(session)
    expect(events[0]).toMatchObject({ type: 'error', message: 'aws-auth:sso-expired' })
  })

  it('keeps the CLI’s own words for anything it does not recognise', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: 'boom' }], code: 3 })
    const session = sessionWith(runner, { describeFailure: () => null })
    session.send({ text: 'oi' })
    const events = await drain(session)
    expect(events[0]).toMatchObject({ type: 'error', message: 'fake exited with code 3: boom' })
  })
})
