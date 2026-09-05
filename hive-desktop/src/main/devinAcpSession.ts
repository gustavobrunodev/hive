import { readFile, writeFile } from 'fs/promises'
import { createAcpClient, type AcpClient } from './acpClient'
import { isUsableCwd, type ProcessRunner } from './processRunner'
import {
  composeTurnPrompt,
  createAgentEventQueue,
  isCompactTurn,
  type AgentAdapterDeps,
  type AgentInput,
  type AgentSession,
  type SessionOpts,
  type TurnOpts,
  type TurnUsage,
  type WorkflowCommand
} from './agentAdapter'
import { asRecord, asText } from './modelCatalog'

/**
 * Devin, driven as a **live session** over ACP instead of one process per
 * message.
 *
 * `acpClient.ts` explains why (and the numbers). This module is the mapping:
 * ACP's `session/update` stream in, Hive's `AgentEvent`s out. The shapes below
 * are all measured against the real `devin 3000.6.14` — the protocol's
 * Cognition extensions are not published, so nothing here is inferred from
 * documentation.
 *
 * ## The methods this speaks, and what each is for
 *
 *   `initialize`                 handshake; declares what *we* can do for the
 *                                agent. Load-bearing: see `fs/*` below.
 *   `session/new`                opens the session, answers `sessionId` plus
 *                                the mode + model config options.
 *   `session/load`               re-attaches to a session id from a previous
 *                                app run (`loadSession: true`).
 *   `session/prompt`             one turn. Resolves with `stopReason` + usage.
 *   `session/set_config_option`  changes the model — the field is `configId`,
 *                                not `configOptionId` (the CLI rejects that
 *                                one as a missing field).
 *   `session/set_mode`           Code / Smart / Ask / Plan / Bypass.
 *   `session/cancel`             a **notification**, not a request. Sent as a
 *                                request it answers "Method not found", which
 *                                is how this was discovered.
 *
 * ## Why `fs/*` is answered here rather than declared away
 *
 * A client that advertises `fs.readTextFile` **must** answer
 * `fs/read_text_file`, and an unanswered one does not fail — it hangs, with
 * the turn parked forever on a file read. (Measured: the first probe of this
 * protocol stalled exactly there.) Answering is still the right side of the
 * trade: it routes the agent's reads and writes through this process, which is
 * what lets the rest of the app see them.
 */

/** ACP's own protocol version. Bumping this is a deliberate act, not a default. */
const PROTOCOL_VERSION = 1

/** One `session/update` payload, in the shapes this module actually reads. */
interface SessionUpdate {
  sessionUpdate?: string
  content?: { type?: string; text?: string }
  toolCallId?: string
  title?: string
  kind?: string
  status?: string
  rawInput?: unknown
  locations?: { path?: string }[]
  used?: number
  size?: number
  _meta?: Record<string, unknown>
}

/** What `session/prompt` resolves with. */
interface PromptResult {
  stopReason?: string
  usage?: Record<string, unknown>
}

/** What `session/new` / `session/load` answer with. */
interface NewSessionResult {
  sessionId?: string
  modes?: { currentModeId?: string }
}

/**
 * Maps ACP's tool `kind` onto the tool names Hive's transcript already knows
 * how to draw, so a Devin read looks like a Claude read rather than inventing
 * a second vocabulary for the same act. An unmapped kind keeps the agent's own
 * title, which is always human-readable.
 */
const TOOL_NAMES: Record<string, string> = {
  read: 'Read',
  edit: 'Edit',
  delete: 'Delete',
  move: 'Move',
  search: 'Grep',
  execute: 'Bash',
  think: 'Think',
  fetch: 'WebFetch'
}

/** Number out of an unknown, or `undefined` — usage arithmetic must never NaN. */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Devin's usage report → Hive's `TurnUsage`.
 *
 * The token split lives under Cognition's `_meta` keys on the stream's
 * `usage_update`, and under plain names on the `session/prompt` result. Both
 * are read, because they are the same numbers arriving by two routes and a
 * turn that ends without a final report shows no receipt at all.
 */
function toUsage(
  source: Record<string, unknown> | undefined,
  meta?: Record<string, unknown>
): TurnUsage | null {
  if (!source && !meta) return null
  const pick = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = numberOf(source?.[key]) ?? numberOf(meta?.[key])
      if (value !== undefined) return value
    }
    return undefined
  }
  const input = pick('inputTokens', 'cognition.ai/inputTokens')
  const output = pick('outputTokens', 'cognition.ai/outputTokens')
  const cacheRead = pick('cachedReadTokens', 'cognition.ai/cachedReadTokens')
  const cacheWrite = pick('cachedWriteTokens', 'cognition.ai/cachedWriteTokens')
  if (input === undefined && output === undefined && cacheRead === undefined) return null
  return {
    inputTokens: input ?? 0,
    cacheReadTokens: cacheRead ?? 0,
    cacheCreationTokens: cacheWrite ?? 0,
    outputTokens: output ?? 0
  }
}

/** The headline argument for a tool row: the first path, else the raw command. */
function toolDetail(update: SessionUpdate): string | undefined {
  const path = update.locations?.[0]?.path
  if (typeof path === 'string' && path !== '') return path
  const raw = asRecord(update.rawInput)
  const command = asText(raw?.command) ?? asText(raw?.query) ?? asText(raw?.pattern)
  return command ?? undefined
}

export interface DevinAcpSessionOptions {
  /** The binary to run in ACP mode. Injected so tests can point at a script. */
  command?: string
}

/**
 * Opens a Devin session that stays alive across turns.
 *
 * The ACP process is started **lazily**, on the first turn rather than at
 * construction, because `AgentService` creates a session object as soon as a
 * conversation is selected — starting a Devin process there would spend a
 * subprocess (and the user's MCP servers) on every glance at the chat.
 */
export function createDevinAcpSession(
  processRunner: ProcessRunner,
  opts: SessionOpts,
  deps?: AgentAdapterDeps & DevinAcpSessionOptions
): AgentSession {
  const queue = createAgentEventQueue()
  const command = deps?.command ?? 'devin'

  /** The live connection, or `null` before the first turn / after a failure. */
  let client: AcpClient | null = null
  /** Devin's own session id for the live connection. */
  let acpSessionId: string | null = null
  /** The model currently in force on the connection, so we only set it on change. */
  let appliedModel: string | null = null
  /** The turn currently being prompted — every event is tagged with it. */
  let activeTurnId: string | undefined
  /** Set while a turn is being cancelled, so it settles as `interrupted`. */
  let cancelling = false
  let stopped = false
  /** Serializes turns: ACP runs one prompt per session at a time. */
  let chain: Promise<void> = Promise.resolve()

  /** Tool ids seen this turn, so an `end` is only emitted for a `start` we sent. */
  const openTools = new Set<string>()

  /**
   * Where this session is in a compaction (context-compaction), which is what
   * lets the CLI's own progress chatter be kept out of the transcript.
   *
   * Measured against the real `devin 3000.6.14`: a compaction emits, in order,
   * a display-flagged chunk "Compacting context…", the
   * `cognition.ai/compaction` notification `started`, then `completed` (with
   * the summary), then one last display-flagged chunk "Context compacted".
   * Those two chunks are the CLI narrating itself — Hive draws the seam
   * instead — so `settling` exists purely to swallow the trailing one. Matching
   * on the English sentences would break on the next release; matching on the
   * *window* the agent itself declares does not.
   */
  let compactionPhase: 'idle' | 'running' | 'settling' = 'idle'
  /**
   * Whether the compaction now in flight is one somebody asked for.
   *
   * Devin's notification never says. This session does know, because it saw the
   * prompt: a `/compact` turn sets this, and anything else that compacts is the
   * agent minding its own ceiling. Getting it wrong would put "você compactou"
   * under something the user never did.
   */
  let compactionTrigger: 'manual' | 'auto' = 'auto'

  /** The tool name a call is drawn under: ACP's `kind`, else the agent's title. */
  function toolName(update: SessionUpdate): string {
    return TOOL_NAMES[update.kind ?? ''] ?? update.title ?? 'Tool'
  }

  /** Text out of a chunk update, or `null` when there is nothing to emit. */
  function chunkText(update: SessionUpdate): string | null {
    const text = update.content?.text
    return typeof text === 'string' && text !== '' ? text : null
  }

  /** `tool_call` → one activity row opening. */
  function openTool(update: SessionUpdate, turnId: string | undefined): void {
    const id = update.toolCallId
    if (typeof id !== 'string') return
    openTools.add(id)
    const detail = toolDetail(update)
    queue.push({
      type: 'tool',
      name: toolName(update),
      toolId: id,
      phase: 'start',
      ...(detail ? { detail } : {}),
      turnId
    })
  }

  /**
   * `tool_call_update` → that row settling.
   *
   * `in_progress` is a status change, not a completion, and closing the row on
   * it would settle every tool the instant it started.
   */
  function closeTool(update: SessionUpdate, turnId: string | undefined): void {
    const id = update.toolCallId
    if (typeof id !== 'string' || !openTools.has(id)) return
    if (update.status !== 'completed' && update.status !== 'failed') return
    openTools.delete(id)
    queue.push({
      type: 'tool',
      name: toolName(update),
      toolId: id,
      phase: 'end',
      ok: update.status === 'completed',
      turnId
    })
  }

  /**
   * One `session/update` → zero or one `AgentEvent`.
   *
   * A table rather than a switch: the update vocabulary is Cognition's and
   * grows on their release schedule, so the shape that costs least to extend
   * is the one where a new entry is a new line. Anything absent from it —
   * modes, titles, command lists, plans — is deliberately ignored: an unknown
   * update is news we do not draw yet, never an error.
   */
  const UPDATE_HANDLERS: Record<string, (u: SessionUpdate, turnId?: string) => void> = {
    agent_message_chunk: (update, turnId) => {
      const text = chunkText(update)
      if (text === null) return
      if (isCompactionChatter(update)) return
      queue.push({ type: 'token', text, turnId })
    },
    // The answer to "sempre aparece Iniciando": Devin thinks for seconds
    // before it writes anything, and this is the only signal that exists
    // during that window. Its own event, so the transcript can show reasoning
    // as reasoning instead of splicing it into the reply.
    agent_thought_chunk: (update, turnId) => {
      const text = chunkText(update)
      if (text) queue.push({ type: 'thought', text, turnId })
    },
    tool_call: openTool,
    tool_call_update: closeTool,
    usage_update: (update, turnId) => {
      const usage = toUsage(undefined, update._meta)
      if (usage) queue.push({ type: 'usage', usage, turnId })
    }
  }

  /**
   * Is this chunk the CLI narrating its own compaction rather than the agent
   * talking? True only inside the window the agent itself declared, and only
   * for chunks it flagged as display chrome — so ordinary prose that happens to
   * arrive mid-compaction still reaches the transcript.
   */
  function isCompactionChatter(update: SessionUpdate): boolean {
    if (compactionPhase === 'idle') return false
    if (update._meta?.['cognition.ai/displayMessage'] !== true) return false
    if (compactionPhase === 'settling') compactionPhase = 'idle'
    return true
  }

  /**
   * `cognition.ai/compaction` → the seam the transcript draws.
   *
   * The counts Claude reports have no equivalent here — Devin hands over a
   * prose summary and nothing else — so the event carries what exists and the
   * renderer fills the "before" from its own last reading. Inventing a number
   * would be indistinguishable from a measured one.
   */
  function routeCompaction(params: unknown): void {
    const status = asText(asRecord(params)?.status)
    if (status === 'started') {
      compactionPhase = 'running'
      queue.push({
        type: 'compact',
        phase: 'start',
        trigger: compactionTrigger,
        turnId: activeTurnId
      })
      return
    }
    if (status !== 'completed') return
    compactionPhase = 'settling'
    const summary = asText(asRecord(params)?.summary)
    queue.push({
      type: 'compact',
      phase: 'end',
      trigger: compactionTrigger,
      ...(summary ? { summary } : {}),
      turnId: activeTurnId
    })
    compactionTrigger = 'auto'
  }

  function routeUpdate(params: unknown): void {
    const update = (asRecord(params)?.update ?? null) as SessionUpdate | null
    if (!update) return
    UPDATE_HANDLERS[update.sessionUpdate ?? '']?.(update, activeTurnId)
  }

  /** Brings up the connection and opens (or re-attaches to) a Devin session. */
  async function connect(resume: string | null | undefined): Promise<void> {
    if (client && acpSessionId) return
    const acp = createAcpClient(processRunner, {
      command,
      args: ['acp'],
      cwd: opts.workspace,
      ...(deps?.host?.env ? { env: deps.host.env as Record<string, string> } : {})
    })
    client = acp

    acp.onNotify('session/update', routeUpdate)
    // Cognition's own extension channel, and the only signal that a context was
    // compacted — including the compactions Devin performs on its own, which is
    // the case Hive was blind to.
    acp.onNotify('_cognition.ai/compaction', routeCompaction)

    // The agent reads and writes through us because we said it could; see the
    // module header for why silence here is worse than refusing.
    acp.onRequest('fs/read_text_file', async (params) => {
      const path = asText(asRecord(params)?.path)
      if (!path) throw new Error('fs/read_text_file sem path')
      return { content: await readFile(path, 'utf-8') }
    })
    acp.onRequest('fs/write_text_file', async (params) => {
      const record = asRecord(params)
      const path = asText(record?.path)
      if (!path) throw new Error('fs/write_text_file sem path')
      await writeFile(path, asText(record?.content) ?? '', 'utf-8')
      return {}
    })
    // Devin's own permission modes handle approvals for now; taking the first
    // offered option keeps a turn from parking on a prompt no surface shows.
    // (Wiring this to Hive's approval cards is the next step, and the reason
    // the handler is here rather than left to `METHOD_NOT_FOUND`.)
    acp.onRequest('session/request_permission', (params) => {
      const options = asRecord(params)?.options
      const first = Array.isArray(options) ? asRecord(options[0]) : null
      const optionId = asText(first?.optionId)
      return optionId
        ? { outcome: { outcome: 'selected', optionId } }
        : { outcome: { outcome: 'cancelled' } }
    })

    void acp.closed.then(() => {
      // A connection that dies takes its session id with it; the next turn
      // reconnects rather than prompting into a socket nobody is holding.
      if (client === acp) {
        client = null
        acpSessionId = null
        appliedModel = null
      }
    })

    await acp.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false }
    })

    if (resume) {
      try {
        await acp.request('session/load', {
          sessionId: resume,
          cwd: opts.workspace,
          mcpServers: []
        })
        acpSessionId = resume
        return
      } catch {
        // The id is from an older run the agent no longer has, or from a
        // different workspace. A fresh session is a better answer than an
        // error the user can do nothing about.
      }
    }

    const created = (await acp.request<NewSessionResult>('session/new', {
      cwd: opts.workspace,
      mcpServers: []
    })) as NewSessionResult
    const id = asText(created?.sessionId)
    if (!id) throw new Error('O Devin não devolveu um id de sessão.')
    acpSessionId = id
    queue.push({ type: 'session', id, turnId: activeTurnId })
  }

  /**
   * Puts the picked model in force.
   *
   * Devin's picker rows are families and its rungs are variant ids, and the
   * config option takes either — so whichever the user last moved is what
   * gets sent, exactly as the one-shot adapter's `--model` did.
   */
  async function applyModel(acp: AcpClient, model?: string, effort?: string): Promise<void> {
    const chosen = effort !== undefined && effort !== '' ? effort : model
    if (!chosen || chosen === appliedModel || !acpSessionId) return
    try {
      await acp.request('session/set_config_option', {
        sessionId: acpSessionId,
        configId: 'model',
        value: chosen
      })
      appliedModel = chosen
    } catch {
      // An id this account can't use. The turn still runs, on the session's
      // own model — refusing to answer would be a worse trade than answering
      // with the default.
    }
  }

  /** Runs one turn end to end and settles it with exactly one terminal event. */
  /**
   * Closes any tool the agent started and never finished.
   *
   * Called **before** the turn's terminal event, not after: the renderer
   * settles a turn on `done`/`error`, so a tool `end` arriving later has no
   * live turn left to attach to and the activity row spins forever. Same
   * ordering constraint the one-shot adapter documents for its `session` event.
   */
  function closeOrphanTools(turnId: string | undefined): void {
    for (const id of openTools) {
      queue.push({ type: 'tool', name: 'Tool', toolId: id, phase: 'end', ok: false, turnId })
    }
    openTools.clear()
  }

  /** Sends the prompt and settles the turn on whatever comes back. */
  async function prompt(text: string, turnOpts: TurnOpts | undefined): Promise<void> {
    const turnId = turnOpts?.turnId
    // Each turn declares its own compaction state (context-compaction), and
    // this is the only place that can. Three things follow:
    //
    //  - the compaction notification carries no trigger, so a turn that *asked*
    //    for one is the only evidence that it was asked for;
    //  - the CLI's first progress chunk ("Compacting context…") arrives
    //    *before* it announces `started`, so a window opened only on that
    //    notification would let the first line of chatter through. Opening it
    //    here is what makes an asked-for compaction fully silent. An
    //    agent-initiated one still leaks that first line — unchanged from
    //    before this feature, and the seam lands right after it;
    //  - clearing here rather than when the turn ends is not tidiness, it is
    //    correctness. Measured against the real CLI: `session/prompt` resolves
    //    `end_turn` **before** the compaction even starts, so a reset in the
    //    turn's `finally` ran first and the `completed` notification that
    //    followed reported the compaction as the agent's own. A compaction
    //    outlives the turn that asked for it; the next turn is the first moment
    //    it is safe to forget.
    if (isCompactTurn(text)) {
      compactionTrigger = 'manual'
      compactionPhase = 'running'
    } else {
      compactionTrigger = 'auto'
      compactionPhase = 'idle'
    }
    await connect(turnOpts?.resume)
    const acp = client
    if (!acp || !acpSessionId) throw new Error('Não foi possível abrir a sessão do Devin.')
    await applyModel(acp, turnOpts?.model ?? opts.model, turnOpts?.effort ?? opts.effort)

    const result = (await acp.request<PromptResult>('session/prompt', {
      sessionId: acpSessionId,
      prompt: [{ type: 'text', text }]
    })) as PromptResult

    closeOrphanTools(turnId)
    const usage = toUsage(result?.usage)
    if (usage) queue.push({ type: 'usage', usage, final: true, turnId })
    queue.push(
      cancelling || result?.stopReason === 'cancelled'
        ? { type: 'interrupted', turnId }
        : { type: 'done', turnId }
    )
  }

  /** Runs one turn end to end and settles it with exactly one terminal event. */
  async function runTurn(text: string, turnOpts: TurnOpts | undefined): Promise<void> {
    const turnId = turnOpts?.turnId
    activeTurnId = turnId
    cancelling = false
    openTools.clear()

    // A missing workspace must name itself rather than surface as an ENOENT
    // that blames the binary. `error` is terminal on its own — the contract
    // `cliAdapterCore` upholds — so no `done` follows it.
    if (!isUsableCwd(opts.workspace)) {
      queue.push({
        type: 'error',
        message: `A pasta de trabalho não existe mais: ${opts.workspace || '(nenhuma)'}. Escolha outra pasta para continuar.`,
        turnId
      })
      return
    }

    try {
      await prompt(text, turnOpts)
    } catch (error) {
      closeOrphanTools(turnId)
      queue.push(
        cancelling
          ? { type: 'interrupted', turnId }
          : {
              type: 'error',
              message: error instanceof Error ? error.message : String(error),
              turnId
            }
      )
    } finally {
      activeTurnId = undefined
      cancelling = false
    }
  }

  /** Queues a turn behind whatever is already running on this session. */
  function enqueue(prompt: string, turnOpts: TurnOpts | undefined): void {
    if (stopped) return
    chain = chain.then(() => runTurn(prompt, turnOpts)).catch(() => {})
  }

  return {
    send(input: AgentInput): void {
      enqueue(composeTurnPrompt(input.text, input.attachments), input)
    },
    events: queue,
    runWorkflow(cmd: WorkflowCommand, turnOpts?: TurnOpts): void {
      const prompt = cmd.prompt ?? `/${cmd.key}`
      enqueue(composeTurnPrompt(prompt, turnOpts?.attachments), turnOpts)
    },
    interrupt(turnId?: string): void {
      if (!client || !acpSessionId) return
      if (turnId !== undefined && activeTurnId !== undefined && turnId !== activeTurnId) return
      cancelling = true
      // A notification, not a request — see the module header.
      client.notify('session/cancel', { sessionId: acpSessionId })
    },
    stop(): void {
      stopped = true
      client?.stop()
      client = null
      acpSessionId = null
      appliedModel = null
    }
  }
}
