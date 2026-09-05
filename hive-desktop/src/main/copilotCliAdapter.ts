import { homedir } from 'os'
import type { ProcessRunner } from './processRunner'
import type { AgentAdapter, AgentAdapterDeps, AgentCapabilities, SessionOpts } from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'
import {
  COPILOT_CATALOG,
  COPILOT_COMPACTION,
  detectCopilotCapabilities
} from './copilotModelCatalog'
import { CLI_DEFAULT_ID } from './modelCatalog'

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
    models: [
      {
        id: CLI_DEFAULT_ID,
        label: 'Automático',
        descriptionKey: 'cliDefault',
        traits: ['cli-default'],
        group: 'default',
        source: 'catalog'
      },
      ...COPILOT_CATALOG
    ],
    // Verified against the installed CLI's own option list: no effort or
    // reasoning-level flag exists.
    efforts: [],
    supportsAttachments: true,
    provider: { id: 'github', detail: null },
    modelSource: 'catalog',
    note: 'no-listing',
    compaction: COPILOT_COMPACTION
  }
}

/** Creates the GitHub Copilot CLI adapter (injected `ProcessRunner`, fully fake-testable). */
export function createCopilotCliAdapter(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps
): AgentAdapter {
  return {
    id: 'github-copilot',
    displayName: 'GitHub Copilot CLI',
    capabilities,
    // Copilot publishes no model list, so detection here reads the one thing
    // that *is* on disk — the model the user picked in the Copilot TUI — and
    // the picker is told to say the rest is a known-models catalog.
    detectCapabilities: () =>
      Promise.resolve(
        detectCopilotCapabilities({
          env: deps?.host?.env ?? process.env,
          home: deps?.host?.home ?? homedir(),
          ...(deps?.host?.readJson ? { readJson: deps.host.readJson } : {})
        })
      ),
    commandName: COPILOT_COMMAND,
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
