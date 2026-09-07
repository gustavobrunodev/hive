import { asRecord, asText, parseJsonLoose, runCapture } from './modelCatalog'
import { resolveExecutable } from './cliEnv'
import { stripAnsi } from './cliAdapterCore'
import type { ProcessRunner } from './processRunner'

/**
 * `ClaudeAuthService` — the **other** way Claude Code authenticates, and the
 * one this app had no idea about.
 *
 * Hive knew exactly one story about credentials: Amazon Bedrock
 * (`awsAuthService.ts`). Everybody else — which is to say, most users, who sign
 * in with their Claude subscription — got no detection, no repair and no
 * explanation. When their OAuth session expired the CLI exited 1 **writing
 * nothing to stderr**, and the app dutifully reported the only thing it had:
 *
 * ```
 * Não foi possível concluir a resposta: claude exited with code 1
 * ```
 *
 * That sentence contains no cause, no repair, and no hint that the answer is
 * "sign in again". Two things fix it, and they are separate: `cliAdapterCore`
 * now reads the CLI's own words out of its JSON stream, and this module turns
 * the *cause* into something the user can actually resolve without leaving the
 * app.
 *
 * ## What it reads
 *
 * `claude auth status --json` — the CLI's own answer, so the two providers stop
 * being a guess. Measured on `claude 2.1.226`:
 *
 * ```json
 * { "loggedIn": true,  "authMethod": "claude.ai",   "apiProvider": "firstParty",
 *   "email": "…", "orgName": "…", "subscriptionType": "pro" }
 * { "loggedIn": false, "authMethod": "none",        "apiProvider": "firstParty" }
 * { "loggedIn": true,  "authMethod": "third_party", "apiProvider": "bedrock" }
 * ```
 *
 * The third line is why this is not a competing source of truth with the AWS
 * lane but a complement: the CLI itself says which of the two arrangements is
 * in play, so each surface can stop inferring it from settings files.
 *
 * ## What it drives
 *
 * `claude auth login`, headlessly. It prints a verification URL and then blocks
 * on `Paste code here if prompted >` — a prompt written for a terminal, which
 * is exactly the situation `awsAuthService` was built for and exactly the
 * situation a desktop app is not. So Hive plays the terminal: it reads the URL,
 * opens the real browser through Electron, takes the code the user copies back
 * into a field, and writes it to the process's stdin. Measured, not assumed:
 * the CLI accepts a piped code and answers a wrong one with `Invalid code.
 * Please make sure the full code was copied.` on stderr **without exiting** —
 * so a mistyped paste is a retry, not a failed login.
 *
 * Nothing here ever handles a token: the credentials are written and read by
 * the CLI, in its own store, which is why a session established here works in
 * the user's terminal too.
 */

/** The account the CLI is signed into, as it describes itself. */
export interface ClaudeAccount {
  loggedIn: boolean
  /** `claude.ai`, `console`, `third_party`, `none` — the CLI's own vocabulary. */
  authMethod: string | null
  /** `firstParty` for Anthropic's own API; `bedrock`/`vertex`/… otherwise. */
  apiProvider: string | null
  /** Set when an API key is what will authenticate (`ANTHROPIC_API_KEY`, a helper). */
  apiKeySource: string | null
  email: string | null
  organization: string | null
  /** `pro`, `max`, … — the plan behind the subscription, when there is one. */
  subscription: string | null
}

/**
 * The one word every surface branches on.
 *
 * `third-party` is deliberately not an error: a machine on Bedrock/Vertex is
 * correctly configured, its credentials simply belong to the other lane. Saying
 * "not connected" there would send the user to sign into an account that has
 * nothing to do with how their turns are billed.
 */
export type ClaudeAuthState =
  /** Signed in to Anthropic's API — turns will run. */
  | 'connected'
  /** First-party, and nobody is signed in. The one state with a repair here. */
  | 'signed-out'
  /** A key, not an account: nothing to sign in to, and nothing to renew. */
  | 'api-key'
  /** Bedrock/Vertex/Foundry own the credentials (see `awsAuthService`). */
  | 'third-party'
  /** The `claude` binary isn't on the widened PATH. */
  | 'no-cli'
  /** The CLI answered something this build can't read — say so, don't guess. */
  | 'unknown'

export interface ClaudeAuthStatus {
  state: ClaudeAuthState
  account: ClaudeAccount | null
  cliAvailable: boolean
  /** When this was read, so a surface can say how fresh it is. */
  checkedAt: number
}

/** How a sign-in is going, in the words the interface uses. */
export type ClaudeLoginPhase =
  | 'idle'
  /** `claude auth login` spawned; the URL hasn't been printed yet. */
  | 'starting'
  /** The URL is out and the browser is open — the user is on claude.com. */
  | 'browser'
  /** The CLI is asking for the code, and Hive is asking the user for it. */
  | 'code'
  /** A code was written to stdin; the CLI is exchanging it. */
  | 'finishing'
  | 'success'
  | 'failed'
  /** The user (or a new attempt) stopped this one. */
  | 'canceled'

/** Which sign-in the user asked for. Both are the CLI's own flags. */
export type ClaudeLoginMode = 'claudeai' | 'console'

/** The live state of the one in-flight sign-in, broadcast on every change. */
export interface ClaudeLoginState {
  phase: ClaudeLoginPhase
  mode: ClaudeLoginMode
  /** The verification URL, once printed. Also what the browser was opened on. */
  url: string | null
  /**
   * The CLI's complaint about the code we last sent it.
   *
   * Its own field rather than `message` because it is not a failure: the
   * process is still running and still waiting, so the surface must stay on
   * the paste step with an explanation instead of collapsing into an error
   * card that has thrown the login away.
   */
  codeError: string | null
  /** Failure detail, verbatim from the CLI — shown only when `phase` is `failed`. */
  message: string | null
  startedAt: number | null
  /** Who was signed in, read back after a success. */
  account: ClaudeAccount | null
}

/** What a sign-in came back with. */
export type ClaudeLoginResult =
  | { ok: true; account: ClaudeAccount | null }
  | { ok: false; reason: 'no-cli' | 'failed' | 'canceled'; message: string }

export interface ClaudeAuthServiceDeps {
  processRunner: ProcessRunner
  /** Opens the user's browser — injected so the whole flow is testable. */
  openExternal: (url: string) => Promise<void> | void
  /** Resolves `claude` on the widened PATH; injected for tests. */
  resolveClaude?: () => string | null
  now?: () => number
}

export interface ClaudeAuthService {
  /**
   * What the CLI says about this machine's account. Cached, because on Windows
   * (and from WSL) one `claude auth status` costs whole seconds — measured at
   * 5.9 s against the npm shim, against 0.3 s for a native build. `refresh`
   * bypasses the cache; a finished login always does.
   */
  status(workspace?: string, refresh?: boolean): Promise<ClaudeAuthStatus>
  /** Starts a sign-in and resolves when it lands. Single-flight. */
  login(mode?: ClaudeLoginMode, workspace?: string): Promise<ClaudeLoginResult>
  /** Hands the CLI the code the user copied out of the browser. */
  submitCode(code: string): boolean
  /** Stops the in-flight sign-in. */
  cancel(): void
  /** The live sign-in state, for a window that opens mid-flight. */
  loginState(): ClaudeLoginState
  /** Subscribes to sign-in state changes; returns an unsubscribe. */
  onState(listener: (state: ClaudeLoginState) => void): () => void
}

/** The binary. Not configurable: it is the one that owns the credential store. */
const CLAUDE_COMMAND = 'claude'

/** How long `auth status` may take before we stop waiting for it. */
const STATUS_TIMEOUT_MS = 20_000

/** How long a cached status stands. Short enough that a terminal login shows up. */
const STATUS_TTL_MS = 30_000

/** How long a sign-in may sit unfinished before it is abandoned. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

const IDLE_STATE: ClaudeLoginState = {
  phase: 'idle',
  mode: 'claudeai',
  url: null,
  codeError: null,
  message: null,
  startedAt: null,
  account: null
}

/** Reads one `claude auth status --json` payload. `null` when it isn't one. */
export function readAccount(output: string | null): ClaudeAccount | null {
  const record = asRecord(parseJsonLoose(output))
  if (!record || typeof record.loggedIn !== 'boolean') return null
  return {
    loggedIn: record.loggedIn,
    authMethod: asText(record.authMethod),
    apiProvider: asText(record.apiProvider),
    apiKeySource: asText(record.apiKeySource),
    email: asText(record.email),
    organization: asText(record.orgName),
    subscription: asText(record.subscriptionType)
  }
}

/**
 * The account, read as the one word the interface branches on.
 *
 * The order is the point. A third-party provider outranks everything, because
 * on Bedrock the first-party fields describe an account that will not pay for
 * a single token; an API key outranks "signed in", because a key in the
 * environment is what the CLI will actually use.
 */
export function stateOf(account: ClaudeAccount | null, cliAvailable: boolean): ClaudeAuthState {
  if (!cliAvailable) return 'no-cli'
  if (!account) return 'unknown'
  if (account.apiProvider !== null && account.apiProvider !== 'firstParty') return 'third-party'
  if (account.authMethod === 'third_party') return 'third-party'
  if (account.apiKeySource !== null) return 'api-key'
  return account.loggedIn ? 'connected' : 'signed-out'
}

/**
 * Every URL in a chunk of CLI output.
 *
 * ANSI is stripped first and that is load-bearing: the CLI prints the address
 * as an OSC-8 hyperlink, so the raw bytes carry the URL **twice** — once
 * inside the escape and once as the visible text — and a naive match would
 * hand the browser a string with a `\x1b]8;;` still glued to it.
 */
export function urlsIn(text: string): string[] {
  return stripAnsi(text).match(/https?:\/\/[^\s"'<>]+/g) ?? []
}

/** The verification URL, once the CLI has printed it. */
export function verificationUrl(text: string): string | null {
  return urlsIn(text).find((url) => url.includes('oauth')) ?? urlsIn(text)[0] ?? null
}

/**
 * Whether the CLI is now waiting for the code the user copies out of the
 * browser. Matched on the prompt it prints (`Paste code here if prompted >`),
 * which arrives on stdout **without a trailing newline** — so this is tested
 * against the whole transcript so far, never line by line.
 */
export function asksForCode(text: string): boolean {
  return /paste\s+code/i.test(stripAnsi(text))
}

/** The CLI's rejection of a pasted code — a retry, not a failure. */
export function codeRejection(text: string): string | null {
  const match = /invalid code[^\n]*/i.exec(stripAnsi(text))
  return match ? match[0].trim() : null
}

/** The last line worth showing — CLI errors end with the useful sentence. */
function lastMeaningfulLine(transcript: string): string {
  const lines = stripAnsi(transcript)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  return lines.length > 0 ? lines[lines.length - 1].slice(0, 300) : 'login-failed'
}

export function createClaudeAuthService(deps: ClaudeAuthServiceDeps): ClaudeAuthService {
  const now = deps.now ?? Date.now
  const resolveClaude = deps.resolveClaude ?? (() => resolveExecutable(CLAUDE_COMMAND))
  const listeners = new Set<(state: ClaudeLoginState) => void>()

  let state: ClaudeLoginState = { ...IDLE_STATE }
  let cached: { status: ClaudeAuthStatus; workspace: string | undefined } | null = null
  /** The one sign-in in flight, shared by every caller that asks while it runs. */
  let inFlight: Promise<ClaudeLoginResult> | null = null
  let killCurrent: (() => void) | null = null
  let writeCode: ((chunk: string) => boolean) | null = null

  function publish(next: Partial<ClaudeLoginState>): void {
    state = { ...state, ...next }
    for (const listener of listeners) listener(state)
  }

  async function readStatus(workspace?: string): Promise<ClaudeAuthStatus> {
    const cliAvailable = resolveClaude() !== null
    if (!cliAvailable) {
      return { state: 'no-cli', account: null, cliAvailable: false, checkedAt: now() }
    }
    const output = await runCapture(
      deps.processRunner,
      CLAUDE_COMMAND,
      ['auth', 'status', '--json'],
      { ...(workspace ? { cwd: workspace } : {}), timeoutMs: STATUS_TIMEOUT_MS }
    )
    const account = readAccount(output)
    return { state: stateOf(account, true), account, cliAvailable: true, checkedAt: now() }
  }

  async function status(workspace?: string, refresh = false): Promise<ClaudeAuthStatus> {
    const fresh =
      cached !== null &&
      cached.workspace === workspace &&
      now() - cached.status.checkedAt < STATUS_TTL_MS
    if (!refresh && fresh && cached) return cached.status
    const next = await readStatus(workspace)
    cached = { status: next, workspace }
    return next
  }

  /**
   * Reacts to everything the login has printed so far.
   *
   * Called with the *accumulated* transcript on every chunk, not with the
   * chunk: the URL, the paste prompt and any rejection all arrive as
   * unterminated writes on two streams, and a prompt with no newline is
   * exactly the kind of thing that arrives split across two reads. Re-reading a
   * few hundred bytes is cheaper than being wrong about that.
   *
   * `seen` is what keeps it idempotent — the browser opens once, and one
   * rejection is announced once however many times it is re-read.
   */
  async function readTranscript(
    transcript: string,
    seen: { url: boolean; rejection: string | null }
  ): Promise<void> {
    if (!seen.url) {
      const url = verificationUrl(transcript)
      if (url) {
        seen.url = true
        publish({ phase: 'browser', url })
        // A browser that refuses to open is not a failed login: the URL is on
        // screen with a copy control, and the CLI is still waiting.
        try {
          await deps.openExternal(url)
        } catch {
          publish({ url })
        }
      }
    }
    const rejection = codeRejection(transcript)
    if (rejection !== null && rejection !== seen.rejection) {
      seen.rejection = rejection
      publish({ phase: 'code', codeError: rejection })
      return
    }
    if (state.phase === 'browser' && asksForCode(transcript)) publish({ phase: 'code' })
  }

  /**
   * Runs one `claude auth login`, start to finish: spawn, read the transcript
   * as it arrives (`readTranscript` above decides what each new byte means),
   * then settle on how the process ended.
   */
  async function runLogin(mode: ClaudeLoginMode, workspace?: string): Promise<ClaudeLoginResult> {
    if (resolveClaude() === null) {
      publish({ phase: 'failed', mode, message: 'claude-cli-missing', startedAt: now() })
      return { ok: false, reason: 'no-cli', message: 'claude-cli-missing' }
    }

    publish({
      phase: 'starting',
      mode,
      url: null,
      codeError: null,
      message: null,
      startedAt: now(),
      account: null
    })

    const handle = deps.processRunner.run(
      CLAUDE_COMMAND,
      ['auth', 'login', mode === 'console' ? '--console' : '--claudeai'],
      { stdin: 'pipe', processGroup: true, ...(workspace ? { cwd: workspace } : {}) }
    )
    writeCode = handle.write ?? null
    let canceled = false
    killCurrent = () => {
      canceled = true
      handle.kill()
    }
    const timeout = setTimeout(() => {
      if (state.phase !== 'success' && state.phase !== 'failed') killCurrent?.()
    }, LOGIN_TIMEOUT_MS)
    timeout.unref?.()

    const seen = { url: false, rejection: null as string | null }
    let transcript = ''
    try {
      for await (const chunk of handle.output) {
        transcript += chunk.data
        await readTranscript(transcript, seen)
      }
      const result = await handle.exitCode
      if (canceled) {
        publish({ phase: 'canceled', message: null })
        return { ok: false, reason: 'canceled', message: 'canceled' }
      }
      if (result.code !== 0) {
        const message = lastMeaningfulLine(transcript)
        publish({ phase: 'failed', message })
        return { ok: false, reason: 'failed', message }
      }
      // The CLI exited clean; its own store is the proof. Reading it back is
      // also how every surface learns *who* just signed in — and it is the
      // only thing that can tell a real sign-in from a clean exit that left no
      // account behind (a cancelled browser tab, a code for another install).
      // The chat re-sends the failed turn on `ok`, so calling that one a
      // success would answer the user's question with the same failure twice.
      const after = await status(workspace, true)
      if (after.state === 'signed-out') {
        const message = lastMeaningfulLine(transcript)
        publish({ phase: 'failed', message })
        return { ok: false, reason: 'failed', message }
      }
      publish({ phase: 'success', message: null, codeError: null, account: after.account })
      return { ok: true, account: after.account }
    } finally {
      clearTimeout(timeout)
      killCurrent = null
      writeCode = null
    }
  }

  return {
    status,
    loginState: () => state,
    onState(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    cancel() {
      killCurrent?.()
    },
    submitCode(code) {
      const trimmed = code.trim()
      if (trimmed === '' || writeCode === null) return false
      const written = writeCode(`${trimmed}\n`)
      // `finishing` even on a code the CLI will reject: the rejection comes
      // back on stderr within a beat and puts the step back, and a paste that
      // changed nothing on screen reads as a control that didn't work.
      if (written) publish({ phase: 'finishing', codeError: null })
      return written
    },
    login(mode = 'claudeai', workspace) {
      if (inFlight) return inFlight
      const run = runLogin(mode, workspace).finally(() => {
        inFlight = null
      })
      inFlight = run
      return run
    }
  }
}
