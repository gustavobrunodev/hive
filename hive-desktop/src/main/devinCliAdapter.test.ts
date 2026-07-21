import { describe, expect, it } from 'vitest'
import { createFakeProcessRunner } from './processRunner'
import { createDevinCliAdapter } from './devinCliAdapter'
import type { AgentEvent } from './agentAdapter'

async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) out.push((await iterator.next()).value)
  return out
}

describe('DevinCliAdapter', () => {
  it('is a fixed-model agent: NO models, NO efforts, but supports attachments', () => {
    const adapter = createDevinCliAdapter(createFakeProcessRunner())
    expect(adapter.id).toBe('devin')
    const caps = adapter.capabilities()
    expect(caps.models).toEqual([])
    expect(caps.efforts).toEqual([])
    expect(caps.supportsAttachments).toBe(true)
  })

  it('spawns `devin -p <prompt>` with no model/effort flags; appends --resume', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    const adapter = createDevinCliAdapter(runner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'faça isso', resume: 'devin-42' })
    await take(session.events, 2)

    expect(runner.calls[0].command).toBe('devin')
    expect(runner.calls[0].args).toEqual(['-p', 'faça isso', '--resume', 'devin-42'])
    expect(runner.calls[0].args).not.toContain('--model')
    expect(runner.calls[0].args).not.toContain('--effort')
  })

  it('folds attachments into the prompt (parity with Claude)', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ code: 0 })
    const adapter = createDevinCliAdapter(runner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'analisa', attachments: ['docs/prd.md'] })
    await take(session.events, 1)

    const prompt = runner.calls[0].args[1]
    expect(prompt).toContain('<attached-files>')
    expect(prompt).toContain('- docs/prd.md')
  })
})
