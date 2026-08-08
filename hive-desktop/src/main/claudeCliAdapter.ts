import type { ProcessRunner } from './processRunner'
import type { AgentAdapter, AgentAdapterDeps, AgentCapabilities, SessionOpts } from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'

/**
 * The Claude Code adapter (T13, C1): drives the real `claude` CLI via the
 * injected `ProcessRunner`. The spawn/stream/parse/interrupt engine is shared
 * across all CLI adapters in `cliAdapterCore.ts` (multi-agent); this module
 * holds only what is *Claude-specific*: its curated capabilities and its argv.
 *
 * --- CLI invocation flags: verified vs. best-guess ---
 *
 * VERIFIED against a real `claude` binary (v2.1.206) and a live `-p` run
 * driving the real `bmad-prd` skill end-to-end (produced a real
 * `_bmad-output/.../prd.md`):
 *   - `claude -p "<prompt>"` — non-interactive "print mode": run one turn
 *     against the given prompt, stream/print the result, then exit.
 *   - `--model <id>` — selects the model. `--help` recommends aliases
 *     (`opus`/`sonnet`/`haiku`/`fable`) over pinned full model ids.
 *   - `--effort <level>` — confirmed real, values `low|medium|high|xhigh|max`.
 *   - `--permission-mode acceptEdits` — **required** for any workflow that
 *     writes files: `-p` with no permission-mode flag silently refuses
 *     tool-driven writes. `acceptEdits` covers Write/Edit (not Bash).
 *   - `--output-format stream-json --include-partial-messages --verbose` —
 *     structured output that exposes the CLI's `session_id` (the `--resume`
 *     handle) and true token-level streaming. The shared parser falls back to
 *     raw-token passthrough for any non-JSON line, so an older CLI degrades to
 *     opaque-text behavior.
 *   - `-r, --resume [sessionId]` — resume a conversation by session id
 *     (works with --print).
 *   - `--permission-prompt-tool <mcp tool>` + `--mcp-config <json>` — the
 *     supported way to answer permission prompts in print mode: the CLI calls
 *     the named MCP tool and blocks the turn on its verdict instead of
 *     silently refusing the call. Hive hosts that tool itself (see
 *     `approvalService.ts`), which is what turns "the agent needs permission"
 *     into a real interaction rather than a stalled turn.
 */

const CLAUDE_COMMAND = 'claude'

/**
 * The context window every current Claude model exposes through the CLI, in
 * tokens (session-usage). Curated here for the same reason the model list is
 * (C5): no CLI reports its own limit, and the UI needs a denominator to say
 * how full a conversation is. One shared constant rather than four copies —
 * the day a model ships a different window, it gets its own entry and this
 * stays the default.
 */
const CLAUDE_CONTEXT_WINDOW = 200_000

function capabilities(): AgentCapabilities {
  // Curated per C5 — the full set of model aliases and effort levels the
  // Claude Code CLI accepts, not an arbitrarily trimmed subset.
  return {
    models: [
      { id: 'opus', label: 'Opus', contextWindow: CLAUDE_CONTEXT_WINDOW },
      { id: 'sonnet', label: 'Sonnet', contextWindow: CLAUDE_CONTEXT_WINDOW },
      { id: 'haiku', label: 'Haiku', contextWindow: CLAUDE_CONTEXT_WINDOW },
      { id: 'fable', label: 'Fable', contextWindow: CLAUDE_CONTEXT_WINDOW }
    ],
    efforts: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
      { id: 'xhigh', label: 'Extra High' },
      { id: 'max', label: 'Max' }
    ],
    // R6.5/T16: attached/referenced file paths are folded into the turn's
    // prompt — the CLI reads the files itself via its Read tool.
    supportsAttachments: true
  }
}

/**
 * Creates the `ClaudeCliAdapter`. `processRunner` is injected
 * (constructor/factory-injection, matching `createConfigStore`/
 * `createWorkspaceService`) so this module is fully testable against
 * `createFakeProcessRunner()`.
 *
 * `deps.permissionPrompt` (agent-approvals) is optional on purpose: without it
 * the adapter behaves exactly as before (edits auto-accepted, everything else
 * refused by the CLI), so nothing that constructs an adapter without a live
 * approval bridge — tests, the availability probe — has to know about one.
 */
export function createClaudeCliAdapter(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps
): AgentAdapter {
  const prompt = deps?.permissionPrompt
  return {
    id: 'claude-cli',
    displayName: 'Claude CLI',
    capabilities,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: CLAUDE_COMMAND,
        errorLabel: 'claude',
        buildArgs: (turnPrompt, { model, effort, resume, turnId }) => {
          // agent-approvals: only wire the prompt tool once the bridge is
          // actually listening — a config pointing at no port would fail the
          // whole turn, which is strictly worse than today's behavior.
          const mcpConfig = prompt?.mcpConfig(turnId) ?? null
          return [
            '-p',
            turnPrompt,
            ...(model ? ['--model', model] : []),
            ...(effort ? ['--effort', effort] : []),
            // Verified live: without a permission-mode flag, `-p` silently
            // refuses tool-driven writes. `acceptEdits` is the minimum that lets
            // BMAD skills (e.g. bmad-prd) actually write their output artifact.
            // Kept alongside the prompt tool below, which deliberately narrows
            // the ask to what `acceptEdits` does *not* cover (Bash, network,
            // MCP tools) — editing a file the user asked for stays frictionless.
            '--permission-mode',
            'acceptEdits',
            // session-history: structured output exposes the CLI's `session_id`
            // and true token streaming. `--verbose` is required for stream-json
            // with --print; `--include-partial-messages` adds text deltas.
            '--output-format',
            'stream-json',
            '--include-partial-messages',
            '--verbose',
            ...(mcpConfig && prompt
              ? ['--mcp-config', mcpConfig, '--permission-prompt-tool', prompt.promptToolName]
              : []),
            ...(resume ? ['--resume', resume] : [])
          ]
        }
      })
  }
}
