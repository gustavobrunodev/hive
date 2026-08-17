import { readFileSync, statSync } from 'fs'
import type { ProcessHandle, ProcessRunner } from './processRunner'
import { buildToolPatch, MAX_SOURCE_BYTES } from './toolPatch'
import {
  composeTurnPrompt,
  createAgentEventQueue,
  type AgentInput,
  type AgentSession,
  type McpServerReport,
  type McpServerStatus,
  type SessionOpts,
  type TurnOpts,
  type TurnUsage,
  type WorkflowCommand
} from './agentAdapter'

/**
 * Shared engine for every one-shot-per-turn CLI agent adapter (multi-agent).
 *
 * All three shipped adapters — `ClaudeCliAdapter`, `CopilotCliAdapter`,
 * `DevinCliAdapter` — drive their CLI the same way: spawn one non-interactive
 * `-p "<prompt>"` process per turn against the injected `ProcessRunner`, stream
 * its stdout, and end on exactly one terminal event. The ONLY thing that
 * differs is the argv each CLI wants (`buildArgs`) and the binary name
 * (`command`). Everything else — turn spawning, the stream-json/raw-token
 * stdout parser, session-id learning, background-turn routing by `turnId`,
 * interrupt-vs-error accounting, `stop()` teardown — is identical and lives
 * here, so a new adapter is a ~40-line file, not a third copy of this logic.
 *
 * The stdout parser targets the Anthropic-shaped `--output-format stream-json`
 * lines (Claude, and the Copilot CLI when pointed at a Claude model), and
 * falls back to raw-token passthrough for any non-JSON line — so an adapter
 * whose CLI streams plain text (or a shape we don't model) still surfaces its
 * output verbatim instead of dropping it.
 */

/** Everything an adapter must supply to `createCliAgentSession` beyond the generic engine. */
export interface CliAdapterConfig {
  /** The binary to spawn (`claude` / `copilot` / `devin`). */
  command: string
  /**
   * Label used in terminal error messages (`<label> exited with code 1: …`) —
   * usually the same as `command`, kept separate so a display-friendly label
   * can differ from the raw binary name.
   */
  errorLabel: string
  /**
   * Builds the argv for one turn. `model`/`effort` are the resolved values
   * (per-turn override falling back to the session default) and may be
   * `undefined` when the adapter exposes no such choice — `buildArgs` then
   * omits the corresponding flag. `resume` is the CLI-native session id to
   * continue, or `null`/`undefined` for a fresh conversation. `turnId` is the
   * caller's turn identity, which an adapter wiring a permission-prompt tool
   * (agent-approvals) stamps onto that tool's config so an approval raised by
   * this child routes back to the conversation that started it.
   */
  buildArgs(
    prompt: string,
    turn: { model?: string; effort?: string; resume?: string | null; turnId?: string }
  ): string[]
  /**
   * agent-terminal (AT-R4): extra environment for this turn — the adapter's
   * own translation of the shell the user chose (`CLAUDE_CODE_SHELL` and
   * friends). Called per turn, so a choice made mid-session applies to the
   * next message without restarting anything. Absent, or returning nothing,
   * means this CLI has no way to be told and the choice is the launch alone.
   */
  buildEnv?(): Record<string, string> | undefined
}

/**
 * One parsed line of Anthropic-shaped `--output-format stream-json` output
 * (session-history: this structured mode is what exposes the CLI's
 * `session_id` — the key to real conversation memory via `--resume`). Only the
 * fields the parser reads are modeled; everything else is ignored.
 */
interface StreamJsonLine {
  type?: string
  subtype?: string
  session_id?: string
  /**
   * Set on every line a *subagent* produced (the `Task`/`Agent` tool's own
   * conversation, which the CLI calls a sidechain). Its token counts describe
   * that subagent's window, not this conversation's — see `emitUsageEvents`.
   */
  parent_tool_use_id?: string | null
  event?: {
    type?: string
    delta?: { type?: string; text?: string }
  }
  /**
   * A message's content blocks. `assistant` messages carry `tool_use` blocks
   * (the agent calling a tool); `user` messages carry the matching
   * `tool_result` blocks (the call coming back) — together they're the live
   * activity feed (agent-activity) and the file-change attribution (ACR-C7).
   */
  message?: {
    /** The model that produced this message, as the CLI names it (session-usage). */
    model?: string
    content?: Array<{
      type?: string
      id?: string
      name?: string
      input?: Record<string, unknown>
      tool_use_id?: string
      is_error?: boolean
    }>
    /** Per-message token accounting — a live snapshot of context occupancy. */
    usage?: StreamJsonUsage
  }
  /** `result` only: the turn's totals, plus the CLI's own timings and cost. */
  usage?: StreamJsonUsage
  /**
   * `result` only: per-model accounting, and the one place the CLI states the
   * **context window it is actually using** — which beats any curated constant,
   * because the same model id runs at 200k or 1M depending on how the CLI was
   * configured.
   */
  modelUsage?: Record<string, { contextWindow?: number } | undefined>
  total_cost_usd?: number
  duration_ms?: number
  duration_api_ms?: number
  /**
   * `system`/`init` only (mcp-visibility): every MCP server the CLI dialed for
   * this turn, and how that went.
   */
  mcp_servers?: unknown
  /** `system`/`init` only: every tool name the turn was given, MCP tools included. */
  tools?: unknown
}

/** The Anthropic-shaped `usage` object, as it appears on both message and result lines. */
interface StreamJsonUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/** A number off the wire, coerced to a non-negative integer — an absent or malformed field is 0, never `NaN`. */
function tokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/** A CLI-reported millisecond/currency figure, or `undefined` when the CLI didn't report one. */
function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Reads a `usage` object into the adapter's own shape, or returns `null` when
 * the line carries none — every field is optional off the wire, and a usage
 * block with nothing in it is not worth an event.
 */
function readUsage(raw: StreamJsonUsage | undefined, model?: string): TurnUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const usage: TurnUsage = {
    inputTokens: tokenCount(raw.input_tokens),
    cacheReadTokens: tokenCount(raw.cache_read_input_tokens),
    cacheCreationTokens: tokenCount(raw.cache_creation_input_tokens),
    outputTokens: tokenCount(raw.output_tokens),
    model: typeof model === 'string' && model !== '' ? model : undefined
  }
  const total =
    usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens + usage.outputTokens
  return total === 0 ? null : usage
}

/**
 * Emits the turn's token accounting (session-usage): a live snapshot per
 * completed `assistant` message, and the authoritative `final` one off the
 * `result` line, which is where the CLI puts the turn's cost and its own
 * duration. Consumers accumulate only the `final` ones — the intermediate
 * snapshots are restatements of the same growing request, not separate costs.
 *
 * ## Why the `result` line's input counts are NOT the context window
 *
 * The defect this closes: one BMAD prompt reported a context window 100% full.
 * Measured against a real `claude` 2.1.226 run (5 tool calls, one `-p` turn):
 *
 *   assistant #1  cache_read  15 854      ← each is ONE request's prompt
 *   assistant #2  cache_read  22 667
 *   assistant #3  cache_read  23 298
 *   assistant #4  cache_read  23 609
 *   assistant #5  cache_read  23 760      ← the window really held ~24k (12%)
 *   result        cache_read 109 188      ← 15 854+22 667+23 298+23 609+23 760
 *
 * The `result` line's input-side counts are a **sum over every API request the
 * turn made** — a billing figure. Read as occupancy they grow without bound
 * with the number of steps, which is exactly how nine steps filled a 200k
 * window that held 24k. Its output-side counts, cost and durations *are* turn
 * totals and stay authoritative.
 *
 * So the final event is assembled from both halves: totals off the `result`
 * line, occupancy off the last main-chain snapshot this turn saw. That keeps
 * one meaning for `TurnUsage` everywhere — input side = what the window holds,
 * output side = what the turn produced.
 *
 * ## Why subagent messages are skipped
 *
 * A `Task`/`Agent` tool runs its own conversation, and its `assistant` lines
 * carry their own `usage` (measured: 12k while the parent sat at 23k). Folding
 * those in makes the meter drop mid-turn and then jump back. They are tagged
 * with `parent_tool_use_id`; the parent's totals already bill them.
 */
function emitUsageEvents(
  parsed: StreamJsonLine,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  tracker: TurnTracker
): void {
  if (parsed.type === 'assistant') {
    if (typeof parsed.parent_tool_use_id === 'string' && parsed.parent_tool_use_id !== '') return
    const usage = readUsage(parsed.message?.usage, parsed.message?.model)
    if (!usage) return
    tracker.context = usage
    queue.push({ type: 'usage', usage, turnId })
    return
  }
  if (parsed.type !== 'result') return
  const totals = readUsage(parsed.usage)
  if (!totals) return
  queue.push({
    type: 'usage',
    usage: finalUsage(parsed, totals, tracker.context),
    final: true,
    turnId
  })
}

/**
 * Assembles the end-of-turn report out of its two halves: what the turn
 * produced (off the `result` line) and what the window holds (off the last
 * request's snapshot). With no snapshot at all — a turn of exactly one request,
 * whose `assistant` line some CLIs never print — the sums *are* that single
 * request, so falling back to them is exact rather than merely close.
 */
function finalUsage(
  parsed: StreamJsonLine,
  totals: TurnUsage,
  context: TurnUsage | null
): TurnUsage {
  const occupancy = context ?? totals
  return {
    inputTokens: occupancy.inputTokens,
    cacheReadTokens: occupancy.cacheReadTokens,
    cacheCreationTokens: occupancy.cacheCreationTokens,
    outputTokens: totals.outputTokens,
    model: context?.model,
    contextWindow: readContextWindow(parsed.modelUsage, context?.model),
    costUsd: optionalNumber(parsed.total_cost_usd),
    durationMs: optionalNumber(parsed.duration_ms),
    apiDurationMs: optionalNumber(parsed.duration_api_ms)
  }
}

/**
 * The window the CLI says it is running this model at (`modelUsage`), which is
 * the denominator the meter should divide by. Matched by the model name the
 * turn's own messages carried, so a turn that also ran a subagent on a second
 * model doesn't get the subagent's ceiling; with a single entry the name is
 * redundant and the entry is taken as-is.
 */
function readContextWindow(
  modelUsage: StreamJsonLine['modelUsage'],
  model: string | undefined
): number | undefined {
  if (!modelUsage || typeof modelUsage !== 'object') return undefined
  const entries = Object.entries(modelUsage)
  const match =
    (model !== undefined ? modelUsage[model] : undefined) ??
    (entries.length === 1 ? entries[0][1] : undefined)
  const window = match?.contextWindow
  return typeof window === 'number' && Number.isFinite(window) && window > 0 ? window : undefined
}

/** Everything an MCP server exposes is namespaced `mcp__<server>__<tool>`. */
const MCP_TOOL_PREFIX = 'mcp__'

/**
 * The comparison key for a server name (mcp-visibility).
 *
 * One server wears three spellings across the surfaces this app reads: the
 * config's own (`hive-approvals`), the CLI's tool namespace, which admits only
 * `[A-Za-z0-9_]` (`mcp__hive_approvals__approve`), and the log directory's
 * (`mcp-logs-hive-approvals`). Matching on the raw string therefore splits one
 * server into three, each with a fragment of the truth. Normalizing every
 * non-alphanumeric run to `_` collapses all three onto the same key.
 */
export function mcpServerKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
}

/** The CLI's status word, narrowed. An unrecognized word is `unknown`, never "fine". */
function readMcpStatus(value: unknown): McpServerStatus {
  if (typeof value !== 'string') return 'unknown'
  const word = value.trim().toLowerCase()
  if (word === 'connected') return 'connected'
  if (word === 'failed' || word === 'error') return 'failed'
  if (word === 'needs-auth' || word === 'needs_auth' || word === 'pending-auth') return 'needs-auth'
  if (word === 'pending' || word === 'connecting') return 'pending'
  return 'unknown'
}

/**
 * Buckets the turn's tool list by which server exposes each one, keyed by
 * {@link mcpServerKey}. A tool whose namespace matches no reported server is
 * dropped rather than inventing a server the CLI never mentioned.
 */
function mcpToolsByServer(tools: unknown): Map<string, string[]> {
  const byServer = new Map<string, string[]>()
  if (!Array.isArray(tools)) return byServer
  for (const entry of tools) {
    if (typeof entry !== 'string' || !entry.startsWith(MCP_TOOL_PREFIX)) continue
    const rest = entry.slice(MCP_TOOL_PREFIX.length)
    const split = rest.indexOf('__')
    if (split <= 0) continue
    const key = mcpServerKey(rest.slice(0, split))
    const tool = rest.slice(split + 2)
    if (tool === '') continue
    const bucket = byServer.get(key)
    if (bucket) bucket.push(tool)
    else byServer.set(key, [tool])
  }
  return byServer
}

/**
 * Reads the CLI's `system`/`init` line into the turn's MCP roster, or returns
 * null when the line isn't one (or carries no `mcp_servers` array at all — a
 * CLI build that doesn't report them must stay silent rather than claim the
 * user has none).
 *
 * Exported for its own test: this is a parse of somebody else's wire format,
 * and the failure mode of getting it wrong is a confident lie on screen.
 */
export function readMcpRoster(parsed: StreamJsonLine): McpServerReport[] | null {
  if (parsed.type !== 'system' || parsed.subtype !== 'init') return null
  if (!Array.isArray(parsed.mcp_servers)) return null
  const toolsByServer = mcpToolsByServer(parsed.tools)
  const servers: McpServerReport[] = []
  for (const entry of parsed.mcp_servers) {
    if (entry === null || typeof entry !== 'object') continue
    const name = (entry as { name?: unknown }).name
    if (typeof name !== 'string' || name.trim() === '') continue
    servers.push({
      name: name.trim(),
      status: readMcpStatus((entry as { status?: unknown }).status),
      tools: toolsByServer.get(mcpServerKey(name)) ?? []
    })
  }
  return servers
}

/** Claude tool names whose `input.file_path` attributes a workspace file change (Agent Change Review, ACR-C7). */
const FILE_EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

/**
 * The pre-edit image of a file a tool is about to change (agent-patch AP-C1).
 *
 * Read synchronously and on purpose: this runs inside the stdout line handler,
 * and an `await` here would let the *next* line's events be queued before this
 * one's, which reorders the transcript. The cost is bounded on both ends — only
 * the four file-editing tools reach it, and anything over
 * `MAX_SOURCE_BYTES` is refused before the read rather than after.
 *
 * Every failure — file doesn't exist yet (a `Write` creating one), a permission
 * error, a directory, a binary blob — is the same answer: `null`, meaning "diff
 * without line numbers". A patch the user can read beats a stack trace.
 */
function readPatchSource(path: string): string | null {
  try {
    if (statSync(path).size > MAX_SOURCE_BYTES) return null
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * The headline argument of a tool call, flattened to one line for the activity
 * row. Ordered by how tools are actually named in Claude's schema — the path
 * for file tools, the command for `Bash`, the pattern for search tools — with
 * a plain-string fallback so an unknown (or MCP) tool still shows *something*
 * rather than an empty row.
 */
export function toolDetailOf(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined
  for (const key of [
    'file_path',
    'path',
    'command',
    'pattern',
    'url',
    'query',
    'description',
    'prompt'
  ]) {
    const value = input[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim().split('\n')[0]
  }
  return undefined
}

/**
 * Routes one stdout line into the session's event queue, tagging every event
 * with the turn's `turnId` (background-turns: concurrent turns share one queue,
 * so identity on the event is what keeps their streams apart).
 *  - a changed `session_id` → `session` (persisted per conversation, handed
 *    back as `resume` on the next turn),
 *  - `stream_event` text deltas → `token` (true incremental streaming),
 *  - complete `assistant`/`result`/`user` objects → their *text* is ignored
 *    (it already streamed as deltas; re-emitting would duplicate every reply),
 *    but their `tool_use`/`tool_result` blocks become `tool` events and their
 *    `usage` blocks become `usage` events,
 *  - a non-JSON line → emitted verbatim as a `token` (defensive fallback so a
 *    CLI without stream-json degrades to plain output instead of vanishing).
 */
function handleStdoutLine(
  line: string,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  tracker: TurnTracker
): void {
  const trimmed = line.trim()
  if (trimmed === '') return
  let parsed: StreamJsonLine
  try {
    parsed = JSON.parse(trimmed) as StreamJsonLine
  } catch {
    queue.push({ type: 'token', text: line, turnId })
    return
  }
  if (typeof parsed.session_id === 'string' && parsed.session_id !== tracker.lastId) {
    tracker.lastId = parsed.session_id
    queue.push({ type: 'session', id: parsed.session_id, turnId })
  }
  if (
    parsed.type === 'stream_event' &&
    parsed.event?.type === 'content_block_delta' &&
    parsed.event.delta?.type === 'text_delta' &&
    typeof parsed.event.delta.text === 'string'
  ) {
    queue.push({ type: 'token', text: parsed.event.delta.text, turnId })
  }
  // The roster arrives on the CLI's very first line, before the agent has done
  // anything — so the UI can say which servers this turn got, and whether they
  // answered, while the turn is still starting rather than in hindsight.
  const roster = readMcpRoster(parsed)
  if (roster !== null) queue.push({ type: 'mcp', servers: roster, turnId })
  emitToolEvents(parsed, queue, turnId)
  emitUsageEvents(parsed, queue, turnId, tracker)
}

/**
 * The little state one turn's stdout stream carries between lines: the session
 * id already announced (so a re-mint is reported once, not per line), and the
 * newest per-request token snapshot, which is what `result` lines are missing
 * (see `emitUsageEvents`). Scoped to `pipeTurn` — one process, one turn — so
 * concurrent turns never read each other's numbers.
 */
interface TurnTracker {
  lastId: string | null
  context: TurnUsage | null
}

/**
 * Emits the `tool` half of the stream (agent-activity + ACR-C7 attribution):
 * a `start` per `tool_use` block on a complete `assistant` message, and an
 * `end` per `tool_result` block on the `user` message that answers it, paired
 * by the CLI's own `tool_use.id`.
 *
 * Every tool is reported, not just the file-editing ones: reading, searching
 * and running commands is most of what the agent does, and a UI that only knew
 * about writes showed a silent gap for all of it. `filePath` stays reserved
 * for the file-editing tools so change attribution keeps consuming paths only.
 * Text blocks are ignored (they already streamed as deltas); this never
 * affects token streaming.
 */
function emitToolEvents(
  parsed: StreamJsonLine,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined
): void {
  const blocks = parsed.message?.content
  if (!Array.isArray(blocks)) return
  if (parsed.type === 'assistant') {
    for (const block of blocks) {
      if (block.type !== 'tool_use' || typeof block.name !== 'string') continue
      const filePath =
        FILE_EDIT_TOOLS.has(block.name) && typeof block.input?.file_path === 'string'
          ? block.input.file_path
          : undefined
      queue.push({
        type: 'tool',
        name: block.name,
        detail: toolDetailOf(block.input),
        toolId: block.id,
        phase: 'start',
        filePath,
        // The change itself, diffed against the file as it stands right now —
        // the CLI has not run the tool yet (agent-patch AP-C1).
        patch: buildToolPatch(block.name, block.input, readPatchSource),
        turnId
      })
    }
    return
  }
  if (parsed.type === 'user') {
    for (const block of blocks) {
      if (block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue
      queue.push({
        type: 'tool',
        // The result block doesn't repeat the tool's name; the UI already has
        // it from the `start` it pairs with via `toolId`.
        name: '',
        toolId: block.tool_use_id,
        phase: 'end',
        ok: block.is_error !== true,
        turnId
      })
    }
  }
}

/**
 * Pipes one spawned turn's `ProcessHandle` into the session's shared event
 * queue: stdout is consumed as line-buffered stream-json, stderr is collected
 * as error context (never rendered into the transcript), then exactly one
 * terminal event — `done` (clean exit), `interrupted` (a deliberate user
 * `stop()`/`interrupt()` killed it), or `error` (unexpected exit/signal, with
 * the stderr tail appended). Partial `token`s already delivered are unaffected.
 */
async function pipeTurn(
  handle: ProcessHandle,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  wasInterrupted: () => boolean,
  errorLabel: string
): Promise<void> {
  const tracker: TurnTracker = { lastId: null, context: null }
  let stdoutRest = ''
  let stderrTail = ''
  for await (const chunk of handle.output) {
    if (chunk.stream === 'stderr') {
      stderrTail = (stderrTail + chunk.data).slice(-500)
      continue
    }
    stdoutRest += chunk.data
    const lines = stdoutRest.split('\n')
    stdoutRest = lines.pop() ?? ''
    for (const line of lines) {
      handleStdoutLine(line, queue, turnId, tracker)
    }
  }
  handleStdoutLine(stdoutRest, queue, turnId, tracker)
  const result = await handle.exitCode
  if (wasInterrupted()) {
    queue.push({ type: 'interrupted', turnId })
  } else if (result.code === 0) {
    queue.push({ type: 'done', turnId })
  } else if (result.signal) {
    queue.push({
      type: 'error',
      message: `${errorLabel} was terminated by signal ${result.signal}`,
      turnId
    })
  } else {
    const detail = stderrTail.trim()
    queue.push({
      type: 'error',
      message: `${errorLabel} exited with code ${result.code}${detail ? `: ${detail}` : ''}`,
      turnId
    })
  }
}

/**
 * Builds an `AgentSession` for a one-shot-per-turn CLI adapter. Shared by
 * every adapter (see file header); the `config` is the only per-adapter input.
 */
export function createCliAgentSession(
  processRunner: ProcessRunner,
  opts: SessionOpts,
  config: CliAdapterConfig
): AgentSession {
  const queue = createAgentEventQueue()
  // Every in-flight turn's handle, keyed by its caller turnId (or an internal
  // key when none was given). One process per turn; background-turns means
  // several can run concurrently, so this is a map, not a single handle.
  const activeHandles = new Map<string, ProcessHandle>()
  // Handles a user interrupt/stop killed, so `pipeTurn` can distinguish a
  // deliberate interrupt (emit `interrupted`) from a real failure (emit `error`).
  const interruptedHandles = new Set<ProcessHandle>()
  let anonymousTurnCounter = 0

  function spawnTurn(prompt: string, turnOpts: TurnOpts | undefined): void {
    const model = turnOpts?.model ?? opts.model
    const effort = turnOpts?.effort ?? opts.effort
    const resume = turnOpts?.resume
    const turnId = turnOpts?.turnId
    anonymousTurnCounter += 1
    const handleKey = turnId ?? `anon-${anonymousTurnCounter}`
    const handle = processRunner.run(
      config.command,
      config.buildArgs(prompt, { model, effort, resume, turnId }),
      {
        cwd: opts.workspace,
        env: config.buildEnv?.(),
        // agent-terminal (AT-R3): the agent's turn is the one spawn that runs
        // inside the user's chosen terminal. With nothing chosen the runner
        // spawns exactly as it always did.
        shell: true
      }
    )
    activeHandles.set(handleKey, handle)
    void pipeTurn(
      handle,
      queue,
      turnId,
      () => interruptedHandles.has(handle),
      config.errorLabel
    ).then(() => {
      if (activeHandles.get(handleKey) === handle) {
        activeHandles.delete(handleKey)
      }
      interruptedHandles.delete(handle)
    })
  }

  /** Marks a handle as deliberately killed (its terminal event becomes `interrupted`, not `error`), then kills it. */
  function killAsInterrupt(handle: ProcessHandle): void {
    interruptedHandles.add(handle)
    handle.kill()
  }

  return {
    send(input: AgentInput): void {
      spawnTurn(composeTurnPrompt(input.text, input.attachments), input)
    },
    events: queue,
    runWorkflow(cmd: WorkflowCommand, turnOpts?: TurnOpts): void {
      // No explicit prompt → invoke the skill by its slash command, the same
      // thing the user would type in the composer.
      const prompt = cmd.prompt ?? `/${cmd.key}`
      spawnTurn(composeTurnPrompt(prompt, turnOpts?.attachments), turnOpts)
    },
    interrupt(turnId?: string): void {
      if (turnId !== undefined) {
        const handle = activeHandles.get(turnId)
        if (handle) killAsInterrupt(handle)
        return
      }
      for (const handle of activeHandles.values()) killAsInterrupt(handle)
    },
    stop(): void {
      for (const handle of activeHandles.values()) killAsInterrupt(handle)
    }
  }
}
