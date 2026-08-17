import fs from 'node:fs'
import path from 'node:path'
import type { SeededWorkspace } from './workspace'

// QA side of the R-06/P0-003 seam. `src/main/e2eAgentSeam.ts` decides *whether*
// to redirect the agent CLI; this arms it for one case and gives the test a
// readable handle on what the stand-in did.

/** One turn's canned behavior — the contract of `e2e/__fixtures__/scripted-agent-cli.cjs`. */
export interface AgentScript {
  /** Session id announced on the stream (what the app persists for `--resume`). */
  sessionId?: string
  /** Text deltas streamed into the transcript, in order. */
  chunks?: string[]
  /** Files the agent writes, workspace-relative — real bytes, really on disk. */
  writes?: Array<{ path: string; content: string }>
  /** Pause before each chunk, for streaming/interrupt timing. */
  delayMs?: number
  /**
   * Pause after each write's `tool_use`. The stand-in reports no
   * `tool_result`, so without this a step starts and settles in the same
   * instant and the per-step clock — which only shows past a second — has
   * nothing to report (chat-timing).
   */
  writeDelayMs?: number
  /** Stream the chunks, then never exit — the state an interrupt test needs. */
  hang?: boolean
  /** Non-zero turns the adapter's terminal event into `error`. */
  exitCode?: number
  /** Written to stderr; the adapter appends its tail to the error message. */
  stderr?: string
  /**
   * session-usage: token accounting, in the CLI's own wire names. Emitted on
   * an `assistant` message and again on the closing `result` line, which is
   * where cost and duration live — so the app's parser, its `usage` event and
   * the context meter are all exercised for real.
   */
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
    total_cost_usd?: number
    duration_ms?: number
    duration_api_ms?: number
  }
  /**
   * A multi-step turn: one entry per API call it made, each printed as its own
   * `assistant` snapshot, with the `result` line carrying their **sum** — which
   * is what the real CLI does. A one-request script can't distinguish occupancy
   * read off the snapshot from occupancy read off the sums; this can.
   *
   * `sidechain` adds a subagent's own request alongside one of them, printed
   * with `parent_tool_use_id` set: its window is not this conversation's.
   */
  requests?: Array<{
    input_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
    output_tokens?: number
    sidechain?: {
      input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      output_tokens?: number
    }
  }>
  /** The ceiling the CLI reports for itself, on the result line's `modelUsage`. */
  contextWindow?: number
  /** The model name the stand-in reports on its assistant messages. */
  model?: string
  /**
   * mcp-visibility: the turn's MCP roster, as the CLI reports it on its
   * `system`/`init` line. Omitted → the line carries none, which is what a CLI
   * build without the field looks like and must stay silent.
   */
  mcpServers?: Array<{ name: string; status: string }>
  /**
   * The `mcp__<server>__<tool>` entries of the same line's `tools` list. Kept
   * separate from `mcpServers` because the CLI keeps them separate: pairing
   * them back up is exactly what `readMcpRoster` is being tested to do.
   */
  mcpTools?: string[]
}

export interface ScriptedAgent {
  /** Extra env for `launchSeededApp` — arms the seam for this case only. */
  env: Record<string, string>
  /** Every invocation the app made, in order, read back from disk. */
  invocations(): AgentInvocation[]
  /**
   * Replaces the script for the *next* turn. The stand-in reads the file on
   * every spawn, and each turn is its own spawn, so a case that needs two turns
   * to behave differently — two conversations editing two different files —
   * rewrites it between them instead of arming a second agent.
   */
  rearm(script: AgentScript): void
}

/** One recorded spawn of the stand-in. */
export interface AgentInvocation {
  kind: 'turn' | 'version'
  /** Which real binary the seam replaced for this spawn (`claude`, `devin`, …). */
  command: string
  /** The `-p` prompt the app sent, when this was a turn. */
  prompt: string | null
  argv?: string[]
  cwd?: string
  /**
   * agent-terminal: the terminal-related environment the turn was spawned
   * with. `SHELL` is the generic export; the `CLAUDE_CODE_*` trio is the
   * Claude adapter's binding. Everything else about the environment is
   * deliberately not recorded.
   */
  shellEnv?: {
    SHELL: string | null
    CLAUDE_CODE_SHELL: string | null
    CLAUDE_CODE_GIT_BASH_PATH: string | null
    CLAUDE_CODE_USE_POWERSHELL_TOOL: string | null
  }
}

/** Absolute path to the stand-in CLI. */
function standInPath(): string {
  return path.join(__dirname, '..', '__fixtures__', 'scripted-agent-cli.cjs')
}

/**
 * Arms the scripted-agent seam for one case: writes `script` next to the
 * seeded workspace and returns the env that redirects agent spawns to the
 * stand-in. Pass `env` to `launchSeededApp`.
 *
 * The exec bit is (re)set here rather than trusted from a checkout — the seam
 * spawns this path directly, and a lost mode bit would surface as "the agent
 * failed", which is indistinguishable from the bug the E2E hunts.
 */
export function armScriptedAgent(seeded: SeededWorkspace, script: AgentScript): ScriptedAgent {
  const scriptPath = path.join(seeded.root, 'agent-script.json')
  const logPath = path.join(seeded.root, 'agent-invocations.jsonl')
  fs.writeFileSync(scriptPath, JSON.stringify(script), 'utf-8')
  fs.writeFileSync(logPath, '', 'utf-8')

  const cli = standInPath()
  fs.chmodSync(cli, 0o755)

  return {
    env: {
      HIVE_E2E_AGENT_CLI: cli,
      HIVE_E2E_AGENT_SCRIPT: scriptPath,
      HIVE_E2E_AGENT_LOG: logPath
    },
    invocations(): AgentInvocation[] {
      return fs
        .readFileSync(logPath, 'utf-8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as AgentInvocation)
    },
    rearm(next: AgentScript): void {
      fs.writeFileSync(scriptPath, JSON.stringify(next), 'utf-8')
    }
  }
}
