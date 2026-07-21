import { describe, expect, it } from 'vitest'
import { createAgentService } from './agentService'
import type { AgentRegistry, AgentMeta } from './agentRegistry'
import {
  createAgentEventQueue,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentEvent,
  type AgentInput,
  type AgentSession,
  type SessionOpts,
  type WorkflowCommand
} from './agentAdapter'

/**
 * A hand-rolled fake `AgentSession` (rather than the real `ClaudeCliAdapter`):
 * `AgentService` only ever talks to the `AgentAdapter` interface, so a minimal
 * fake that records what's sent to it and lets tests push events onto its
 * `events` stream is the most direct way to prove the service's own
 * pool/routing/forwarding logic (multi-agent).
 */
interface FakeSession extends AgentSession {
  opts: SessionOpts
  sends: AgentInput[]
  workflows: WorkflowCommand[]
  interrupts: Array<string | undefined>
  stopped: boolean
  push(event: AgentEvent): void
}

function createFakeSession(opts: SessionOpts): FakeSession {
  const queue = createAgentEventQueue()
  const session: FakeSession = {
    opts,
    sends: [],
    workflows: [],
    interrupts: [],
    stopped: false,
    events: queue,
    push: (event: AgentEvent) => queue.push(event),
    send(input: AgentInput) {
      session.sends.push(input)
    },
    runWorkflow(cmd: WorkflowCommand) {
      session.workflows.push(cmd)
    },
    interrupt(turnId?: string) {
      session.interrupts.push(turnId)
    },
    stop() {
      session.stopped = true
    }
  }
  return session
}

const FAKE_CAPABILITIES: AgentCapabilities = {
  models: [{ id: 'model-a', label: 'Model A' }],
  efforts: [{ id: 'low', label: 'Low' }],
  supportsAttachments: false
}

function createFakeAdapter(id = 'fake'): { adapter: AgentAdapter; sessions: FakeSession[] } {
  const sessions: FakeSession[] = []
  const adapter: AgentAdapter = {
    id,
    displayName: `Fake ${id}`,
    capabilities: () => ({ ...FAKE_CAPABILITIES }),
    startSession: (opts: SessionOpts) => {
      const session = createFakeSession(opts)
      sessions.push(session)
      return session
    }
  }
  return { adapter, sessions }
}

/** A minimal `AgentRegistry` over one or more fake adapters (multi-agent pool routing). */
function createFakeRegistry(adapters: Record<string, AgentAdapter>): AgentRegistry {
  const ids = Object.keys(adapters)
  const meta: AgentMeta[] = ids.map((id) => ({
    id,
    displayName: adapters[id].displayName,
    description: '',
    available: true,
    installHint: '',
    docsUrl: ''
  }))
  return {
    detect: async () => meta,
    get: (id) => adapters[id] ?? null,
    defaultId: () => ids[0],
    ids: () => ids,
    resolve: (id) => {
      if (id && adapters[id]) return { id, adapter: adapters[id] }
      return { id: ids[0], adapter: adapters[ids[0]] }
    }
  }
}

// Yields long enough for the microtask chain driving `onEvent`'s internal
// `for await` loop (queue push -> resolve -> loop -> listener) to fully drain.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AgentService (multi-agent pool)', () => {
  it('capabilities() passes through to the default adapter, and to a named one', () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter })
    )

    expect(service.capabilities()).toEqual(FAKE_CAPABILITIES)
    expect(service.capabilities('agent-b')).toEqual(FAKE_CAPABILITIES)
  })

  it('send() before any startSession lazily starts the default agent and forwards the turn', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))

    service.startSession({ workspace: '/ws' })
    service.send('hello')

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sends).toEqual([{ text: 'hello', resume: null }])
  })

  it('routes turns to the session named by opts.agentId, starting each agent lazily', () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter })
    )

    service.startSession({ workspace: '/ws' })
    service.send('para A', { agentId: 'agent-a', turnId: 't-a' })
    service.send('para B', { agentId: 'agent-b', turnId: 't-b' })

    expect(a.sessions).toHaveLength(1)
    expect(b.sessions).toHaveLength(1)
    expect(a.sessions[0].sends).toEqual([{ text: 'para A', resume: null, turnId: 't-a' }])
    expect(b.sessions[0].sends).toEqual([{ text: 'para B', resume: null, turnId: 't-b' }])
  })

  it('reuses a pooled session for the same agent across turns (idempotent start)', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))

    service.startSession({ workspace: '/ws' })
    service.startSession({ workspace: '/ws' })
    service.send('one')
    service.send('two')

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sends).toHaveLength(2)
  })

  it('runWorkflow() forwards to the named agent session', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))

    service.startSession({ workspace: '/ws' })
    service.runWorkflow({ key: 'prd', prompt: 'run prd' }, { agentId: 'fake' })

    expect(sessions[0].workflows).toEqual([{ key: 'prd', prompt: 'run prd' }])
  })

  it('send() forwards resume, turnId, model/effort override and attachments', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))

    service.startSession({ workspace: '/ws' })
    service.send('vai', {
      resume: 'cli-7',
      turnId: 'turn-9',
      model: 'opus',
      effort: 'max',
      attachments: ['/abs/dados.csv']
    })

    expect(sessions[0].sends).toEqual([
      {
        text: 'vai',
        resume: 'cli-7',
        turnId: 'turn-9',
        model: 'opus',
        effort: 'max',
        attachments: ['/abs/dados.csv']
      }
    ])
  })

  it('onEvent() forwards events from every pooled session, tagged by turnId (concurrency)', async () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter })
    )
    service.startSession({ workspace: '/ws' })

    const received: AgentEvent[] = []
    service.onEvent((event) => received.push(event))

    // Two agents running concurrently — their streams interleave through one
    // unified subscription, each carrying its own turnId.
    service.send('a', { agentId: 'agent-a', turnId: 't-a' })
    service.send('b', { agentId: 'agent-b', turnId: 't-b' })
    a.sessions[0].push({ type: 'token', text: 'from A', turnId: 't-a' })
    b.sessions[0].push({ type: 'token', text: 'from B', turnId: 't-b' })
    a.sessions[0].push({ type: 'done', turnId: 't-a' })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(received).toContainEqual({ type: 'token', text: 'from A', turnId: 't-a' })
    expect(received).toContainEqual({ type: 'token', text: 'from B', turnId: 't-b' })
    expect(received).toContainEqual({ type: 'done', turnId: 't-a' })
  })

  it('unsubscribing via the returned function stops further forwarding', async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))
    service.startSession({ workspace: '/ws' })
    service.send('go')

    const received: AgentEvent[] = []
    const unsubscribe = service.onEvent((event) => received.push(event))
    unsubscribe()

    sessions[0].push({ type: 'token', text: 'late' })
    await flushMicrotasks()

    expect(received).toEqual([])
  })

  it('interrupt(turnId?) broadcasts to every pooled session and keeps them alive', () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter })
    )
    service.startSession({ workspace: '/ws' })
    service.send('a', { agentId: 'agent-a' })
    service.send('b', { agentId: 'agent-b' })

    service.interrupt('turn-3')
    service.interrupt()

    expect(a.sessions[0].interrupts).toEqual(['turn-3', undefined])
    expect(b.sessions[0].interrupts).toEqual(['turn-3', undefined])
    expect(a.sessions[0].stopped).toBe(false)
    expect(b.sessions[0].stopped).toBe(false)
  })

  it('stop() stops and clears every pooled session; a later send lazily starts a fresh one', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))
    service.startSession({ workspace: '/ws' })
    service.send('one')

    service.stop()
    expect(sessions[0].stopped).toBe(true)

    // A new send after stop() rebuilds the pool (fresh session).
    service.send('two')
    expect(sessions).toHaveLength(2)
    expect(sessions[1].sends).toEqual([{ text: 'two', resume: null }])
  })

  it('stop()/interrupt() with an empty pool are safe no-ops', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }))

    expect(() => service.stop()).not.toThrow()
    expect(() => service.interrupt()).not.toThrow()
  })

  it('routes an unknown agentId to the registry default (never throws)', () => {
    const a = createFakeAdapter('agent-a')
    const service = createAgentService(createFakeRegistry({ 'agent-a': a.adapter }))

    service.startSession({ workspace: '/ws' })
    service.send('hi', { agentId: 'missing' })

    expect(a.sessions).toHaveLength(1)
    expect(a.sessions[0].sends).toEqual([{ text: 'hi', resume: null }])
  })
})
