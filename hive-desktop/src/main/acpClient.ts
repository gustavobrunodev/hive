import type { ProcessHandle, ProcessRunner } from './processRunner'

/**
 * ACP — the Agent Client Protocol — over one long-lived child process.
 *
 * ## Why this module exists
 *
 * Every adapter before it drove its CLI the same way: one process per turn,
 * `-p "<prompt>"`, read stdout, exit. That is the right shape for a CLI whose
 * print mode emits structured events (Claude's `--output-format stream-json`),
 * and the wrong shape for Devin, which emits **plain prose**. Three of the four
 * defects this module closes come from that single mismatch:
 *
 *  - *"Devin demora 50s a 1 minuto para iniciar uma sessão."* Every message
 *    paid a full cold start: process spawn, auth, MCP servers reconnected,
 *    workspace re-scanned, system context rebuilt — before the model saw a
 *    single token.
 *  - *"Toda vez que mando uma mensagem parece que inicia uma nova sessão."*
 *    It did. `--resume` re-sends an id, but the process, its MCP connections
 *    and its warmed context are all built again from nothing.
 *  - *"Sempre aparece: Iniciando."* `turnPhase()` reports `starting` while a
 *    turn has produced no timeline blocks, and prose produces none: no tool
 *    events, no session id until the process exits. So the label was accurate
 *    and useless — the UI genuinely knew nothing for the whole turn.
 *
 * `devin acp` fixes all three at the source. It is a JSON-RPC server over
 * stdio that stays up across turns and reports what it is doing as it does it.
 * Measured against the real `devin 3000.6.14` on the reporter's machine:
 *
 *   handshake (`initialize`)            0.07s
 *   first prompt, incl. one file read   6.1s
 *   **second prompt, same session       1.7s**
 *
 * against ~3.5s of fixed cold-start per message before, on a *trivial* prompt
 * — and the gap widens with the size of the workspace, which is exactly the
 * case the reporter was in.
 *
 * ## What this module is, and is not
 *
 * It is the **transport**: framing, request/response correlation, and the
 * inbound-request dispatch. It knows nothing about Devin, sessions, or Hive's
 * `AgentEvent`s — `devinAcpSession.ts` owns that mapping. Keeping the two
 * apart is what lets the protocol be tested against a scripted process with no
 * agent anywhere near it, and what would let a second ACP-speaking CLI reuse
 * this unchanged.
 *
 * ## Framing
 *
 * Newline-delimited JSON, one message per line — ACP's stdio framing, and what
 * `devin acp` actually writes (verified by reading its stdout directly).
 * Non-JSON lines are **skipped, not fatal**: the agent's tracing goes to
 * stderr, but a banner or an update notice on stdout must not take the session
 * down. Partial lines are buffered until their newline arrives, because a
 * 10 KB `session/update` does not arrive in one chunk.
 */

/** A JSON-RPC id. The spec allows strings; we only ever mint numbers. */
type RpcId = number | string

/** One decoded JSON-RPC message, in any of the four shapes the spec allows. */
interface RpcMessage {
  jsonrpc?: string
  id?: RpcId
  method?: string
  params?: unknown
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

/** The JSON-RPC error a failed `request` rejects with, with its code kept. */
export class AcpError extends Error {
  readonly code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'AcpError'
    this.code = code
  }
}

/** JSON-RPC's "the method isn't implemented here" — the honest answer to an
 *  agent asking for a capability this client never advertised. */
const METHOD_NOT_FOUND = -32601

/** Handles one request *from* the agent; the resolved value becomes `result`. */
export type AcpRequestHandler = (params: unknown) => Promise<unknown> | unknown

/** Handles one notification from the agent. Return values are ignored. */
export type AcpNotificationHandler = (params: unknown) => void

export interface AcpClient {
  /** Calls `method` on the agent and resolves with its `result`. */
  request<T = unknown>(method: string, params?: unknown): Promise<T>
  /** Fires a notification at the agent; nothing comes back. */
  notify(method: string, params?: unknown): void
  /** Registers the handler for one inbound request method. */
  onRequest(method: string, handler: AcpRequestHandler): void
  /** Registers the handler for one inbound notification method. */
  onNotify(method: string, handler: AcpNotificationHandler): void
  /** Resolves when the agent process exits, whatever the reason. */
  readonly closed: Promise<void>
  /** Kills the agent process and rejects every in-flight request. */
  stop(): void
}

export interface AcpClientOptions {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  /**
   * Called with whatever the agent writes to stderr. `devin acp` logs its
   * whole trace there, so this is diagnostics only — never parsed, and never
   * shown to the user as if it were the agent talking.
   */
  onStderr?: (text: string) => void
}

/**
 * Spawns the agent and starts speaking ACP to it.
 *
 * The process is started through the app's own `ProcessRunner`, not `spawn`
 * directly, so it inherits the widened `PATH` that makes a GUI-launched Electron
 * app able to find `devin` at all, the Windows `.cmd` shim routing, and the
 * process-group kill that makes Stop actually stop things. `stdin: 'pipe'` is
 * the one thing this caller needs that no other caller wants.
 */
export function createAcpClient(
  processRunner: ProcessRunner,
  options: AcpClientOptions
): AcpClient {
  const handle: ProcessHandle = processRunner.run(options.command, options.args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    stdin: 'pipe',
    processGroup: true
  })

  const pending = new Map<RpcId, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  const requestHandlers = new Map<string, AcpRequestHandler>()
  const notifyHandlers = new Map<string, AcpNotificationHandler>()
  let nextId = 0
  let stopped = false

  function send(message: Record<string, unknown>): void {
    handle.write?.(`${JSON.stringify(message)}\n`)
  }

  /** Answers one inbound request, converting a thrown handler into an error reply. */
  async function dispatchRequest(id: RpcId, method: string, params: unknown): Promise<void> {
    const handler = requestHandlers.get(method)
    if (!handler) {
      // Not an internal failure: the agent asked for something we never
      // advertised. Saying so lets it fall back to its own implementation,
      // where staying silent would hang the turn forever — which is exactly
      // what happened the first time this client claimed `fs.readTextFile`
      // and had no handler for `fs/read_text_file`.
      send({
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` }
      })
      return
    }
    try {
      send({ jsonrpc: '2.0', id, result: (await handler(params)) ?? {} })
    } catch (error) {
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  function handleMessage(message: RpcMessage): void {
    // A response: it carries an id and no method.
    if (message.id !== undefined && message.method === undefined) {
      const waiter = pending.get(message.id)
      if (!waiter) return
      pending.delete(message.id)
      if (message.error) {
        waiter.reject(
          new AcpError(message.error.message ?? 'Erro do agente', message.error.code ?? -32603)
        )
      } else {
        waiter.resolve(message.result)
      }
      return
    }
    if (message.method === undefined) return
    // A request expects a reply; a notification has no id.
    if (message.id !== undefined) {
      void dispatchRequest(message.id, message.method, message.params)
      return
    }
    notifyHandlers.get(message.method)?.(message.params)
  }

  const closed = (async () => {
    let buffer = ''
    for await (const chunk of handle.output) {
      if (chunk.stream === 'stderr') {
        options.onStderr?.(chunk.data)
        continue
      }
      buffer += chunk.data
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        const trimmed = line.trim()
        if (trimmed !== '') {
          try {
            handleMessage(JSON.parse(trimmed) as RpcMessage)
          } catch {
            // Not JSON. An agent banner, an update notice, a stray ANSI line.
            // Skipping keeps a cosmetic write from killing a working session.
          }
        }
        newline = buffer.indexOf('\n')
      }
    }
    await handle.exitCode
    // Nothing will ever answer these now.
    const reason = new Error('O processo do agente terminou.')
    for (const waiter of pending.values()) waiter.reject(reason)
    pending.clear()
  })()

  return {
    request<T = unknown>(method: string, params?: unknown): Promise<T> {
      if (stopped) return Promise.reject(new Error('A sessão do agente foi encerrada.'))
      const id = ++nextId
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
        send({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })
      })
    },
    notify(method: string, params?: unknown): void {
      if (stopped) return
      send({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) })
    },
    onRequest(method: string, handler: AcpRequestHandler): void {
      requestHandlers.set(method, handler)
    },
    onNotify(method: string, handler: AcpNotificationHandler): void {
      notifyHandlers.set(method, handler)
    },
    closed,
    stop(): void {
      stopped = true
      handle.kill()
    }
  }
}
