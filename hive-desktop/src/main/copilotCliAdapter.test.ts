import { describe, expect, it } from 'vitest'
import { createFakeProcessRunner } from './processRunner'
import { createCopilotCliAdapter } from './copilotCliAdapter'
import type { AgentEvent } from './agentAdapter'

async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) out.push((await iterator.next()).value)
  return out
}

describe('CopilotCliAdapter', () => {
  it('exposes models but NO effort levels, and supports attachments', () => {
    const adapter = createCopilotCliAdapter(createFakeProcessRunner())
    expect(adapter.id).toBe('github-copilot')
    const caps = adapter.capabilities()
    expect(caps.models.length).toBeGreaterThan(0)
    expect(caps.efforts).toEqual([])
    expect(caps.supportsAttachments).toBe(true)
  })

  it('spawns `copilot -p <prompt> --model <id> --allow-all-tools`; omits --effort', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    const adapter = createCopilotCliAdapter(runner)
    const session = adapter.startSession({ workspace: '/ws', model: 'gpt-5' })

    session.send({ text: 'oi' })
    await take(session.events, 2) // token + done

    expect(runner.calls[0].command).toBe('copilot')
    expect(runner.calls[0].args).toEqual(['-p', 'oi', '--model', 'gpt-5', '--allow-all-tools'])
    expect(runner.calls[0].args).not.toContain('--effort')
    expect(runner.calls[0].opts).toEqual({ cwd: '/ws' })
  })

  it('appends --resume for conversation memory, and works with no model (adapter default)', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ code: 0 })
    const adapter = createCopilotCliAdapter(runner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'continua', resume: 'sess-9' })
    await take(session.events, 1)

    expect(runner.calls[0].args).toEqual(['-p', 'continua', '--allow-all-tools', '--resume', 'sess-9'])
  })

  it('a non-zero exit surfaces an error labeled `copilot`', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stderr', data: 'kaboom' }], code: 1 })
    const adapter = createCopilotCliAdapter(runner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'x' })
    const [event] = await take(session.events, 1)
    expect(event.type).toBe('error')
    expect((event as { message: string }).message).toContain('copilot exited with code 1')
    expect((event as { message: string }).message).toContain('kaboom')
  })
})
