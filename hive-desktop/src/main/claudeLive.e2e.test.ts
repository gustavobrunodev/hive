import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import { createProcessRunner } from './processRunner'
import type { AgentEvent, AgentSession } from './agentAdapter'

/**
 * The Claude adapter against the **real `claude` binary** — specifically the
 * one claim no fake runner can make: that `/compact`, sent through this
 * adapter with all the flags it really sends (`-p`, `--output-format
 * stream-json`, `--permission-mode`, `--resume`), still produces the CLI's own
 * `compact_boundary` line, and that the conversation survives it.
 *
 * Why this needs a live test at all: the whole feature rests on driving the
 * agent's own compaction rather than inventing one, and "the CLI accepts
 * `/compact` in print mode" is a fact about a binary that ships on its own
 * schedule. The parse is unit-tested against a captured payload; this is the
 * half that proves the payload still arrives.
 *
 * Excluded from `npm run test` (it is an `*.e2e.test.ts`); run with
 * `npm run test:e2e` on a machine with `claude` installed and logged in. It
 * spends two small `haiku` turns.
 */
const AVAILABLE = process.env.HIVE_SKIP_CLAUDE_LIVE !== '1'

describe.skipIf(!AVAILABLE)('ClaudeCliAdapter — against the real CLI', () => {
  it('compacts its own context on /compact, keeping the conversation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-claude-compact-'))
    writeFileSync(join(dir, 'senha.txt'), 'abacaxi\n')

    const adapter = createClaudeCliAdapter(createProcessRunner())
    const session = adapter.startSession({ workspace: dir, model: 'haiku' })

    // Something to compact, and something to check the memory of afterwards.
    const first = await turnOf(session, {
      text: 'Leia senha.txt e responda só com a palavra que está lá.',
      resume: null,
      turnId: 'live-1'
    })
    expect(textOf(first).toLowerCase()).toContain('abacaxi')
    const resume = sessionIdOf(first)
    expect(resume).not.toBeNull()

    const compacted = await turnOf(session, { text: '/compact', resume, turnId: 'live-2' })
    const boundary = compacted.find(
      (event): event is Extract<AgentEvent, { type: 'compact' }> => event.type === 'compact'
    )

    expect(boundary).toBeDefined()
    // The CLI reports the boundary after the fact — there is no `start` to wait
    // for, which is the contract the seam is built on.
    expect(boundary?.phase).toBe('end')
    expect(boundary?.trigger).toBe('manual')
    // Its own numbers, which is what the seam shows instead of a guess.
    expect(boundary?.preTokens ?? 0).toBeGreaterThan(0)
    expect(boundary?.postTokens ?? Number.MAX_SAFE_INTEGER).toBeLessThan(boundary?.preTokens ?? 0)

    // The whole reason Hive drives the CLI's own compaction rather than
    // rebuilding one: the resume handle survives it, so the conversation is
    // still the same conversation.
    expect(sessionIdOf(compacted) ?? resume).toBe(resume)

    session.stop()
  }, 300_000)

  /**
   * The turn the user reported: a file attached in the chat, and the agent
   * answering that no file was attached.
   *
   * Nothing about the *content* of the prompt was ever wrong —
   * `composeTurnPrompt` builds the same `<attached-files>` block for every
   * adapter. What was wrong was the transport: on Windows the npm `.cmd` shim
   * truncates a command line at its first newline, and the block starts on the
   * prompt's second line, so the agent was told about no files at all.
   *
   * This is the half a unit test cannot make. The unit test asserts the prompt
   * is on `opts.input` and not in argv; only a real binary can say that
   * `claude -p`, with no positional prompt and all the flags this adapter
   * really sends, reads that stdin as the turn and acts on what is in it.
   *
   * It also carries the multi-line case in general: a reply that quotes the
   * file's contents can only come from a prompt whose second line survived.
   */
  it('reads a file attached to the turn — the block that argv used to truncate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-claude-attach-'))
    const attached = join(dir, 'anexo.txt')
    writeFileSync(attached, 'jabuticaba\n')

    const adapter = createClaudeCliAdapter(createProcessRunner())
    const session = adapter.startSession({ workspace: dir, model: 'haiku' })

    const events = await turnOf(session, {
      text: 'Leia o arquivo anexado e responda só com a palavra que está nele.',
      // Absolute, exactly as a picked attachment arrives from the renderer.
      attachments: [attached],
      resume: null,
      turnId: 'live-attach-1'
    })

    expect(textOf(events).toLowerCase()).toContain('jabuticaba')
    session.stop()
  }, 300_000)
})

/** Runs one turn and returns its events. */
async function turnOf(
  session: AgentSession,
  input: { text: string; resume: string | null; turnId: string; attachments?: string[] }
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

function textOf(events: AgentEvent[]): string {
  return events
    .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
    .map((event) => event.text)
    .join('')
}

function sessionIdOf(events: AgentEvent[]): string | null {
  const announced = events.filter(
    (event): event is Extract<AgentEvent, { type: 'session' }> => event.type === 'session'
  )
  return announced[announced.length - 1]?.id ?? null
}
