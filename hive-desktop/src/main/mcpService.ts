import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * `McpService` — the main-process half of the MCP module (activate/disable
 * MCP servers, inspect their tools, read connection logs), modeled on the
 * Claude Code CLI's own on-disk contract so what the app manages is exactly
 * what the `claude` binary reads when it runs a turn in this workspace:
 *
 *   - **Catalog** lives in `<workspace>/.mcp.json` — the CLI's project-scoped
 *     MCP file: `{ "mcpServers": { "<name>": <config> } }`. A `command` entry
 *     is a stdio server; `{ "type": "http" | "sse", "url": … }` is a remote
 *     one. This service owns add/edit/remove on that file.
 *
 *   - **Enabled state** lives in `<workspace>/.claude/settings.local.json` —
 *     the CLI's local settings file. We keep `enableAllProjectMcpServers:
 *     true` (so the CLI loads project servers without an interactive approval
 *     prompt — this app IS the approval surface) and use
 *     `disabledMcpjsonServers: []` as a denylist, so a server is enabled
 *     unless the user explicitly turned it off. New servers are on by default,
 *     which is the desktop-app expectation (vs. the CLI's approve-each default).
 *
 *   - **Status / tools / logs** come from a live probe (an injected
 *     `McpProbe`, real implementation in `mcpProbe.ts`): it starts the server,
 *     runs the MCP `initialize` + `tools/list` handshake, and returns the tool
 *     list plus whatever the server wrote to stderr as diagnostic logs — the
 *     "does it actually connect, and what does it expose" view Claude Desktop
 *     shows. Injected so this module stays unit-testable with a fake probe and
 *     no child processes (the `ProcessRunner`/`DialogLike` DI convention).
 *
 * No sidecar registry: both files are the CLI's own, so nothing drifts out of
 * sync with what the agent actually sees.
 */

/** How a server is reached. `stdio` = local child process; `http`/`sse` = remote endpoint. */
export type McpTransport = 'stdio' | 'http' | 'sse'

/** The transport-specific launch/connection details for one server (no name). */
export interface McpServerConfig {
  transport: McpTransport
  /** stdio: the executable to spawn. */
  command?: string
  /** stdio: arguments passed to `command`. */
  args?: string[]
  /** stdio: extra environment variables for the spawned process. */
  env?: Record<string, string>
  /** http/sse: the endpoint URL. */
  url?: string
  /** http/sse: extra request headers (e.g. an auth token). */
  headers?: Record<string, string>
}

/** A configured server as the renderer lists it: its config plus name + enabled flag. */
export interface McpServer extends McpServerConfig {
  name: string
  enabled: boolean
}

/** One tool a server advertises via `tools/list`. */
export interface McpToolInfo {
  name: string
  description: string
}

/** The outcome of probing a server: connected?, its tools, and captured logs. */
export interface McpProbeResult {
  ok: boolean
  tools: McpToolInfo[]
  /** Server's self-reported name from the `initialize` result (when it connected). */
  serverName?: string
  /** Server's self-reported version from the `initialize` result. */
  serverVersion?: string
  /** Diagnostic text (a server's stderr for stdio; response detail for remote). */
  logs: string
  /** Human-readable failure reason when `ok` is false. */
  error?: string
  /** Wall-clock time the probe took, in milliseconds. */
  durationMs: number
}

/**
 * The connection probe. Injected so the service is testable without spawning
 * anything; the real implementation lives in `mcpProbe.ts`.
 */
export type McpProbe = (config: McpServerConfig, opts: { cwd: string }) => Promise<McpProbeResult>

export interface McpService {
  /** All project-scoped servers with their live enabled flag (catalog ∪ enabled state). */
  list(workspaceRoot: string): Promise<McpServer[]>
  /** Adds a new server to `.mcp.json` (throws on invalid config or duplicate name). */
  add(workspaceRoot: string, name: string, config: McpServerConfig): Promise<void>
  /** Renames/updates a server in place (throws if the new name collides with another). */
  update(
    workspaceRoot: string,
    originalName: string,
    name: string,
    config: McpServerConfig
  ): Promise<void>
  /** Removes a server from the catalog and drops it from the disabled denylist. */
  remove(workspaceRoot: string, name: string): Promise<void>
  /** Turns a server on/off by editing the `disabledMcpjsonServers` denylist. */
  setEnabled(workspaceRoot: string, name: string, enabled: boolean): Promise<void>
  /** Starts the named server and runs the MCP handshake to report status/tools/logs. */
  probe(workspaceRoot: string, name: string): Promise<McpProbeResult>
}

const MCP_FILE = '.mcp.json'
const CLAUDE_DIR = '.claude'
const SETTINGS_FILE = 'settings.local.json'

/** Shape of `.mcp.json` on disk. `mcpServers` values are raw (pre-normalization). */
interface McpFile {
  mcpServers?: Record<string, RawServerConfig>
  [key: string]: unknown
}

/** A raw server entry as written in `.mcp.json` (CLI schema, before we normalize it). */
interface RawServerConfig {
  type?: string
  command?: string
  args?: unknown
  env?: unknown
  url?: string
  headers?: unknown
  [key: string]: unknown
}

/** Shape of the fields we read/write in `.claude/settings.local.json` (others preserved). */
interface LocalSettings {
  enableAllProjectMcpServers?: boolean
  disabledMcpjsonServers?: string[]
  [key: string]: unknown
}

/** Parses a JSON file into `T`, or returns `fallback` for missing/invalid/non-object content. */
async function readJson<T>(path: string, fallback: T): Promise<T> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return fallback
  }
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

/** Atomically writes `value` as pretty JSON (temp file + rename), creating parent dirs. */
async function writeJson(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
}

/** Coerces an unknown value into a clean `string[]` (drops non-strings). */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Coerces an unknown value into a flat `Record<string,string>` (drops non-string values). */
function toStringMap(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val
  }
  return out
}

/**
 * Normalizes one raw `.mcp.json` entry into our canonical `McpServerConfig`.
 * Transport is taken from an explicit `type`, else inferred: a `command`
 * means stdio, a bare `url` means http.
 */
function normalizeConfig(raw: RawServerConfig): McpServerConfig {
  const explicit =
    raw.type === 'http' || raw.type === 'sse' || raw.type === 'stdio' ? raw.type : null
  const transport: McpTransport =
    explicit ?? (typeof raw.command === 'string' ? 'stdio' : raw.url ? 'http' : 'stdio')

  if (transport === 'stdio') {
    const config: McpServerConfig = {
      transport,
      command: typeof raw.command === 'string' ? raw.command : ''
    }
    const args = toStringArray(raw.args)
    if (args.length > 0) config.args = args
    const env = toStringMap(raw.env)
    if (Object.keys(env).length > 0) config.env = env
    return config
  }

  const config: McpServerConfig = { transport, url: typeof raw.url === 'string' ? raw.url : '' }
  const headers = toStringMap(raw.headers)
  if (Object.keys(headers).length > 0) config.headers = headers
  return config
}

/** Serializes a canonical config back into the CLI's `.mcp.json` entry shape. */
function serializeConfig(config: McpServerConfig): RawServerConfig {
  if (config.transport === 'stdio') {
    const raw: RawServerConfig = { command: config.command ?? '' }
    if (config.args && config.args.length > 0) raw.args = config.args
    if (config.env && Object.keys(config.env).length > 0) raw.env = config.env
    return raw
  }
  const raw: RawServerConfig = { type: config.transport, url: config.url ?? '' }
  if (config.headers && Object.keys(config.headers).length > 0) raw.headers = config.headers
  return raw
}

/**
 * Validates a server name + config before it touches disk, throwing a
 * user-facing message on failure (the IPC boundary surfaces `Error.message`).
 */
function validate(name: string, config: McpServerConfig): void {
  if (name.trim() === '') throw new Error('O nome do servidor é obrigatório.')
  if (config.transport === 'stdio') {
    if (!config.command || config.command.trim() === '') {
      throw new Error('Informe o comando que inicia o servidor.')
    }
  } else if (!config.url || config.url.trim() === '') {
    throw new Error('Informe a URL do servidor.')
  }
}

/** Reads and normalizes every server in `.mcp.json`, preserving file order. */
async function readCatalog(workspaceRoot: string): Promise<Map<string, McpServerConfig>> {
  const file = await readJson<McpFile>(join(workspaceRoot, MCP_FILE), {})
  const servers = new Map<string, McpServerConfig>()
  const raw = file.mcpServers
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [name, entry] of Object.entries(raw)) {
      if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
        servers.set(name, normalizeConfig(entry))
      }
    }
  }
  return servers
}

/** Reads the raw `.mcp.json` object (used by mutations to preserve unknown top-level keys). */
async function readMcpFile(workspaceRoot: string): Promise<McpFile> {
  return readJson<McpFile>(join(workspaceRoot, MCP_FILE), {})
}

/** Reads the local settings object (used to read/write the enabled denylist). */
async function readSettings(workspaceRoot: string): Promise<LocalSettings> {
  return readJson<LocalSettings>(join(workspaceRoot, CLAUDE_DIR, SETTINGS_FILE), {})
}

/** Persists the local settings object, creating `.claude/` if needed. */
async function writeSettings(workspaceRoot: string, settings: LocalSettings): Promise<void> {
  const dir = join(workspaceRoot, CLAUDE_DIR)
  await mkdir(dir, { recursive: true })
  await writeJson(join(dir, SETTINGS_FILE), settings)
}

/**
 * Factory (`createConfigStore`/`createWorkspaceService` convention): the probe
 * is injected so the service can be unit-tested against a fake with no child
 * processes or network.
 */
export function createMcpService(deps: { probe: McpProbe }): McpService {
  const { probe } = deps

  async function disabledSet(workspaceRoot: string): Promise<Set<string>> {
    const settings = await readSettings(workspaceRoot)
    return new Set(toStringArray(settings.disabledMcpjsonServers))
  }

  async function list(workspaceRoot: string): Promise<McpServer[]> {
    const [catalog, disabled] = await Promise.all([
      readCatalog(workspaceRoot),
      disabledSet(workspaceRoot)
    ])
    return [...catalog.entries()].map(([name, config]) => ({
      name,
      ...config,
      enabled: !disabled.has(name)
    }))
  }

  async function writeServer(
    workspaceRoot: string,
    name: string,
    config: McpServerConfig,
    dropName: string | null
  ): Promise<void> {
    const file = await readMcpFile(workspaceRoot)
    const servers: Record<string, RawServerConfig> =
      file.mcpServers !== null &&
      typeof file.mcpServers === 'object' &&
      !Array.isArray(file.mcpServers)
        ? { ...file.mcpServers }
        : {}
    // Rename/replace: drop the original key first so a rename doesn't leave a stale entry.
    if (dropName !== null) delete servers[dropName]
    servers[name] = serializeConfig(config)
    await writeJson(join(workspaceRoot, MCP_FILE), { ...file, mcpServers: servers })
  }

  async function add(workspaceRoot: string, name: string, config: McpServerConfig): Promise<void> {
    validate(name, config)
    const catalog = await readCatalog(workspaceRoot)
    if (catalog.has(name)) throw new Error(`Já existe um servidor chamado "${name}".`)
    await writeServer(workspaceRoot, name, config, null)
  }

  async function update(
    workspaceRoot: string,
    originalName: string,
    name: string,
    config: McpServerConfig
  ): Promise<void> {
    validate(name, config)
    const catalog = await readCatalog(workspaceRoot)
    if (name !== originalName && catalog.has(name)) {
      throw new Error(`Já existe um servidor chamado "${name}".`)
    }
    await writeServer(workspaceRoot, name, config, originalName)
    // A rename must carry the enabled state across to the new key.
    if (name !== originalName) {
      const settings = await readSettings(workspaceRoot)
      const disabled = toStringArray(settings.disabledMcpjsonServers)
      if (disabled.includes(originalName)) {
        const next = disabled.filter((entry) => entry !== originalName)
        next.push(name)
        await writeSettings(workspaceRoot, { ...settings, disabledMcpjsonServers: next })
      }
    }
  }

  async function remove(workspaceRoot: string, name: string): Promise<void> {
    const file = await readMcpFile(workspaceRoot)
    if (
      file.mcpServers !== null &&
      typeof file.mcpServers === 'object' &&
      !Array.isArray(file.mcpServers)
    ) {
      const servers = { ...file.mcpServers }
      delete servers[name]
      await writeJson(join(workspaceRoot, MCP_FILE), { ...file, mcpServers: servers })
    }
    // Also stop tracking it in the denylist so a later re-add starts enabled.
    const settings = await readSettings(workspaceRoot)
    const disabled = toStringArray(settings.disabledMcpjsonServers)
    if (disabled.includes(name)) {
      await writeSettings(workspaceRoot, {
        ...settings,
        disabledMcpjsonServers: disabled.filter((entry) => entry !== name)
      })
    }
  }

  async function setEnabled(workspaceRoot: string, name: string, enabled: boolean): Promise<void> {
    const settings = await readSettings(workspaceRoot)
    const disabled = new Set(toStringArray(settings.disabledMcpjsonServers))
    if (enabled) disabled.delete(name)
    else disabled.add(name)
    await writeSettings(workspaceRoot, {
      ...settings,
      // Keep the CLI loading enabled project servers without an approval prompt.
      enableAllProjectMcpServers: true,
      disabledMcpjsonServers: [...disabled]
    })
  }

  async function probeServer(workspaceRoot: string, name: string): Promise<McpProbeResult> {
    const catalog = await readCatalog(workspaceRoot)
    const config = catalog.get(name)
    if (!config) throw new Error(`Servidor "${name}" não encontrado.`)
    return probe(config, { cwd: workspaceRoot })
  }

  return { list, add, update, remove, setEnabled, probe: probeServer }
}
