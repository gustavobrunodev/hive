import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { ApprovalDecision, ApprovalEvent } from './agentAdapter'

/**
 * `ApprovalService` (agent-approvals) — the bridge that turns "the agent needs
 * permission" into a real interaction in Hive.
 *
 * ## Why this exists
 *
 * Adapters drive their CLI non-interactively (`claude -p …`). In that mode the
 * CLI has no TUI to ask in, so a tool it isn't pre-authorized for is simply
 * refused — and the agent, believing a prompt appeared *somewhere*, replies
 * with things like "A security prompt appeared, please approve it" while Hive
 * shows nothing to approve. The turn stalls on a question the user was never
 * asked.
 *
 * The Claude CLI's supported escape hatch is `--permission-prompt-tool`: name
 * an MCP tool and the CLI calls **it** instead of prompting, blocking the turn
 * on the tool's answer. So Hive hosts that MCP tool itself.
 *
 * ## Shape
 *
 * A loopback HTTP MCP endpoint (`127.0.0.1`, ephemeral port) served straight
 * from the main process. HTTP rather than the usual stdio transport for one
 * decisive reason: a stdio server has to be a **separate script file** the CLI
 * spawns, which means an extra artifact to bundle, resolve inside an asar, and
 * keep in sync. An in-process HTTP listener has none of that — same code path
 * in dev and in a packaged build, and directly unit-testable.
 *
 * Only the four JSON-RPC methods the CLI actually calls are implemented
 * (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`) plus
 * `ping`; anything else answers a clean "method not found" rather than
 * pretending.
 *
 * ## Trust boundary
 *
 * The listener binds to `127.0.0.1` only and requires a per-run bearer token
 * that never leaves this process except through the `--mcp-config` argv of the
 * CLI children it authorizes. Any other local process that finds the port gets
 * a 401 — it can't manufacture approvals on the user's behalf.
 */

/** The MCP server name inside `--mcp-config`; the prompt tool is `mcp__<server>__<tool>`. */
const SERVER_NAME = 'hive_approvals'
const TOOL_NAME = 'approve'

/** The protocol revision the CLI's MCP client negotiates against. */
const PROTOCOL_VERSION = '2025-06-18'

/**
 * How long a request may sit unanswered before it auto-denies. Generous on
 * purpose: a blocked turn waiting on a human is the *correct* state, and Claude
 * Code itself waits indefinitely. The ceiling only exists so a window closed
 * mid-prompt can't strand a CLI process forever.
 */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

/** Header carrying the turn a CLI child belongs to, so its prompts route to the right conversation. */
const TURN_HEADER = 'x-hive-turn'

/** Header carrying the shared secret. Sent as `Authorization: Bearer <token>`. */
const AUTH_HEADER = 'authorization'

/**
 * The permission-prompt tool's wire contract, fixed by the Claude CLI: it calls
 * the tool with the pending call, and reads the decision back out of the
 * result's text content as JSON.
 */
interface PromptToolArgs {
  tool_name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
}

/** Rules the user answered "sempre" to. `tool` alone for argument-less tools; `tool:<prefix>` for `Bash`. */
export type ApprovalRule = string

export interface ApprovalServiceOptions {
  /**
   * Standing allow-rules restored from disk at startup, and the sink for new
   * ones. Injected (rather than reaching for the config store) so this module
   * stays free of Electron and trivially testable.
   */
  rules?: ApprovalRule[]
  onRulesChanged?: (rules: ApprovalRule[]) => void
  /**
   * Fires once per *newly* recorded standing rule, carrying the call it came
   * from. Hive's own rule (above) is what stops this service re-asking; this
   * hook is how the grant also reaches the **agent's own** permission config,
   * so "Sempre permitir" is a real, visible, portable setting rather than a
   * private note (see `agentPermissions.ts`). Kept as a callback so this
   * module stays free of the filesystem and of agent-specific syntax.
   */
  onGranted?: (grant: GrantedRule) => void
  /** Overridable for tests; see `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number
}

/** The call a standing grant was recorded from. */
export interface GrantedRule {
  /** Hive's own rule key (`Bash:mkdir`, `WebFetch`). */
  rule: ApprovalRule
  tool: string
  input?: Record<string, unknown>
  /** The turn that asked — how the caller resolves which agent to configure. */
  turnId?: string
}

export interface ApprovalService {
  /** The `--permission-prompt-tool` value: `mcp__hive_approvals__approve`. */
  readonly promptToolName: string
  /**
   * The `--mcp-config` JSON for one turn. Includes the live port, the bearer
   * token, and `turnId` as a header so an approval raised by this child routes
   * back to the conversation that started it. `null` until `listen()` resolves.
   */
  mcpConfig(turnId?: string): string | null
  /** Binds the loopback listener. Resolves once the port is known. */
  listen(): Promise<void>
  /** Subscribes to pending requests; returns an unsubscribe function. */
  onRequest(listener: (request: ApprovalEvent) => void): () => void
  /** Releases a blocked request. Unknown / already-answered ids are a no-op. */
  respond(requestId: string, decision: ApprovalDecision): void
  /** Denies every pending request of one turn (its process was interrupted), or all of them. */
  cancel(turnId?: string): void
  /** The current standing allow-rules, in insertion order. */
  rules(): ApprovalRule[]
  /** Drops every standing rule (the profile's "esquecer permissões"). */
  clearRules(): void
  close(): Promise<void>
}

/**
 * The rule a decision with `scope: 'always'` records, and the key a later
 * request is matched against.
 *
 * `Bash` is special-cased to the command's **first word** (`npm`, `git`,
 * `mkdir`). Remembering the whole command line would never match twice, and
 * remembering bare `Bash` would hand over the entire shell on one click — the
 * executable is the granularity a person actually reasons about.
 */
export function approvalRuleFor(tool: string, input: Record<string, unknown> | undefined): string {
  if (tool !== 'Bash') return tool
  const command = typeof input?.command === 'string' ? input.command.trim() : ''
  const head = command.split(/\s+/)[0] ?? ''
  return head === '' ? tool : `${tool}:${head}`
}

/**
 * The card's headline: the one thing about this call the user has to read to
 * decide. Falls back to nothing rather than dumping a JSON blob — the card
 * shows the full input in its expandable detail anyway.
 */
export function approvalDetailFor(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined
  const pick = (key: string): string | undefined =>
    typeof input[key] === 'string' && input[key] !== '' ? (input[key] as string) : undefined
  return (
    pick('command') ??
    pick('file_path') ??
    pick('path') ??
    pick('url') ??
    pick('pattern') ??
    pick('description')
  )
}

interface Pending {
  request: ApprovalEvent
  rule: string
  resolve: (decision: ApprovalDecision) => void
  timer: ReturnType<typeof setTimeout>
}

/** JSON-RPC error codes used here (spec-defined values). */
const METHOD_NOT_FOUND = -32601
const INVALID_REQUEST = -32600

export function createApprovalService(options: ApprovalServiceOptions = {}): ApprovalService {
  const token = randomUUID()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const listeners = new Set<(request: ApprovalEvent) => void>()
  const pending = new Map<string, Pending>()
  const allowRules = new Set<ApprovalRule>(options.rules ?? [])
  let server: Server | null = null
  let port: number | null = null

  function persistRules(): void {
    options.onRulesChanged?.([...allowRules])
  }

  /** Registers a blocked request and hands the promise back to the HTTP handler. */
  function ask(
    tool: string,
    input: Record<string, unknown> | undefined,
    turnId: string | undefined
  ): Promise<ApprovalDecision> {
    const rule = approvalRuleFor(tool, input)
    if (allowRules.has(rule)) return Promise.resolve({ behavior: 'allow', scope: 'always' })

    const requestId = randomUUID()
    const request: ApprovalEvent = {
      type: 'approval',
      requestId,
      tool,
      detail: approvalDetailFor(input),
      input,
      turnId
    }
    return new Promise<ApprovalDecision>((resolve) => {
      const timer = setTimeout(() => {
        settle(requestId, { behavior: 'deny', message: 'Approval request timed out.' })
      }, timeoutMs)
      // `unref` so a waiting timer never keeps the app alive on quit.
      timer.unref?.()
      pending.set(requestId, { request, rule, resolve, timer })
      for (const listener of listeners) listener(request)
    })
  }

  function settle(requestId: string, decision: ApprovalDecision): void {
    const entry = pending.get(requestId)
    if (!entry) return
    pending.delete(requestId)
    clearTimeout(entry.timer)
    if (
      decision.behavior === 'allow' &&
      decision.scope === 'always' &&
      !allowRules.has(entry.rule)
    ) {
      allowRules.add(entry.rule)
      persistRules()
      // The grant is announced *after* it is recorded here, so a failure to
      // write the agent's own config can never leave Hive re-asking for
      // something the user already authorized.
      options.onGranted?.({
        rule: entry.rule,
        tool: entry.request.tool,
        input: entry.request.input,
        turnId: entry.request.turnId
      })
    }
    entry.resolve(decision)
  }

  // --- MCP over HTTP -------------------------------------------------------

  function toolsList(): unknown {
    return {
      tools: [
        {
          name: TOOL_NAME,
          description:
            'Asks the Hive user to approve or deny a tool call. Blocks until they answer.',
          inputSchema: {
            type: 'object',
            properties: {
              tool_name: { type: 'string' },
              input: { type: 'object' },
              tool_use_id: { type: 'string' }
            },
            required: ['tool_name']
          }
        }
      ]
    }
  }

  /**
   * Answers one `tools/call`. The decision travels back as JSON *inside* the
   * result's text content — that indirection is the CLI's contract for
   * permission-prompt tools, not a choice made here.
   */
  async function callTool(
    params: { name?: string; arguments?: PromptToolArgs } | undefined,
    turnId: string | undefined
  ): Promise<unknown> {
    if (params?.name !== TOOL_NAME) {
      return { content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }], isError: true }
    }
    const args = params.arguments ?? {}
    const decision = await ask(args.tool_name ?? 'unknown', args.input, turnId)
    const payload =
      decision.behavior === 'allow'
        ? { behavior: 'allow', updatedInput: args.input ?? {} }
        : { behavior: 'deny', message: decision.message ?? 'Denied by the user in Hive.' }
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
  }

  async function dispatch(
    method: string,
    params: unknown,
    turnId: string | undefined
  ): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
    switch (method) {
      case 'initialize':
        return {
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_NAME, version: '1.0.0' }
          }
        }
      case 'ping':
        return { result: {} }
      case 'tools/list':
        return { result: toolsList() }
      case 'tools/call':
        return {
          result: await callTool(params as { name?: string; arguments?: PromptToolArgs }, turnId)
        }
      default:
        return { error: { code: METHOD_NOT_FOUND, message: `Unsupported method: ${method}` } }
    }
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.setEncoding('utf-8')
      req.on('data', (chunk: string) => {
        body += chunk
      })
      req.on('end', () => resolve(body))
      req.on('error', reject)
    })
  }

  function send(res: ServerResponse, status: number, payload?: unknown): void {
    if (payload === undefined) {
      res.writeHead(status)
      res.end()
      return
    }
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body)
    })
    res.end(body)
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = req.headers[AUTH_HEADER]
    if (auth !== `Bearer ${token}`) {
      send(res, 401, { error: 'unauthorized' })
      return
    }
    if (req.method !== 'POST') {
      // The CLI's client may probe GET (server-initiated SSE) or DELETE
      // (session teardown). Neither is offered: this endpoint only answers
      // requests, it never pushes.
      send(res, 405, undefined)
      return
    }
    const turnHeader = req.headers[TURN_HEADER]
    const turnId = typeof turnHeader === 'string' && turnHeader !== '' ? turnHeader : undefined

    let message: { jsonrpc?: string; id?: string | number; method?: string; params?: unknown }
    try {
      message = JSON.parse(await readBody(req))
    } catch {
      send(res, 400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: INVALID_REQUEST, message: 'Invalid JSON' }
      })
      return
    }
    // A notification (no `id`) gets an ack with no body, per the transport spec.
    if (message.id === undefined || message.id === null) {
      send(res, 202, undefined)
      return
    }
    const outcome = await dispatch(message.method ?? '', message.params, turnId)
    send(res, 200, { jsonrpc: '2.0', id: message.id, ...outcome })
  }

  return {
    promptToolName: `mcp__${SERVER_NAME}__${TOOL_NAME}`,

    mcpConfig(turnId?: string): string | null {
      if (port === null) return null
      return JSON.stringify({
        mcpServers: {
          [SERVER_NAME]: {
            type: 'http',
            url: `http://127.0.0.1:${port}/mcp`,
            headers: {
              Authorization: `Bearer ${token}`,
              ...(turnId ? { 'X-Hive-Turn': turnId } : {})
            }
          }
        }
      })
    },

    listen(): Promise<void> {
      if (server) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const created = createServer((req, res) => {
          void handle(req, res).catch(() => send(res, 500, { error: 'internal' }))
        })
        created.on('error', reject)
        created.listen(0, '127.0.0.1', () => {
          const address = created.address()
          port = typeof address === 'object' && address !== null ? address.port : null
          server = created
          resolve()
        })
      })
    },

    onRequest(listener: (request: ApprovalEvent) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    respond: settle,

    cancel(turnId?: string): void {
      for (const [requestId, entry] of [...pending]) {
        if (turnId !== undefined && entry.request.turnId !== turnId) continue
        settle(requestId, { behavior: 'deny', message: 'The turn was stopped in Hive.' })
      }
    },

    rules: () => [...allowRules],

    clearRules(): void {
      allowRules.clear()
      persistRules()
    },

    close(): Promise<void> {
      this.cancel()
      const active = server
      server = null
      port = null
      if (!active) return Promise.resolve()
      return new Promise((resolve) => active.close(() => resolve()))
    }
  }
}
