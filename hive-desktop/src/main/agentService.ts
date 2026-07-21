import type {
  AgentCapabilities,
  AgentEvent,
  AgentSession,
  SessionOpts,
  TurnOpts,
  WorkflowCommand
} from './agentAdapter'
import type { AgentRegistry } from './agentRegistry'

/**
 * `AgentService` (multi-agent) — owns a **pool of live sessions, one per
 * agent**, and is the UI/IPC layer's only way to talk to them. A single Hive
 * window can now run several agents at once (one conversation on Claude, another
 * on Devin, a third on Copilot), so there is no longer a single "active"
 * adapter: each turn names its `agentId` and the service routes it to (creating
 * on demand) that agent's session.
 *
 * Every session's events funnel into one unified `onEvent` stream. That's safe
 * because every event already carries the caller's `turnId` (background-turns),
 * which is what the renderer routes on — it never needed to know *which* adapter
 * produced a given token, only which conversation/turn it belongs to. So going
 * from one session to N changes nothing downstream.
 *
 * The `AgentRegistry` is injected (matching the rest of the main process); this
 * module only ever calls the `AgentAdapter` interface, staying agent-agnostic.
 */
export interface AgentService {
  /** The named agent's capabilities (models/efforts/attachments), or the default agent's when omitted. */
  capabilities(agentId?: string): AgentCapabilities
  /**
   * Ensures a live session exists for `opts.agentId` (defaulting to the
   * registry default) bound to the given workspace/model/effort, creating it
   * lazily and memoizing it in the pool. Idempotent: calling it again for an
   * agent that already has a session is a no-op (the existing session keeps its
   * events + in-flight turns). model/effort are per-turn overridable, so the
   * session's defaults here only matter for turns that don't override them.
   */
  startSession(opts: SessionOpts): AgentSession
  /**
   * Forwards a turn to the session named by `opts.agentId` (default agent when
   * omitted), starting that session first if needed (so a `send` never fails
   * merely because `startSession` wasn't called for that agent yet). `resume`
   * (conversation memory), `turnId` (background-turns) and `model`/`effort`
   * (per-turn overrides) travel through unchanged.
   */
  send(text: string, opts?: TurnOpts): void
  /** Forwards a guided-intent workflow command to the named agent's session. Same routing/opts as `send`. */
  runWorkflow(cmd: WorkflowCommand, opts?: TurnOpts): void
  /**
   * Interrupts one in-flight turn by id across the whole pool (an unknown id is
   * a per-adapter no-op, so broadcasting to every session is safe), or every
   * in-flight turn of every session with no id. Sessions stay alive.
   */
  interrupt(turnId?: string): void
  /**
   * Subscribes `listener` to the unified event stream of **every** pooled
   * session, present and future, and returns an unsubscribe function. Sessions
   * created later (a new agent's first turn) are automatically wired in.
   */
  onEvent(listener: (event: AgentEvent) => void): () => void
  /** Stops and clears every pooled session's underlying process(es). Safe with an empty pool. */
  stop(): void
}

interface PooledSession {
  session: AgentSession
  /** Forwarding loop guard: flipped by `stop()` so a torn-down session stops reaching listeners. */
  alive: boolean
}

export function createAgentService(registry: AgentRegistry): AgentService {
  // One session per agent id (multi-agent). Keyed by the resolved agent id.
  const pool = new Map<string, PooledSession>()
  const listeners = new Set<(event: AgentEvent) => void>()
  // The last workspace a session was started with, so a lazy
  // send-before-start can bind a new session to the right cwd.
  let currentWorkspace: string | null = null

  function resolveId(agentId?: string): string {
    return registry.resolve(agentId ?? null).id
  }

  /** Fans one session's events out to every current listener while the session is alive. */
  function pumpEvents(pooled: PooledSession): void {
    void (async () => {
      for await (const event of pooled.session.events) {
        if (!pooled.alive) return
        for (const listener of listeners) listener(event)
      }
    })()
  }

  function ensureSession(agentId: string, opts: SessionOpts): AgentSession {
    const existing = pool.get(agentId)
    if (existing) return existing.session
    const { adapter } = registry.resolve(agentId)
    const session = adapter.startSession({ ...opts, agentId })
    const pooled: PooledSession = { session, alive: true }
    pool.set(agentId, pooled)
    pumpEvents(pooled)
    return session
  }

  function startSession(opts: SessionOpts): AgentSession {
    return ensureSession(resolveId(opts.agentId), opts)
  }

  function sessionFor(opts?: TurnOpts): AgentSession {
    const agentId = resolveId(opts?.agentId)
    const existing = pool.get(agentId)
    if (existing) return existing.session
    // A send/runWorkflow can arrive before an explicit startSession for this
    // agent (e.g. the very first turn of a conversation on a newly-picked
    // agent) — start it lazily with no model/effort defaults; the turn's own
    // opts carry the model/effort.
    return ensureSession(agentId, { workspace: currentWorkspace ?? '', agentId })
  }

  return {
    capabilities: (agentId?: string) => registry.resolve(agentId ?? null).adapter.capabilities(),
    startSession(opts: SessionOpts): AgentSession {
      currentWorkspace = opts.workspace
      return startSession(opts)
    },
    send(text: string, opts?: TurnOpts): void {
      sessionFor(opts).send({
        text,
        resume: opts?.resume ?? null,
        turnId: opts?.turnId,
        attachments: opts?.attachments,
        model: opts?.model,
        effort: opts?.effort
      })
    },
    runWorkflow(cmd: WorkflowCommand, opts?: TurnOpts): void {
      sessionFor(opts).runWorkflow(cmd, {
        resume: opts?.resume ?? null,
        turnId: opts?.turnId,
        attachments: opts?.attachments,
        model: opts?.model,
        effort: opts?.effort
      })
    },
    interrupt(turnId?: string): void {
      for (const pooled of pool.values()) pooled.session.interrupt(turnId)
    },
    onEvent(listener: (event: AgentEvent) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    stop(): void {
      for (const pooled of pool.values()) {
        pooled.alive = false
        pooled.session.stop()
      }
      pool.clear()
    }
  }
}
