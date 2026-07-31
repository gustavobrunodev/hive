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
  /** Stream the chunks, then never exit — the state an interrupt test needs. */
  hang?: boolean
  /** Non-zero turns the adapter's terminal event into `error`. */
  exitCode?: number
  /** Written to stderr; the adapter appends its tail to the error message. */
  stderr?: string
}

export interface ScriptedAgent {
  /** Extra env for `launchSeededApp` — arms the seam for this case only. */
  env: Record<string, string>
  /** Every invocation the app made, in order, read back from disk. */
  invocations(): AgentInvocation[]
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
    }
  }
}
