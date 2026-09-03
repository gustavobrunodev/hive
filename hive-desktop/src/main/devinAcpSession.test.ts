import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDevinAcpSession } from './devinAcpSession'
import { createAcpTestServer, type AcpTestServer } from './acpTestServer'
import type { AgentEvent } from './agentAdapter'

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
