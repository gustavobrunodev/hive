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

import type { ToolPatch } from './toolPatch'

export type { PatchHunk, PatchLine, PatchOp, PatchSpan, ToolPatch } from './toolPatch'

/** One curated model or effort-level option surfaced to the UI (C5). */
export interface AgentOption {
  id: string
  label: string
  /**
   * Context-window size in tokens, for models that have a published one
   * (session-usage). The UI needs a denominator to turn the `usage` event's
   * raw token counts into "how full is this conversation" — and no CLI
   * reports its own limit, so it is curated here alongside the model list,
   * per C5. Omitted → the UI shows absolute token counts and no percentage,
   * which is the honest degradation for an adapter that hasn't declared one.
   */
  contextWindow?: number
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
 * - `tool` — the agent invoked a tool, or that invocation came back. Emitted
 *   as a **pair** (`phase: 'start'` on the `tool_use` block, `phase: 'end'` on
 *   its `tool_result`) correlated by `toolId`, so the UI can show work as it
 *   happens instead of a silent gap (agent-activity AA-R1).
 * - `approval` — the agent asked permission to run a tool that isn't
 *   pre-authorized (agent-approvals). The turn's CLI process is **blocked**
 *   until `AgentSession.respondApproval` answers with the matching
 *   `requestId`; nothing else in the stream moves until then.
 * - `done` — the turn/session's underlying process finished successfully.
 * - `error` — the turn/session's underlying process failed (non-zero exit,
 *   killed by an *unexpected* signal, or failed to spawn).
 * - `interrupted` — the turn was stopped by the *user* (chat-controls CC-R1):
 *   `stop()` killed the in-flight process on purpose. Distinct from `error` so
 *   the UI treats a deliberate stop as a normal outcome (keep partial output,
 *   no error Alert) rather than a claude failure (CC-R1.5). Terminal, like
 *   `done`/`error`.
 * - `usage` — the CLI reported how many tokens the turn actually cost
 *   (session-usage). Emitted repeatedly: once per completed assistant message
 *   (a live snapshot of how full the context window is) and once more, marked
 *   `final`, from the CLI's own end-of-turn `result` line, which is the only
 *   place a per-turn cost and the CLI's own duration exist. Purely
 *   informational — nothing in the turn's lifecycle depends on it, so an
 *   adapter whose CLI reports no usage simply never emits it.
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
  | ToolEvent
  | ApprovalEvent
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string; turnId?: string }
  | { type: 'interrupted'; turnId?: string }
  | { type: 'session'; id: string; turnId?: string }
  | UsageEvent

/**
 * One tool invocation, reported twice (agent-activity): `start` when the agent
 * decided to call it, `end` when its result came back. `toolId` is the CLI's
 * own `tool_use.id`, which is what pairs the two halves — the UI keys its live
 * activity rows on it.
 */
export interface ToolEvent {
  type: 'tool'
  /** As the CLI names it: `Bash`, `Read`, `Edit`, `Grep`, `mcp__<server>__<tool>`. */
  name: string
  /** The call's headline argument, already flattened to one line: the command for `Bash`, the path for file tools, the pattern for `Grep`. */
  detail?: string
  /** Correlates `start` with `end`. Absent on adapters that don't expose tool ids. */
  toolId?: string
  phase?: 'start' | 'end'
  /** `end` only — whether the tool reported an error result. */
  ok?: boolean
  /**
   * The absolute workspace path this tool wrote to. Set **only** for
   * file-editing tools, and deliberately separate from `detail`: change
   * attribution (ACR-C7) consumes paths, and a `Bash` command line is not one.
   */
  filePath?: string
  /**
   * `start` only, file-editing tools only: the change this call is about to
   * apply, already diffed and capped (agent-patch AP-C1). Present so the
   * transcript can draw the snippet at the moment the agent commits to it —
   * which, for a tool that needs permission, is before the user has answered.
   * Absent when the tool changes no file, or changes nothing.
   */
  patch?: ToolPatch
  turnId?: string
}

/**
 * What one request to the model actually cost, as the CLI reports it
 * (session-usage).
 *
 * The four token fields are the model's own accounting of the request it just
 * made, and their sum minus `outputTokens` **is** the context window's
 * occupancy: everything the model read this call, whether it came fresh from
 * the prompt, out of the prompt cache, or was written into the cache on the
 * way in. That is the same number Claude Code's `/context` reports, and it is
 * the only one available without re-tokenizing the transcript ourselves.
 *
 * `outputTokens` is deliberately *not* part of that sum — it is what the model
 * wrote, which only joins the context on the *next* request.
 */
export interface TurnUsage {
  /** Prompt tokens sent fresh, i.e. neither read from nor written to the cache. */
  inputTokens: number
  /** Prompt tokens served out of the cache — in a resumed conversation, most of it. */
  cacheReadTokens: number
  /** Prompt tokens written into the cache on this request: this call's *new* context. */
  cacheCreationTokens: number
  /** Tokens the model generated. Joins the context of the following request. */
  outputTokens: number
  /** The model as the CLI names it (`claude-opus-…`), when it says. */
  model?: string
  /** `result` only: what the CLI billed for the whole turn, in USD. */
  costUsd?: number
  /** `result` only: the CLI's own wall-clock for the turn, in ms. */
  durationMs?: number
  /** `result` only: the part of `durationMs` spent waiting on the API, in ms. */
  apiDurationMs?: number
}

/**
 * One usage report. `final` marks the end-of-turn `result` line — the only
 * snapshot whose totals cover the whole turn, and therefore the only one a
 * caller may accumulate across turns without double-counting the intermediate
 * assistant messages that led to it.
 */
export interface UsageEvent {
  type: 'usage'
  usage: TurnUsage
  final?: boolean
  turnId?: string
}

/**
 * The agent asked to run a tool it isn't pre-authorized for (agent-approvals).
 * The turn is blocked until answered — this is the same interaction Claude Code
 * shows in its own TUI, surfaced in Hive instead of nowhere.
 */
export interface ApprovalEvent {
  type: 'approval'
  /** Answer key: `respondApproval(requestId, …)` releases exactly this request. */
  requestId: string
  /** The tool the agent wants to run (`Bash`, `WebFetch`, `mcp__…`). */
  tool: string
  /** One-line headline for the card: the command, the URL, the path. */
  detail?: string
  /** The tool's full input, for the card's expandable detail. Already JSON-safe. */
  input?: Record<string, unknown>
  turnId?: string
}

/** How the user answered an `ApprovalEvent`. */
export interface ApprovalDecision {
  behavior: 'allow' | 'deny'
  /**
   * `always` also records a standing rule for this tool (persisted, app-wide),
   * so the same class of call stops asking. `once` covers only this request.
   * Ignored on `deny` — refusing is never remembered, so a mistaken "no" can't
   * quietly block the agent forever.
   */
  scope?: 'once' | 'always'
  /** Shown to the agent as the reason on `deny`, so it can adapt instead of retrying blind. */
  message?: string
}

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

/**
 * The permission-prompt endpoint an adapter can point its CLI at
 * (agent-approvals). Supplied by the main process, implemented by
 * `ApprovalService`; adapters treat it as opaque argv material and never learn
 * how approvals are actually delivered.
 */
export interface PermissionPromptEndpoint {
  /** The CLI flag value naming the tool (`mcp__hive_approvals__approve`). */
  promptToolName: string
  /** MCP server config JSON for one turn, or `null` while the bridge isn't listening. */
  mcpConfig(turnId?: string): string | null
}

/** Optional collaborators handed to an adapter factory. Every field is opt-in. */
export interface AgentAdapterDeps {
  permissionPrompt?: PermissionPromptEndpoint
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
