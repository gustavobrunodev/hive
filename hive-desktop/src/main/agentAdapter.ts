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
 */
export interface AgentCapabilities {
  models: AgentOption[]
  efforts: AgentOption[]
  /** MVP: false for `ClaudeCliAdapter`. File attachments are a separate,
   *  later should-have task (R6.5 / T16). */
  supportsAttachments: boolean
}

/** Options a caller supplies when starting a new agent session. */
export interface SessionOpts {
  /** Absolute path to the active workspace; the adapter runs the CLI here. */
  workspace: string
  /** A model id from this adapter's `capabilities().models`. */
  model: string
  /** An effort id from this adapter's `capabilities().efforts`. */
  effort: string
}

/**
 * A single turn's input. `text` is the only field needed for this task.
 * File attachments (R6.5) are a separate future should-have task (T16) and
 * deliberately not modeled here yet — extending this with an optional
 * `attachments` field later is additive and won't require changing this
 * task's callers.
 */
export interface AgentInput {
  text: string
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
 *   killed by an unexpected signal, or failed to spawn).
 */
export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string; detail?: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

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

/** A live (or just-started) agent session. */
export interface AgentSession {
  /** Send a turn's input to the agent. */
  send(input: AgentInput): void
  /** Streamed events for this session, across all turns. */
  readonly events: AsyncIterable<AgentEvent>
  /** Drive the agent via a guided-intent workflow command (R7.2). */
  runWorkflow(cmd: WorkflowCommand): void
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
