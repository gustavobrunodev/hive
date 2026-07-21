import type { ProcessRunner } from './processRunner'
import type { AgentAdapter, AgentCapabilities, SessionOpts } from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'

/**
 * The Devin CLI adapter (multi-agent). Drives Cognition's `devin` binary via
 * the shared one-shot-per-turn engine in `cliAdapterCore.ts`, exactly like
 * `ClaudeCliAdapter`. Devin is a fixed-model autonomous agent, so this adapter
 * exposes **no model and no effort choice** — the composer hides both pickers
 * and the turn omits `--model`/`--effort`.
 *
 * --- CLI invocation flags: BEST-GUESS, verify against a real `devin` binary ---
 *
 * Modeled on the Devin CLI's documented surface (no real binary in this build
 * sandbox). Each flag is a `// BEST-GUESS` to confirm:
 *   - `devin -p "<prompt>"` — run one non-interactive turn against the prompt.
 *   - `--resume <id>` — continue a prior Devin session (conversation memory).
 * Devin does not emit Anthropic-shaped stream-json; the shared parser falls
 * back to raw-token passthrough, and session-id learning is best-effort until
 * the real output shape is confirmed.
 */

const DEVIN_COMMAND = 'devin'

function capabilities(): AgentCapabilities {
  return {
    // Devin picks its own model — no user-facing model choice.
    models: [],
    efforts: [],
    supportsAttachments: true
  }
}

/** Creates the Devin CLI adapter (injected `ProcessRunner`, fully fake-testable). */
export function createDevinCliAdapter(processRunner: ProcessRunner): AgentAdapter {
  return {
    id: 'devin',
    displayName: 'Devin CLI',
    capabilities,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: DEVIN_COMMAND,
        errorLabel: 'devin',
        buildArgs: (prompt, { resume }) => ['-p', prompt, ...(resume ? ['--resume', resume] : [])]
      })
  }
}
