import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDevinCliAdapter } from './devinCliAdapter'
import { createProcessRunner } from './processRunner'
import type { AgentEvent } from './agentAdapter'

/**
 * The Devin adapter against the **real `devin` binary** — the one thing no fake
 * runner can prove: that the flags this adapter sends are the flags that CLI
 * accepts, and that its `--export` really carries a session id we can resume.
 *
 * Excluded from `npm run test` (it is an `*.e2e.test.ts`); run with
 * `npm run test:e2e` on a machine that has `devin` installed and logged in.
 * Skips itself cleanly everywhere else, because a red suite on a laptop with
 * no Devin account would say nothing about the code.
 */
const DEVIN = join(process.env.HOME ?? '', '.local', 'bin', 'devin')
const AVAILABLE = existsSync(DEVIN)

describe.skipIf(!AVAILABLE)('DevinCliAdapter — against the real CLI', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'hive-devin-live-'))
  writeFileSync(join(workspace, 'README.md'), '# fixture\n')

  /** Runs one turn and returns every event it produced. */
  async function turn(
    session: ReturnType<ReturnType<typeof createDevinCliAdapter>['startSession']>,
    text: string,
    resume: string | null
  ): Promise<AgentEvent[]> {
    const events: AgentEvent[] = []
    const iterator = session.events[Symbol.asyncIterator]()
    session.send({ text, resume, turnId: `t-${events.length}` })
    for (;;) {
      const event = (await iterator.next()).value as AgentEvent
      events.push(event)
      if (event.type === 'done' || event.type === 'error') break
    }
    return events
  }

  it('answers, states its session id, and remembers the previous turn on resume', async () => {
    const adapter = createDevinCliAdapter(createProcessRunner(), {
      scratchDir: join(workspace, '.hive-scratch')
    })
    const session = adapter.startSession({ workspace })

    const first = await turn(session, 'Responda exatamente: banana', null)
    const text = first
      .filter((e): e is Extract<AgentEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.text)
      .join('')
    expect(first[first.length - 1]).toMatchObject({ type: 'done' })
    expect(text.toLowerCase()).toContain('banana')

    // The whole point of the `--export` round trip.
    const announced = first.find(
      (e): e is Extract<AgentEvent, { type: 'session' }> => e.type === 'session'
    )
    expect(announced?.id).toMatch(/\S/)

    const second = await turn(
      session,
      'Qual palavra eu pedi na mensagem anterior? Responda só a palavra.',
      announced?.id ?? null
    )
    const memory = second
      .filter((e): e is Extract<AgentEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.text)
      .join('')
    expect(memory.toLowerCase()).toContain('banana')

    session.stop()
  }, 240_000)

  it('reads the real model families, with a reasoning ladder on them', async () => {
    const adapter = createDevinCliAdapter(createProcessRunner())
    const caps = await adapter.detectCapabilities?.({ workspace })
    expect(caps?.note).toBeUndefined()
    expect(caps?.modelSource).toBe('detected')
    // The bug: the old parser returned nothing and the picker fell back to a
    // seven-row constant.
    expect(caps?.models.length ?? 0).toBeGreaterThan(20)
    const withLadder = (caps?.models ?? []).filter((m) => (m.efforts?.length ?? 0) > 1)
    expect(withLadder.length).toBeGreaterThan(5)
    // Every rung is a model id the CLI accepts, and none of them is a twin.
    for (const model of withLadder) {
      for (const rung of model.efforts ?? []) {
        expect(rung.id.endsWith('-fast') || rung.id.endsWith('-priority')).toBe(false)
      }
    }
  }, 120_000)
})
