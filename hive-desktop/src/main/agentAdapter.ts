/**
 * `AgentAdapter` — the decoupling boundary between the app and whichever
 * agent CLI drives a chat session (T13). See design.md §2 "Module
 * Responsibilities" (`AgentAdapter`) and §3 "Key Interfaces", and context.md
 * decision C1 (internal adapter interface, Claude CLI only for MVP — no
 * external ACP spec) and C5 (curated per-adapter model/effort lists, not
 * scraped from `--help`).
 *
 * This module holds only the *contract* (types) plus anything shared across
 * adapter implementations. `ClaudeCliAdapter`, the MVP's sole implementation,
 * lives in `claudeCliAdapter.ts`. Future adapters (e.g. a Devin CLI adapter,
 * per C1) implement this same interface and are drop-in — nothing in
 * `AgentService` (T14) or the UI should need to know which adapter is active
 * beyond this contract.
 */

import type { ShellInfo } from './shellCatalog'
import type { ToolPatch } from './toolPatch'

export type { PatchHunk, PatchLine, PatchOp, PatchSpan, ToolPatch } from './toolPatch'

/**
 * How the app learned that a row belongs on the picker — the provenance the
 * footer shows, and the reason this type exists at all.
 *
 * The complaint this feature answers was "os modelos do Claude parecem estar
 * fixos": a curated list is *usually* right and silently wrong the moment the
 * CLI is pointed at Bedrock, at a gateway, or at an account with different
 * model access. A row that says where it came from can be checked; a row that
 * doesn't asks the user to take our word for it.
 *
 *  - `detected`   — read off this machine (the CLI's own caches / a `models`
 *                   subcommand). The strongest claim, and the only one that
 *                   survives a provider swap.
 *  - `configured` — named by the user's own settings or environment
 *                   (`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_*_MODEL`, a Devin
 *                   config default). Also true of this machine, and it is what
 *                   makes Bedrock ids show up as themselves.
 *  - `catalog`    — the curated fallback for a CLI that publishes no list.
 *                   Honest, but the picker says so rather than implying more.
 */
export type OptionSource = 'detected' | 'configured' | 'catalog'

/**
 * A closed vocabulary of things worth saying about a model on its row, as
 * *codes* rather than sentences: the main process holds no UI strings (i18n
 * lives in the renderer, per R1.6), so every trait here is mapped to pt-BR
 * copy by `modelCopy.ts` on the other side of the IPC boundary.
 */
export type ModelTrait =
  /** Omits the model flag entirely — the CLI answers with its own configured default. */
  | 'cli-default'
  /** The vendor's own router picks a model per task (Devin's Adaptive). */
  | 'router'
  /** The heaviest tier available here. */
  | 'flagship'
  /** The everyday tier: the one to reach for when unsure. */
  | 'balanced'
  /** Cheap and quick; less capable. */
  | 'fast'
  /** A 1M-token context variant. */
  | 'long-context'
  /** A superseded version, kept because sessions pinned to it still resume. */
  | 'legacy'
  /** Reasons about the task before answering (extended thinking). */
  | 'thinking'
  /** Reads images as well as text. */
  | 'vision'

/** Which bucket of the picker a row falls into (grouped in this order). */
export type OptionGroup = 'default' | 'recommended' | 'more' | 'legacy'

/** One model or effort-level option surfaced to the UI. */
export interface AgentOption {
  /**
   * What travels to the CLI as `--model`/`--effort`. **The empty string is
   * meaningful**: it is the "use the CLI's own default" row, and the adapter
   * omits the flag for it rather than passing an empty value.
   */
  id: string
  label: string
  /**
   * Context-window size in tokens, for models that have a published one
   * (session-usage). The UI needs a denominator to turn the `usage` event's
   * raw token counts into "how full is this conversation" — and most CLIs
   * don't report their own limit up front, so it is curated here. Omitted →
   * the UI shows absolute token counts and no percentage, which is the honest
   * degradation for an adapter that hasn't declared one.
   */
  contextWindow?: number
  /**
   * A one-line explanation **as the machine phrased it** — a description read
   * out of the CLI's own catalog (`~/.claude.json`'s model options, `devin
   * models list`), or out of the user's `ANTHROPIC_*_DESCRIPTION` env. Passed
   * through verbatim, in whatever language its source wrote it: inventing a
   * translation for a string we detected would erase the evidence.
   */
  description?: string
  /**
   * An i18n key for curated copy (`chat.model.<key>`), used *instead of*
   * `description` when present. This is how a catalog row gets pt-BR prose
   * without the main process holding UI strings.
   */
  descriptionKey?: string
  /** Who makes the model — the picker's group header for multi-vendor CLIs. */
  vendor?: string
  source?: OptionSource
  traits?: ModelTrait[]
  group?: OptionGroup
  /**
   * The concrete id this row resolves to when it isn't obvious — the Bedrock
   * inference profile behind `sonnet`, the model an alias points at. Shown as
   * the row's fine print, because on a third-party provider "Sonnet" alone is
   * not enough to know what you are about to run.
   */
  resolvedId?: string
}

/**
 * Which backend the agent's CLI is actually pointed at. Codes, not sentences,
 * for the same i18n reason as `ModelTrait`; `detail` is machine-read evidence
 * (a region, a host, a CLI version) and is shown verbatim.
 */
export interface AgentProvider {
  id:
    'anthropic' | 'bedrock' | 'vertex' | 'foundry' | 'gateway' | 'github' | 'cognition' | 'unknown'
  /** Region / host / account hint read off the machine, or `null`. */
  detail?: string | null
}

/**
 * Why a capability probe fell short of a full answer, as a closed code the
 * renderer maps to copy. Absent when detection went cleanly.
 */
export type CapabilityNote =
  /** The CLI isn't installed here, so only the curated catalog is on offer. */
  | 'cli-missing'
  /** The CLI is here but its model listing failed (non-zero exit, bad JSON, timeout). */
  | 'probe-failed'
  /** The CLI publishes no machine-readable model list; the catalog is the best available. */
  | 'no-listing'

/**
 * What an adapter supports, so the UI can build model/effort pickers and
 * decide whether to offer attachments — all driven by the adapter, never
 * hardcoded in the UI (C5).
 *
 * multi-agent: `models` and/or `efforts` may be **empty**. Not every agent CLI
 * exposes effort levels (the GitHub Copilot CLI has none). The composer hides
 * the corresponding control when its list is empty and simply omits
 * `--model`/`--effort` on the turn, so the adapter falls back to its CLI's own
 * default.
 */
export interface AgentCapabilities {
  models: AgentOption[]
  efforts: AgentOption[]
  /** Whether turns may carry `AgentInput.attachments` (R6.5/T16). The UI
   *  gates the attach button + drag-and-drop on this. */
  supportsAttachments: boolean
  /** Which backend this CLI is pointed at, when it could be determined. */
  provider?: AgentProvider
  /** The strongest provenance among `models` — what the picker's footer claims. */
  modelSource?: OptionSource
  /**
   * What the CLI would do with no flags at all: the model/effort its own
   * config selects. Shown as the fine print of the "default" row, so choosing
   * it is an informed choice rather than a shrug. `null` when unknown.
   */
  defaults?: { model: string | null; effort: string | null }
  /** Why detection fell back, when it did. */
  note?: CapabilityNote
  /** The CLI version the probe read back, for the footer's evidence line. */
  cliVersion?: string | null
}

/** What a capability probe needs to know about where it is running. */
export interface CapabilityContext {
  /** The active workspace — project-scoped settings live under it. */
  workspace?: string
}

/**
 * One file the user picked to attach to a prompt (R6.5/T16) — the shape the
 * `chat:chooseAttachments` native dialog returns and the composer chips
 * render. `path` is absolute (attachments may live anywhere on the host OS,
 * unlike `@` references, which are workspace-relative by construction).
 */
export interface AttachmentPick {
  path: string
  name: string
  /** Bytes, for the chip's meta line. */
  size: number
}

/** Options a caller supplies when starting a new agent session. */
export interface SessionOpts {
  /**
   * Which registered adapter drives this session (multi-agent). Set by the
   * `AgentService` session pool + IPC layer to route `start`/`send` to the
   * right adapter; the adapter implementation itself ignores it (it already
   * *is* that adapter). Omitted → the caller's default agent.
   */
  agentId?: string
  /** Absolute path to the active workspace; the adapter runs the CLI here. */
  workspace: string
  /**
   * A model id from this adapter's `capabilities().models`, or omitted when
   * the adapter exposes no model choice (`capabilities().models` empty) — the
   * CLI then uses its own default.
   */
  model?: string
  /** An effort id from this adapter's `capabilities().efforts`, or omitted when the adapter exposes no effort levels. */
  effort?: string
}

/** A single turn's input. */
export interface AgentInput {
  text: string
  /**
   * Files offered as context for this turn (R6.5/T16): absolute paths for
   * user-attached files, workspace-relative POSIX paths for `@` references.
   * Adapters fold them into the turn's prompt (`composeTurnPrompt`) — the
   * agent CLI reads the files itself via its own tools, so nothing is
   * inlined over IPC.
   */
  attachments?: string[]
  /**
   * session-history (conversation memory): the adapter-native session id to
   * resume so the agent keeps the conversation's prior context (`claude -p
   * --resume <id>`). `null`/omitted starts the turn fresh. This is the
   * *CLI's* id (surfaced via the `session` event), not Hive's stored
   * conversation id.
   */
  resume?: string | null
  /**
   * Caller-chosen identity for this turn (background-turns): echoed on every
   * event the turn produces, so concurrent turns — e.g. one conversation
   * still streaming in the background while another runs on screen — route
   * their tokens/terminals to the right transcript, and `interrupt(turnId)`
   * can stop exactly one of them.
   */
  turnId?: string
  /**
   * Per-turn model override (skill-studio): a model id from
   * `capabilities().models`, applied to just this turn instead of the
   * session's default. This lets one conversation run on a different model
   * (e.g. the skill-studio launching a generation on a heavier model) without
   * restarting — and so tearing down — the shared session. Omitted → the
   * session default (`SessionOpts.model`).
   */
  model?: string
  /** Per-turn effort override — same contract as `model` (`SessionOpts.effort` is the default). */
  effort?: string
}

/**
 * Streamed events produced by a session, per design.md §3
 * (`token | tool | done | error`). Fields are this task's own judgment call
 * (design.md only names the variants, not their fields):
 * - `token` — a chunk of streamed agent output text. MVP maps each raw
 *   stdout chunk from the underlying CLI process to one `token` event
 *   (simplest reasonable mapping; no attempt to parse structured
 *   token/message boundaries out of the CLI's stdout).
 * - `tool` — the agent invoked a tool, or that invocation came back. Emitted
 *   as a **pair** (`phase: 'start'` on the `tool_use` block, `phase: 'end'` on
 *   its `tool_result`) correlated by `toolId`, so the UI can show work as it
 *   happens instead of a silent gap (agent-activity AA-R1).
 * - `approval` — the agent asked permission to run a tool that isn't
 *   pre-authorized (agent-approvals). The turn's CLI process is **blocked**
 *   until `AgentSession.respondApproval` answers with the matching
 *   `requestId`; nothing else in the stream moves until then.
 * - `done` — the turn/session's underlying process finished successfully.
 * - `error` — the turn/session's underlying process failed (non-zero exit,
 *   killed by an *unexpected* signal, or failed to spawn).
 * - `interrupted` — the turn was stopped by the *user* (chat-controls CC-R1):
 *   `stop()` killed the in-flight process on purpose. Distinct from `error` so
 *   the UI treats a deliberate stop as a normal outcome (keep partial output,
 *   no error Alert) rather than a claude failure (CC-R1.5). Terminal, like
 *   `done`/`error`.
 * - `usage` — the CLI reported how many tokens the turn actually cost
 *   (session-usage). Emitted repeatedly: once per completed assistant message
 *   (a live snapshot of how full the context window is) and once more, marked
 *   `final`, from the CLI's own end-of-turn `result` line, which is the only
 *   place a per-turn cost and the CLI's own duration exist. Purely
 *   informational — nothing in the turn's lifecycle depends on it, so an
 *   adapter whose CLI reports no usage simply never emits it.
 * - `session` — the adapter learned (or re-learned) the CLI-native session id
 *   for the conversation in progress (session-history). Callers persist it and
 *   pass it back as `AgentInput.resume` on later turns so the agent keeps its
 *   context. Emitted whenever the id changes (the Claude CLI can mint a new id
 *   when resuming).
 * - `mcp` — the turn's MCP roster (mcp-visibility): which servers this turn got,
 *   whether each one actually connected, and what each exposes. Emitted once,
 *   from the CLI's own handshake line, *before* the agent can call anything —
 *   which is what makes "o servidor está subindo / subiu / falhou" a state the
 *   UI can show instead of a silence the user has to infer from.
 *
 * Every variant can carry the `turnId` its turn was spawned with
 * (background-turns) — the router key that keeps concurrent turns' streams
 * apart. Absent on events from turns spawned without one.
 */
export type AgentEvent =
  | { type: 'token'; text: string; turnId?: string }
  | ToolEvent
  | ApprovalEvent
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string; turnId?: string }
  | { type: 'interrupted'; turnId?: string }
  | { type: 'session'; id: string; turnId?: string }
  | UsageEvent
  | McpEvent

/**
 * How the CLI reports one MCP server's state at the top of a turn. `connected`
 * and `failed` are the two that matter; the rest are modeled because the CLI
 * emits them and an unknown word must not silently read as "fine".
 */
export type McpServerStatus = 'connected' | 'failed' | 'needs-auth' | 'pending' | 'unknown'

/** One MCP server, as the CLI's handshake reported it for this turn. */
export interface McpServerReport {
  /** The name the workspace's `.mcp.json` (or the user config) gives it. */
  name: string
  status: McpServerStatus
  /**
   * What this server exposes to the turn, already stripped of the
   * `mcp__<server>__` prefix — `browser_navigate`, not
   * `mcp__playwright__browser_navigate`. Empty when the CLI listed the server
   * but no tools for it, which is itself worth showing: a server that connected
   * and exposes nothing is a misconfiguration, not a success.
   */
  tools: string[]
}

/**
 * The turn's MCP roster (mcp-visibility).
 *
 * The Claude CLI opens `--output-format stream-json` with a
 * `{"type":"system","subtype":"init",…}` line carrying `mcp_servers` and the
 * turn's whole `tools` list. That line is the only place the *app* can learn
 * what the agent was actually given — `.mcp.json` says what was asked for, and
 * the two disagree exactly when something is wrong.
 */
export interface McpEvent {
  type: 'mcp'
  servers: McpServerReport[]
  turnId?: string
}

/**
 * One tool invocation, reported twice (agent-activity): `start` when the agent
 * decided to call it, `end` when its result came back. `toolId` is the CLI's
 * own `tool_use.id`, which is what pairs the two halves — the UI keys its live
 * activity rows on it.
 */
export interface ToolEvent {
  type: 'tool'
  /** As the CLI names it: `Bash`, `Read`, `Edit`, `Grep`, `mcp__<server>__<tool>`. */
  name: string
  /** The call's headline argument, already flattened to one line: the command for `Bash`, the path for file tools, the pattern for `Grep`. */
  detail?: string
  /** Correlates `start` with `end`. Absent on adapters that don't expose tool ids. */
  toolId?: string
  phase?: 'start' | 'end'
  /** `end` only — whether the tool reported an error result. */
  ok?: boolean
  /**
   * The absolute workspace path this tool wrote to. Set **only** for
   * file-editing tools, and deliberately separate from `detail`: change
   * attribution (ACR-C7) consumes paths, and a `Bash` command line is not one.
   */
  filePath?: string
  /**
   * `start` only, file-editing tools only: the change this call is about to
   * apply, already diffed and capped (agent-patch AP-C1). Present so the
   * transcript can draw the snippet at the moment the agent commits to it —
   * which, for a tool that needs permission, is before the user has answered.
   * Absent when the tool changes no file, or changes nothing.
   */
  patch?: ToolPatch
  turnId?: string
}

/**
 * What one request to the model actually cost, as the CLI reports it
 * (session-usage).
 *
 * The four token fields are the model's own accounting of the request it just
 * made, and their sum minus `outputTokens` **is** the context window's
 * occupancy: everything the model read this call, whether it came fresh from
 * the prompt, out of the prompt cache, or was written into the cache on the
 * way in. That is the same number Claude Code's `/context` reports, and it is
 * the only one available without re-tokenizing the transcript ourselves.
 *
 * `outputTokens` is deliberately *not* part of that sum — it is what the model
 * wrote, which only joins the context on the *next* request.
 *
 * ## The invariant every adapter must uphold
 *
 * The three input-side fields describe **one request** — the newest one, so
 * they read as occupancy. The output side (`outputTokens`, `costUsd`,
 * `durationMs`, `apiDurationMs`) describes the **whole turn**. A CLI that
 * reports its end-of-turn input counts as a sum over the turn's requests (the
 * `claude` CLI does) must convert before emitting: summed prompt tokens are a
 * bill, not an occupancy, and they grow with the number of steps until any
 * window looks full. See `cliAdapterCore.ts`'s `emitUsageEvents`.
 */
export interface TurnUsage {
  /** Prompt tokens sent fresh, i.e. neither read from nor written to the cache. */
  inputTokens: number
  /** Prompt tokens served out of the cache — in a resumed conversation, most of it. */
  cacheReadTokens: number
  /** Prompt tokens written into the cache on this request: this call's *new* context. */
  cacheCreationTokens: number
  /** Tokens the model generated. Joins the context of the following request. */
  outputTokens: number
  /** The model as the CLI names it (`claude-opus-…`), when it says. */
  model?: string
  /**
   * The context window this turn actually ran against, when the CLI reports one
   * — the true denominator, which outranks the adapter's curated
   * `AgentModel.contextWindow` because the same model id runs at 200k or 1M
   * depending on how the CLI was configured.
   */
  contextWindow?: number
  /** `result` only: what the CLI billed for the whole turn, in USD. */
  costUsd?: number
  /** `result` only: the CLI's own wall-clock for the turn, in ms. */
  durationMs?: number
  /** `result` only: the part of `durationMs` spent waiting on the API, in ms. */
  apiDurationMs?: number
}

/**
 * One usage report. `final` marks a `result` line — the only report whose
 * totals cover the whole turn, and therefore the only one a caller may
 * accumulate across turns without double-counting the intermediate assistant
 * messages that led to it.
 *
 * A turn may emit **more than one** `final` (measured: a `claude` turn that
 * ran a subagent emitted two, at `num_turns` 2 then 6), and each restates the
 * turn's totals *so far* rather than reporting a new slice. So a `final` for a
 * turn already counted replaces that turn's contribution; it never adds to it.
 */
export interface UsageEvent {
  type: 'usage'
  usage: TurnUsage
  final?: boolean
  turnId?: string
}

/**
 * The agent asked to run a tool it isn't pre-authorized for (agent-approvals).
 * The turn is blocked until answered — this is the same interaction Claude Code
 * shows in its own TUI, surfaced in Hive instead of nowhere.
 */
export interface ApprovalEvent {
  type: 'approval'
  /** Answer key: `respondApproval(requestId, …)` releases exactly this request. */
  requestId: string
  /** The tool the agent wants to run (`Bash`, `WebFetch`, `mcp__…`). */
  tool: string
  /** One-line headline for the card: the command, the URL, the path. */
  detail?: string
  /** The tool's full input, for the card's expandable detail. Already JSON-safe. */
  input?: Record<string, unknown>
  turnId?: string
}

/** How the user answered an `ApprovalEvent`. */
export interface ApprovalDecision {
  behavior: 'allow' | 'deny'
  /**
   * `always` also records a standing rule for this tool (persisted, app-wide),
   * so the same class of call stops asking. `once` covers only this request.
   * `session` is the widest and the shortest-lived: it stops asking for
   * *everything* until the app is closed, writes nothing to disk and nothing
   * into the agent's own permission config — the answer to a long working
   * session where the agent is asking every thirty seconds, not a standing
   * grant. Ignored on `deny` — refusing is never remembered, so a mistaken
   * "no" can't quietly block the agent forever.
   */
  scope?: 'once' | 'always' | 'session'
  /** Shown to the agent as the reason on `deny`, so it can adapt instead of retrying blind. */
  message?: string
}

/**
 * A guided-intent entry point (R7.2) — "run BMAD workflow X". The full
 * catalog (`WorkflowCatalog`, curated intent→command map) is built in T17;
 * this is a minimal placeholder shape so `runWorkflow`'s signature doesn't
 * block that later wiring. `key` identifies the workflow (e.g. a BMAD skill
 * name like `"bmad-prd"`); `prompt`, if given, is the literal instruction
 * sent to the agent for this workflow (T17/T19 will supply real ones —
 * BMAD's Claude Code integration is skill-based, triggered by a natural
 * language prompt naming the intent, not a special CLI flag; see design.md
 * §7 "PRD workflow command"). When `prompt` is omitted, the adapter falls
 * back to a generic "run workflow `key`" instruction.
 */
export interface WorkflowCommand {
  key: string
  prompt?: string
}

/** Per-turn options shared by `send` (via `AgentInput`) and `runWorkflow`. */
export interface TurnOpts {
  /**
   * Which registered adapter runs this turn (multi-agent). Consumed by the
   * `AgentService` pool to pick the session; the adapter itself ignores it.
   * Omitted → the conversation's / caller's default agent.
   */
  agentId?: string
  /** Same contract as `AgentInput.resume`. */
  resume?: string | null
  /** Same contract as `AgentInput.turnId`. */
  turnId?: string
  /** Same contract as `AgentInput.attachments`. */
  attachments?: string[]
  /** Same contract as `AgentInput.model` — a per-turn model override. */
  model?: string
  /** Same contract as `AgentInput.effort` — a per-turn effort override. */
  effort?: string
  /**
   * The stored conversation (session-history) this turn was asked from.
   * Consumed by the turn-lifecycle wiring in main to attribute the Agent
   * Change Review turn mark (`TurnMark.conversationId`), so the turn's change
   * card renders in that conversation's transcript and nowhere else. Adapters
   * ignore it — it never reaches a CLI.
   */
  conversationId?: string
}

/**
 * Folds a turn's attached/referenced file paths into the prompt an adapter
 * hands its CLI. Shared across adapter implementations (the *transport*
 * differs per adapter; the context contract shouldn't). The block is
 * English — it's machine-facing instruction to the agent, not UI chrome, and
 * the agent's reply language is governed by the workspace's own config
 * (R1.6 scope note in i18n/pt-BR.ts).
 */
export function composeTurnPrompt(text: string, attachments?: string[]): string {
  if (!attachments || attachments.length === 0) return text
  const list = attachments.map((path) => `- ${path}`).join('\n')
  const block = `<attached-files>\nThe user attached the following files as context for this message. Read each one before answering:\n${list}\n</attached-files>`
  return text.trim().length === 0 ? block : `${text}\n\n${block}`
}

/** A live (or just-started) agent session. */
export interface AgentSession {
  /** Send a turn's input to the agent. */
  send(input: AgentInput): void
  /** Streamed events for this session, across all turns. */
  readonly events: AsyncIterable<AgentEvent>
  /** Drive the agent via a guided-intent workflow command (R7.2). */
  runWorkflow(cmd: WorkflowCommand, opts?: TurnOpts): void
  /**
   * Interrupts one in-flight turn by id, or every in-flight turn when called
   * without one (background-turns / chat-controls CC-R1). Unlike `stop()`,
   * the session stays alive and its other turns keep streaming. Interrupted
   * turns end with `interrupted`, never `error`. Unknown ids are a no-op.
   */
  interrupt(turnId?: string): void
  /** Stop the session's underlying process(es). Safe to call more than once. */
  stop(): void
}

/**
 * The permission-prompt endpoint an adapter can point its CLI at
 * (agent-approvals). Supplied by the main process, implemented by
 * `ApprovalService`; adapters treat it as opaque argv material and never learn
 * how approvals are actually delivered.
 */
export interface PermissionPromptEndpoint {
  /** The CLI flag value naming the tool (`mcp__hive_approvals__approve`). */
  promptToolName: string
  /** MCP server config JSON for one turn, or `null` while the bridge isn't listening. */
  mcpConfig(turnId?: string): string | null
}

/**
 * The machine facts a model-catalog probe reads (`detectCapabilities`).
 * Injected as one bundle so a test can put the whole detection on a fake home
 * directory — the alternative, reading `process` inside each catalog module,
 * makes the Bedrock and Vertex paths untestable without a Bedrock account.
 */
export interface HostFacts {
  env: NodeJS.ProcessEnv
  home: string
  platform: NodeJS.Platform
  /** Injection seam for the JSON reads; defaults to the real filesystem. */
  readJson?: <T>(path: string) => T | null
}

/** Optional collaborators handed to an adapter factory. Every field is opt-in. */
export interface AgentAdapterDeps {
  permissionPrompt?: PermissionPromptEndpoint
  /** Overrides the real `process`/`os` facts for `detectCapabilities`. Tests only. */
  host?: HostFacts
  /**
   * agent-terminal (AT-R4): the shell the user chose, read fresh per turn (the
   * choice can change while a session is alive, and the next turn must honour
   * it without a restart). `null` — or an absent dep — means "nothing chosen",
   * and every adapter behaves exactly as it did before this feature.
   */
  shell?: () => ShellInfo | null
  /**
   * agent-terminal: the whole detected catalog, for the adapter that has to
   * *fall back* rather than honour the pick — Claude has no cmd executor, so
   * "cmd" has to become a named, existing shell instead of whatever the CLI
   * would have picked for itself. Absent means "nothing detected", and every
   * binding degrades to the launch alone.
   */
  shells?: () => ShellInfo[]
}

/**
 * How far a chosen shell actually reaches into one agent (agent-terminal
 * AT-R5). Three states, because there are exactly three truths to tell:
 *
 *  - `native` — the CLI accepts this shell for its *own* command execution
 *    (the adapter has an environment variable for it, and the CLI honours it).
 *  - `fallback` — the CLI cannot run its commands in this shell, so Hive pins
 *    it to a **different, named, installed** one (`ShellBinding.runsIn`).
 *  - `launch-only` — Hive launches the CLI inside this shell and the CLI picks
 *    its own executor with no way for us to steer or even read it.
 *
 * `fallback` is the state this feature was re-opened for. Before it, "cmd"
 * reported `launch-only` and Hive set no environment at all — which handed the
 * decision to the Claude CLI, whose Windows rule ends in a remote feature gate
 * (`LY()` in claude 2.1.226). The observable result was the bug report: the
 * user picks "Prompt de Comando" or "Git Bash", and the agent answers "estou
 * usando PowerShell". A pin plus a named shell is the fix; saying which shell
 * it landed on, in the picker, is the other half.
 */
export type ShellSupport = 'native' | 'fallback' | 'launch-only'

/**
 * Why a shell is only `launch-only` (or what the `native` binding actually
 * buys), as a closed code the renderer maps to copy. Codes, not sentences:
 * the main process holds no UI strings (i18n lives in the renderer).
 */
export type ShellSupportNote =
  /** Claude on POSIX honours `CLAUDE_CODE_SHELL` for bash/zsh only — verified against the binary. */
  | 'posix-bash-zsh-only'
  /** Claude on Windows executes `Bash` through Git Bash; that is what this shell *is*. */
  | 'windows-git-bash'
  /** `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` — a real binding, but the CLI still labels the tool preview. */
  | 'powershell-preview'
  /** Windows cmd: the CLI ships no cmd executor, so the commands are pinned elsewhere. */
  | 'cmd-no-executor'
  /** The pin had to land on PowerShell because Git Bash isn't on this machine — installing it changes the answer. */
  | 'install-git-bash'
  /** The CLI publishes no way to choose its inner shell, so the choice is the launch only. */
  | 'no-cli-binding'

/**
 * What one adapter needs to know about the machine to answer, beyond the shell
 * being asked about: a `fallback` is only honest if it names a shell that is
 * really there, and only safe if the pin it writes matches one.
 */
export interface ShellContext {
  /** Every shell `detectShells` found here, in display order. */
  available: ShellInfo[]
  platform: NodeJS.Platform
}

/** One agent's answer to "what happens if I pick this shell?" (AT-R4/AT-R5). */
export interface ShellBinding {
  support: ShellSupport
  note?: ShellSupportNote
  /**
   * The id of the shell this agent will really run its own commands in — the
   * chosen one when `native`, the pinned one when `fallback`, and `null` when
   * the CLI decides for itself (`launch-only`). The picker renders this
   * verbatim, which is why it is an id and not a sentence.
   */
  runsIn: string | null
  /** Environment the adapter adds to its own spawns to honour (or pin) the shell. Empty for `launch-only`. */
  env: Record<string, string>
}

/** Contract any agent CLI implements (C1). MVP: `ClaudeCliAdapter`. */
export interface AgentAdapter {
  id: string
  displayName: string
  /**
   * The curated answer: what this adapter can offer **without touching the
   * machine**. Synchronous and always available, so anything that just needs
   * a shape (a turn's flag validation, a test) gets one without I/O.
   */
  capabilities(): AgentCapabilities
  /**
   * The measured answer: the same shape, after reading this machine — the
   * CLI's own model caches, the user's settings/env, a `models` subcommand.
   * Optional, because an adapter that has nothing to read is honestly
   * described by `capabilities()` alone; callers fall back to it.
   *
   * Implementations must never reject: a probe that fails returns the curated
   * list with a `note` saying why, because a picker with no rows is strictly
   * worse than a picker that admits it is guessing.
   */
  detectCapabilities?(context: CapabilityContext): Promise<AgentCapabilities>
  startSession(opts: SessionOpts): AgentSession
  /**
   * agent-terminal: how this agent honours `shell`. Optional — an adapter
   * that doesn't implement it is treated as `launch-only`/`no-cli-binding`,
   * which is the honest default for a CLI whose inner shell we can't steer.
   */
  shellBinding?(shell: ShellInfo, context: ShellContext): ShellBinding
  /**
   * The CLI binary this adapter drives (`claude`, `copilot`, …). Optional and
   * display-only: the terminal picker shows the real command line a turn is
   * spawned with, and a preview that named the wrong binary would be exactly
   * the kind of confident-and-wrong the picker exists to end.
   */
  commandName?: string
}

/**
 * A small single-producer/single-consumer async queue for `AgentEvent`s,
 * shared across every turn of a session (a session's `events` is one
 * continuous stream even though `ClaudeCliAdapter` spawns a fresh process
 * per turn — see claudeCliAdapter.ts). Mirrors the equivalent private queue
 * in `processRunner.ts`; duplicated here (not imported) because that one
 * isn't exported and is typed for `ProcessStreamChunk`, not `AgentEvent`.
 */
export function createAgentEventQueue(): {
  push(event: AgentEvent): void
  [Symbol.asyncIterator](): AsyncIterator<AgentEvent>
} {
  const buffer: AgentEvent[] = []
  const waiting: Array<(result: IteratorResult<AgentEvent>) => void> = []

  return {
    push(event: AgentEvent): void {
      const resolve = waiting.shift()
      if (resolve) {
        resolve({ value: event, done: false })
      } else {
        buffer.push(event)
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
      return {
        next(): Promise<IteratorResult<AgentEvent>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift() as AgentEvent, done: false })
          }
          return new Promise((resolve) => waiting.push(resolve))
        }
      }
    }
  }
}
