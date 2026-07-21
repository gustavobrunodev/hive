import type { ProcessRunner } from './processRunner'
import type { AgentAdapter, AgentCapabilities, SessionOpts } from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'

/**
 * The GitHub Copilot CLI adapter (multi-agent). Drives the `copilot` binary
 * (npm `@github/copilot`) via the shared one-shot-per-turn engine in
 * `cliAdapterCore.ts`, exactly like `ClaudeCliAdapter`. Only the argv and the
 * curated model list are Copilot-specific.
 *
 * --- CLI invocation flags: BEST-GUESS, verify against a real `copilot` binary ---
 *
 * Modeled on the GitHub Copilot CLI's documented programmatic surface (no real
 * binary exists in this build sandbox — same situation the Claude adapter was
 * first built under). Each flag below is a `// BEST-GUESS` to confirm:
 *   - `copilot -p "<prompt>"` — non-interactive/programmatic prompt mode.
 *   - `--model <id>` — model selection; Copilot fronts multiple providers
 *     (Anthropic + OpenAI), so the curated ids below are real Copilot model
 *     slugs, NOT Claude aliases.
 *   - `--allow-all-tools` — grant tool use without per-call approval, the
 *     Copilot analog of Claude's `--permission-mode acceptEdits` (needed so a
 *     BMAD skill can actually write its artifact).
 *   - `--resume <id>` — continue a prior session (conversation memory). The
 *     Copilot CLI does not emit Anthropic-shaped stream-json, so the shared
 *     parser falls back to raw-token passthrough; session-id learning via the
 *     `session` event is best-effort until the real output shape is confirmed.
 *
 * Copilot has **no effort levels** (`efforts: []`) — the composer hides that
 * picker and the turn omits `--effort`.
 */

const COPILOT_COMMAND = 'copilot'

function capabilities(): AgentCapabilities {
  return {
    // BEST-GUESS: real Copilot CLI model slugs across its fronted providers.
    models: [
      { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
      { id: 'o4-mini', label: 'o4-mini' }
    ],
    // The Copilot CLI exposes no effort/reasoning-level flag.
    efforts: [],
    supportsAttachments: true
  }
}

/** Creates the GitHub Copilot CLI adapter (injected `ProcessRunner`, fully fake-testable). */
export function createCopilotCliAdapter(processRunner: ProcessRunner): AgentAdapter {
  return {
    id: 'github-copilot',
    displayName: 'GitHub Copilot CLI',
    capabilities,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: COPILOT_COMMAND,
        errorLabel: 'copilot',
        buildArgs: (prompt, { model, resume }) => [
          '-p',
          prompt,
          ...(model ? ['--model', model] : []),
          // BEST-GUESS: grant tool use non-interactively (acceptEdits analog).
          '--allow-all-tools',
          ...(resume ? ['--resume', resume] : [])
        ]
      })
  }
}
