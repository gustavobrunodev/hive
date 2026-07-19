import type { ProcessHandle, ProcessRunner } from './processRunner'
import {
  composeTurnPrompt,
  createAgentEventQueue,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentInput,
  type AgentSession,
  type SessionOpts,
  type TurnOpts,
  type WorkflowCommand
} from './agentAdapter'

/**
 * MVP's sole `AgentAdapter` implementation (T13, C1): drives the real Claude
 * CLI (`claude`) via the injected `ProcessRunner`, mirroring the
 * constructor/factory-injection style of `configStore.ts` /
 * `workspaceService.ts` — no direct `electron` import, and the process
 * abstraction is passed in rather than reached for internally, so this
 * module is unit-testable against `createFakeProcessRunner()` with no real
 * `claude` binary required (none is available in this sandbox).
 *
 * --- CLI invocation flags: verified vs. best-guess (flag this clearly for
 * future correction — see task report) ---
 *
 * VERIFIED against a real `claude` binary (v2.1.206) and a live `-p` run
 * driving the real `bmad-prd` skill end-to-end (produced a real
 * `_bmad-output/.../prd.md`, matching design.md §7's predicted path):
 *   - `claude -p "<prompt>"` — non-interactive "print mode": run one turn
 *     against the given prompt, stream/print the result, then exit. This is
 *     the right primitive for spawning one process per turn against
 *     `ProcessRunner`/`ProcessHandle`, which only exposes a stdout/stderr
 *     stream + exit code (no stdin), not an attach-and-keep-talking channel.
 *   - `--model <id>` — selects the model for the run. `--help` recommends
 *     aliases (`opus`/`sonnet`/`haiku`/`fable`) over pinned full model ids,
 *     since the latter churn as new model generations ship.
 *   - `--effort <level>` — confirmed real, values `low|medium|high|xhigh|max`.
 *   - `--permission-mode <mode>` — **required** for any workflow that writes
 *     files (which "Create a PRD" always does): verified live that `-p` with
 *     no permission-mode flag silently refuses tool-driven writes ("I don't
 *     have permission to write there yet"), while `acceptEdits` allows them.
 *     `acceptEdits` covers Write/Edit only, not Bash — BMAD sub-steps that
 *     shell out (e.g. `uv run` scripts) still get skipped/blocked under it;
 *     acceptable for the MVP's single PRD-skill workflow, revisit if a
 *     future workflow needs Bash-driven BMAD steps.
 *   - Working directory: the CLI operates on the current working directory;
 *     we pass `opts.workspace` as `cwd` to `ProcessRunner.run`, not as a
 *     flag (matches how `BmadService`-style callers use `RunOptions.cwd`).
 *   - Workflow prompts sent via `runWorkflow` (e.g. "use the bmad-prd skill
 *     to create a PRD") — confirmed live: Claude Code resolves the skill by
 *     matching the natural-language prompt against `SKILL.md` descriptions,
 *     no explicit invocation syntax needed.
 *   - session-history flags, verified against the same binary's `--help`
 *     (v2.1.206): `-r, --resume [sessionId]` (resume a conversation by
 *     session id, works with --print), `--output-format stream-json`,
 *     `--include-partial-messages` (partial chunks; requires --print +
 *     stream-json), and stream-json-with-print requiring `--verbose`. The
 *     stdout parser falls back to raw-token passthrough for any non-JSON
 *     line, so an older CLI degrades to the previous opaque-text behavior.
 */

const CLAUDE_COMMAND = 'claude'

function capabilities(): AgentCapabilities {
  // Curated per C5 — deliberately not scraped from `claude --help` (there is
  // no stable machine-readable "list models" command, and the concrete set is
  // account-dependent). This is the full set of model aliases and effort
  // levels the Claude Code CLI accepts, not an arbitrarily trimmed subset:
  //
  //   - Models: the CLI's own `--model` aliases (`--help` recommends aliases
  //     over pinned model ids, which churn as new generations ship). `fable`
  //     was previously missing from this list.
  //   - Efforts: `--effort` accepts `low|medium|high|xhigh|max` (verified
  //     against a real `claude` binary). `xhigh`/`max` were previously
  //     missing.
  return {
    models: [
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' },
      { id: 'fable', label: 'Fable' }
    ],
    efforts: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
      { id: 'xhigh', label: 'Extra High' },
      { id: 'max', label: 'Max' }
    ],
    // R6.5/T16: attached/referenced file paths are folded into the turn's
    // prompt (`composeTurnPrompt`) — the CLI reads the files itself via its
    // Read tool, which handles text, images and PDFs alike.
    supportsAttachments: true
  }
}

/**
 * One parsed line of `--output-format stream-json` output (session-history:
 * this structured mode replaced raw-stdout `token` mapping so the adapter can
 * learn the CLI's `session_id` — the key to real conversation memory via
 * `--resume`). Only the fields this adapter reads are modeled; everything
 * else in the CLI's event objects is ignored.
 */
interface StreamJsonLine {
  type?: string
  subtype?: string
  session_id?: string
  event?: {
    type?: string
    delta?: { type?: string; text?: string }
  }
}

/**
 * Routes one stdout line into the session's event queue, tagging every event
 * with the turn's `turnId` (background-turns: concurrent turns share one
 * queue, so identity on the event is what keeps their streams apart).
 *  - `system/init` (and any later event carrying a changed `session_id`) →
 *    `session` — the renderer persists it per conversation and hands it back
 *    as `resume` on the next turn.
 *  - `stream_event` text deltas (`--include-partial-messages`) → `token` —
 *    true incremental streaming, replacing the old "whole stdout chunk as one
 *    token" mapping.
 *  - Complete `assistant`/`result`/`user` objects → ignored: their text
 *    already streamed as deltas; re-emitting would duplicate every reply.
 *  - A non-JSON line → emitted verbatim as a `token` (defensive fallback so
 *    an older CLI without stream-json — or a stray plain-text warning —
 *    degrades to the previous behavior instead of vanishing).
 */
function handleStdoutLine(
  line: string,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  sessionTracker: { lastId: string | null }
): void {
  const trimmed = line.trim()
  if (trimmed === '') return
  let parsed: StreamJsonLine
  try {
    parsed = JSON.parse(trimmed) as StreamJsonLine
  } catch {
    queue.push({ type: 'token', text: line, turnId })
    return
  }
  if (typeof parsed.session_id === 'string' && parsed.session_id !== sessionTracker.lastId) {
    sessionTracker.lastId = parsed.session_id
    queue.push({ type: 'session', id: parsed.session_id, turnId })
  }
  if (
    parsed.type === 'stream_event' &&
    parsed.event?.type === 'content_block_delta' &&
    parsed.event.delta?.type === 'text_delta' &&
    typeof parsed.event.delta.text === 'string'
  ) {
    queue.push({ type: 'token', text: parsed.event.delta.text, turnId })
  }
}

/**
 * Pipes one spawned turn's `ProcessHandle` into the session's shared event
 * queue: stdout is consumed as line-buffered stream-json (see
 * `handleStdoutLine`), stderr is collected as error context (never rendered
 * into the transcript), then exactly one terminal event:
 *  - `done` on a clean exit (code 0),
 *  - `interrupted` when the non-clean exit was caused by a deliberate
 *    user `stop()` (chat-controls CC-R1.5) — `wasInterrupted()` reports this
 *    turn's handle was the one `stop()` killed,
 *  - `error` otherwise (unexpected non-zero exit code or signal), with the
 *    tail of stderr appended so the Alert says *why*, not just the code.
 * Partial `token`s already delivered are unaffected either way (CC-R1.3).
 */
async function pipeTurn(
  handle: ProcessHandle,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  wasInterrupted: () => boolean
): Promise<void> {
  // Session-id dedupe is per turn: every event of a resumed run echoes the
  // same id, but each new turn must re-announce its (possibly re-minted) id.
  const sessionTracker: { lastId: string | null } = { lastId: null }
  let stdoutRest = ''
  let stderrTail = ''
  for await (const chunk of handle.output) {
    if (chunk.stream === 'stderr') {
      stderrTail = (stderrTail + chunk.data).slice(-500)
      continue
    }
    stdoutRest += chunk.data
    const lines = stdoutRest.split('\n')
    stdoutRest = lines.pop() ?? ''
    for (const line of lines) {
      handleStdoutLine(line, queue, turnId, sessionTracker)
    }
  }
  handleStdoutLine(stdoutRest, queue, turnId, sessionTracker)
  const result = await handle.exitCode
  if (wasInterrupted()) {
    queue.push({ type: 'interrupted', turnId })
  } else if (result.code === 0) {
    queue.push({ type: 'done', turnId })
  } else if (result.signal) {
    queue.push({
      type: 'error',
      message: `claude was terminated by signal ${result.signal}`,
      turnId
    })
  } else {
    const detail = stderrTail.trim()
    queue.push({
      type: 'error',
      message: `claude exited with code ${result.code}${detail ? `: ${detail}` : ''}`,
      turnId
    })
  }
}

function startSession(processRunner: ProcessRunner, opts: SessionOpts): AgentSession {
  const queue = createAgentEventQueue()
  // Every in-flight turn's handle, keyed by its caller turnId (or an
  // internal key when none was given). `ClaudeCliAdapter` spawns one
  // `claude -p ...` process per turn (see file header); background-turns
  // means several can now run concurrently — one conversation finishing in
  // the background while another streams on screen — so this is a map, not
  // a single "active handle". Conversation *context* across one-shot turns
  // comes from `--resume` (session-history).
  const activeHandles = new Map<string, ProcessHandle>()
  // Handles a user interrupt/stop killed, so `pipeTurn` can distinguish a
  // deliberate interrupt (emit `interrupted`) from a real failure
  // (emit `error`) — chat-controls CC-R1.5.
  const interruptedHandles = new Set<ProcessHandle>()
  let anonymousTurnCounter = 0

  function spawnTurn(prompt: string, turnOpts: TurnOpts | undefined): void {
    const resume = turnOpts?.resume
    const turnId = turnOpts?.turnId
    // Per-turn model/effort override (skill-studio) falls back to the session
    // defaults — so one turn can run on a heavier model without restarting the
    // shared session and killing its other (e.g. backgrounded) turns.
    const model = turnOpts?.model ?? opts.model
    const effort = turnOpts?.effort ?? opts.effort
    anonymousTurnCounter += 1
    const handleKey = turnId ?? `anon-${anonymousTurnCounter}`
    const handle = processRunner.run(
      CLAUDE_COMMAND,
      [
        '-p',
        prompt,
        '--model',
        model,
        '--effort',
        effort,
        // Verified live: without a permission-mode flag, `-p` silently
        // refuses tool-driven writes ("I don't have permission to write
        // there yet"). `acceptEdits` is the minimum that lets BMAD skills
        // (e.g. bmad-prd) actually write their output artifact.
        '--permission-mode',
        'acceptEdits',
        // session-history: structured output is what exposes the CLI's
        // `session_id` (the handle for `--resume`) and true token-level
        // streaming. `--verbose` is required by the CLI for stream-json
        // with --print; `--include-partial-messages` adds text deltas.
        '--output-format',
        'stream-json',
        '--include-partial-messages',
        '--verbose',
        // Continue this conversation's prior CLI session, when known.
        ...(resume ? ['--resume', resume] : [])
      ],
      { cwd: opts.workspace }
    )
    activeHandles.set(handleKey, handle)
    void pipeTurn(handle, queue, turnId, () => interruptedHandles.has(handle)).then(() => {
      if (activeHandles.get(handleKey) === handle) {
        activeHandles.delete(handleKey)
      }
      interruptedHandles.delete(handle)
    })
  }

  /** Marks a handle as deliberately killed (its terminal event becomes `interrupted`, not `error`), then kills it. */
  function killAsInterrupt(handle: ProcessHandle): void {
    interruptedHandles.add(handle)
    handle.kill()
  }

  return {
    // `send` writes have nowhere to go once a turn's process is running —
    // `ProcessHandle` doesn't expose stdin (see file header) — so, for this
    // MVP session model, `send` starts a brand new one-shot `claude -p`
    // turn per call rather than streaming into an already-running process.
    // Conversation memory across those turns is `--resume`'s job (above).
    send(input: AgentInput): void {
      spawnTurn(composeTurnPrompt(input.text, input.attachments), input)
    },
    events: queue,
    // Minimal MVP implementation: turns a `WorkflowCommand` into a one-shot
    // prompt turn, same as `send`. Full catalog wiring (mapping curated
    // intents to real BMAD skill prompts) is T17/T19; this just guarantees
    // a sane, non-crashing signature for those tasks to build on, including
    // a placeholder `key` with no `prompt`.
    runWorkflow(cmd: WorkflowCommand, turnOpts?: TurnOpts): void {
      // No explicit prompt → invoke the skill by its slash command, the same
      // thing the user would type in the composer (`claude -p "/<skill>"`).
      const prompt = cmd.prompt ?? `/${cmd.key}`
      spawnTurn(composeTurnPrompt(prompt, turnOpts?.attachments), turnOpts)
    },
    // background-turns: interrupt exactly one turn (the Stop button targets
    // the on-screen conversation's turn) or, with no id, every in-flight
    // turn. Background turns keep streaming either way when not targeted.
    interrupt(turnId?: string): void {
      if (turnId !== undefined) {
        const handle = activeHandles.get(turnId)
        if (handle) killAsInterrupt(handle)
        return
      }
      for (const handle of activeHandles.values()) killAsInterrupt(handle)
    },
    stop(): void {
      // Session teardown: every in-flight turn dies as a deliberate
      // interrupt (CC-R1.5) — never a spurious `error`.
      for (const handle of activeHandles.values()) killAsInterrupt(handle)
    }
  }
}

/**
 * Creates the MVP's `ClaudeCliAdapter`. `processRunner` is injected
 * (constructor/factory-injection, matching `createConfigStore`/
 * `createWorkspaceService`) so this module has no direct process-spawning
 * dependency of its own and is fully testable against
 * `createFakeProcessRunner()`.
 */
export function createClaudeCliAdapter(processRunner: ProcessRunner): AgentAdapter {
  return {
    id: 'claude-cli',
    displayName: 'Claude CLI',
    capabilities,
    startSession: (opts: SessionOpts) => startSession(processRunner, opts)
  }
}
