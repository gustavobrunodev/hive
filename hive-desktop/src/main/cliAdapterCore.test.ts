import { describe, expect, it } from 'vitest'
import { createCliAgentSession, failureDetail, readFailureText, stripAnsi } from './cliAdapterCore'
import { createFakeProcessRunner } from './processRunner'
import type { AgentEvent } from './agentAdapter'

/**
 * The shared CLI engine's **prose** path — the half of it that is exercised by
 * every agent that does not speak Anthropic `stream-json` (Devin, and Copilot
 * outside a Claude model).
 *
 * The defect these cover, reported as "o texto está vindo todo bagunçado
 * inline": a Devin reply arrived in the transcript as one unbroken run-on
 * paragraph. The engine split stdout on `\n`, dropped the separator, then
 * dropped every blank line as empty — and markdown is defined by exactly those
 * two characters. Measured against the real `devin 3000.6.14`, whose `-p`
 * output is clean UTF-8 markdown.
 */

/** Drains `count` events off a session. */
async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) out.push((await iterator.next()).value)
  return out
}

/** Runs one turn against scripted stdout and returns the reply the transcript would show. */
async function replyFor(stdout: string): Promise<string> {
  const runner = createFakeProcessRunner()
  runner.script({ chunks: [{ stream: 'stdout', data: stdout }], code: 0 })
  const session = createCliAgentSession(
    runner,
    { workspace: '/ws' },
    { command: 'fake', errorLabel: 'fake', buildArgs: (prompt) => ['-p', prompt] }
  )
  session.send({ text: 'oi' })
  const events: AgentEvent[] = []
  const iterator = session.events[Symbol.asyncIterator]()
  for (;;) {
    const next = (await iterator.next()).value as AgentEvent
    events.push(next)
    if (next.type !== 'token') break
  }
  return events
    .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
    .map((event) => event.text)
    .join('')
}

/** Exactly what the real Devin CLI printed for "resumo em markdown", byte for byte. */
const DEVIN_MARKDOWN = [
  '## Resumo',
  '',
  '- Primeiro ponto importante.',
  '- Segundo ponto relevante.',
  '- Terceiro ponto essencial.',
  '',
  '```bash',
  'echo "Resumo concluído"',
  '```',
  ''
].join('\n')

describe('the prose path (a CLI without stream-json)', () => {
  it('gives the transcript back the markdown the CLI actually printed', async () => {
    // Byte-for-byte, minus the trailing newline the split consumes: the reply
    // is markdown, and every newline in it is structure.
    expect(await replyFor(DEVIN_MARKDOWN)).toBe(DEVIN_MARKDOWN)
  })

  it('keeps the blank line that separates two paragraphs', async () => {
    expect(await replyFor('um\n\ndois\n')).toBe('um\n\ndois\n')
  })

  it('survives a reply arriving split across chunk boundaries', async () => {
    const runner = createFakeProcessRunner()
    runner.script({
      chunks: [
        { stream: 'stdout', data: '## Res' },
        { stream: 'stdout', data: 'umo\n\n- um' },
        { stream: 'stdout', data: '\n- dois\n' }
      ],
      code: 0
    })
    const session = createCliAgentSession(
      runner,
      { workspace: '/ws' },
      { command: 'fake', errorLabel: 'fake', buildArgs: (prompt) => ['-p', prompt] }
    )
    session.send({ text: 'oi' })
    const events = await take(session.events, 5)
    const text = events
      .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
      .map((event) => event.text)
      .join('')
    expect(text).toBe('## Resumo\n\n- um\n- dois\n')
  })

  it('adds no phantom newline for a reply that ends without one', async () => {
    expect(await replyFor('pronto')).toBe('pronto\n')
  })

  // `devin` prints `\x1b[?2004l` (bracketed paste off) on its way out; an
  // escape byte in a transcript renders as garbage, not as colour.
  it('strips the control bytes a CLI paints its output with', async () => {
    expect(await replyFor('[?2004lok[0m\n')).toBe('ok\n')
  })
})

describe('the structured path is unchanged', () => {
  it('drops the blank lines between JSON records rather than emitting them', async () => {
    const line = (text: string): string =>
      JSON.stringify({
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text } }
      })
    // The blank line between two records is framing, not structure — and the
    // deltas already carry the reply's own newlines.
    expect(await replyFor(`${line('## Resumo')}\n\n${line('\n\n- um')}\n`)).toBe(
      '## Resumo\n\n- um'
    )
  })
})

describe('stripAnsi', () => {
  it('removes CSI, OSC and two-character escapes and leaves the text', () => {
    expect(stripAnsi('[1;31mvermelho[0m')).toBe('vermelho')
    expect(stripAnsi(']0;títulotexto')).toBe('texto')
    expect(stripAnsi('[?2004l')).toBe('')
    expect(stripAnsi('sem escapes')).toBe('sem escapes')
  })

  it('leaves an unrecognised byte alone rather than dropping it', () => {
    // Dropping what we do not understand would be a second, quieter way to
    // mangle a reply.
    expect(stripAnsi('R$ 10 — 50% é muito')).toBe('R$ 10 — 50% é muito')
  })
})

/**
 * context-compaction: the CLI compacted its own context, and the app has to
 * hear about it.
 *
 * Every line below is verbatim from a real `claude 2.1.x` run in the print
 * mode this engine drives — `claude -p "/compact" --resume <id>` — which is
 * also how the whole feature's shape was decided: the CLI keeps the session
 * id, reports the boundary *after* the fact, and states the trigger itself.
 */
describe('compaction boundaries', () => {
  /** Runs one turn against scripted stdout and returns every compact event it produced. */
  async function compactEventsFor(
    stdout: string
  ): Promise<Array<Extract<AgentEvent, { type: 'compact' }>>> {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: stdout }], code: 0 })
    const session = createCliAgentSession(
      runner,
      { workspace: '/ws' },
      { command: 'fake', errorLabel: 'fake', buildArgs: (prompt) => ['-p', prompt] }
    )
    session.send({ text: '/compact', turnId: 'turn-1' })
    const out: Array<Extract<AgentEvent, { type: 'compact' }>> = []
    const iterator = session.events[Symbol.asyncIterator]()
    for (;;) {
      const next = (await iterator.next()).value as AgentEvent
      if (next.type === 'compact') out.push(next)
      if (next.type === 'done' || next.type === 'error') break
    }
    return out
  }

  const BOUNDARY = JSON.stringify({
    type: 'system',
    subtype: 'compact_boundary',
    session_id: 'ee7299b3-8d3a-46fd-bc48-ed0bb9b546dc',
    compact_metadata: {
      trigger: 'manual',
      pre_tokens: 22678,
      post_tokens: 757,
      cumulative_dropped_tokens: 21921,
      duration_ms: 8400
    }
  })

  it('turns the CLI’s boundary line into the seam’s numbers', async () => {
    const [event] = await compactEventsFor(`${BOUNDARY}\n`)
    expect(event).toEqual({
      type: 'compact',
      phase: 'end',
      trigger: 'manual',
      preTokens: 22678,
      postTokens: 757,
      durationMs: 8400,
      turnId: 'turn-1'
    })
  })

  // The trigger is passed through, never assumed: the CLI uses the same line
  // for its own threshold, and reading that as manual would put "você
  // compactou" under something the user never did.
  it('keeps the CLI’s own trigger', async () => {
    const auto = BOUNDARY.replace('"trigger":"manual"', '"trigger":"auto"')
    const [event] = await compactEventsFor(`${auto}\n`)
    expect(event.trigger).toBe('auto')
  })

  // The counts belong to the agent. A boundary without them still says a
  // compaction happened — the seam fills the "before" from its own reading.
  it('reports a boundary that carries no metadata at all', async () => {
    const bare = JSON.stringify({ type: 'system', subtype: 'compact_boundary' })
    const [event] = await compactEventsFor(`${bare}\n`)
    expect(event).toEqual({ type: 'compact', phase: 'end', trigger: 'manual', turnId: 'turn-1' })
  })

  it('leaves every other system line alone', async () => {
    const init = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc' })
    expect(await compactEventsFor(`${init}\n`)).toEqual([])
  })
})

/**
 * The failure a CLI states **only inside its own JSON stream**.
 *
 * The reported bug, in one line: `Não foi possível concluir a resposta: claude
 * exited with code 1`. A `claude` signed out of its account writes nothing to
 * stderr — it prints the reason as stream-json and exits 1 — so the app had
 * literally nothing to quote but the exit code. These are the two payloads it
 * really prints, captured from `claude 2.1.226`.
 */
const AUTH_FAILURE_STREAM = [
  JSON.stringify({
    type: 'assistant',
    message: {
      model: '<synthetic>',
      content: [{ type: 'text', text: 'Failed to authenticate: OAuth session expired' }]
    },
    error: 'authentication_failed',
    is_api_error_message: true
  }),
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: true,
    result: 'Failed to authenticate: OAuth session expired and could not be refreshed'
  })
].join('\n')

describe('readFailureText', () => {
  it('reads the `result` line even though its subtype says "success"', () => {
    expect(
      readFailureText({ type: 'result', subtype: 'success', is_error: true, result: 'boom' })
    ).toBe('boom')
  })

  it('falls back to the error code when the result line carries no prose', () => {
    expect(
      readFailureText({ type: 'result', is_error: true, error: 'authentication_failed' })
    ).toBe('authentication_failed')
    expect(readFailureText({ type: 'result', is_error: true })).toBeNull()
  })

  it('reads the API-error message the CLI dresses up as an assistant turn', () => {
    expect(
      readFailureText({
        type: 'assistant',
        is_api_error_message: true,
        message: { content: [{ type: 'text', text: 'Invalid API key' }] }
      })
    ).toBe('Invalid API key')
  })

  it('ignores every ordinary line — the happy path must cost nothing', () => {
    expect(readFailureText({ type: 'assistant', message: { content: [] } })).toBeNull()
    expect(readFailureText({ type: 'result', is_error: false, result: 'tudo certo' })).toBeNull()
    expect(readFailureText({ type: 'stream_event' })).toBeNull()
  })
})

describe('failureDetail', () => {
  it('uses the stream when stderr is silent (the reported case)', () => {
    expect(failureDetail('', 'Failed to authenticate')).toBe('Failed to authenticate')
  })

  it('keeps stderr when the stream said nothing', () => {
    expect(failureDetail('  boom  ', null)).toBe('boom')
  })

  it('states one fact once when both streams said the same thing', () => {
    expect(failureDetail('Failed to authenticate: x', 'Failed to authenticate: x')).toBe(
      'Failed to authenticate: x'
    )
  })

  it('keeps both when they are different halves of the story', () => {
    expect(failureDetail('Warning: MCP blocked', 'Failed to authenticate')).toBe(
      'Failed to authenticate (Warning: MCP blocked)'
    )
  })
})

describe('a turn that fails with an empty stderr', () => {
  it('reports the reason the CLI streamed instead of only its exit code', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: `${AUTH_FAILURE_STREAM}\n` }], code: 1 })
    const session = createCliAgentSession(
      runner,
      { workspace: '/ws' },
      { command: 'claude', errorLabel: 'claude', buildArgs: (prompt) => ['-p', prompt] }
    )
    session.send({ text: 'oi' })

    const iterator = session.events[Symbol.asyncIterator]()
    let event = (await iterator.next()).value as AgentEvent
    while (event.type !== 'error') event = (await iterator.next()).value as AgentEvent
    expect(event.message).toContain('OAuth session expired and could not be refreshed')
    // The exit code stays in the sentence — it is the CLI's own verdict — but
    // it is no longer the *whole* sentence.
    expect(event.message).toContain('claude exited with code 1')
  })
})
