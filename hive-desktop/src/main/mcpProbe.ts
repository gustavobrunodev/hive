import { spawn } from 'child_process'

import { cliEnv, spawnTarget, type SpawnTarget } from './cliEnv'
import type { McpProbe, McpProbeResult, McpServerConfig, McpToolInfo } from './mcpService'

/**
 * The real `McpProbe` (injected into `McpService` from `index.ts`): connect to
 * a configured MCP server, run the protocol handshake, and report back whether
 * it came up, what tools it exposes, and its diagnostic output — the live
 * "is this server actually working" check behind the MCP module's status dots
 * and log drawer.
 *
 * MCP speaks JSON-RPC 2.0. The minimal viable handshake is:
 *   1. `initialize`         → server returns its `serverInfo` + capabilities
 *   2. `notifications/initialized`  (fire-and-forget, per spec)
 *   3. `tools/list`         → server returns the tools it advertises
 *
 * stdio transport frames each JSON-RPC message as one newline-delimited line
 * on stdin/stdout; a server's human diagnostics go to stderr, which we capture
 * verbatim as the log feed. Remote transports (`http`/`sse`) POST the same
 * messages to the endpoint; MCP's Streamable-HTTP responses come back as
 * either a JSON body or an SSE `data:` frame, both handled here.
 *
 * Everything is time-boxed: a server that never speaks, or a command that
 * doesn't exist, resolves to `ok: false` with a reason rather than hanging.
 *
 * The spawn goes out through `cliEnv`/`spawnTarget`, exactly like every other
 * CLI this app starts (see `processRunner.ts`). That is not a detail: the
 * canonical MCP server is `npx -y @playwright/mcp@latest`, and `npx` lives in
 * an npm/nvm prefix that a desktop app launched from a launcher does not have
 * on its `PATH` — while on Windows it is a `.cmd` shim `CreateProcess` cannot
 * find or execute at all. Spawning it raw reported "Comando não encontrado:
 * npx" on machines where the same line runs in any terminal, which read as a
 * broken server rather than as a lookup this app had simply skipped.
 */

/** How long a remote endpoint gets to answer before the probe gives up. */
const PROBE_TIMEOUT_MS = 10_000

/**
 * The stdio ceiling is three times the remote one, because a local server is
 * usually not "running" yet: the canonical entry is `npx -y <pkg>@latest`,
 * whose first run downloads the package before a single byte of JSON-RPC is
 * written. Measured cold on `@playwright/mcp@latest`, that took past 10s and
 * the probe reported a timeout for a server that was working — the same
 * "Hive says it's broken, my terminal says it's fine" the PATH fix above
 * addresses. The button spins while it waits, so the cost of the longer
 * ceiling is only paid by a server that really is stuck.
 */
const STDIO_PROBE_TIMEOUT_MS = 30_000
const PROTOCOL_VERSION = '2025-06-18'
const CLIENT_INFO = { name: 'hive', version: '1.0.0' }

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code?: number; message?: string }
}

function initializeRequest(id: number): JsonRpcMessage {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO
    }
  }
}

function toolsListRequest(id: number): JsonRpcMessage {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} }
}

/** Pulls the (name, description) tool list out of a `tools/list` result object. */
function parseTools(result: unknown): McpToolInfo[] {
  if (result === null || typeof result !== 'object') return []
  const tools = (result as { tools?: unknown }).tools
  if (!Array.isArray(tools)) return []
  return tools.map((tool) => {
    const record = (tool ?? {}) as { name?: unknown; description?: unknown }
    return {
      name: typeof record.name === 'string' ? record.name : '',
      description: typeof record.description === 'string' ? record.description : ''
    }
  })
}

/** Pulls the server's self-reported name/version out of an `initialize` result. */
function parseServerInfo(result: unknown): { name?: string; version?: string } {
  if (result === null || typeof result !== 'object') return {}
  const info = (result as { serverInfo?: unknown }).serverInfo
  if (info === null || typeof info !== 'object') return {}
  const record = info as { name?: unknown; version?: unknown }
  return {
    name: typeof record.name === 'string' ? record.name : undefined,
    version: typeof record.version === 'string' ? record.version : undefined
  }
}

/**
 * How a stdio server is actually spawned: the widened CLI environment, the
 * server's own `env` on top of it (it is the one the user wrote for this
 * server specifically), and the command resolved against that `PATH` — routed
 * through `cmd.exe` when what resolves is a Windows batch shim.
 *
 * Separate from `probeStdio` so the lookup is testable without a child
 * process: it is the half of the probe that decides whether `npx` is found at
 * all.
 */
export function stdioSpawnPlan(
  config: McpServerConfig,
  base: NodeJS.ProcessEnv = cliEnv()
): SpawnTarget & { env: NodeJS.ProcessEnv } {
  const env = { ...base, ...(config.env ?? {}) }
  return { ...spawnTarget(config.command ?? '', config.args ?? [], env.PATH, env), env }
}

/** Probes a local (stdio) server: spawn it, handshake over stdin/stdout, capture stderr. */
function probeStdio(config: McpServerConfig, cwd: string): Promise<McpProbeResult> {
  const startedAt = Date.now()
  return new Promise<McpProbeResult>((resolve) => {
    let settled = false
    let stdoutBuffer = ''
    let stderrLog = ''
    let serverInfo: { name?: string; version?: string } = {}

    const plan = stdioSpawnPlan(config)
    const child = spawn(plan.command, plan.args, {
      cwd,
      env: plan.env,
      windowsVerbatimArguments: plan.windowsVerbatimArguments,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const finish = (
      result: Omit<McpProbeResult, 'durationMs' | 'logs'> & { logs?: string }
    ): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        // Already gone — nothing to kill.
      }
      resolve({
        ...result,
        logs: (result.logs ?? stderrLog).trim(),
        durationMs: Date.now() - startedAt
      })
    }

    const timer = setTimeout(() => {
      finish({
        ok: false,
        tools: [],
        error:
          'O servidor não respondeu ao handshake dentro do tempo limite. Se for a primeira execução, ele pode ainda estar baixando — tente de novo.'
      })
    }, STDIO_PROBE_TIMEOUT_MS)

    const send = (message: JsonRpcMessage): void => {
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`)
      } catch {
        // Stream closed underneath us — the exit/error handlers will settle.
      }
    }

    child.on('error', (err: NodeJS.ErrnoException) => {
      const reason =
        err.code === 'ENOENT'
          ? `Comando não encontrado: "${config.command}". Instale-o ou informe o caminho completo do executável.`
          : `Falha ao iniciar o servidor: ${err.message}`
      finish({ ok: false, tools: [], error: reason })
    })

    child.on('exit', (code) => {
      if (settled) return
      finish({
        ok: false,
        tools: [],
        error: `O servidor encerrou antes de concluir o handshake (código ${code ?? 'desconhecido'}).`
      })
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrLog += chunk.toString()
    })

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      let newlineIndex = stdoutBuffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim()
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
        newlineIndex = stdoutBuffer.indexOf('\n')
        if (line === '') continue
        let message: JsonRpcMessage
        try {
          message = JSON.parse(line) as JsonRpcMessage
        } catch {
          continue // Non-JSON stdout line (some servers log there) — ignore.
        }
        if (message.id === 1 && message.result !== undefined) {
          serverInfo = parseServerInfo(message.result)
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          send(toolsListRequest(2))
        } else if (message.id === 2) {
          if (message.error) {
            finish({
              ok: false,
              tools: [],
              serverName: serverInfo.name,
              serverVersion: serverInfo.version,
              error: message.error.message ?? 'O servidor recusou tools/list.'
            })
          } else {
            finish({
              ok: true,
              tools: parseTools(message.result),
              serverName: serverInfo.name,
              serverVersion: serverInfo.version
            })
          }
        }
      }
    })

    send(initializeRequest(1))
  })
}

/** Extracts a JSON-RPC message from a Streamable-HTTP body (raw JSON or an SSE `data:` frame). */
function parseHttpBody(body: string): JsonRpcMessage | null {
  const trimmed = body.trim()
  if (trimmed === '') return null
  try {
    return JSON.parse(trimmed) as JsonRpcMessage
  } catch {
    // SSE framing: find the last `data:` line and parse its payload.
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
    for (const payload of dataLines.reverse()) {
      try {
        return JSON.parse(payload) as JsonRpcMessage
      } catch {
        continue
      }
    }
    return null
  }
}

/** Probes a remote (http/sse) server via MCP Streamable HTTP POSTs. */
async function probeRemote(config: McpServerConfig): Promise<McpProbeResult> {
  const startedAt = Date.now()
  const url = config.url ?? ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  const done = (result: Omit<McpProbeResult, 'durationMs'>): McpProbeResult => {
    clearTimeout(timer)
    return { ...result, durationMs: Date.now() - startedAt }
  }

  const post = async (message: JsonRpcMessage): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(config.headers ?? {})
      },
      body: JSON.stringify(message),
      signal: controller.signal
    })

  try {
    const initResponse = await post(initializeRequest(1))
    const initText = await initResponse.text()
    if (!initResponse.ok) {
      return done({
        ok: false,
        tools: [],
        logs: initText.slice(0, 4000).trim(),
        error: `O endpoint respondeu ${initResponse.status} ${initResponse.statusText}.`
      })
    }
    const initMessage = parseHttpBody(initText)
    const serverInfo = parseServerInfo(initMessage?.result)

    const listResponse = await post(toolsListRequest(2))
    const listText = await listResponse.text()
    const listMessage = parseHttpBody(listText)
    if (!listResponse.ok || listMessage?.error) {
      return done({
        ok: false,
        tools: [],
        serverName: serverInfo.name,
        serverVersion: serverInfo.version,
        logs: listText.slice(0, 4000).trim(),
        error: listMessage?.error?.message ?? `tools/list respondeu ${listResponse.status}.`
      })
    }
    return done({
      ok: true,
      tools: parseTools(listMessage?.result),
      serverName: serverInfo.name,
      serverVersion: serverInfo.version,
      logs: `Conectado a ${url}`
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return done({
      ok: false,
      tools: [],
      logs: '',
      error: aborted
        ? 'O endpoint não respondeu dentro do tempo limite.'
        : `Falha na conexão: ${err instanceof Error ? err.message : String(err)}`
    })
  }
}

/** The injectable probe: routes to the stdio or remote implementation by transport. */
export const mcpProbe: McpProbe = (config, opts) =>
  config.transport === 'stdio' ? probeStdio(config, opts.cwd) : probeRemote(config)
