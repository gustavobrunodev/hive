import type { AgentRegistry } from './agentRegistry'
import type { ShellSupport, ShellSupportNote } from './agentAdapter'
import type { ConfigStore } from './configStore'
import {
  defaultShell,
  detectShells,
  resolveShell,
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
 */

/** One agent's verdict on one shell — the serializable half of `ShellBinding`. */
export interface ShellAgentSupport {
  agentId: string
  displayName: string
  support: ShellSupport
  note?: ShellSupportNote
}

/** One row in the picker: a detected shell plus what each enabled agent makes of it. */
export interface ShellOption {
  id: string
  path: string
  family: ShellFamily
  /** True for the shell "Automático" resolves to on this machine. */
  systemDefault: boolean
  agents: ShellAgentSupport[]
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
}

export interface ShellService {
  /** The full picker view. `refresh` re-runs detection instead of answering from the cache. */
  list(refresh?: boolean): ShellCatalogView
  /** Persists the choice; `null` restores automatic. An unknown id is ignored. */
  select(id: string | null): void
  /** The shell agent turns run inside right now, or `null` — what `ProcessRunner` reads per spawn. */
  current(): ShellInfo | null
}

export function createShellService(
  configStore: ConfigStore,
  agentRegistry: AgentRegistry,
  detect: () => ShellInfo[] = () => detectShells()
): ShellService {
  let cache: ShellInfo[] | null = null

  function shells(refresh = false): ShellInfo[] {
    if (refresh || cache === null) cache = detect()
    return cache
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
    const binding = adapter.shellBinding?.(shell) ?? {
      support: 'launch-only' as const,
      note: 'no-cli-binding' as const,
      env: {}
    }
    return {
      agentId,
      displayName: adapter.displayName,
      support: binding.support,
      note: binding.note
    }
  }

  return {
    list(refresh = false): ShellCatalogView {
      const detected = shells(refresh)
      const selectedId = configStore.getAgentShell()
      const resolved = resolveShell(selectedId, detected)
      const agentIds = relevantAgentIds()
      return {
        shells: detected.map((shell) => ({
          id: shell.id,
          path: shell.path,
          family: shell.family,
          // The row "Automático" lands on, which is what the label promises —
          // on Windows that is `cmd` by platform, in POSIX the user's `$SHELL`.
          systemDefault: defaultShell(detected)?.id === shell.id,
          agents: agentIds
            .map((agentId) => supportFor(shell, agentId))
            .filter((entry): entry is ShellAgentSupport => entry !== null)
        })),
        selectedId,
        resolvedId: resolved?.id ?? null,
        missingSelection: selectedId !== null && !detected.some((shell) => shell.id === selectedId)
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
      return resolveShell(configStore.getAgentShell(), shells())
    }
  }
}
