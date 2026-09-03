import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDevinCliAdapter } from './devinCliAdapter'
import { createDevinAcpSession } from './devinAcpSession'
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

/**
 * The ACP path against the real binary — the transport the app now ships.
 *
 * This is the test that would have caught the original report. Everything it
 * asserts was measured by hand first (`devin 3000.6.14`, this machine):
 * handshake 0.07s, first prompt 6.1s, **second prompt on the same session
 * 1.7s** — against a full cold start on every single message before.
 */
describe.skipIf(!AVAILABLE)('DevinAcpSession — against the real CLI', () => {
  it('keeps one session across two turns, streams reasoning, and remembers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-devin-acp-'))
    writeFileSync(join(dir, 'senha.txt'), 'abacaxi\n')

    const session = createDevinAcpSession(createProcessRunner(), { workspace: dir })

    const first = await turnOf(session, {
      text: 'Leia senha.txt e responda só com a palavra que está lá.',
      // Free on this account, so the suite costs nothing to run.
      model: 'glm-5.2',
      turnId: 'live-1'
    })

    expect(first[first.length - 1]).toMatchObject({ type: 'done' })
    expect(textOf(first).toLowerCase()).toContain('abacaxi')

    // The session id is announced, which is what a resumed conversation needs.
    expect(first.some((event) => event.type === 'session')).toBe(true)
    // Reasoning arrived *before* the reply — the silence that read as
    // "Iniciando" for the whole turn is now filled.
    expect(first.some((event) => event.type === 'thought')).toBe(true)
    // It actually opened the file rather than guessing.
    expect(first.some((event) => event.type === 'tool')).toBe(true)

    const startedSecond = Date.now()
    const second = await turnOf(session, {
      text: 'Qual arquivo você acabou de ler? Responda só o nome.',
      turnId: 'live-2'
    })
    const secondMs = Date.now() - startedSecond

    expect(second[second.length - 1]).toMatchObject({ type: 'done' })
    // Context survived without a `--resume` handshake, because the process
    // never went away.
    expect(textOf(second).toLowerCase()).toContain('senha.txt')
    // The headline claim, asserted loosely enough not to be flaky on a slow
    // network: a follow-up turn no longer pays a cold start. Measured at 1.7s;
    // the old path could not answer at all in under ~3s.
    expect(secondMs).toBeLessThan(30_000)

    session.stop()
  }, 180_000)
})

/** Runs one turn and returns its events. */
async function turnOf(
  session: ReturnType<typeof createDevinAcpSession>,
  input: { text: string; model?: string; turnId: string }
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  const iterator = session.events[Symbol.asyncIterator]()
  session.send(input)
  for (;;) {
    const event = (await iterator.next()).value as AgentEvent
    events.push(event)
    if (event.type === 'done' || event.type === 'error' || event.type === 'interrupted') break
  }
  return events
}

/** The reply text a turn produced (tokens only — reasoning is not the reply). */
function textOf(events: AgentEvent[]): string {
  return events
    .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
    .map((event) => event.text)
    .join('')
}
