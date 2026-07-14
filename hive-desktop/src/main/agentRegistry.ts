import type { ProcessRunner } from './processRunner'
import type { AgentAdapter } from './agentAdapter'
import { createClaudeCliAdapter } from './claudeCliAdapter'

/**
 * `AgentRegistry` — the set of agent CLIs the app can drive (agent-selection
 * AG-R1, G2). Proves the decoupling at the product surface: adapters are
 * registered by `id` with an `available` flag; `AgentService` starts sessions
 * with whichever adapter is currently selected. Adding a real second adapter
 * later (e.g. a working Devin CLI) is one new `available: true` entry — no UI or
 * service change. See `.specs/features/agent-selection/design.md` §1.
 *
 * `devin` (and any future placeholder) is registered `available: false` with no
 * `create`: it's declared so the picker can show the roadmap ("Em breve") without
 * pretending it works. No Devin CLI exists in this environment — it's a cloud
 * agent, not a local `-p`-style CLI (AG-C1).
 */

/** Serializable metadata for one registered agent — the shape crossing IPC to
 *  the renderer's picker (never the live `AgentAdapter`, which isn't cloneable). */
export interface AgentMeta {
  id: string
  displayName: string
  /** One-liner for the picker card. */
  description: string
  /** `false` = declared-but-not-yet-available placeholder ("Em breve"). */
  available: boolean
}

interface RegistryEntry extends AgentMeta {
  /** Present only for `available` entries — lazily builds the live adapter. */
  create?: (processRunner: ProcessRunner) => AgentAdapter
}

export interface AgentRegistry {
  /** Serializable list of every registered agent, in display order. */
  list(): AgentMeta[]
  /** The live adapter for `id`, or `null` if unknown/unavailable. */
  get(id: string): AgentAdapter | null
  /** The id of the first available agent (the safe default / fallback). */
  defaultId(): string
  /**
   * Resolves a (possibly stale/unknown/`null`) selected id to a concrete
   * available adapter, falling back to `defaultId()` (AG-R2.2). Never throws,
   * never returns an unavailable adapter.
   */
  resolve(id: string | null): { id: string; adapter: AgentAdapter }
}

/**
 * Builds the registry over an injected `ProcessRunner` (same DI style as the
 * rest of the main process). Adapters are memoized on first `get` so a session
 * re-bind doesn't rebuild the adapter each time.
 */
export function createAgentRegistry(processRunner: ProcessRunner): AgentRegistry {
  const entries: RegistryEntry[] = [
    {
      id: 'claude-cli',
      displayName: 'Claude Code',
      description: 'Agente da Anthropic via CLI `claude`. Pronto para uso.',
      available: true,
      create: createClaudeCliAdapter
    },
    {
      id: 'devin',
      displayName: 'Devin',
      description: 'Agente de engenharia autônomo da Cognition. Em breve.',
      available: false
    }
  ]

  const cache = new Map<string, AgentAdapter>()

  function get(id: string): AgentAdapter | null {
    const entry = entries.find((candidate) => candidate.id === id)
    if (!entry || !entry.available || !entry.create) return null
    let adapter = cache.get(id)
    if (!adapter) {
      adapter = entry.create(processRunner)
      cache.set(id, adapter)
    }
    return adapter
  }

  function defaultId(): string {
    const firstAvailable = entries.find((entry) => entry.available)
    // Registry always has at least one available entry (claude-cli); the `??`
    // is a defensive fallback that never fires in practice.
    return firstAvailable?.id ?? entries[0].id
  }

  return {
    list: () =>
      entries.map(({ id, displayName, description, available }) => ({
        id,
        displayName,
        description,
        available
      })),
    get,
    defaultId,
    resolve(id: string | null) {
      const requested = id != null ? get(id) : null
      if (requested && id) return { id, adapter: requested }
      const fallbackId = defaultId()
      // `get(defaultId())` is non-null by construction (defaultId is available).
      return { id: fallbackId, adapter: get(fallbackId) as AgentAdapter }
    }
  }
}
