import { existsSync } from 'fs'
import { isE2ESeamEnabled } from './bmadService'
import type { ProcessRunner, RunOptions, ProcessHandle } from './processRunner'

/**
 * R-06 / P0-003 — the scripted-agent seam.
 *
 * The journey that proves this product's thesis (ask the agent for a PRD, watch
 * `PRD.md` land in the explorer) cannot run against a real agent CLI: none is
 * installed on the CI runner, and one that were would make the test
 * non-deterministic, networked and paid-per-run. What the E2E needs is a
 * *stand-in binary* — something that streams the CLI's own stream-json shape
 * and really writes files into the workspace.
 *
 * So this seam replaces the **binary**, not the adapter. That distinction is
 * the whole design: everything above the spawn stays production code inside the
 * test — `AgentService`'s session pool, `cliAdapterCore`'s stream-json parser,
 * session-id learning, `tool_use` attribution, turn accounting, the review
 * checkpoint wiring, the IPC bridge, the transcript, and the explorer's
 * filesystem watcher. Swapping the whole `AgentAdapter` instead would have put
 * all of that outside the test's reach, and it is most of what P0-003 exists to
 * prove.
 *
 * Same shape as B-1 (`bmadService.isE2ESeamEnabled`): **two** explicit
 * conditions, neither sufficient on its own.
 *
 *   - `HIVE_E2E=1` — the launcher's opt-in, shared with B-1. Without it the
 *     variable below is inert, so a stray `HIVE_E2E_AGENT_CLI` in a user's
 *     environment can never redirect which binary the app spawns. That is not
 *     hypothetical hygiene: this one redirects *program execution*.
 *   - `HIVE_E2E_AGENT_CLI=<path>` — the stand-in itself, which must exist on
 *     disk. The flag alone cannot conjure an agent; with nothing to redirect
 *     to, the real CLI runs and a missing one fails the way it always did.
 *
 * Scope is enforced by *where this is applied*, not by a name filter:
 * `src/main/index.ts` wraps only the `ProcessRunner` handed to
 * `createAgentRegistry`, whose sole spawns are the agent CLIs (`--version`
 * probes and one process per turn). Every other consumer of the runner — BMAD
 * install/update, git, the MCP probe — holds the unwrapped instance and is
 * untouched by this file.
 */

/**
 * The stand-in binary's path when the seam is armed, else `null`.
 * `null` means "change nothing" — every caller falls through to the real CLI.
 */
export function scriptedAgentCli(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isE2ESeamEnabled(env)) return null
  const command = env.HIVE_E2E_AGENT_CLI
  // A path that isn't there would spawn ENOENT and surface as "agent failed",
  // which reads exactly like the product bug the test is meant to catch. Better
  // to leave the seam disarmed and let the missing real CLI say so instead.
  if (!command || !existsSync(command)) return null
  return command
}

/**
 * Wraps `runner` so agent-CLI spawns go to the scripted stand-in, preserving
 * argv and `cwd` (the workspace) exactly as the adapter built them — the
 * stand-in is handed the same `-p <prompt>` the real CLI would have received,
 * which is what lets it act on the request.
 *
 * The replaced command name travels along as `HIVE_E2E_AGENT_COMMAND` so a
 * single stand-in can serve all three registered agents and answer a
 * `--version` probe per binary (availability detection is a spawn too).
 *
 * Returns `runner` itself — same object, not a wrapper — when the seam is
 * disarmed, so production carries no indirection at all.
 */
export function withScriptedAgentCli(
  runner: ProcessRunner,
  env: NodeJS.ProcessEnv = process.env
): ProcessRunner {
  const scripted = scriptedAgentCli(env)
  if (!scripted) return runner
  return {
    run(command: string, args: string[], opts?: RunOptions): ProcessHandle {
      return runner.run(scripted, args, {
        ...opts,
        env: { ...opts?.env, HIVE_E2E_AGENT_COMMAND: command }
      })
    }
  }
}
