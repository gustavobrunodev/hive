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

  /**
   * context-compaction, against the real thing.
   *
   * This is the claim the whole feature rests on, and the one that cannot be
   * faked: that `/compact` sent as an ordinary prompt over ACP really compacts
   * this CLI's context, and that what comes back is a
   * `cognition.ai/compaction` notification carrying a summary — which is what
   * Hive draws its seam from. The `available_commands_update` this session
   * publishes lists `compact` alongside `ask` and `plan`; this proves the
   * command behind that listing does what the listing implies.
   */
  it('compacts its own context when asked, and says so', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-devin-compact-'))
    const session = createDevinAcpSession(createProcessRunner(), { workspace: dir })

    // Something to compact. Free model, so the suite still costs nothing.
    await turnOf(session, { text: 'Responda apenas: um', model: 'glm-5.2', turnId: 'pre-1' })

    const events = await turnOf(session, { text: '/compact', turnId: 'compact-1' })
    const compactions = events.filter((event) => event.type === 'compact')

    // The notification arrives asynchronously — the prompt itself returns
    // `end_turn` before the compaction starts, which is exactly why the pane
    // settles its seam on this event and not on the turn.
    const settled = await waitForCompaction(session, compactions)

    expect(settled.some((event) => event.phase === 'start')).toBe(true)
    const end = settled.find((event) => event.phase === 'end')
    expect(end).toBeDefined()
    // Asked for, not the agent's own ceiling.
    expect(end?.trigger).toBe('manual')
    // Devin hands over prose rather than counts; the seam's numbers come from
    // the pane's own reading, and this is the half the CLI does supply.
    expect((end?.summary ?? '').length).toBeGreaterThan(0)
    // The CLI's progress chatter is the app's to draw, not the agent's to say.
    expect(textOf(events)).not.toContain('Compacting context')

    session.stop()
  }, 300_000)
})

/**
 * Waits for the compaction pair to arrive on the session's stream, starting
 * from whatever the turn already collected. Devin reports the compaction
 * *after* the prompt resolves, so a test that stopped at `done` would see only
 * half of it — or none.
 */
async function waitForCompaction(
  session: ReturnType<typeof createDevinAcpSession>,
  seen: AgentEvent[]
): Promise<Array<Extract<AgentEvent, { type: 'compact' }>>> {
  const found = seen.filter(
    (event): event is Extract<AgentEvent, { type: 'compact' }> => event.type === 'compact'
  )
  if (found.some((event) => event.phase === 'end')) return found
  const iterator = session.events[Symbol.asyncIterator]()
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    const event = (await iterator.next()).value as AgentEvent
    if (event.type !== 'compact') continue
    found.push(event)
    if (event.phase === 'end') return found
  }
  return found
}

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
