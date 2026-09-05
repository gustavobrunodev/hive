import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import type { ProcessRunner } from './processRunner'
import type {
  AgentAdapter,
  AgentAdapterDeps,
  AgentCapabilities,
  AgentEvent,
  AgentSession,
  CapabilityContext,
  SessionOpts
} from './agentAdapter'
import { createCliAgentSession } from './cliAdapterCore'
import { createDevinAcpSession } from './devinAcpSession'
import { DEVIN_CATALOG, DEVIN_COMPACTION, detectDevinCapabilities } from './devinModelCatalog'
import { CLI_DEFAULT_ID } from './modelCatalog'

/**
 * The Devin CLI adapter (multi-agent). Drives Cognition's `devin` binary.
 *
 * **Two transports, and the default is the live one.** Turns normally run over
 * ACP (`devin acp`) — one process for the whole conversation, structured
 * events while it works. That is `devinAcpSession.ts`, and its header carries
 * the measurements that made it the default. Everything below documents the
 * **fallback**: the one-shot `-p` engine in `cliAdapterCore.ts`, kept for a
 * `devin` too old to have an `acp` subcommand and reachable with
 * `HIVE_DEVIN_ACP=0`.
 *
 * Detection (`detectCapabilities`) is shared by both and unchanged.
 *
 * Every flag below is **verified against a real `devin 3000.6.14`** on the
 * reporter's machine, not read off documentation:
 *
 *   - `-p, --print [PROMPT]` — non-interactive mode with an inline prompt.
 *   - `--model <MODEL>` — accepts a family slug (`claude-sonnet-5`), an alias
 *     (`sonnet`) **or** a variant id (`claude-sonnet-5-high`). All three were
 *     run; an unknown one exits 1 and lists the accepted slugs.
 *   - `-r, --resume <SESSION_ID>` — continues a conversation by id. Measured:
 *     a resumed turn answered from the previous turn's context in 2.7s.
 *   - `--export <PATH>` — writes the whole conversation, **including its
 *     `session_id`**, after each turn. This is the only place the CLI states
 *     that id in print mode.
 *   - `--respect-workspace-trust false` — see below.
 *
 * Devin has no `--effort` flag; its reasoning ladder is folded into `--model`
 * as per-family variants, which `devinModelCatalog.ts` unpacks back into two
 * axes for the picker. So this adapter sends **one** model flag, resolved from
 * whichever of the two the user last moved.
 */

const DEVIN_COMMAND = 'devin'

/**
 * What the fallback engine has to work around — and why it can only ever be a
 * fallback.
 *
 * **1. "Devin demora 50s a 1 minuto para iniciar uma sessão."**
 * **2. "Toda vez que mando uma mensagem parece que inicia uma nova sessão."**
 *
 * `--export` mitigates these: Devin writes the conversation (with `session_id`
 * at the top) after each turn, so this adapter points it at a scratch file,
 * reads the id back when the process exits, and hands `--resume` to the next
 * turn. The transcript keeps its context.
 *
 * What it cannot fix is that **every message is still a new process**: a fresh
 * spawn, a fresh auth check, every MCP server reconnected, the workspace
 * re-scanned. `--resume` restores the conversation, not the machinery around
 * it. Nor does print mode emit any structured event, so the turn produces no
 * timeline blocks and `turnPhase()` — which reports `starting` while a turn
 * has produced nothing — is stuck on "Iniciando" for its whole duration.
 *
 * Both are properties of the transport, which is why the real fix was to
 * change the transport. See `devinAcpSession.ts`.
 *
 * **3. `Error: Refusing to run in an untrusted workspace`.**
 *
 * Devin's trust prompt is interactive-only, and its own error says so: "Non-
 * interactive (print) mode cannot show the trust prompt and fails in an
 * untrusted directory." So a workspace the user opened in Hive but never
 * opened in Devin's own TUI could not be used at all — every turn exited 1 in
 * under a second. Hive's workspace picker **is** the trust decision here (the
 * user chose the folder, in this app, on purpose), so the flag states it.
 */
const TRUST_ARGS = ['--respect-workspace-trust', 'false']

function capabilities(): AgentCapabilities {
  return {
    models: [
      {
        id: CLI_DEFAULT_ID,
        label: 'Automático',
        descriptionKey: 'cliDefault',
        traits: ['cli-default'],
        group: 'default',
        source: 'catalog'
      },
      ...DEVIN_CATALOG
    ],
    // Not an agent-wide ladder: Devin's reasoning levels are per model, and
    // ride on each model row's own `efforts` (see `devinModelCatalog.ts`).
    efforts: [],
    supportsAttachments: true,
    provider: { id: 'cognition', detail: null },
    modelSource: 'catalog',
    compaction: DEVIN_COMPACTION
  }
}

/**
 * What goes after `--model`.
 *
 * The picker shows two controls; the CLI has one flag. A chosen rung is the
 * full variant id (`claude-opus-5-high`) and already names its family, so it
 * wins outright — the family slug it came from would be the same choice with
 * the reasoning level thrown away.
 */
export function devinModelArg(model?: string, effort?: string): string | undefined {
  if (effort !== undefined && effort !== '') return effort
  return model !== undefined && model !== '' ? model : undefined
}

/**
 * Reads the `session_id` out of a `--export` file. Everything about this is
 * best-effort: the export is a convenience, and a turn that produced a reply
 * but no readable id must still settle normally — it just starts fresh again
 * next time, which is exactly the behaviour that existed before.
 */
export function readExportedSessionId(path: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    const id = (parsed as { session_id?: unknown } | null)?.session_id
    return typeof id === 'string' && id.trim() !== '' ? id.trim() : null
  } catch {
    return null
  }
}

/** Where the per-turn export files go. One directory, swept as each turn finishes. */
function exportDir(deps?: AgentAdapterDeps): string {
  return deps?.scratchDir ?? join(tmpdir(), 'hive-devin-export')
}

/** Options that decide how this adapter talks to `devin`. */
export interface DevinAdapterOptions {
  /**
   * Drive Devin over ACP (one live process per conversation) instead of the
   * one-shot `-p` engine. Defaults to on; `HIVE_DEVIN_ACP=0` is the escape
   * hatch for a `devin` too old to have an `acp` subcommand.
   *
   * Injected rather than read from `process.env` at module scope so both
   * transports stay testable — the fallback engine is still shipped, so it is
   * still covered.
   */
  acp?: boolean
}

/** Creates the Devin CLI adapter (injected `ProcessRunner`, fully fake-testable). */
export function createDevinCliAdapter(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps & DevinAdapterOptions
): AgentAdapter {
  const useAcp = deps?.acp ?? process.env.HIVE_DEVIN_ACP !== '0'
  return {
    id: 'devin',
    displayName: 'Devin CLI',
    capabilities,
    detectCapabilities: (context: CapabilityContext) =>
      detectDevinCapabilities({
        processRunner,
        env: deps?.host?.env ?? process.env,
        home: deps?.host?.home ?? homedir(),
        platform: deps?.host?.platform ?? process.platform,
        ...(deps?.host?.readJson ? { readJson: deps.host.readJson } : {}),
        ...(context.workspace ? { workspace: context.workspace } : {})
      }),
    commandName: DEVIN_COMMAND,
    startSession: (opts: SessionOpts) =>
      // ACP is the default path now: one live process for the whole
      // conversation, structured events while the turn runs. The one-shot
      // `-p` engine below stays as the fallback for a `devin` too old to have
      // an `acp` subcommand — see `devinAcpSession.ts` for the measurements
      // that made this the default.
      useAcp
        ? createDevinAcpSession(processRunner, opts, deps)
        : startDevinSession(processRunner, opts, deps)
  }
}

/**
 * The session, wrapped so the export file can be read back.
 *
 * `createCliAgentSession` owns the process and settles the turn; this wrapper
 * only watches the event stream go by, and when a turn ends without the CLI
 * having announced a session id, reads the one the export wrote and pushes it
 * downstream as the `session` event the rest of the app already understands.
 * Nothing about the turn's own lifecycle depends on it.
 */
function startDevinSession(
  processRunner: ProcessRunner,
  opts: SessionOpts,
  deps?: AgentAdapterDeps
): AgentSession {
  const dir = exportDir(deps)
  /** turnId (or the sentinel for an unnamed turn) → the export path that turn was given. */
  const exports = new Map<string, string>()
  const KEY = (turnId?: string): string => turnId ?? ' anon'

  const inner = createCliAgentSession(processRunner, opts, {
    command: DEVIN_COMMAND,
    errorLabel: 'devin',
    buildArgs: (prompt, { model, effort, resume, turnId }) => {
      const chosen = devinModelArg(model, effort)
      const path = join(dir, `turn-${Date.now()}-${randomUUID()}.json`)
      try {
        mkdirSync(dir, { recursive: true })
        exports.set(KEY(turnId), path)
      } catch {
        exports.delete(KEY(turnId))
      }
      return [
        '-p',
        prompt,
        ...(chosen ? ['--model', chosen] : []),
        ...TRUST_ARGS,
        // Only when the directory is really there: pointing the CLI at an
        // unwritable path would trade a missing session id for a failed turn.
        ...(exports.has(KEY(turnId)) ? ['--export', path] : []),
        ...(resume ? ['--resume', resume] : [])
      ]
    }
  })

  return { ...inner, events: withSessionIds(inner.events, exports, KEY) }
}

/**
 * Republishes the session's events, inserting a `session` event just before a
 * turn's terminal one when the export file names an id nothing else did.
 *
 * It has to go *before* the terminal event: the renderer settles the turn on
 * `done`/`error` and adopts a session id onto the turn it belongs to, so an id
 * arriving after the close would have no turn left to attach to.
 */
async function* withSessionIds(
  events: AsyncIterable<AgentEvent>,
  exports: Map<string, string>,
  key: (turnId?: string) => string
): AsyncGenerator<AgentEvent> {
  /** Turns whose id the CLI announced itself — nothing to add for those. */
  const announced = new Set<string>()
  for await (const event of events) {
    if (event.type === 'session') announced.add(key(event.turnId))
    if (event.type === 'done' || event.type === 'error' || event.type === 'interrupted') {
      const id = key(event.turnId)
      const path = exports.get(id)
      exports.delete(id)
      if (path !== undefined) {
        const sessionId = announced.has(id) ? null : readExportedSessionId(path)
        if (sessionId !== null) yield { type: 'session', id: sessionId, turnId: event.turnId }
        // The export is a whole transcript on disk; it exists to carry one
        // string across the process boundary and has no business outliving it.
        try {
          rmSync(path, { force: true })
        } catch {
          // A locked file on Windows: the next run's mkdir does not care.
        }
      }
    }
    yield event
  }
}
