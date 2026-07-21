import type { ProcessRunner } from './processRunner'
import type { AgentAdapter } from './agentAdapter'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import { createCopilotCliAdapter } from './copilotCliAdapter'
import { createDevinCliAdapter } from './devinCliAdapter'

/**
 * `AgentRegistry` — the set of agent CLIs the app can drive (multi-agent).
 * Every entry is a real adapter now (Claude, GitHub Copilot, Devin); which of
 * them the user can actually use depends on what's installed on *their*
 * machine, so availability is **detected at runtime** by probing each binary
 * rather than hard-coded. Unavailable agents are surfaced disabled with an
 * `installHint` + `docsUrl` so the picker can tell the user how to enable them.
 *
 * The renderer's source of truth for the picker is `detect()` (async, cached);
 * `get`/`resolve`/`defaultId` are the sync handles `AgentService` uses to route
 * turns to the right adapter.
 */

/** Serializable metadata for one registered agent — the shape crossing IPC to
 *  the renderer's picker (never the live `AgentAdapter`, which isn't cloneable). */
export interface AgentMeta {
  id: string
  displayName: string
  /** One-liner for the picker card. */
  description: string
  /** Whether the agent's CLI was detected on this machine (probe result). */
  available: boolean
  /** How to install/enable the CLI — shown on the disabled card when unavailable. */
  installHint: string
  /** Docs link for the "Como instalar" affordance (opened via `openExternal`). */
  docsUrl: string
}

interface RegistryEntry {
  id: string
  displayName: string
  description: string
  installHint: string
  docsUrl: string
  /** The binary probed by `detect()` and spawned by the adapter. */
  detectCommand: string
  create: (processRunner: ProcessRunner) => AgentAdapter
}

export interface AgentRegistry {
  /**
   * Probes every registered agent's CLI and returns full metadata (including
   * live `available`), in display order. Results are cached after the first
   * run; pass `refresh` to re-probe (e.g. after the user installs a CLI).
   */
  detect(refresh?: boolean): Promise<AgentMeta[]>
  /** The live adapter for `id`, or `null` if the id isn't a registered agent. */
  get(id: string): AgentAdapter | null
  /** The id of the default agent (the safe fallback). */
  defaultId(): string
  /** Every registered agent id, in display order. */
  ids(): string[]
  /**
   * Resolves a (possibly stale/unknown/`null`) id to a concrete adapter,
   * falling back to `defaultId()`. Never throws. Not gated on detected
   * availability — a turn sent to a since-uninstalled CLI simply surfaces a
   * spawn error event, which is more honest than silently redirecting it.
   */
  resolve(id: string | null): { id: string; adapter: AgentAdapter }
}

/** How long a `--version` probe may run before we assume the (spawned) binary is present but slow. */
const PROBE_TIMEOUT_MS = 4000

/**
 * Probes one CLI by running `<command> --version`. A binary that isn't
 * installed makes `ProcessRunner` emit `{ code: null, signal: null }` (its
 * ENOENT path), so a non-null code OR a signal means the process actually
 * started → the CLI is present. A probe that hasn't resolved within the
 * timeout is assumed present (it spawned; it's just slow) and killed.
 */
async function probe(processRunner: ProcessRunner, command: string): Promise<boolean> {
  const handle = processRunner.run(command, ['--version'])
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), PROBE_TIMEOUT_MS)
  )
  const outcome = await Promise.race([handle.exitCode, timeout])
  if (outcome === 'timeout') {
    handle.kill()
    return true
  }
  return outcome.code !== null || outcome.signal !== null
}

/**
 * Builds the registry over an injected `ProcessRunner`. Adapters are memoized
 * on first `get`; detection results are memoized after the first `detect()`.
 */
export function createAgentRegistry(processRunner: ProcessRunner): AgentRegistry {
  const entries: RegistryEntry[] = [
    {
      id: 'claude-cli',
      displayName: 'Claude Code',
      description: 'Agente da Anthropic via CLI `claude`.',
      installHint: 'Instale o Claude Code: npm i -g @anthropic-ai/claude-code',
      docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
      detectCommand: 'claude',
      create: createClaudeCliAdapter
    },
    {
      id: 'github-copilot',
      displayName: 'GitHub Copilot',
      description: 'CLI agêntica do GitHub Copilot com modelos Anthropic e OpenAI.',
      installHint: 'Instale a CLI do Copilot: npm i -g @github/copilot',
      docsUrl: 'https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli',
      detectCommand: 'copilot',
      create: createCopilotCliAdapter
    },
    {
      id: 'devin',
      displayName: 'Devin',
      description: 'Agente de engenharia autônomo da Cognition via CLI `devin`.',
      installHint: 'Instale a CLI do Devin e faça login em app.devin.ai.',
      docsUrl: 'https://docs.devin.ai/work-with-devin/devin-cli',
      detectCommand: 'devin',
      create: createDevinCliAdapter
    }
  ]

  const adapterCache = new Map<string, AgentAdapter>()
  let detectCache: AgentMeta[] | null = null

  function get(id: string): AgentAdapter | null {
    const entry = entries.find((candidate) => candidate.id === id)
    if (!entry) return null
    let adapter = adapterCache.get(id)
    if (!adapter) {
      adapter = entry.create(processRunner)
      adapterCache.set(id, adapter)
    }
    return adapter
  }

  function defaultId(): string {
    return entries[0].id
  }

  async function detect(refresh = false): Promise<AgentMeta[]> {
    if (detectCache && !refresh) return detectCache
    const results = await Promise.all(
      entries.map(async (entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        description: entry.description,
        installHint: entry.installHint,
        docsUrl: entry.docsUrl,
        available: await probe(processRunner, entry.detectCommand)
      }))
    )
    detectCache = results
    return results
  }

  return {
    detect,
    get,
    defaultId,
    ids: () => entries.map((entry) => entry.id),
    resolve(id: string | null) {
      const requested = id != null ? get(id) : null
      if (requested && id) return { id, adapter: requested }
      const fallbackId = defaultId()
      return { id: fallbackId, adapter: get(fallbackId) as AgentAdapter }
    }
  }
}
