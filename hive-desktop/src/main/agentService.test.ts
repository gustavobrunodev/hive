import { describe, expect, it } from 'vitest'
import { createAgentService } from './agentService'
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
  stopped: boolean
  push(event: AgentEvent): void
}

function createFakeSession(opts: SessionOpts): FakeSession {
  const queue = createAgentEventQueue()
  const session: FakeSession = {
    opts,
    sends: [],
    workflows: [],
    stopped: false,
    events: queue,
    push: (event: AgentEvent) => queue.push(event),
    send(input: AgentInput) {
      session.sends.push(input)
    },
    runWorkflow(cmd: WorkflowCommand) {
      session.workflows.push(cmd)
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

function createFakeAdapter(): { adapter: AgentAdapter; sessions: FakeSession[] } {
  const sessions: FakeSession[] = []
  const adapter: AgentAdapter = {
    id: 'fake',
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

// Yields long enough for the microtask chain driving `onEvent`'s internal
// `for await` loop (queue push -> resolve -> .then -> loop -> listener) to
// fully drain, without relying on a fixed number of manual awaits.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AgentService', () => {
  it('capabilities() passes through to the adapter', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(adapter)

    expect(service.capabilities()).toEqual(FAKE_CAPABILITIES)
  })

  it('send() throws when no session has been started', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(adapter)

    expect(() => service.send('hello')).toThrow(/no active session/i)
  })

  it('runWorkflow() throws when no session has been started', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(adapter)

    expect(() => service.runWorkflow({ key: 'prd' })).toThrow(/no active session/i)
  })

  it('startSession() + send() forwards the turn to the underlying session', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(adapter)

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.send('hello')

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sends).toEqual([{ text: 'hello' }])
  })

  it('runWorkflow() forwards to the underlying session', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(adapter)

    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })
    service.runWorkflow({ key: 'prd', prompt: 'run prd' })

    expect(sessions[0].workflows).toEqual([{ key: 'prd', prompt: 'run prd' }])
  })

  it('starting a new session stops the previous active session and becomes the new target for send()', () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(adapter)

    service.startSession({ workspace: '/ws-1', model: 'model-a', effort: 'low' })
    service.startSession({ workspace: '/ws-2', model: 'model-a', effort: 'low' })

    expect(sessions[0].stopped).toBe(true)
    expect(sessions[1].stopped).toBe(false)

    service.send('hi')
    expect(sessions[0].sends).toEqual([])
    expect(sessions[1].sends).toEqual([{ text: 'hi' }])
  })

  it('onEvent() with no active session is a safe no-op subscribe (does not throw)', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(adapter)

    const unsubscribe = service.onEvent(() => {})
    expect(() => unsubscribe()).not.toThrow()
  })

  it("onEvent() forwards the active session's streamed events, in order", async () => {
    const { adapter, sessions } = createFakeAdapter()
    const service = createAgentService(adapter)
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
    const service = createAgentService(adapter)
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
    const service = createAgentService(adapter)
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
    const service = createAgentService(adapter)
    service.startSession({ workspace: '/ws', model: 'model-a', effort: 'low' })

    service.stop()

    expect(sessions[0].stopped).toBe(true)
    expect(() => service.send('hi')).toThrow(/no active session/i)
    expect(() => service.runWorkflow({ key: 'prd' })).toThrow(/no active session/i)
  })

  it('stop() with no active session is a safe no-op', () => {
    const { adapter } = createFakeAdapter()
    const service = createAgentService(adapter)

    expect(() => service.stop()).not.toThrow()
  })
})
