import type { ProcessRunner } from './processRunner'
import type { AgentAdapter, AgentAdapterDeps } from './agentAdapter'
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
  /**
   * What the detected CLI answered `--version` with, trimmed to one line
   * (`null` when unavailable, or when it answered with nothing usable).
   * Shown on the card: detection that names a version is checkable by the
   * user, where a bare green dot asks them to take our word for it.
   */
  version: string | null
  /** The binary we looked for on `PATH` — the honest answer to "why not?". */
  detectCommand: string
  /** How to install/enable the CLI — shown on the disabled card when unavailable. */
  installHint: string
  /**
   * Whether Hive can install this agent itself (`agentInstaller.ts`). True for
   * the npm-published CLIs; false for an agent whose setup needs steps we
   * can't do for the user (Devin: an account and a browser login), where
   * offering a button we can't honour would be worse than the docs link.
   */
  installable: boolean
  /** The exact command Hive would run (also what the card offers to copy), or `null`. */
  installCommand: string | null
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
  /** npm package that provides `detectCommand`, when Hive can install it itself. */
  npmPackage?: string
  create: (processRunner: ProcessRunner, deps?: AgentAdapterDeps) => AgentAdapter
}

/** One agent's probe outcome. Exported for `agentInstaller`'s post-install re-check. */
export interface AgentProbeResult {
  available: boolean
  version: string | null
}

export interface AgentRegistry {
  /**
   * Probes every registered agent's CLI and returns full metadata (including
   * live `available`), in display order. Results are cached after the first
   * run; pass `refresh` to re-probe (e.g. after the user installs a CLI).
   */
  detect(refresh?: boolean): Promise<AgentMeta[]>
  /**
   * Re-probes a single agent and folds the result into the `detect()` cache.
   * This is what makes a just-finished install visible without a restart:
   * `agentInstaller` calls it the moment `npm i -g` exits, and the picker
   * re-renders off the returned metadata.
   */
  refreshOne(id: string): Promise<AgentMeta | null>
  /** The live adapter for `id`, or `null` if the id isn't a registered agent. */
  get(id: string): AgentAdapter | null
  /** Serializable metadata for `id` ignoring availability, or `null` if unknown. */
  describe(id: string): Omit<AgentMeta, 'available' | 'version'> | null
  /** The npm package providing `id`'s CLI, or `null` when Hive can't install it. */
  npmPackageFor(id: string): string | null
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
 * Trims a `--version` answer down to something a card can show: the first
 * non-empty line, ANSI stripped, capped. CLIs are not consistent here —
 * `claude` answers `2.1.226 (Claude Code)`, others print a banner first — so
 * this keeps the first line rather than trying to parse a semver out of prose
 * and showing nothing when the guess misses.
 */
export function parseVersionOutput(output: string): string | null {
  const line = output
    // eslint-disable-next-line no-control-regex -- stripping ANSI is the point
    .replace(/\[[0-9;]*m/g, '')
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== '')
  if (!line) return null
  return line.length > 60 ? `${line.slice(0, 59)}…` : line
}

/**
 * Probes one CLI by running `<command> --version`. A binary that isn't
 * installed makes `ProcessRunner` emit `{ code: null, signal: null }` (its
 * ENOENT path), so a non-null code OR a signal means the process actually
 * started → the CLI is present. A probe that hasn't resolved within the
 * timeout is assumed present (it spawned; it's just slow) and killed.
 *
 * The output is kept, not discarded: a CLI that answers with its version lets
 * the picker say *which* one it found.
 */
export async function probeCommand(
  processRunner: ProcessRunner,
  command: string
): Promise<AgentProbeResult> {
  const handle = processRunner.run(command, ['--version'])
  let output = ''
  const collect = (async () => {
    for await (const chunk of handle.output) {
      if (chunk.stream === 'stdout') output += chunk.data
    }
  })()
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), PROBE_TIMEOUT_MS)
  )
  const outcome = await Promise.race([handle.exitCode, timeout])
  if (outcome === 'timeout') {
    handle.kill()
    return { available: true, version: null }
  }
  await collect
  const available = outcome.code !== null || outcome.signal !== null
  return { available, version: available ? parseVersionOutput(output) : null }
}

/**
 * Builds the registry over an injected `ProcessRunner`. Adapters are memoized
 * on first `get`; detection results are memoized after the first `detect()`.
 *
 * `deps` is forwarded to every adapter factory (agent-approvals hands the
 * permission-prompt endpoint through here). Adapters that have no use for a
 * given collaborator ignore it, so this stays one optional argument rather
 * than a per-adapter wiring table.
 */
export function createAgentRegistry(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps
): AgentRegistry {
  const entries: RegistryEntry[] = [
    {
      id: 'claude-cli',
      displayName: 'Claude Code',
      description: 'Agente da Anthropic via CLI `claude`.',
      installHint: 'Instale o Claude Code: npm i -g @anthropic-ai/claude-code',
      docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
      detectCommand: 'claude',
      npmPackage: '@anthropic-ai/claude-code',
      create: createClaudeCliAdapter
    },
    {
      id: 'github-copilot',
      displayName: 'GitHub Copilot',
      description: 'CLI agêntica do GitHub Copilot com modelos Anthropic e OpenAI.',
      installHint: 'Instale a CLI do Copilot: npm i -g @github/copilot',
      docsUrl: 'https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli',
      detectCommand: 'copilot',
      npmPackage: '@github/copilot',
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

  /** The half of `AgentMeta` that comes from the entry, not from the probe. */
  function staticMeta(entry: RegistryEntry): Omit<AgentMeta, 'available' | 'version'> {
    return {
      id: entry.id,
      displayName: entry.displayName,
      description: entry.description,
      detectCommand: entry.detectCommand,
      installHint: entry.installHint,
      installable: entry.npmPackage !== undefined,
      installCommand: entry.npmPackage ? `npm install -g ${entry.npmPackage}` : null,
      docsUrl: entry.docsUrl
    }
  }

  function get(id: string): AgentAdapter | null {
    const entry = entries.find((candidate) => candidate.id === id)
    if (!entry) return null
    let adapter = adapterCache.get(id)
    if (!adapter) {
      adapter = entry.create(processRunner, deps)
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
        ...staticMeta(entry),
        ...(await probeCommand(processRunner, entry.detectCommand))
      }))
    )
    detectCache = results
    return results
  }

  async function refreshOne(id: string): Promise<AgentMeta | null> {
    const entry = entries.find((candidate) => candidate.id === id)
    if (!entry) return null
    const meta = {
      ...staticMeta(entry),
      ...(await probeCommand(processRunner, entry.detectCommand))
    }
    // Keep the cache coherent rather than invalidating it wholesale: the other
    // two agents' results are still good, and re-probing them would spawn two
    // processes to learn nothing.
    if (detectCache) {
      detectCache = detectCache.map((cached) => (cached.id === id ? meta : cached))
    }
    return meta
  }

  return {
    detect,
    refreshOne,
    get,
    describe: (id) => {
      const entry = entries.find((candidate) => candidate.id === id)
      return entry ? staticMeta(entry) : null
    },
    npmPackageFor: (id) => entries.find((candidate) => candidate.id === id)?.npmPackage ?? null,
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
