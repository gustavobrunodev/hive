import { readFileSync, statSync } from 'fs'
import type { ProcessHandle, ProcessRunner } from './processRunner'
import { buildToolOutput, buildToolParams } from './toolDetails'
import { buildToolPatch, MAX_SOURCE_BYTES } from './toolPatch'
import {
  composeTurnPrompt,
  createAgentEventQueue,
  type AgentEvent,
  type AgentInput,
  type AgentSession,
  type CompactEvent,
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
  /**
   * aws-bedrock: a gate the turn must pass **before** its process is spawned.
   *
   * Exists because one CLI (Claude, pointed at Amazon Bedrock) has a
   * precondition that lives outside itself: a cached AWS SSO session that
   * expires roughly daily. The CLI's own repair for that shells out to
   * `aws sso login`, which needs a terminal a desktop app cannot give it — so
   * it fails, and the turn dies with the repair's error rather than the
   * problem's.
   *
   * Doing it here, rather than at each of the four call sites that can start a
   * turn, is what makes it total: the composer, the queue, a workflow command
   * and a background turn all arrive through `spawnTurn`.
   *
   * The contract is deliberately narrow. It resolves `{ ok: true }` — usually
   * instantly, from a file read — and the turn proceeds exactly as before. It
   * resolves `{ ok: false }` and the turn ends as an error with that message,
   * having spawned nothing. `emit` lets it narrate into the turn's own event
   * stream while it works, which is what turns "the app hung for forty seconds"
   * into a visible, cancellable login.
   */
  preflight?(context: {
    turnId: string | undefined
    emit: (event: AgentEvent) => void
  }): Promise<{ ok: true } | { ok: false; message: string }>
  /**
   * Whether a failed turn should be retried **once, without its `--resume`
   * handle**, given the CLI's own error text.
   *
   * The one case it is for: `No conversation found with session ID: …`. A
   * session id Hive stored is only as alive as the CLI's transcript store, and
   * a turn that died before the CLI ever wrote that conversation leaves a
   * handle that fails every subsequent turn — the conversation is bricked, and
   * the message the user sees names a UUID they have no way to connect to
   * anything. Retrying without it costs one spawn and silently restores the
   * conversation; the CLI reports a fresh session id, which is adopted the
   * usual way.
   *
   * Only ever consulted for a turn that produced **no output at all**, so a
   * retry can never duplicate text already streamed into the transcript.
   */
  retryWithoutResume?(detail: string): boolean
  /**
   * Rewrites a failed turn's message when the CLI's own text names a cause the
   * app can explain better.
   *
   * The reported failure is the case for it, verbatim:
   *
   * ```
   * claude exited with code 1: Warning: MCP server blocked by enterprise
   * policy: hive_approvals Error running awsAuthRefresh (in settings or
   * ~/.claude.json): No conversation found with session ID: 8d2c3ac9-…
   * ```
   *
   * Three unrelated facts in one sentence, none of which is the true one — the
   * AWS session expired. Returning a short **code** (never a translated
   * sentence: main holds no copy) lets the chat draw a card with the repair on
   * it. `null` keeps the CLI's own words, which stay the right answer for
   * everything the app cannot improve on.
   */
  describeFailure?(detail: string): string | null
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
      /**
       * `tool_result` only: what the call answered. A string, or the same
       * content-block list a message body uses (agent-tool-details).
       */
      content?: unknown
    }>
    /** Per-message token accounting — a live snapshot of context occupancy. */
    usage?: StreamJsonUsage
  }
  /**
   * `system`/`compact_boundary` only: what the CLI's own compaction did
   * (context-compaction). Measured on `claude 2.1.x`, print mode, by running
   * `claude -p "/compact" --resume <id>`: the line arrives *after* the fact,
   * the session id is unchanged, and the counts are the CLI's own.
   */
  compact_metadata?: {
    trigger?: string
    pre_tokens?: number
    post_tokens?: number
    duration_ms?: number
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

/**
 * Strips ANSI/VT control sequences from one line of a CLI's plain-text output.
 *
 * Not defensive programming: `devin` emits `\x1b[?2004l` (bracketed-paste off)
 * on its way out, and a transcript is a place where an escape byte renders as
 * garbage rather than as color. Covers CSI (`ESC [ … final`), OSC (`ESC ] …
 * BEL|ST`) and the two-character escapes; anything it does not recognise is
 * left alone, because dropping bytes we do not understand would be a second,
 * quieter way to mangle a reply.
 */
export function stripAnsi(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- stripping control bytes is the point
      .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
      // eslint-disable-next-line no-control-regex -- idem
      .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, '')
      // eslint-disable-next-line no-control-regex -- idem
      .replace(/\u001B[@-Z\\-_]/g, '')
  )
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
 * A `system`/`compact_boundary` line → a `compact` event, or `null`.
 *
 * Only `end` is ever emitted here, and that is not an omission: in print mode
 * the CLI reports the boundary once the compaction has already happened, so
 * there is no moment at which a `start` would be true. A surface that waited
 * for one would wait forever — which is why the contract says a `start` may
 * never come.
 *
 * `trigger` is passed through rather than assumed. `manual` is what a
 * `/compact` turn produces; the CLI uses the same line for its own threshold,
 * and treating that as manual would put "você compactou" under something the
 * user never did.
 */
function readCompactBoundary(
  parsed: StreamJsonLine,
  turnId: string | undefined
): CompactEvent | null {
  if (parsed.type !== 'system' || parsed.subtype !== 'compact_boundary') return null
  const meta = parsed.compact_metadata ?? {}
  return {
    type: 'compact',
    phase: 'end',
    trigger: meta.trigger === 'auto' ? 'auto' : 'manual',
    ...(typeof meta.pre_tokens === 'number' ? { preTokens: meta.pre_tokens } : {}),
    ...(typeof meta.post_tokens === 'number' ? { postTokens: meta.post_tokens } : {}),
    ...(typeof meta.duration_ms === 'number' ? { durationMs: meta.duration_ms } : {}),
    turnId
  }
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
 *  - a non-JSON line → emitted as a `token` **with its newline put back**
 *    (see below).
 *
 * ## Why the raw fallback re-adds the newline
 *
 * The defect this closes: a Devin reply arrived in the transcript as one
 * unbroken run-on paragraph — headings, bullets and fenced code all welded
 * onto the same line. Devin (and Copilot outside a Claude model) does not
 * speak `stream-json`; it prints ordinary markdown, and this function was
 * splitting that stdout on `\n`, **dropping the separator**, then dropping
 * every blank line as "empty". Markdown is defined by exactly those two
 * characters: no newline is no list, no blank line is no paragraph. Measured
 * against the real `devin 3000.6.14`, whose `-p` output is clean UTF-8
 * markdown with `\n` and blank lines throughout.
 *
 * So a stream that has never produced a JSON line is treated as prose and its
 * line structure is preserved verbatim; the moment one JSON line parses, the
 * stream is structured and blank lines go back to being noise between records.
 * ANSI is stripped on that same path — a CLI that paints its output (Devin's
 * bracketed-paste guard, `\x1b[?2004l`, is the one measured here) must not put
 * escape bytes into the transcript.
 */
function handleStdoutLine(
  line: string,
  queue: ReturnType<typeof createAgentEventQueue>,
  turnId: string | undefined,
  tracker: TurnTracker
): void {
  const trimmed = line.trim()
  if (trimmed === '') {
    // A blank line is structure in prose and noise between JSON records.
    if (!tracker.structured) queue.push({ type: 'token', text: '\n', turnId })
    return
  }
  let parsed: StreamJsonLine
  try {
    parsed = JSON.parse(trimmed) as StreamJsonLine
  } catch {
    queue.push({ type: 'token', text: `${stripAnsi(line)}\n`, turnId })
    return
  }
  tracker.structured = true
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
  const compaction = readCompactBoundary(parsed, turnId)
  if (compaction !== null) queue.push(compaction)
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
  /**
   * Whether this stream has ever produced a parseable JSON line. It decides
   * how the raw fallback treats blank lines — structure in prose, noise
   * between records — and it is one-way: a structured stream that emits a
   * stray non-JSON line (a warning banner) stays structured.
   */
  structured: boolean
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
      // The change itself, diffed against the file as it stands right now —
      // the CLI has not run the tool yet (agent-patch AP-C1).
      const patch = buildToolPatch(block.name, block.input, readPatchSource)
      queue.push({
        type: 'tool',
        name: block.name,
        detail: toolDetailOf(block.input),
        toolId: block.id,
        phase: 'start',
        filePath,
        patch,
        // The whole call, not just its headline (agent-tool-details). The row
        // shows one truncated line; this is what the user opens it to read.
        params: buildToolParams(block.input, patch !== undefined),
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
        // What came back (agent-tool-details). On a failed call this *is* the
        // error message, which is the one thing the row could never say.
        output: buildToolOutput(block.content),
        turnId
      })
    }
  }
}

/**
 * One in-flight turn: its process, its id, and the two facts every other part
 * of this file needs to agree on about it.
 *
 * `settled` is the important one. Exactly one terminal event may ever be
 * pushed for a turn, and after an interrupt that event has *already* been
 * pushed — synchronously, at the moment the user clicked — so everything the
 * dying process still says on its way out has to be dropped rather than
 * appended to a transcript the UI has already closed.
 */
interface TurnRun {
  /**
   * `null` until the process exists. A turn can now be interrupted *before*
   * it spawns — it may be sitting in `preflight`, waiting on a browser login —
   * and Stop has to work there too.
   */
  handle: ProcessHandle | null
  turnId: string | undefined
  /** The user asked for this — its terminal event is `interrupted`, never `error`. */
  interrupted: boolean
  /** A terminal event has been pushed; nothing further may be pushed for this turn. */
  settled: boolean
}

/**
 * Pipes one spawned turn's `ProcessHandle` into the session's shared event
 * queue: stdout is consumed as line-buffered stream-json, stderr is collected
 * as error context (never rendered into the transcript), then exactly one
 * terminal event — `done` (clean exit), `interrupted` (a deliberate user
 * `stop()`/`interrupt()` killed it), or `error` (unexpected exit/signal, with
 * the stderr tail appended). Partial `token`s already delivered are unaffected.
 *
 * A turn already settled by `interrupt()` produces neither content nor a
 * second terminal event from here, however long the process takes to actually
 * die — and it may take a while, or never finish at all if a grandchild is
 * holding the pipe. That is the whole point: settling is not allowed to depend
 * on a process that has just been told it is no longer wanted.
 */
async function pipeTurn(
  run: TurnRun,
  handle: ProcessHandle,
  queue: ReturnType<typeof createAgentEventQueue>,
  errorLabel: string,
  shouldRetry?: (detail: string) => boolean,
  describeFailure?: (detail: string) => string | null
): Promise<TurnOutcome> {
  const { turnId } = run
  let produced = false
  const tracker: TurnTracker = { lastId: null, context: null, structured: false }
  let stdoutRest = ''
  let stderrTail = ''
  for await (const chunk of handle.output) {
    if (run.settled) continue
    if (chunk.stream === 'stderr') {
      stderrTail = (stderrTail + chunk.data).slice(-500)
      continue
    }
    stdoutRest += chunk.data
    produced = true
    const lines = stdoutRest.split('\n')
    stdoutRest = lines.pop() ?? ''
    for (const line of lines) {
      handleStdoutLine(line, queue, turnId, tracker)
    }
  }
  if (run.settled) return 'settled'
  // Only when there IS a trailing partial line: an empty tail through the raw
  // path would append one phantom newline to every prose turn.
  if (stdoutRest !== '') handleStdoutLine(stdoutRest, queue, turnId, tracker)
  const result = await handle.exitCode
  if (run.settled) return 'settled'
  return settleAttempt(run, queue, {
    result,
    errorLabel,
    detail: stderrTail.trim(),
    produced,
    ...(shouldRetry ? { shouldRetry } : {}),
    ...(describeFailure ? { describeFailure } : {})
  })
}

/**
 * Turns one finished attempt into exactly one terminal event — or into a
 * request to try again.
 *
 * Split out of `pipeTurn` because it is the whole decision: five outcomes
 * (stopped by the user, clean exit, killed by a signal, recoverable failure,
 * real failure) that the streaming loop above has no business being
 * interleaved with.
 */
function settleAttempt(
  run: TurnRun,
  queue: ReturnType<typeof createAgentEventQueue>,
  attempt: {
    result: { code: number | null; signal: NodeJS.Signals | null }
    errorLabel: string
    detail: string
    /** Whether this attempt streamed anything — a retry may never duplicate text. */
    produced: boolean
    shouldRetry?: (detail: string) => boolean
    describeFailure?: (detail: string) => string | null
  }
): TurnOutcome {
  const { turnId } = run
  const { result, errorLabel, detail, produced } = attempt
  if (run.interrupted) {
    run.settled = true
    queue.push({ type: 'interrupted', turnId })
    return 'settled'
  }
  if (result.code === 0) {
    run.settled = true
    queue.push({ type: 'done', turnId })
    return 'settled'
  }
  if (result.signal) {
    run.settled = true
    queue.push({
      type: 'error',
      message: `${errorLabel} was terminated by signal ${result.signal}`,
      turnId
    })
    return 'settled'
  }
  // The recoverable failure (a dead `--resume` handle) leaves the turn
  // **unsettled** on purpose: the caller re-spawns into the same run, and a
  // terminal event pushed here would have closed a turn that is about to
  // produce a real answer.
  if (!produced && attempt.shouldRetry?.(detail)) return 'retry'
  run.settled = true
  queue.push({
    type: 'error',
    message:
      attempt.describeFailure?.(detail) ??
      `${errorLabel} exited with code ${result.code}${detail ? `: ${detail}` : ''}`,
    turnId
  })
  return 'settled'
}

/** What one attempt at a turn ended as. `retry` is the only non-terminal one. */
type TurnOutcome = 'settled' | 'retry'

/**
 * How long a turn gets to honour SIGTERM before it is taken out with SIGKILL.
 *
 * Short on purpose. Nothing is waiting on the graceful exit any more — the UI
 * settled the turn the instant Stop was pressed — so this window buys only the
 * CLI's own cleanup, and a CLI that has not finished cleaning up in two
 * seconds is a CLI that is still spending the user's tokens.
 */
const KILL_ESCALATION_MS = 2000

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
  // Every in-flight turn, keyed by its caller turnId (or an internal key when
  // none was given). One process per turn; background-turns means several can
  // run concurrently, so this is a map, not a single handle.
  const activeRuns = new Map<string, TurnRun>()
  let anonymousTurnCounter = 0

  /** Spawns one attempt of a turn. Separate from `driveTurn` because a
   *  recoverable failure re-enters it with a different `resume`. */
  function spawnAttempt(
    prompt: string,
    turn: { model?: string; effort?: string; resume?: string | null; turnId?: string }
  ): ProcessHandle {
    return processRunner.run(config.command, config.buildArgs(prompt, turn), {
      cwd: opts.workspace,
      env: config.buildEnv?.(),
      // agent-terminal (AT-R3): the agent's turn is the one spawn that runs
      // inside the user's chosen terminal. With nothing chosen the runner
      // spawns exactly as it always did.
      shell: true,
      // …which is precisely why the turn also needs its own process group.
      // POSIX gets away with `exec` (the shell becomes the CLI), but Windows
      // has no exec: there the turn is cmd.exe → claude.cmd → node, and a
      // kill aimed at the shell left the agent running. See
      // RunOptions.processGroup for the full account.
      processGroup: true
    })
  }

  /**
   * One turn, from gate to terminal event.
   *
   * Three things happen here that used to be a single `processRunner.run`, and
   * each one exists because of a real failure:
   *
   *  1. **The gate runs first** (`config.preflight`), so a Bedrock turn whose
   *     AWS session died overnight logs the user back in instead of spawning a
   *     CLI that will fail in two seconds with somebody else's error message.
   *  2. **Interruption is checked around every await.** The turn can now be
   *     stopped while it has no process at all — during that login — and Stop
   *     must settle it rather than spawn into a cancelled request.
   *  3. **One recoverable retry** (`config.retryWithoutResume`), for a
   *     `--resume` handle the CLI no longer recognises.
   */
  async function driveTurn(
    run: TurnRun,
    handleKey: string,
    prompt: string,
    turn: { model?: string; effort?: string; resume?: string | null; turnId?: string }
  ): Promise<void> {
    try {
      if (config.preflight) {
        const verdict = await config.preflight({
          turnId: turn.turnId,
          emit: (event) => queue.push(event)
        })
        // Stop pressed while the gate was open: `interruptRun` already pushed
        // the terminal event, so this only has to not spawn.
        if (run.settled || run.interrupted) return
        if (!verdict.ok) {
          run.settled = true
          queue.push({ type: 'error', message: verdict.message, turnId: turn.turnId })
          return
        }
      }
      let resume = turn.resume ?? null
      // At most two attempts, and the second only ever drops `--resume`.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (run.settled || run.interrupted) return
        const handle = spawnAttempt(prompt, { ...turn, resume })
        run.handle = handle
        const outcome = await pipeTurn(
          run,
          handle,
          queue,
          config.errorLabel,
          // Only the first attempt may ask for a retry, and only when there
          // was a handle to blame in the first place.
          attempt === 0 && resume ? config.retryWithoutResume : undefined,
          config.describeFailure
        )
        if (outcome === 'settled') return
        resume = null
      }
    } finally {
      if (activeRuns.get(handleKey) === run) activeRuns.delete(handleKey)
    }
  }

  function spawnTurn(prompt: string, turnOpts: TurnOpts | undefined): void {
    const model = turnOpts?.model ?? opts.model
    const effort = turnOpts?.effort ?? opts.effort
    const resume = turnOpts?.resume
    const turnId = turnOpts?.turnId
    anonymousTurnCounter += 1
    const handleKey = turnId ?? `anon-${anonymousTurnCounter}`
    const run: TurnRun = { handle: null, turnId, interrupted: false, settled: false }
    activeRuns.set(handleKey, run)
    void driveTurn(run, handleKey, prompt, { model, effort, resume, turnId })
  }

  /**
   * Stops one turn, from the user's side.
   *
   * The order matters, and it is not the obvious one: the turn is **settled
   * first** and killed second. Waiting for the process to die before telling
   * the UI anything is what made Stop look broken — a CLI that ignores SIGTERM,
   * or a grandchild still holding the stdout pipe, and the transcript sits
   * "respondendo" indefinitely with the button doing nothing visible. Nothing
   * about "the user is done with this turn" depends on the process agreeing, so
   * nothing here waits for it.
   *
   * The kill still happens, twice if it has to: SIGTERM for the CLI's own
   * cleanup, then SIGKILL if it is still alive shortly after. The escalation
   * timer is unref'd — it must never be the reason the app stays awake.
   */
  function interruptRun(run: TurnRun): void {
    run.interrupted = true
    if (!run.settled) {
      run.settled = true
      queue.push({ type: 'interrupted', turnId: run.turnId })
    }
    // No process yet — the turn is in its preflight gate (an AWS login, say).
    // Settling it above is the whole job; `driveTurn` sees `interrupted` and
    // never spawns.
    const handle = run.handle
    if (!handle) return
    handle.kill()
    const escalation = setTimeout(() => handle.kill('SIGKILL'), KILL_ESCALATION_MS)
    escalation.unref?.()
    void handle.exitCode.then(() => clearTimeout(escalation))
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
        const run = activeRuns.get(turnId)
        if (run) interruptRun(run)
        return
      }
      for (const run of activeRuns.values()) interruptRun(run)
    },
    stop(): void {
      for (const run of activeRuns.values()) interruptRun(run)
    }
  }
}
