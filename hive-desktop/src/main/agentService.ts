import type {
  AgentAdapter,
  AgentCapabilities,
  AgentEvent,
  AgentSession,
  SessionOpts,
  WorkflowCommand
} from './agentAdapter'

/**
 * `AgentService` (T14) — owns the single active `AgentAdapter` session for
 * this app instance and is the UI/IPC layer's only way to talk to it. See
 * design.md §2 "Module Responsibilities" (`AgentService`: "Own the active
 * AgentAdapter; forward chat turns; stream tokens; expose adapter
 * capabilities") and §3's IPC surface (`agent.capabilities()`,
 * `agent.start(opts)`, `agent.send(...)`, `agent.runWorkflow(key)`).
 *
 * `adapter` is injected (constructor/factory-injection, matching
 * `createConfigStore`/`createWorkspaceService`/`createClaudeCliAdapter`), and
 * this module only ever calls the `AgentAdapter` interface — it never knows
 * it's talking to `ClaudeCliAdapter` specifically, keeping the UI/IPC layer
 * agent-agnostic per R6.2 and context.md decision C1.
 */
export interface AgentService {
  /** Thin passthrough to the adapter's capabilities (models/efforts/attachments). */
  capabilities(): AgentCapabilities
  /**
   * Starts a new session via the adapter and makes it the active one.
   * MVP scope (design.md): a single active session at a time. Starting a
   * new session stops the previous active session first (if any) so its
   * underlying process(es) don't leak, matching the "tear down the old one
   * before starting a new one" behavior `fsService.ts`'s `watchWorkspace`
   * wiring already uses for its own single-active-thing-per-sender state.
   */
  startSession(opts: SessionOpts): AgentSession
  /**
   * Forwards a turn's text to the active session. Throws if no session has
   * been started yet (a no-op would silently swallow a user's message,
   * which is worse than a clear error the IPC layer can surface as a
   * rejected promise to the renderer).
   */
  send(text: string): void
  /** Forwards a guided-intent workflow command to the active session. Same no-active-session behavior as `send`: throws. */
  runWorkflow(cmd: WorkflowCommand): void
  /**
   * Subscribes `listener` to the *currently* active session's event stream
   * and returns an unsubscribe function. If there is no active session yet,
   * this is a safe no-op subscribe (returns a no-op unsubscribe) rather than
   * throwing — unlike `send`/`runWorkflow`, subscribing before anything is
   * happening is harmless, there's just nothing to receive yet.
   *
   * The subscription is scoped to the session that was active at call time:
   * if `startSession` is called again later (a new active session), this
   * subscription stops forwarding that old session's further events (MVP
   * has no multi-session fan-out — see design.md's single-active-session
   * scope). Callers that want events from the new session must call
   * `onEvent` again after starting it. This mirrors the IPC layer's
   * `agent:event:*` channel pattern, which itself mirrors `fs:watch:*`.
   */
  onEvent(listener: (event: AgentEvent) => void): () => void
  /**
   * Stops the active session's underlying process(es), if any, and clears
   * it as the active session (T8, WS-R5.2). Distinct from `startSession`'s
   * internal `activeSession?.stop()` — that only tears down the *previous*
   * session as a side effect of starting a new one. This is for the case
   * where no new session is started right away (e.g. a workspace switch
   * whose `Chat` unmounts and the new workspace fails to provision before a
   * new session starts): without an explicit `stop()`, the old session's
   * process(es) would otherwise keep running, orphaned, until (if ever) a
   * new session starts. Safe to call with no active session (no-op).
   */
  stop(): void
}

function requireActiveSession(session: AgentSession | null, methodName: string): AgentSession {
  if (!session) {
    throw new Error(`AgentService.${methodName}: no active session — call startSession() first`)
  }
  return session
}

export function createAgentService(adapter: AgentAdapter): AgentService {
  let activeSession: AgentSession | null = null

  function startSession(opts: SessionOpts): AgentSession {
    activeSession?.stop()
    activeSession = adapter.startSession(opts)
    return activeSession
  }

  function send(text: string): void {
    requireActiveSession(activeSession, 'send').send({ text })
  }

  function runWorkflow(cmd: WorkflowCommand): void {
    requireActiveSession(activeSession, 'runWorkflow').runWorkflow(cmd)
  }

  function onEvent(listener: (event: AgentEvent) => void): () => void {
    const session = activeSession
    if (!session) {
      return () => {}
    }

    let stopped = false
    void (async () => {
      for await (const event of session.events) {
        // Stop forwarding once explicitly unsubscribed, or once a different
        // session has become the active one (see `onEvent`'s doc comment).
        if (stopped || activeSession !== session) {
          return
        }
        listener(event)
      }
    })()

    return () => {
      stopped = true
    }
  }

  function stop(): void {
    activeSession?.stop()
    activeSession = null
  }

  return {
    capabilities: () => adapter.capabilities(),
    startSession,
    send,
    runWorkflow,
    onEvent,
    stop
  }
}
