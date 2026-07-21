/**
 * `AgentAdapter` — the decoupling boundary between the app and whichever
 * agent CLI drives a chat session (T13). See design.md §2 "Module
 * Responsibilities" (`AgentAdapter`) and §3 "Key Interfaces", and context.md
 * decision C1 (internal adapter interface, Claude CLI only for MVP — no
 * external ACP spec) and C5 (curated per-adapter model/effort lists, not
 * scraped from `--help`).
 *
 * This module holds only the *contract* (types) plus anything shared across
 * adapter implementations. `ClaudeCliAdapter`, the MVP's sole implementation,
 * lives in `claudeCliAdapter.ts`. Future adapters (e.g. a Devin CLI adapter,
 * per C1) implement this same interface and are drop-in — nothing in
 * `AgentService` (T14) or the UI should need to know which adapter is active
 * beyond this contract.
 */

/** One curated model or effort-level option surfaced to the UI (C5). */
export interface AgentOption {
  id: string
  label: string
}

/**
 * What an adapter supports, so the UI can build model/effort pickers and
 * decide whether to offer attachments — all driven by the adapter, never
 * hardcoded in the UI (C5).
 *
 * multi-agent: `models` and/or `efforts` may be **empty**. Not every agent CLI
 * exposes a model choice (Devin is a fixed-model agent) or effort levels (the
 * GitHub Copilot CLI has none). The composer hides the corresponding picker
 * when its list is empty and simply omits `--model`/`--effort` on the turn, so
 * the adapter falls back to its CLI's own default.
 */
export interface AgentCapabilities {
  models: AgentOption[]
  efforts: AgentOption[]
  /** Whether turns may carry `AgentInput.attachments` (R6.5/T16). The UI
   *  gates the attach button + drag-and-drop on this. */
  supportsAttachments: boolean
}

/**
 * One file the user picked to attach to a prompt (R6.5/T16) — the shape the
 * `chat:chooseAttachments` native dialog returns and the composer chips
 * render. `path` is absolute (attachments may live anywhere on the host OS,
 * unlike `#` references, which are workspace-relative by construction).
 */
export interface AttachmentPick {
  path: string
  name: string
  /** Bytes, for the chip's meta line. */
  size: number
}

/** Options a caller supplies when starting a new agent session. */
export interface SessionOpts {
  /**
   * Which registered adapter drives this session (multi-agent). Set by the
   * `AgentService` session pool + IPC layer to route `start`/`send` to the
   * right adapter; the adapter implementation itself ignores it (it already
   * *is* that adapter). Omitted → the caller's default agent.
   */
  agentId?: string
  /** Absolute path to the active workspace; the adapter runs the CLI here. */
  workspace: string
  /**
   * A model id from this adapter's `capabilities().models`, or omitted when
   * the adapter exposes no model choice (`capabilities().models` empty) — the
   * CLI then uses its own default.
   */
  model?: string
  /** An effort id from this adapter's `capabilities().efforts`, or omitted when the adapter exposes no effort levels. */
  effort?: string
}

/** A single turn's input. */
export interface AgentInput {
  text: string
  /**
   * Files offered as context for this turn (R6.5/T16): absolute paths for
   * user-attached files, workspace-relative POSIX paths for `#` references.
   * Adapters fold them into the turn's prompt (`composeTurnPrompt`) — the
   * agent CLI reads the files itself via its own tools, so nothing is
   * inlined over IPC.
   */
  attachments?: string[]
  /**
   * session-history (conversation memory): the adapter-native session id to
   * resume so the agent keeps the conversation's prior context (`claude -p
   * --resume <id>`). `null`/omitted starts the turn fresh. This is the
   * *CLI's* id (surfaced via the `session` event), not Hive's stored
   * conversation id.
   */
  resume?: string | null
  /**
   * Caller-chosen identity for this turn (background-turns): echoed on every
   * event the turn produces, so concurrent turns — e.g. one conversation
   * still streaming in the background while another runs on screen — route
   * their tokens/terminals to the right transcript, and `interrupt(turnId)`
   * can stop exactly one of them.
   */
  turnId?: string
  /**
   * Per-turn model override (skill-studio): a model id from
   * `capabilities().models`, applied to just this turn instead of the
   * session's default. This lets one conversation run on a different model
   * (e.g. the skill-studio launching a generation on a heavier model) without
   * restarting — and so tearing down — the shared session. Omitted → the
   * session default (`SessionOpts.model`).
   */
  model?: string
  /** Per-turn effort override — same contract as `model` (`SessionOpts.effort` is the default). */
  effort?: string
}

/**
 * Streamed events produced by a session, per design.md §3
 * (`token | tool | done | error`). Fields are this task's own judgment call
 * (design.md only names the variants, not their fields):
 * - `token` — a chunk of streamed agent output text. MVP maps each raw
 *   stdout chunk from the underlying CLI process to one `token` event
 *   (simplest reasonable mapping; no attempt to parse structured
 *   token/message boundaries out of the CLI's stdout).
 * - `tool` — the agent invoked a tool. Not populated by `ClaudeCliAdapter`
 *   in this task (its stdout is treated as opaque text), but the variant is
 *   modeled now so a future adapter/parser can start emitting it without an
 *   `AgentEvent` shape change.
 * - `done` — the turn/session's underlying process finished successfully.
 * - `error` — the turn/session's underlying process failed (non-zero exit,
 *   killed by an *unexpected* signal, or failed to spawn).
 * - `interrupted` — the turn was stopped by the *user* (chat-controls CC-R1):
 *   `stop()` killed the in-flight process on purpose. Distinct from `error` so
 *   the UI treats a deliberate stop as a normal outcome (keep partial output,
 *   no error Alert) rather than a claude failure (CC-R1.5). Terminal, like
 *   `done`/`error`.
 * - `session` — the adapter learned (or re-learned) the CLI-native session id
 *   for the conversation in progress (session-history). Callers persist it and
 *   pass it back as `AgentInput.resume` on later turns so the agent keeps its
 *   context. Emitted whenever the id changes (the Claude CLI can mint a new id
 *   when resuming).
 *
 * Every variant can carry the `turnId` its turn was spawned with
 * (background-turns) — the router key that keeps concurrent turns' streams
 * apart. Absent on events from turns spawned without one.
 */
export type AgentEvent =
  | { type: 'token'; text: string; turnId?: string }
  | { type: 'tool'; name: string; detail?: string; turnId?: string }
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string; turnId?: string }
  | { type: 'interrupted'; turnId?: string }
  | { type: 'session'; id: string; turnId?: string }

/**
 * A guided-intent entry point (R7.2) — "run BMAD workflow X". The full
 * catalog (`WorkflowCatalog`, curated intent→command map) is built in T17;
 * this is a minimal placeholder shape so `runWorkflow`'s signature doesn't
 * block that later wiring. `key` identifies the workflow (e.g. a BMAD skill
 * name like `"bmad-prd"`); `prompt`, if given, is the literal instruction
 * sent to the agent for this workflow (T17/T19 will supply real ones —
 * BMAD's Claude Code integration is skill-based, triggered by a natural
 * language prompt naming the intent, not a special CLI flag; see design.md
 * §7 "PRD workflow command"). When `prompt` is omitted, the adapter falls
 * back to a generic "run workflow `key`" instruction.
 */
export interface WorkflowCommand {
  key: string
  prompt?: string
}

/** Per-turn options shared by `send` (via `AgentInput`) and `runWorkflow`. */
export interface TurnOpts {
  /**
   * Which registered adapter runs this turn (multi-agent). Consumed by the
   * `AgentService` pool to pick the session; the adapter itself ignores it.
   * Omitted → the conversation's / caller's default agent.
   */
  agentId?: string
  /** Same contract as `AgentInput.resume`. */
  resume?: string | null
  /** Same contract as `AgentInput.turnId`. */
  turnId?: string
  /** Same contract as `AgentInput.attachments`. */
  attachments?: string[]
  /** Same contract as `AgentInput.model` — a per-turn model override. */
  model?: string
  /** Same contract as `AgentInput.effort` — a per-turn effort override. */
  effort?: string
}

/**
 * Folds a turn's attached/referenced file paths into the prompt an adapter
 * hands its CLI. Shared across adapter implementations (the *transport*
 * differs per adapter; the context contract shouldn't). The block is
 * English — it's machine-facing instruction to the agent, not UI chrome, and
 * the agent's reply language is governed by the workspace's own config
 * (R1.6 scope note in i18n/pt-BR.ts).
 */
export function composeTurnPrompt(text: string, attachments?: string[]): string {
  if (!attachments || attachments.length === 0) return text
  const list = attachments.map((path) => `- ${path}`).join('\n')
  const block = `<attached-files>\nThe user attached the following files as context for this message. Read each one before answering:\n${list}\n</attached-files>`
  return text.trim().length === 0 ? block : `${text}\n\n${block}`
}

/** A live (or just-started) agent session. */
export interface AgentSession {
  /** Send a turn's input to the agent. */
  send(input: AgentInput): void
  /** Streamed events for this session, across all turns. */
  readonly events: AsyncIterable<AgentEvent>
  /** Drive the agent via a guided-intent workflow command (R7.2). */
  runWorkflow(cmd: WorkflowCommand, opts?: TurnOpts): void
  /**
   * Interrupts one in-flight turn by id, or every in-flight turn when called
   * without one (background-turns / chat-controls CC-R1). Unlike `stop()`,
   * the session stays alive and its other turns keep streaming. Interrupted
   * turns end with `interrupted`, never `error`. Unknown ids are a no-op.
   */
  interrupt(turnId?: string): void
  /** Stop the session's underlying process(es). Safe to call more than once. */
  stop(): void
}

/** Contract any agent CLI implements (C1). MVP: `ClaudeCliAdapter`. */
export interface AgentAdapter {
  id: string
  displayName: string
  capabilities(): AgentCapabilities
  startSession(opts: SessionOpts): AgentSession
}

/**
 * A small single-producer/single-consumer async queue for `AgentEvent`s,
 * shared across every turn of a session (a session's `events` is one
 * continuous stream even though `ClaudeCliAdapter` spawns a fresh process
 * per turn — see claudeCliAdapter.ts). Mirrors the equivalent private queue
 * in `processRunner.ts`; duplicated here (not imported) because that one
 * isn't exported and is typed for `ProcessStreamChunk`, not `AgentEvent`.
 */
export function createAgentEventQueue(): {
  push(event: AgentEvent): void
  [Symbol.asyncIterator](): AsyncIterator<AgentEvent>
} {
  const buffer: AgentEvent[] = []
  const waiting: Array<(result: IteratorResult<AgentEvent>) => void> = []

  return {
    push(event: AgentEvent): void {
      const resolve = waiting.shift()
      if (resolve) {
        resolve({ value: event, done: false })
      } else {
        buffer.push(event)
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
      return {
        next(): Promise<IteratorResult<AgentEvent>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift() as AgentEvent, done: false })
          }
          return new Promise((resolve) => waiting.push(resolve))
        }
      }
    }
  }
}
