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
  // The bug this replaced: the adapter declared `models: []` on the premise
  // that Devin is a fixed-model agent, so the composer hid the picker and the
  // user could not choose. Devin fronts four vendors and documents `--model`.
  it('offers models (Adaptive included) and no effort ladder', () => {
    const adapter = createDevinCliAdapter(createFakeProcessRunner())
    expect(adapter.id).toBe('devin')
    const caps = adapter.capabilities()
    expect(caps.models.length).toBeGreaterThan(1)
    expect(caps.models.map((model) => model.id)).toContain('adaptive')
    // The Devin CLI's autonomy dial is `--permission-mode`, not an effort
    // level — so there is nothing to show, and the composer shows nothing.
    expect(caps.efforts).toEqual([])
    expect(caps.supportsAttachments).toBe(true)
  })

  it('spawns `devin -p <prompt>` with no flags beyond the prompt; appends --resume', async () => {
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
