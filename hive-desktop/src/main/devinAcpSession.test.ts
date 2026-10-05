import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  acpPermissionOutcome,
  acpPermissionRequest,
  createDevinAcpSession
} from './devinAcpSession'
import { createAcpTestServer, type AcpTestServer } from './acpTestServer'
import type { AgentEvent, TurnScope } from './agentAdapter'

/** Collects events until a terminal one arrives (or the cap is hit). */
async function drain(events: AsyncIterable<AgentEvent>, max = 40): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < max; i++) {
    const event = (await iterator.next()).value as AgentEvent
    out.push(event)
    if (event.type === 'done' || event.type === 'error' || event.type === 'interrupted') break
  }
  return out
}

/** Polls until `predicate` holds, so a test never depends on a fixed sleep. */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condição não ocorreu a tempo')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** A real directory, because the session refuses to run in one that isn't there. */
function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'hive-acp-ws-'))
}

/**
 * A server that completes the handshake and streams `updates` during the
 * prompt, then ends the turn with `stopReason`.
 */
function scriptedDevin(updates: Record<string, unknown>[], stopReason = 'end_turn'): AcpTestServer {
  const server = createAcpTestServer((method, _params, self) => {
    if (method === 'initialize') return { protocolVersion: 1 }
    if (method === 'session/new') return { sessionId: 'holy-tumbleweed' }
    if (method === 'session/prompt') {
      for (const update of updates) self.emitUpdate(update)
      return { stopReason }
    }
    return {}
  })
  return server
}

describe('DevinAcpSession — ACP updates → Hive events', () => {
  it('opens one session and reuses it for the next turn (the whole point)', async () => {
    // The reported defect: "toda vez que mando uma mensagem parece que inicia
    // uma nova sessão". One `session/new` for two prompts is the fix, stated
    // as an assertion.
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    await drain(session.events)
    session.send({ text: 'de novo', turnId: 't2' })
    await drain(session.events)

    const methods = server.received.map((message) => message.method)
    expect(methods.filter((method) => method === 'session/new')).toHaveLength(1)
    expect(methods.filter((method) => method === 'session/prompt')).toHaveLength(2)
    // And exactly one process was started for both turns.
    expect(methods.filter((method) => method === 'initialize')).toHaveLength(1)
  })

  it('announces the session id so the transcript can resume it', async () => {
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)

    expect(events).toContainEqual({ type: 'session', id: 'holy-tumbleweed', turnId: 't1' })
  })

  it('streams reasoning as thought events and the reply as tokens', async () => {
    // The two are deliberately different events: reasoning is shown live and
    // collapsed after, the reply is the turn's product and is kept.
    const server = scriptedDevin([
      { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Preciso ler' } },
      { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: ' o arquivo.' } },
      { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Pronto.' } }
    ])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)

    expect(events.filter((event) => event.type === 'thought')).toEqual([
      { type: 'thought', text: 'Preciso ler', turnId: 't1' },
      { type: 'thought', text: ' o arquivo.', turnId: 't1' }
    ])
    expect(events.filter((event) => event.type === 'token')).toEqual([
      { type: 'token', text: 'Pronto.', turnId: 't1' }
    ])
  })

  it('pairs a tool call with its completion, naming the file it touched', async () => {
    const server = scriptedDevin([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'call_1',
        title: 'Read file',
        kind: 'read',
        locations: [{ path: '/ws/a.txt' }]
      },
      { sessionUpdate: 'tool_call_update', toolCallId: 'call_1', status: 'in_progress' },
      { sessionUpdate: 'tool_call_update', toolCallId: 'call_1', kind: 'read', status: 'completed' }
    ])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'leia', turnId: 't1' })
    const events = await drain(session.events)
    const tools = events.filter((event) => event.type === 'tool')

    // `in_progress` is a status change, not a completion — two rows, not three.
    expect(tools).toEqual([
      {
        type: 'tool',
        name: 'Read',
        toolId: 'call_1',
        phase: 'start',
        detail: '/ws/a.txt',
        turnId: 't1'
      },
      { type: 'tool', name: 'Read', toolId: 'call_1', phase: 'end', ok: true, turnId: 't1' }
    ])
  })

  it('closes a tool the agent left open when the turn ends', async () => {
    // Otherwise the activity rail spins on that row forever.
    const server = scriptedDevin([
      { sessionUpdate: 'tool_call', toolCallId: 'orphan', title: 'Bash', kind: 'execute' }
    ])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'rode', turnId: 't1' })
    const events = await drain(session.events)

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool', toolId: 'orphan', phase: 'end', ok: false })
    )
  })

  it('reports usage from the stream and a final one from the prompt result', async () => {
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/prompt') {
        self.emitUpdate({
          sessionUpdate: 'usage_update',
          used: 10253,
          _meta: {
            'cognition.ai/inputTokens': 10162,
            'cognition.ai/outputTokens': 91,
            'cognition.ai/cachedReadTokens': 10159
          }
        })
        return {
          stopReason: 'end_turn',
          usage: { inputTokens: 10340, outputTokens: 5, cachedReadTokens: 10157 }
        }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)
    const usage = events.filter((event) => event.type === 'usage')

    expect(usage[0]).toMatchObject({ usage: { inputTokens: 10162, outputTokens: 91 } })
    expect(usage[usage.length - 1]).toMatchObject({
      final: true,
      usage: { inputTokens: 10340, cacheReadTokens: 10157 }
    })
  })

  it('sets the model with `configId` — the field name the CLI actually accepts', async () => {
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1', model: 'claude-opus-5', effort: 'claude-opus-5-high' })
    await drain(session.events)

    const call = server.received.find((message) => message.method === 'session/set_config_option')
    // The rung wins over the family: it already names the family and carries
    // the reasoning level too.
    expect(call?.params).toEqual({
      sessionId: 'holy-tumbleweed',
      configId: 'model',
      value: 'claude-opus-5-high'
    })
  })

  it('does not resend the model when it has not changed', async () => {
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'a', turnId: 't1', model: 'glm-5.2' })
    await drain(session.events)
    session.send({ text: 'b', turnId: 't2', model: 'glm-5.2' })
    await drain(session.events)

    expect(
      server.received.filter((message) => message.method === 'session/set_config_option')
    ).toHaveLength(1)
  })

  it('still answers the turn when the model is one the account cannot use', async () => {
    // A rejected model must cost the reasoning level, never the reply.
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/set_config_option') {
        self.emit({ jsonrpc: '2.0', id: 3, error: { code: -32602, message: 'unknown model' } })
        return undefined
      }
      if (method === 'session/prompt') return { stopReason: 'end_turn' }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1', model: 'nope' })
    const events = await drain(session.events)

    expect(events[events.length - 1]).toMatchObject({ type: 'done' })
  })

  it('answers the agent’s file reads and writes, because it said it would', async () => {
    // A client that advertises `fs.readTextFile` and then ignores the request
    // does not fail — it hangs. This is the regression guard for that.
    const dir = workspace()
    writeFileSync(join(dir, 'a.txt'), 'conteúdo')
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/prompt') {
        self.emit({
          jsonrpc: '2.0',
          id: 900,
          method: 'fs/read_text_file',
          params: { path: join(dir, 'a.txt') }
        })
        self.emit({
          jsonrpc: '2.0',
          id: 901,
          method: 'fs/write_text_file',
          params: { path: join(dir, 'b.txt'), content: 'novo' }
        })
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: dir })

    session.send({ text: 'oi', turnId: 't1' })
    await drain(session.events)
    // The two fs handlers are async and settle **independently of each other**
    // — waiting on only the write's reply let the read's still be in flight,
    // which passed alone and failed inside the full suite. Wait for both.
    await waitFor(() =>
      [900, 901].every((id) => server.received.some((message) => message.id === id))
    )

    expect(server.received).toContainEqual({
      jsonrpc: '2.0',
      id: 900,
      result: { content: 'conteúdo' }
    })
    expect(readFileSync(join(dir, 'b.txt'), 'utf-8')).toBe('novo')
  })

  it('refuses a workspace that is no longer on disk, and names it', async () => {
    // Before this, a deleted workspace surfaced as `spawn devin ENOENT` — a
    // message that blames the binary and sends the user to reinstall a CLI
    // that was never broken.
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: '/nao/existe' })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)

    expect(events[0]).toMatchObject({
      type: 'error',
      message: expect.stringContaining('/nao/existe')
    })
    expect(server.received).toHaveLength(0)
  })

  it('settles a cancelled turn as interrupted, not as an error', async () => {
    const server = createAcpTestServer((method) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/prompt') return { stopReason: 'cancelled' }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)

    expect(events[events.length - 1]).toEqual({ type: 'interrupted', turnId: 't1' })
  })

  it('cancels with a notification — as a request the CLI answers "method not found"', async () => {
    const server = scriptedDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    await drain(session.events)
    session.interrupt('t1')

    const cancel = server.received.find((message) => message.method === 'session/cancel')
    expect(cancel).toBeDefined()
    expect(cancel).not.toHaveProperty('id')
  })

  it('surfaces a handshake failure as a single terminal error', async () => {
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') {
        self.emit({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'sem credencial' } })
        return undefined
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'oi', turnId: 't1' })
    const events = await drain(session.events)

    expect(events).toEqual([{ type: 'error', message: 'sem credencial', turnId: 't1' }])
  })
})

/**
 * context-compaction, over the transport Devin is actually driven through.
 *
 * The sequence below is verbatim from a live `devin acp` session
 * (3000.6.14): a display-flagged chunk "Compacting context…", the
 * `cognition.ai/compaction` notification `started`, then `completed` with a
 * prose summary, then a last display-flagged "Context compacted". The session
 * also advertises `compact` in its own `available_commands_update`, which is
 * why Hive forwards the command instead of inventing a compaction of its own.
 */
describe('DevinAcpSession — context compaction', () => {
  /** A server that runs the real compaction sequence during the prompt. */
  function compactingDevin(summary = 'Resumo da conversa.'): AcpTestServer {
    return createAcpTestServer((method, params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 'slash-ocarina' }
      if (method === 'session/prompt') {
        self.emitUpdate({
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Compacting context…' },
          _meta: { 'cognition.ai/displayMessage': true }
        })
        self.emit({
          jsonrpc: '2.0',
          method: '_cognition.ai/compaction',
          params: { status: 'started', sessionId: 'slash-ocarina' }
        })
        self.emit({
          jsonrpc: '2.0',
          method: '_cognition.ai/compaction',
          params: { status: 'completed', summary, sessionId: 'slash-ocarina' }
        })
        self.emitUpdate({
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Context compacted' },
          _meta: { 'cognition.ai/displayMessage': true }
        })
        void params
        return { stopReason: 'end_turn' }
      }
      return {}
    })
  }

  it('reports the compaction, with the summary the agent handed over', async () => {
    const server = compactingDevin()
    const session = createDevinAcpSession(server, { workspace: workspace() })
    session.send({ text: '/compact', turnId: 't1' })

    const events = await drain(session.events)
    const compactions = events.filter((event) => event.type === 'compact')
    expect(compactions).toEqual([
      { type: 'compact', phase: 'start', trigger: 'manual', turnId: 't1' },
      {
        type: 'compact',
        phase: 'end',
        trigger: 'manual',
        summary: 'Resumo da conversa.',
        turnId: 't1'
      }
    ])
  })

  // The seam is what the transcript shows. The CLI's own progress chatter
  // ("Compacting context…" / "Context compacted") is it narrating itself, and
  // it must not land in the reply as if the agent had said it.
  it('keeps the CLI’s progress chatter out of the transcript', async () => {
    const server = compactingDevin()
    const session = createDevinAcpSession(server, { workspace: workspace() })
    session.send({ text: '/compact', turnId: 't1' })

    const text = (await drain(session.events))
      .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
      .map((event) => event.text)
      .join('')
    expect(text).toBe('')
  })

  // The ordering the real CLI has and a synchronous fake does not: the prompt
  // resolves `end_turn` *before* the compaction starts. A session that forgot
  // it had asked when the turn ended reported the user's own `/compact` as the
  // agent's — which is exactly what the live test caught.
  it('still knows it asked when the compaction outlives the turn', async () => {
    let notify: () => void = () => {}
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 'slash-ocarina' }
      if (method === 'session/prompt') {
        notify = () => {
          self.emit({
            jsonrpc: '2.0',
            method: '_cognition.ai/compaction',
            params: { status: 'completed', summary: 'depois do turno', sessionId: 'slash-ocarina' }
          })
        }
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })
    session.send({ text: '/compact', turnId: 't1' })

    // Drain the turn to its terminal event, then let the notification land.
    const iterator = session.events[Symbol.asyncIterator]()
    for (;;) {
      const event = (await iterator.next()).value as AgentEvent
      if (event.type === 'done' || event.type === 'error') break
    }
    notify()
    const compaction = (await iterator.next()).value as AgentEvent
    expect(compaction).toMatchObject({ type: 'compact', phase: 'end', trigger: 'manual' })
  })

  // The notification never says who asked. This session does — it saw the
  // prompt — and getting it wrong would put "você compactou" under a
  // compaction Devin performed entirely on its own.
  it('marks a compaction nobody asked for as the agent’s own', async () => {
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 'slash-ocarina' }
      if (method === 'session/prompt') {
        self.emit({
          jsonrpc: '2.0',
          method: '_cognition.ai/compaction',
          params: { status: 'completed', summary: 'auto', sessionId: 'slash-ocarina' }
        })
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })
    session.send({ text: 'continue o trabalho', turnId: 't1' })

    const compaction = (await drain(session.events)).find((event) => event.type === 'compact')
    expect(compaction).toMatchObject({ trigger: 'auto', phase: 'end' })
  })

  // Suppression is scoped to the window the agent itself declared: prose that
  // merely arrives while a compaction runs is still the agent talking.
  it('lets ordinary prose through during a compaction', async () => {
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 'slash-ocarina' }
      if (method === 'session/prompt') {
        self.emit({
          jsonrpc: '2.0',
          method: '_cognition.ai/compaction',
          params: { status: 'started', sessionId: 'slash-ocarina' }
        })
        self.emitUpdate({
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'resposta de verdade' }
        })
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: workspace() })
    session.send({ text: 'oi', turnId: 't1' })

    const text = (await drain(session.events))
      .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
      .map((event) => event.text)
      .join('')
    expect(text).toBe('resposta de verdade')
  })
})

/**
 * Two conversations on one connection (the session-independence defect).
 *
 * `AgentService` pools this session object **per agent**, so both of a user's
 * Devin conversations arrive here. The first version treated "already
 * connected" as "nothing to do" and prompted every turn into whichever ACP
 * session happened to be open — which is how a skill build launched from the
 * Estúdio landed inside a running PRD discovery.
 *
 * The server below hands out a new id per `session/new` so the assertions can
 * name *which* session each prompt went to, which is the only thing that
 * distinguishes the fix from the bug.
 */
describe('DevinAcpSession — one connection, one session per conversation', () => {
  interface Prompt {
    sessionId: string
    text: string
  }

  function multiSessionDevin(loadable: string[] = []): {
    server: AcpTestServer
    prompts: Prompt[]
  } {
    const prompts: Prompt[] = []
    let minted = 0
    const server = createAcpTestServer((method, params) => {
      const record = (params ?? {}) as Record<string, unknown>
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: `sess-${++minted}` }
      if (method === 'session/load') {
        if (!loadable.includes(String(record.sessionId))) throw new Error('sessão desconhecida')
        return {}
      }
      if (method === 'session/prompt') {
        const prompt = (record.prompt ?? []) as { text?: string }[]
        prompts.push({ sessionId: String(record.sessionId), text: prompt[0]?.text ?? '' })
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    return { server, prompts }
  }

  it('gives a declared-fresh conversation its own session, on the same process', async () => {
    const { server, prompts } = multiSessionDevin()
    const session = createDevinAcpSession(server, { workspace: workspace() })

    // Conversation A: two turns, the second resuming what the first opened.
    session.send({ text: 'faça um PRD', turnId: 'a1', freshSession: true })
    await drain(session.events)
    session.send({ text: 'continue', turnId: 'a2', resume: 'sess-1' })
    await drain(session.events)

    // Conversation B: a build launched from the Estúdio — no resume handle,
    // and the pane says so.
    session.send({ text: '/bmad-agent-builder', turnId: 'b1', freshSession: true })
    await drain(session.events)

    expect(prompts).toEqual([
      { sessionId: 'sess-1', text: 'faça um PRD' },
      { sessionId: 'sess-1', text: 'continue' },
      { sessionId: 'sess-2', text: '/bmad-agent-builder' }
    ])
    const methods = server.received.map((message) => message.method)
    // Two sessions, but one connection: the whole point of this transport is
    // that a conversation switch must not cost a cold start.
    expect(methods.filter((method) => method === 'session/new')).toHaveLength(2)
    expect(methods.filter((method) => method === 'initialize')).toHaveLength(1)
  })

  it('announces the new session id, so the second conversation can resume its own', async () => {
    const { server } = multiSessionDevin()
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'um', turnId: 'a1', freshSession: true })
    await drain(session.events)
    session.send({ text: 'dois', turnId: 'b1', freshSession: true })
    const events = await drain(session.events)

    expect(events).toContainEqual({ type: 'session', id: 'sess-2', turnId: 'b1' })
  })

  it('goes back to an earlier conversation by loading its id', async () => {
    const { server, prompts } = multiSessionDevin(['sess-1'])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'A', turnId: 'a1', freshSession: true })
    await drain(session.events)
    session.send({ text: 'B', turnId: 'b1', freshSession: true })
    await drain(session.events)
    // Back to A, which is not the session the connection is holding.
    session.send({ text: 'A de novo', turnId: 'a2', resume: 'sess-1' })
    await drain(session.events)

    expect(prompts.map((prompt) => prompt.sessionId)).toEqual(['sess-1', 'sess-2', 'sess-1'])
    expect(server.received.filter((message) => message.method === 'session/load')).toHaveLength(1)
  })

  it('keeps the live session for a follow-up sent before the id came back', async () => {
    // The ambiguity `freshSession` exists to resolve, from the other side: a
    // second turn dispatched while the pane still has no handle must NOT be
    // read as a new conversation, or a conversation loses its memory one turn
    // in. Only the pane can tell the two apart, so absence of the flag means
    // "carry on".
    const { server, prompts } = multiSessionDevin()
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'um', turnId: 't1', freshSession: true })
    await drain(session.events)
    session.send({ text: 'dois', turnId: 't2' })
    await drain(session.events)

    expect(prompts.map((prompt) => prompt.sessionId)).toEqual(['sess-1', 'sess-1'])
    expect(server.received.filter((message) => message.method === 'session/new')).toHaveLength(1)
  })

  it('loads a stored id on the first turn after a restart', async () => {
    const { server, prompts } = multiSessionDevin(['sess-de-ontem'])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'retomando', turnId: 't1', resume: 'sess-de-ontem' })
    await drain(session.events)

    expect(prompts).toEqual([{ sessionId: 'sess-de-ontem', text: 'retomando' }])
    expect(server.received.filter((message) => message.method === 'session/new')).toHaveLength(0)
  })

  it('falls back to a fresh session — not the live one — when a load fails', async () => {
    const { server, prompts } = multiSessionDevin([])
    const session = createDevinAcpSession(server, { workspace: workspace() })

    session.send({ text: 'A', turnId: 'a1', freshSession: true })
    await drain(session.events)
    // An id the agent no longer has. The old conversation cannot be restored,
    // but answering *inside* the other conversation would be worse than a
    // clean start.
    session.send({ text: 'C', turnId: 'c1', resume: 'sess-que-morreu' })
    await drain(session.events)

    expect(prompts.map((prompt) => prompt.sessionId)).toEqual(['sess-1', 'sess-2'])
  })

  it('re-applies the model on a new session, since the setting is per session', async () => {
    const { server } = multiSessionDevin()
    const session = createDevinAcpSession(server, {
      workspace: workspace(),
      model: 'claude-sonnet-5'
    })

    session.send({ text: 'um', turnId: 'a1', freshSession: true, model: 'claude-sonnet-5' })
    await drain(session.events)
    session.send({ text: 'dois', turnId: 'b1', freshSession: true, model: 'claude-sonnet-5' })
    await drain(session.events)

    const configs = server.received.filter(
      (message) => message.method === 'session/set_config_option'
    )
    expect(configs).toHaveLength(2)
    expect(configs.map((message) => (message.params as { sessionId: string }).sessionId)).toEqual([
      'sess-1',
      'sess-2'
    ])
  })
})

/**
 * Design Studio (decision 2, Landing 15): a scoped turn on the Devin
 * connection. The connection stays one; the *session* belongs to a folder, so
 * a turn for another folder opens its own — and while a scoped turn is being
 * prompted, the agent's reads, writes and permission requests are answered by
 * its scope, with nothing shown.
 */
describe('DevinAcpSession — a scoped (Design Studio) turn', () => {
  function folders(): { ws: string; raiz: string; produto: string } {
    const base = mkdtempSync(join(tmpdir(), 'hive-acp-escopo-'))
    const ws = join(base, 'workspace')
    const raiz = join(base, 'Design Studio')
    const produto = join(raiz, 'Câmbio')
    mkdirSync(ws, { recursive: true })
    mkdirSync(join(produto, 'relatorios'), { recursive: true })
    return { ws, raiz, produto }
  }

  function scopeOf(raiz: string, produto: string): TurnScope {
    return {
      cwd: produto,
      readRoots: [raiz],
      writeRoots: [join(produto, 'relatorios')],
      commands: [`node "${join(raiz, 'skill.mjs')}"`]
    }
  }

  it('C43b: a scoped turn opens its session in scope.cwd, and the next unscoped turn goes back to the workspace', async () => {
    const { ws, raiz, produto } = folders()
    let sessions = 0
    const server = createAcpTestServer((method) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: `s${++sessions}` }
      if (method === 'session/prompt') return { stopReason: 'end_turn' }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: ws })

    session.send({ text: 'gere', turnId: 'modulo', scope: scopeOf(raiz, produto) })
    await drain(session.events)
    session.send({ text: 'oi', turnId: 'hive' })
    await drain(session.events)

    const opened = server.received
      .filter((message) => message.method === 'session/new')
      .map((message) => (message.params as { cwd: string }).cwd)
    expect(opened).toEqual([produto, ws])
    // One connection for both: the folder is the session's, not the process's.
    expect(server.received.filter((message) => message.method === 'initialize')).toHaveLength(1)
  })

  it('C43b: resuming a conversation from another folder loads it in the turn’s own folder', async () => {
    const { ws, raiz, produto } = folders()
    const server = createAcpTestServer((method) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 'do-hive' }
      if (method === 'session/prompt') return { stopReason: 'end_turn' }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: ws })
    session.send({ text: 'oi', turnId: 'hive' })
    await drain(session.events)
    session.send({
      text: 'continue',
      turnId: 'modulo',
      resume: 'do-modulo',
      scope: scopeOf(raiz, produto)
    })
    await drain(session.events)

    const load = server.received.find((message) => message.method === 'session/load')
    expect(load?.params).toMatchObject({ sessionId: 'do-modulo', cwd: produto })
  })

  it('C45c: reads and writes outside the scope fail untouched, and a permission request answers by decideScoped — with no approval event', async () => {
    const { ws, raiz, produto } = folders()
    const fora = join(ws, 'segredo.txt')
    writeFileSync(fora, 'não leia')
    const dentro = join(produto, 'relatorios', 'ok.md')
    const escrita = join(ws, 'escrita-proibida.txt')
    let promptId: number | undefined
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/prompt') {
        promptId = (self.received[self.received.length - 1].id as number) ?? undefined
        const ask = (id: number, toolCall: Record<string, unknown>): void =>
          self.emit({
            jsonrpc: '2.0',
            id,
            method: 'session/request_permission',
            params: {
              sessionId: 's1',
              toolCall,
              options: [
                { optionId: 'sim', name: 'Permitir', kind: 'allow_once' },
                { optionId: 'sempre', name: 'Sempre', kind: 'allow_always' },
                { optionId: 'nao', name: 'Negar', kind: 'reject_once' }
              ]
            }
          })
        self.emit({ jsonrpc: '2.0', id: 900, method: 'fs/read_text_file', params: { path: fora } })
        self.emit({
          jsonrpc: '2.0',
          id: 901,
          method: 'fs/write_text_file',
          params: { path: escrita, content: 'x' }
        })
        self.emit({
          jsonrpc: '2.0',
          id: 902,
          method: 'fs/write_text_file',
          params: { path: dentro, content: 'permitido' }
        })
        ask(903, { kind: 'execute', rawInput: { command: 'rm -rf ~' } })
        ask(904, { kind: 'execute', rawInput: { command: `node "${join(raiz, 'skill.mjs')}"` } })
        ask(905, { kind: 'edit', locations: [{ path: join(produto, 'notas.md') }] })
        return undefined // the turn ends only once every request was answered
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: ws })
    session.send({ text: 'gere', turnId: 'modulo', scope: scopeOf(raiz, produto) })
    await waitFor(() =>
      [900, 901, 902, 903, 904, 905].every((id) =>
        server.received.some((message) => message.id === id && !('method' in message))
      )
    )
    server.emit({ jsonrpc: '2.0', id: promptId as number, result: { stopReason: 'end_turn' } })
    const events = await drain(session.events)

    const reply = (id: number): Record<string, unknown> | undefined =>
      server.received.find((message) => message.id === id && !('method' in message))
    expect(reply(900)).toHaveProperty('error')
    expect(reply(901)).toHaveProperty('error')
    expect(existsSync(escrita)).toBe(false)
    expect(reply(902)).toMatchObject({ result: {} })
    expect(readFileSync(dentro, 'utf-8')).toBe('permitido')
    expect(reply(903)).toMatchObject({
      result: { outcome: { outcome: 'selected', optionId: 'nao' } }
    })
    expect(reply(904)).toMatchObject({
      result: { outcome: { outcome: 'selected', optionId: 'sim' } }
    })
    expect(reply(905)).toMatchObject({
      result: { outcome: { outcome: 'selected', optionId: 'nao' } }
    })
    expect(events.some((event) => event.type === 'approval')).toBe(false)
    expect(events[events.length - 1]).toEqual({ type: 'done', turnId: 'modulo' })
  })

  it('answers a turn without scope the way it always did', async () => {
    const { ws } = folders()
    const server = createAcpTestServer((method, _params, self) => {
      if (method === 'initialize') return { protocolVersion: 1 }
      if (method === 'session/new') return { sessionId: 's1' }
      if (method === 'session/prompt') {
        self.emit({
          jsonrpc: '2.0',
          id: 910,
          method: 'session/request_permission',
          params: { options: [{ optionId: 'primeira', kind: 'allow_once' }] }
        })
        return { stopReason: 'end_turn' }
      }
      return {}
    })
    const session = createDevinAcpSession(server, { workspace: ws })
    session.send({ text: 'oi', turnId: 't' })
    await drain(session.events)
    await waitFor(() =>
      server.received.some((message) => message.id === 910 && !('method' in message))
    )
    expect(server.received).toContainEqual({
      jsonrpc: '2.0',
      id: 910,
      result: { outcome: { outcome: 'selected', optionId: 'primeira' } }
    })
  })

  it('names a Produto folder that is gone instead of running elsewhere', async () => {
    const { ws, raiz } = folders()
    const session = createDevinAcpSession(scriptedDevin([]), { workspace: ws })
    session.send({ text: 'gere', turnId: 'm', scope: scopeOf(raiz, join(raiz, 'Sumiu')) })
    const events = await drain(session.events)
    expect(events[0]).toMatchObject({ type: 'error', turnId: 'm' })
  })
})

describe('the ACP permission vocabulary, in decideScoped words', () => {
  it.each([
    [{ toolCall: { kind: 'read', locations: [{ path: '/a' }] } }, { kind: 'read', path: '/a' }],
    [{ toolCall: { kind: 'search', rawInput: {} } }, { kind: 'read', path: '/cwd' }],
    [{ toolCall: { kind: 'edit', rawInput: { file_path: '/b' } } }, { kind: 'write', path: '/b' }],
    [{ toolCall: { kind: 'delete', rawInput: { filePath: '/c' } } }, { kind: 'write', path: '/c' }],
    [{ toolCall: { kind: 'move' } }, { kind: 'write', path: '' }],
    [
      { toolCall: { kind: 'execute', rawInput: { command: 'ls' } } },
      { kind: 'command', command: 'ls' }
    ],
    [{ toolCall: { kind: 'execute' } }, { kind: 'command', command: '' }],
    [{ toolCall: { kind: 'fetch' } }, { kind: 'other', tool: 'fetch' }],
    [{ toolCall: { title: 'Pensar' } }, { kind: 'other', tool: 'Pensar' }],
    [{}, { kind: 'other', tool: 'tool' }]
  ])('%j', (params, expected) => {
    expect(acpPermissionRequest(params, '/cwd')).toEqual(expected)
  })

  it('cancels when the agent offers no option that says the decision', () => {
    expect(
      acpPermissionOutcome({ options: [{ optionId: 'x', kind: 'allow_always' }] }, 'allow')
    ).toEqual({
      outcome: { outcome: 'cancelled' }
    })
    expect(acpPermissionOutcome({}, 'deny')).toEqual({ outcome: { outcome: 'cancelled' } })
  })
})
