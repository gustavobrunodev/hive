/**
 * Pure helpers for the MCP add/edit form (mcp): translating between the flat
 * text fields the user types (one argument per line, `KEY=value` env pairs,
 * `Header: value` lines) and the structured `McpServerConfig` that crosses
 * IPC to `.mcp.json`. Kept framework-free and side-effect-free so the parsing
 * rules are unit-tested directly, and the `McpManager` component only wires
 * them to inputs.
 */

/** How a server is reached — mirror of `main/mcpService.ts`'s `McpTransport`. */
export type McpTransport = 'stdio' | 'http' | 'sse'

/** Transport-specific connection details — mirror of `main/mcpService.ts`. */
export interface McpServerConfig {
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

/** A configured server as the renderer lists it — mirror of `main/mcpService.ts`. */
export interface McpServer extends McpServerConfig {
  name: string
  enabled: boolean
}

/** One advertised tool — mirror of `main/mcpService.ts`. */
export interface McpToolInfo {
  name: string
  description: string
}

/** Probe outcome — mirror of `main/mcpService.ts`. */
export interface McpProbeResult {
  ok: boolean
  tools: McpToolInfo[]
  serverName?: string
  serverVersion?: string
  logs: string
  error?: string
  durationMs: number
}

/**
 * The form's working draft. Everything is a string (or the single transport
 * enum) so inputs stay controlled; `toConfig` collapses it to the wire shape.
 */
export interface McpDraft {
  name: string
  transport: McpTransport
  command: string
  /** One argument per line. */
  argsText: string
  /** One `KEY=value` per line. */
  envText: string
  url: string
  /** One `Header: value` per line. */
  headersText: string
}

/** An empty stdio draft — the default the add form opens on. */
export function emptyDraft(): McpDraft {
  return {
    name: '',
    transport: 'stdio',
    command: '',
    argsText: '',
    envText: '',
    url: '',
    headersText: ''
  }
}

/** Splits a textarea into trimmed, non-empty lines. */
function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** Parses `KEY=value` lines into a map (first `=` splits; blank keys dropped). */
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of toLines(text)) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (key !== '') env[key] = line.slice(eq + 1).trim()
  }
  return env
}

/** Parses `Header: value` lines into a map (first `:` splits; blank names dropped). */
export function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of toLines(text)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim()
    if (key !== '') headers[key] = line.slice(colon + 1).trim()
  }
  return headers
}

/** Serializes an env map back to `KEY=value` lines for the textarea. */
export function envToText(env: Record<string, string> | undefined): string {
  if (!env) return ''
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/** Serializes a headers map back to `Header: value` lines for the textarea. */
export function headersToText(headers: Record<string, string> | undefined): string {
  if (!headers) return ''
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

/** Collapses the draft into the wire `McpServerConfig` (omitting empty collections). */
export function toConfig(draft: McpDraft): McpServerConfig {
  if (draft.transport === 'stdio') {
    const config: McpServerConfig = { transport: 'stdio', command: draft.command.trim() }
    const args = toLines(draft.argsText)
    if (args.length > 0) config.args = args
    const env = parseEnv(draft.envText)
    if (Object.keys(env).length > 0) config.env = env
    return config
  }
  const config: McpServerConfig = { transport: draft.transport, url: draft.url.trim() }
  const headers = parseHeaders(draft.headersText)
  if (Object.keys(headers).length > 0) config.headers = headers
  return config
}

/** Rehydrates a form draft from an existing server (for the edit view). */
export function draftFromServer(server: McpServer): McpDraft {
  return {
    name: server.name,
    transport: server.transport,
    command: server.command ?? '',
    argsText: (server.args ?? []).join('\n'),
    envText: envToText(server.env),
    url: server.url ?? '',
    headersText: headersToText(server.headers)
  }
}

/** Whether the draft has the minimum required fields for its transport. */
export function isDraftValid(draft: McpDraft): boolean {
  if (draft.name.trim() === '') return false
  return draft.transport === 'stdio' ? draft.command.trim() !== '' : draft.url.trim() !== ''
}

/** A short, human summary of a server's connection target (the row subtitle). */
export function connectionSummary(server: McpServerConfig): string {
  if (server.transport === 'stdio') {
    return [server.command ?? '', ...(server.args ?? [])].join(' ').trim()
  }
  return server.url ?? ''
}

/** A one-click starter for the add form: a curated, real MCP server. */
export interface McpPreset {
  id: string
  label: string
  blurb: string
  draft: McpDraft
}

/**
 * Curated starters (mcp): a handful of well-known MCP servers so the common
 * case is one click, not a hand-typed command — the Claude Desktop
 * connector-gallery feeling. `{workspace}` in an arg is substituted with the
 * open workspace path when the preset is applied.
 */
export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'playwright',
    label: 'Playwright',
    blurb: 'Navegador automatizado: abrir páginas, clicar, extrair conteúdo.',
    draft: {
      ...emptyDraft(),
      name: 'playwright',
      command: 'npx',
      argsText: '-y\n@playwright/mcp@latest'
    }
  },
  {
    id: 'filesystem',
    label: 'Filesystem',
    blurb: 'Acesso a arquivos de uma pasta específica do seu computador.',
    draft: {
      ...emptyDraft(),
      name: 'filesystem',
      command: 'npx',
      argsText: '-y\n@modelcontextprotocol/server-filesystem\n{workspace}'
    }
  },
  {
    id: 'github',
    label: 'GitHub',
    blurb: 'Issues, pull requests e repositórios direto do GitHub.',
    draft: {
      ...emptyDraft(),
      name: 'github',
      command: 'npx',
      argsText: '-y\n@modelcontextprotocol/server-github',
      envText: 'GITHUB_PERSONAL_ACCESS_TOKEN='
    }
  },
  {
    id: 'context7',
    label: 'Context7',
    blurb: 'Documentação atualizada de bibliotecas e frameworks.',
    draft: {
      ...emptyDraft(),
      name: 'context7',
      transport: 'http',
      url: 'https://mcp.context7.com/mcp'
    }
  },
  {
    id: 'fetch',
    label: 'Fetch',
    blurb: 'Busca e converte páginas da web em texto para o agente.',
    draft: {
      ...emptyDraft(),
      name: 'fetch',
      command: 'uvx',
      argsText: 'mcp-server-fetch'
    }
  },
  {
    id: 'sequential-thinking',
    label: 'Sequential Thinking',
    blurb: 'Raciocínio passo a passo estruturado para problemas complexos.',
    draft: {
      ...emptyDraft(),
      name: 'sequential-thinking',
      command: 'npx',
      argsText: '-y\n@modelcontextprotocol/server-sequential-thinking'
    }
  }
]

/** Applies a preset, substituting `{workspace}` in every arg with the open path. */
export function applyPreset(preset: McpPreset, workspace: string): McpDraft {
  return {
    ...preset.draft,
    argsText: preset.draft.argsText.replaceAll('{workspace}', workspace)
  }
}
