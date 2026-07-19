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
 * A hand-rolled fake `AgentSession` (rather than exercising the real
 * `ClaudeCliAdapter`): `AgentService` only ever talks to the `AgentAdapter`
 * interface (per C1), so a minimal fake that records what's sent to it and
 * lets tests push events onto its `events` stream on demand is the most
 * direct way to prove `AgentService`'s own forwarding/tracking logic,
 * independent of `ClaudeCliAdapter`'s process-spawning behavior (already
 * covered by claudeCliAdapter.test.ts).
 */
interface FakeSession extends AgentSession {
  opts: SessionOpts
  sends: AgentInput[]
  workflows: WorkflowCommand[]
  /** Every `interrupt()` call's turnId arg (undefined = interrupt-all). */
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
    displayName: 'Fake Adapter',
    capabilities: () => FAKE_CAPABILITIES,
    startSession: (opts: SessionOpts) => {
      const session = createFakeSession(opts)
      sessions.push(session)
      return session
    }
  }
  return { adapter, sessions }
}

/**
 * A minimal `AgentRegistry` wrapping one or more fake adapters — `AgentService`
 * now resolves its adapter through the registry (agent-selection AG-R1), so
 * tests inject a registry keyed by adapter id. `resolve` mirrors the real
 * registry's unknown-id-falls-back-to-default behaviour (AG-R2.2).
 */
function createFakeRegistry(adapters: Record<string, AgentAdapter>): AgentRegistry {
  const ids = Object.keys(adapters)
  const meta: AgentMeta[] = ids.map((id) => ({
    id,
    displayName: adapters[id].displayName,
    description: '',
    available: true
  }))
  return {
    list: () => meta,
    get: (id) => adapters[id] ?? null,
    defaultId: () => ids[0],
    resolve: (id) => {
      if (id && adapters[id]) return { id, adapter: adapters[id] }
      return { id: ids[0], adapter: adapters[ids[0]] }
    }
  }
}

// Yields long enough for the microtask chain driving `onEvent`'s internal
// `for await` loop (queue push -> resolve -> .then -> loop -> listener) to
// fully drain, without relying on a fixed number of manual awaits.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AgentService', () => {
  it('capabilities() passes through to the adapter', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    expect(service.capabilities()).toEqual(FAKE_CAPABILITIES)
  })

  it('send() throws when no session has been started', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    expect(() => service.send('hello')).toThrow(/no active session/i)
  })

  it('runWorkflow() throws when no session has been started', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    expect(() => service.runWorkflow({ key: 'prd' })).toThrow(/no active session/i)
  })

  it('startSession() + send() forwards the turn to the underlying session', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.send('hello')

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sends).toEqual([{ text: 'hello', resume: null }])
  })

  it('runWorkflow() forwards to the underlying session', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.runWorkflow({ key: 'prd', prompt: 'run prd' })

    expect(sessions[0].workflows).toEqual([{ key: 'prd', prompt: 'run prd' }])
  })

  // session-history + background-turns: resume + turnId ride through untouched.
  it('send() forwards resume and turnId to the session as AgentInput fields', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.send('continua dali', { resume: 'cli-sess-7', turnId: 'turn-9' })

    expect(sessions[0].sends).toEqual([
      { text: 'continua dali', resume: 'cli-sess-7', turnId: 'turn-9' }
    ])
  })

  // skill-studio: a per-turn model/effort override rides through to the session.
  it('send() forwards a per-turn model/effort override', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.send('gera a skill', { turnId: 'turn-1', model: 'opus', effort: 'max' })

    expect(sessions[0].sends).toEqual([
      { text: 'gera a skill', resume: null, turnId: 'turn-1', model: 'opus', effort: 'max' }
    ])
  })

  // chat-attachments: attached/referenced file paths ride through untouched.
  it('send() forwards attachments to the session as an AgentInput field', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.send('analisa', { attachments: ['/abs/dados.csv', 'docs/prd.md'] })

    expect(sessions[0].sends).toEqual([
      { text: 'analisa', resume: null, attachments: ['/abs/dados.csv', 'docs/prd.md'] }
    ])
  })

  it('starting a new session stops the previous active session and becomes the new target for send()', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    service.startSession({ workspace: '/ws-1', model: 'model-a', effort: 'low' })
    service.startSession({ workspace: '/ws-2', model: 'model-a', effort: 'low' })

    expect(sessions[0].stopped).toBe(true)
    expect(sessions[1].stopped).toBe(false)

    service.send('hi')
    expect(sessions[0].sends).toEqual([])
    expect(sessions[1].sends).toEqual([{ text: 'hi', resume: null }])
  })

  it('onEvent() with no active session is a safe no-op subscribe (does not throw)', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    const unsubscribe = service.onEvent(() => {})
    expect(() => unsubscribe()).not.toThrow()
  })

  it("onEvent() forwards the active session's streamed events, in order", async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')
    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })

    const received: AgentEvent[] = []
    service.onEvent((event) => received.push(event))

    sessions[0].push({ type: 'token', text: 'Hel' })
    sessions[0].push({ type: 'token', text: 'lo' })
    sessions[0].push({ type: 'done' })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(received).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo' },
      { type: 'done' }
    ])
  })

  it('unsubscribing via the returned function stops further forwarding', async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')
    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })

    const received: AgentEvent[] = []
    const unsubscribe = service.onEvent((event) => received.push(event))
    unsubscribe()

    sessions[0].push({ type: 'token', text: 'late' })
    await flushMicrotasks()

    expect(received).toEqual([])
  })

  it("starting a new session stops forwarding a previous onEvent subscription's events", async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')
    service.startSession({ workspace: '/ws-1', model: 'model-a', effort: 'low' })

    const received: AgentEvent[] = []
    service.onEvent((event) => received.push(event))

    service.startSession({ workspace: '/ws-2', model: 'model-a', effort: 'low' })
    sessions[0].push({ type: 'token', text: 'ignored, stale session' })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(received).toEqual([])
  })

  // T8 (WS-R5.2): explicit teardown, distinct from startSession()'s own
  // "stop the previous session" side effect — this is for the case where no
  // new session is started right after (e.g. Chat's unmount on a workspace
  // switch that never mounts a new Chat).
  it('stop() stops the active session and clears it, so a later send()/runWorkflow() throws again', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')
    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })

    service.stop()

    expect(sessions[0].stopped).toBe(true)
    expect(() => service.send('hi')).toThrow(/no active session/i)
    expect(() => service.runWorkflow({ key: 'prd' })).toThrow(/no active session/i)
  })

  it('stop() with no active session is a safe no-op', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    expect(() => service.stop()).not.toThrow()
  })

  // session-history / chat-controls CC-R1 / background-turns: interrupt
  // targets turns, never the session — the user is still mid-conversation.
  it('interrupt(turnId?) forwards to the session and keeps it active: send() still works and events keep forwarding', async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')
    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })

    const received: AgentEvent[] = []
    service.onEvent((event) => received.push(event))

    service.interrupt('turn-3')
    service.interrupt()

    expect(sessions[0].interrupts).toEqual(['turn-3', undefined])
    expect(sessions[0].stopped).toBe(false)
    // Session still active: send() targets it instead of throwing…
    expect(() => service.send('continua')).not.toThrow()
    expect(sessions[0].sends).toEqual([{ text: 'continua', resume: null }])
    // …and its events still reach the subscriber (unlike after stop(), which
    // cuts the forwarding loop via the activeSession identity check).
    sessions[0].push({ type: 'interrupted' })
    await Promise.resolve()
    await Promise.resolve()
    expect(received).toEqual([{ type: 'interrupted' }])
  })

  it('interrupt() with no active session is a safe no-op', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(createFakeRegistry({ fake: adapter }), 'fake')

    expect(() => service.interrupt()).not.toThrow()
  })

  // agent-selection (AG-R1.2/AG-C4): the active adapter is chosen from the
  // registry and can be re-bound at runtime.
  it('activeAgentId() reports the initially-selected adapter', () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter }),
      'agent-b'
    )

    expect(service.activeAgentId()).toBe('agent-b')
  })

  it('resolves an unknown initial id to the registry default (AG-R2.2)', () => {
    const a = createFakeAdapter('agent-a')
    const service = createAgentService(createFakeRegistry({ 'agent-a': a.adapter }), 'missing')

    expect(service.activeAgentId()).toBe('agent-a')
  })

  it('setAdapter() re-binds which adapter future sessions use', () => {
    const a = createFakeAdapter('agent-a')
    const b = createFakeAdapter('agent-b')
    const service = createAgentService(
      createFakeRegistry({ 'agent-a': a.adapter, 'agent-b': b.adapter }),
      'agent-a'
    )

    service.setAdapter('agent-b')
    expect(service.activeAgentId()).toBe('agent-b')

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    expect(a.sessions).toHaveLength(0)
    expect(b.sessions).toHaveLength(1)
  })

  it('setAdapter() ignores an unknown/unavailable id (safe no-op)', () => {
    const a = createFakeAdapter('agent-a')
    const service = createAgentService(createFakeRegistry({ 'agent-a': a.adapter }), 'agent-a')

    service.setAdapter('nope')
    expect(service.activeAgentId()).toBe('agent-a')
  })
})
