import type { ProcessHandle, ProcessRunner } from './processRunner'
import {
  createAgentEventQueue,
  type AgentAdapter,
  type AgentCapabilities,
  type AgentInput,
  type AgentSession,
  type SessionOpts,
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
 */

const CLAUDE_COMMAND = 'claude'

function capabilities(): AgentCapabilities {
  // Curated per C5 — deliberately not scraped from `claude --help`. Ids are
  // structurally reasonable Claude model/effort identifiers, not guaranteed
  // to be the literally-current model id strings (those churn); the point
  // of C5 is that this list is a maintained, hand-picked set either way.
  return {
    models: [
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' }
    ],
    efforts: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' }
    ],
    // R6.5 (attachments) is a separate should-have task (T16).
    supportsAttachments: false
  }
}

/**
 * Pipes one spawned turn's `ProcessHandle` into the session's shared event
 * queue: every stdout/stderr chunk becomes a `token` event (simplest
 * reasonable MVP mapping — see agentAdapter.ts's `AgentEvent` doc), then
 * exactly one terminal event (`done` on a clean exit, `error` otherwise:
 * non-zero exit code, or exit via signal).
 */
async function pipeTurn(
  handle: ProcessHandle,
  queue: ReturnType<typeof createAgentEventQueue>
): Promise<void> {
  for await (const chunk of handle.output) {
    queue.push({ type: 'token', text: chunk.data })
  }
  const result = await handle.exitCode
  if (result.code === 0) {
    queue.push({ type: 'done' })
  } else if (result.signal) {
    queue.push({ type: 'error', message: `claude was terminated by signal ${result.signal}` })
  } else {
    queue.push({ type: 'error', message: `claude exited with code ${result.code}` })
  }
}

function startSession(processRunner: ProcessRunner, opts: SessionOpts): AgentSession {
  const queue = createAgentEventQueue()
  // The most recently spawned turn's handle, so `stop()` has something to
  // kill. `ClaudeCliAdapter` spawns one `claude -p ...` process per turn
  // (see file header) rather than holding one long-lived process for the
  // whole session, since `ProcessHandle` exposes no stdin to keep feeding a
  // single interactive process turn after turn.
  let activeHandle: ProcessHandle | null = null

  function spawnTurn(prompt: string): void {
    const handle = processRunner.run(
      CLAUDE_COMMAND,
      [
        '-p',
        prompt,
        '--model',
        opts.model,
        '--effort',
        opts.effort,
        // Verified live: without a permission-mode flag, `-p` silently
        // refuses tool-driven writes ("I don't have permission to write
        // there yet"). `acceptEdits` is the minimum that lets BMAD skills
        // (e.g. bmad-prd) actually write their output artifact.
        '--permission-mode',
        'acceptEdits'
      ],
      { cwd: opts.workspace }
    )
    activeHandle = handle
    void pipeTurn(handle, queue).then(() => {
      if (activeHandle === handle) {
        activeHandle = null
      }
    })
  }

  return {
    // `send` writes have nowhere to go once a turn's process is running —
    // `ProcessHandle` doesn't expose stdin (see file header) — so, for this
    // MVP session model, `send` starts a brand new one-shot `claude -p`
    // turn per call rather than streaming into an already-running process.
    // Gap for a future task (flagged for T14, which wires this adapter into
    // `AgentService`): if a true persistent, mid-turn-interruptible session
    // is needed later, either `ProcessHandle` grows a stdin-write method, or
    // this adapter switches to a pty-backed `ProcessRunner` (the extension
    // point `processRunner.ts` already documents for interactive CLIs).
    send(input: AgentInput): void {
      spawnTurn(input.text)
    },
    events: queue,
    // Minimal MVP implementation: turns a `WorkflowCommand` into a one-shot
    // prompt turn, same as `send`. Full catalog wiring (mapping curated
    // intents to real BMAD skill prompts) is T17/T19; this just guarantees
    // a sane, non-crashing signature for those tasks to build on, including
    // a placeholder `key` with no `prompt`.
    runWorkflow(cmd: WorkflowCommand): void {
      const prompt = cmd.prompt ?? `Run the "${cmd.key}" workflow.`
      spawnTurn(prompt)
    },
    stop(): void {
      activeHandle?.kill()
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
