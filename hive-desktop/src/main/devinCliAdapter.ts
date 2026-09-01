import { homedir } from 'os'
import type { ProcessRunner } from './processRunner'
import type {
  AgentAdapter,
  AgentAdapterDeps,
  AgentCapabilities,
  CapabilityContext,
  SessionOpts
} from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'
import { DEVIN_CATALOG, detectDevinCapabilities } from './devinModelCatalog'
import { CLI_DEFAULT_ID } from './modelCatalog'

/**
 * The Devin CLI adapter (multi-agent). Drives Cognition's `devin` binary via
 * the shared one-shot-per-turn engine in `cliAdapterCore.ts`, exactly like
 * `ClaudeCliAdapter`.
 *
 * ## What changed, and why the models were missing
 *
 * This adapter used to declare `models: []` with the note "Devin is a
 * fixed-model agent", so the composer hid the picker entirely — the reported
 * bug. That premise is wrong: Devin fronts Anthropic, OpenAI, Google and
 * Cognition models, and its CLI reference documents all three ways to choose
 * one. Verified against the published CLI reference:
 *
 *   - `--model <MODEL>` — "Set the AI model for this session" (env `DEVIN_MODEL`).
 *   - `devin models list --format json` — "Output the model list as JSON (for
 *     scripts)", which is what `devinModelCatalog.ts` reads so the list comes
 *     from the installed CLI instead of from a constant in this file.
 *   - `agent.model` in `~/.config/devin/config.json` — the user's own default,
 *     surfaced as the "Automático" row's fine print.
 *   - `-p, --print [PROMPT]` — non-interactive mode, optionally inline prompt.
 *   - `-r, --resume <SESSION_ID>` / `-c, --continue` — session resumption.
 *
 * Devin has no effort ladder (its autonomy dial is `--permission-mode`, a
 * different axis), so `efforts` stays empty and the composer shows no effort
 * control for it — the picker reshaping itself per agent is the point.
 *
 * Devin does not emit Anthropic-shaped stream-json; the shared parser falls
 * back to raw-token passthrough, and session-id learning is best-effort until
 * the real output shape is confirmed against a live binary.
 */

const DEVIN_COMMAND = 'devin'

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
      ...DEVIN_CATALOG
    ],
    // Not an effort ladder: Devin's dial is autonomy (`--permission-mode`).
    efforts: [],
    supportsAttachments: true,
    provider: { id: 'cognition', detail: null },
    modelSource: 'catalog'
  }
}

/** Creates the Devin CLI adapter (injected `ProcessRunner`, fully fake-testable). */
export function createDevinCliAdapter(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps
): AgentAdapter {
  return {
    id: 'devin',
    displayName: 'Devin CLI',
    capabilities,
    detectCapabilities: (context: CapabilityContext) =>
      detectDevinCapabilities({
        processRunner,
        env: deps?.host?.env ?? process.env,
        home: deps?.host?.home ?? homedir(),
        platform: deps?.host?.platform ?? process.platform,
        ...(deps?.host?.readJson ? { readJson: deps.host.readJson } : {}),
        ...(context.workspace ? { workspace: context.workspace } : {})
      }),
    commandName: DEVIN_COMMAND,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: DEVIN_COMMAND,
        errorLabel: 'devin',
        buildArgs: (prompt, { model, resume }) => [
          '-p',
          prompt,
          ...(model ? ['--model', model] : []),
          ...(resume ? ['--resume', resume] : [])
        ]
      })
  }
}
