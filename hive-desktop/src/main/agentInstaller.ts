import type { AgentMeta, AgentRegistry } from './agentRegistry'
import type { ProcessRunner } from './processRunner'

/**
 * `AgentInstaller` — installs an agent CLI from inside the app
 * (agent-onboarding, AO-R3).
 *
 * The first-run picker used to end at a sentence: *"Instale o Claude Code:
 * `npm i -g @anthropic-ai/claude-code`"*. For this product's stated audience —
 * PMs, analysts and UX who are BMAD-curious and **not** CLI-fluent — that is
 * the app asking the user to open a terminal in order to start using the app
 * that exists so they never have to. G1 is "zero-terminal BMAD"; the very
 * first screen was the one place it wasn't true.
 *
 * So the picker runs the command itself. Deliberately the *same* command the
 * vendor's docs give (`npm install -g <package>`), because the install has to
 * be indistinguishable from one done by hand: same prefix, same shims, and
 * `npm uninstall -g` works afterwards without Hive's help.
 *
 * Two things this does not do, both on purpose:
 *  - **No `sudo` fallback.** A global prefix the user can't write to is a
 *    machine-configuration decision; re-running under a privilege escalation
 *    the user didn't ask for would silently change file ownership across their
 *    npm prefix. `permission` is reported as its own reason so the UI can say
 *    what to do instead.
 *  - **No trusting the exit code.** `available` still comes from a **probe**
 *    (`registry.refreshOne`). npm exiting 0 means a package was written, not
 *    that a runnable binary landed on this `PATH` — and `PATH` is precisely
 *    what was wrong here to begin with.
 */

/** Why an install ended badly. The renderer owns the wording (i18n); this owns the diagnosis. */
export type AgentInstallFailure =
  /** No npm package is registered for this agent (Devin), or the id is unknown. */
  | 'not-installable'
  /** `npm` itself could not be spawned — nothing to install *with*. */
  | 'npm-missing'
  /** EACCES/EPERM writing the global prefix. */
  | 'permission'
  /** The registry was unreachable. */
  | 'network'
  /** npm succeeded, but the CLI still isn't detectable on this machine. */
  | 'not-detected'
  /** Anything else; `detail` carries npm's own last words. */
  | 'failed'

export type AgentInstallEvent =
  /** One line of npm's output, as it happens. */
  | { type: 'progress'; message: string }
  /** Installed **and** re-probed; `agent` is the fresh metadata for the picker. */
  | { type: 'done'; agent: AgentMeta }
  | { type: 'error'; reason: AgentInstallFailure; detail?: string }

export interface AgentInstaller {
  /**
   * Installs `agentId`'s CLI, streaming progress. Returns a cancel function:
   * calling it kills npm and stops delivery, so a picker that unmounts
   * mid-install leaves nothing running and nothing talking to a dead listener.
   */
  install(agentId: string, onEvent: (event: AgentInstallEvent) => void): () => void
}

export interface AgentInstallerDeps {
  processRunner: ProcessRunner
  registry: AgentRegistry
  /** The package manager binary. Injected so tests never shell out. */
  npmCommand?: string
}

/** How much of npm's output to keep for the failure detail. */
const DETAIL_LINE_LIMIT = 6

/**
 * Classifies a failed `npm install -g` from its output. npm's exit codes are
 * all `1`, so the text is the only signal there is; each pattern below is one
 * that actually shows up in the wild for this command.
 */
export function classifyNpmFailure(output: string): AgentInstallFailure {
  const text = output.toLowerCase()
  if (/\beacces\b|\beperm\b|permission denied|operation not permitted/.test(text)) {
    return 'permission'
  }
  if (
    /\benotfound\b|\betimedout\b|\becconnrefused\b|network|getaddrinfo|registry error/.test(text)
  ) {
    return 'network'
  }
  return 'failed'
}

/** The last few non-empty lines — what a user would look at in a terminal. */
export function tailLines(output: string, limit = DETAIL_LINE_LIMIT): string | undefined {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
  if (lines.length === 0) return undefined
  return lines.slice(-limit).join('\n')
}

export function createAgentInstaller({
  processRunner,
  registry,
  npmCommand = 'npm'
}: AgentInstallerDeps): AgentInstaller {
  function install(agentId: string, onEvent: (event: AgentInstallEvent) => void): () => void {
    const npmPackage = registry.npmPackageFor(agentId)
    if (!npmPackage) {
      onEvent({ type: 'error', reason: 'not-installable' })
      return () => {}
    }

    let cancelled = false
    const emit = (event: AgentInstallEvent): void => {
      if (!cancelled) onEvent(event)
    }

    // `--no-fund --no-audit` keep npm from spending the tail of the run (and
    // the last line the user reads) on notices that have nothing to do with
    // whether the agent installed.
    const handle = processRunner.run(npmCommand, [
      'install',
      '-g',
      npmPackage,
      '--no-fund',
      '--no-audit'
    ])

    void (async () => {
      let output = ''
      for await (const chunk of handle.output) {
        output += chunk.data
        // npm writes its progress to stderr, so both streams feed the line
        // the card shows; the last non-empty one is always the current state.
        const line = tailLines(chunk.data, 1)
        if (line) emit({ type: 'progress', message: line })
      }

      const exit = await handle.exitCode
      if (cancelled) return

      if (exit.code === null && exit.signal === null) {
        // ProcessRunner's ENOENT path: npm itself isn't spawnable.
        emit({ type: 'error', reason: 'npm-missing' })
        return
      }
      if (exit.code !== 0) {
        emit({ type: 'error', reason: classifyNpmFailure(output), detail: tailLines(output) })
        return
      }

      // Exit 0 is npm's opinion; the probe is ours (see the header).
      const agent = await registry.refreshOne(agentId)
      if (cancelled) return
      if (!agent || !agent.available) {
        emit({ type: 'error', reason: 'not-detected', detail: tailLines(output) })
        return
      }
      emit({ type: 'done', agent })
    })()

    return () => {
      cancelled = true
      handle.kill()
    }
  }

  return { install }
}
