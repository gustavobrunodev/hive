import type { AgentRegistry } from './agentRegistry'
import type { ShellContext, ShellSupport, ShellSupportNote } from './agentAdapter'
import type { ConfigStore } from './configStore'
import { cliPath, resolveExecutable } from './cliEnv'
import {
  defaultShell,
  detectShells,
  shellCommandPreview,
  type ShellFamily,
  type ShellInfo
} from './shellCatalog'

/**
 * The terminal picker's source of truth (agent-terminal), and the one place
 * that joins the three things the choice depends on: what is installed
 * (`shellCatalog`), what the user picked (`ConfigStore`), and what each
 * enabled agent can actually do with it (`AgentAdapter.shellBinding`).
 *
 * It exists as its own module for the reason the registry does: the renderer
 * gets a serializable view, never a live adapter, and the main process holds
 * no UI copy — an agent's caveat crosses IPC as a **code** the renderer maps
 * to pt-BR (AT-R5).
 *
 * Detection is cached because it costs a handful of `stat` calls plus a `PATH`
 * walk for `pwsh`, and re-runnable because "I just installed Git Bash" is the
 * exact moment a stale cache would be wrong — the same `refresh` contract the
 * agent picker's re-scan uses.
 *
 * This module also owns what **"Automático" means**, which is a heavier job
 * than it sounds and the second half of the bug this feature was reopened for.
 * The platform default on Windows is cmd, and cmd is the one shell no agent
 * here can run a command in — so "Automático" used to resolve, silently, to a
 * shell that guaranteed a fallback. It now resolves to a shell the enabled
 * agents actually run in, and `shellCatalog` stays agent-agnostic: it reports
 * what the machine prefers, this module decides what the *product* prefers.
 */

/** One agent's verdict on one shell — the serializable half of `ShellBinding`. */
export interface ShellAgentSupport {
  agentId: string
  displayName: string
  support: ShellSupport
  note?: ShellSupportNote
  /**
   * The shell this agent will really run its own commands in, by id — the
   * chosen one, the one it was pinned to, or `null` when the CLI decides for
   * itself. The picker prints it, which is the whole point: "escolhi cmd" and
   * "o Claude vai rodar em Git Bash" are two different facts and the user is
   * entitled to both.
   */
  runsIn: string | null
}

/** One row in the picker: a detected shell plus what each enabled agent makes of it. */
export interface ShellOption {
  id: string
  path: string
  family: ShellFamily
  /** True for the shell "Automático" resolves to on this machine. */
  automatic: boolean
  agents: ShellAgentSupport[]
  /**
   * The literal command line a turn is spawned with in this shell — the
   * receipt behind every claim on the row. Built by `shellCatalog` from the
   * same function that does the spawning.
   */
  preview: string
}

/** Everything the picker renders, in one round trip. */
export interface ShellCatalogView {
  shells: ShellOption[]
  /** The persisted choice — `null` means automatic. */
  selectedId: string | null
  /** What a turn would actually run in right now (`null` when no shell was detected at all). */
  resolvedId: string | null
  /**
   * The persisted choice names a shell that isn't on this machine anymore
   * (D-AT-4). The choice is kept on disk — reinstalling restores it — and the
   * picker says so instead of silently showing a different row as selected.
   */
  missingSelection: boolean
  /**
   * What this machine is, so the picker can drop the copy that doesn't apply
   * to it (a macOS user has no reason to read about Git Bash).
   */
  platform: NodeJS.Platform
}

export interface ShellService {
  /** The full picker view. `refresh` re-runs detection instead of answering from the cache. */
  list(refresh?: boolean): ShellCatalogView
  /** Persists the choice; `null` restores automatic. An unknown id is ignored. */
  select(id: string | null): void
  /** The shell agent turns run inside right now, or `null` — what `ProcessRunner` reads per spawn. */
  current(): ShellInfo | null
  /** Every shell detected here — what an adapter's `shellBinding` needs to pin a fallback to. */
  detected(): ShellInfo[]
}

/** The prompt stand-in in the command preview: short, obviously a placeholder, and never mistaken for real text. */
const PREVIEW_PROMPT = '…'

export function createShellService(
  configStore: ConfigStore,
  agentRegistry: AgentRegistry,
  detect: () => ShellInfo[] = () => detectShells(),
  platform: NodeJS.Platform = process.platform
): ShellService {
  let cache: ShellInfo[] | null = null

  function shells(refresh = false): ShellInfo[] {
    if (refresh || cache === null) cache = detect()
    return cache
  }

  function context(): ShellContext {
    return { available: shells(), platform }
  }

  /**
   * Which agents the caveats are shown for: the ones the user actually
   * enabled. An install with nothing enabled yet (first run, or everything
   * toggled off) falls back to every registered agent — a picker that showed
   * no caveats at all would read as "no caveats", which is the one thing this
   * column exists to prevent.
   */
  function relevantAgentIds(): string[] {
    const enabled = configStore.getEnabledAgents() ?? []
    const registered = agentRegistry.ids()
    const intersection = registered.filter((id) => enabled.includes(id))
    return intersection.length > 0 ? intersection : registered
  }

  function supportFor(shell: ShellInfo, agentId: string): ShellAgentSupport | null {
    const adapter = agentRegistry.get(agentId)
    if (!adapter) return null
    // An adapter with no `shellBinding` is honestly `launch-only`: we can start
    // its CLI inside the chosen shell, and it publishes no way to be told
    // which shell to run its own commands in.
    const binding = adapter.shellBinding?.(shell, context()) ?? {
      support: 'launch-only' as const,
      note: 'no-cli-binding' as const,
      runsIn: null,
      env: {}
    }
    return {
      agentId,
      displayName: adapter.displayName,
      support: binding.support,
      note: binding.note,
      runsIn: binding.runsIn
    }
  }

  /**
   * The command a preview is drawn with: the default agent's CLI, **resolved
   * to the absolute path** exactly as `ProcessRunner` resolves it before
   * spawning. A preview showing the bare `claude` while the spawn uses
   * `C:\\Users\\…\\npm\\claude.cmd` would be a receipt for a different
   * command than the one that runs — which is the failure mode the receipt
   * exists to close, one level down.
   */
  function previewCommand(): string {
    for (const id of [agentRegistry.defaultId(), ...agentRegistry.ids()]) {
      const name = agentRegistry.get(id)?.commandName
      if (name !== undefined && name !== '') return resolveExecutable(name, cliPath()) ?? name
    }
    return 'agente'
  }

  /**
   * What "Automático" lands on (AT-R2), and the reason this is not simply
   * `defaultShell`.
   *
   * The machine's own default is the right answer whenever the agents can use
   * it — on macOS and Linux that is the user's `$SHELL`, and zsh/bash are
   * exactly what the Claude CLI accepts. On Windows it is cmd, which no agent
   * can execute a command in, so following it would mean shipping a default
   * that is *guaranteed* to fall back. Instead: the first shell every relevant
   * agent runs natively in, then the first any of them does, then the
   * platform's own — a machine with only cmd still resolves to cmd rather than
   * to nothing.
   */
  function automaticShell(detected: ShellInfo[]): ShellInfo | null {
    const platformDefault = defaultShell(detected)
    const agentIds = relevantAgentIds()
    if (agentIds.length === 0) return platformDefault

    const nativeCount = (shell: ShellInfo): number =>
      agentIds.filter((agentId) => supportFor(shell, agentId)?.support === 'native').length

    if (platformDefault && nativeCount(platformDefault) > 0) return platformDefault
    const best = detected
      .map((shell) => ({ shell, natives: nativeCount(shell) }))
      .filter((entry) => entry.natives > 0)
      // Ties keep detection order, which is the order the picker shows and the
      // order `shellCatalog` documents as preference (Git Bash before the
      // PowerShells is deliberate: it is the CLI's own executor).
      .sort((a, b) => b.natives - a.natives)[0]
    return best?.shell ?? platformDefault
  }

  /**
   * The shell a turn runs in: the user's pick while it is still installed,
   * otherwise automatic (D-AT-4 — an uninstalled Git Bash must not fail every
   * turn; the saved id stays on disk so reinstalling restores the choice).
   */
  function resolveCurrent(detected: ShellInfo[]): ShellInfo | null {
    const selectedId = configStore.getAgentShell()
    const picked =
      selectedId === null ? null : (detected.find((shell) => shell.id === selectedId) ?? null)
    return picked ?? automaticShell(detected)
  }

  return {
    list(refresh = false): ShellCatalogView {
      const detected = shells(refresh)
      const selectedId = configStore.getAgentShell()
      const resolved = resolveCurrent(detected)
      const automatic = automaticShell(detected)
      const agentIds = relevantAgentIds()
      const command = previewCommand()
      return {
        shells: detected.map((shell) => ({
          id: shell.id,
          path: shell.path,
          family: shell.family,
          // The row "Automático" lands on, which is what the label promises.
          automatic: automatic?.id === shell.id,
          agents: agentIds
            .map((agentId) => supportFor(shell, agentId))
            .filter((entry): entry is ShellAgentSupport => entry !== null),
          preview: shellCommandPreview(shell, command, ['-p', PREVIEW_PROMPT])
        })),
        selectedId,
        resolvedId: resolved?.id ?? null,
        missingSelection: selectedId !== null && !detected.some((shell) => shell.id === selectedId),
        platform
      }
    },
    select(id: string | null): void {
      if (id === null) {
        configStore.setAgentShell(null)
        return
      }
      // Only a shell we actually detected may be persisted: an id typed into
      // an IPC message (or left over from another machine) would otherwise
      // resolve to nothing forever, with the picker showing a row nobody has.
      if (!shells().some((shell) => shell.id === id)) return
      configStore.setAgentShell(id)
    },
    current(): ShellInfo | null {
      return resolveCurrent(shells())
    },
    detected(): ShellInfo[] {
      return shells()
    }
  }
}
