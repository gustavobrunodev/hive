import type { ProcessRunner } from './processRunner'
import type {
  AgentAdapter,
  AgentAdapterDeps,
  AgentCapabilities,
  SessionOpts,
  ShellBinding
} from './agentAdapter'
import type { ShellInfo } from './shellCatalog'
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
 * tokens (session-usage) — the meter's denominator *before the first turn
 * answers*, which is the only window in which it is the best number available.
 *
 * The CLI does state its own ceiling, but only in hindsight: every `result`
 * line carries `modelUsage[model].contextWindow` (verified on 2.1.226:
 * `200000` for haiku), and `cliAdapterCore` forwards it so the meter switches
 * to the real figure as soon as a turn reports. This constant covers the gap —
 * and the case where a configured window (`sonnet[1m]`) differs from the
 * curated one, which is precisely why the reported figure outranks it.
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
 * How the Claude Code CLI honours a chosen shell (agent-terminal AT-R4).
 *
 * Not guessed — read out of the shipped binary (`claude 2.1.226`), because the
 * rules are narrow enough that guessing would produce a setting that silently
 * does nothing:
 *
 *  - **POSIX**: `CLAUDE_CODE_SHELL` is accepted only when the path *contains*
 *    `bash` or `zsh` and is executable; anything else is logged as
 *    "not a valid bash/zsh path, falling back to detection" and dropped. So
 *    fish/sh/dash get `launch-only` rather than an export the CLI throws away.
 *  - **Windows**: `Bash` runs through Git Bash (`CLAUDE_CODE_GIT_BASH_PATH`,
 *    whose basename must be `bash.exe`/`sh.exe`/`bash`/`sh`), and
 *    `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` turns on the PowerShell tool. There
 *    is **no cmd executor at all** — which is exactly why cmd, the platform
 *    default this feature was asked to ship, reports `launch-only` with the
 *    note the picker renders. Telling the user otherwise would be the one
 *    thing worse than not offering the choice.
 */
export function claudeShellBinding(shell: ShellInfo): ShellBinding {
  if (shell.family === 'bash' || shell.family === 'zsh') {
    // Windows' Git Bash *is* the CLI's own executor; POSIX bash/zsh are what
    // `CLAUDE_CODE_SHELL` accepts. Same variable name would be wrong on
    // Windows, hence the split by id rather than by family alone.
    return shell.id === 'git-bash'
      ? {
          support: 'native',
          note: 'windows-git-bash',
          env: { CLAUDE_CODE_GIT_BASH_PATH: shell.path }
        }
      : { support: 'native', env: { CLAUDE_CODE_SHELL: shell.path } }
  }
  if (shell.family === 'powershell') {
    return {
      support: 'native',
      note: 'powershell-preview',
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }
    }
  }
  if (shell.family === 'cmd') {
    return { support: 'launch-only', note: 'windows-git-bash', env: {} }
  }
  return { support: 'launch-only', note: 'posix-bash-zsh-only', env: {} }
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
    shellBinding: claudeShellBinding,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: CLAUDE_COMMAND,
        errorLabel: 'claude',
        // agent-terminal: re-read per turn, so switching terminals in the
        // profile sheet reaches the very next message.
        buildEnv: () => {
          const shell = deps?.shell?.() ?? null
          return shell ? claudeShellBinding(shell).env : undefined
        },
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
