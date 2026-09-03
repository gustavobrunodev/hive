import { describe, expect, it } from 'vitest'
import { createCliAgentSession, stripAnsi } from './cliAdapterCore'
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
