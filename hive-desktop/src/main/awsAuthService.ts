import { resolveExecutable } from './cliEnv'
import type { ProcessRunner } from './processRunner'
import {
  detectBedrockSetup,
  needsSsoLogin,
  type AwsProfileSource,
  type BedrockDetectDeps,
  type BedrockSetup
} from './awsBedrock'
import {
  authKindOf,
  isSsoKind,
  ssoCacheKeyOf,
  type AwsAuthKind,
  type AwsProfile
} from './awsConfig'
import { readSsoToken, type SsoTokenInfo } from './awsSsoCache'

/**
 * `AwsAuthService` — the part of Hive that logs the user into AWS so the
 * Claude CLI doesn't have to ask them to.
 *
 * The arrangement it replaces: Claude Code's own repair for an expired Bedrock
 * session is `awsAuthRefresh`, a settings hook that shells out to
 * `aws sso login`. That command wants a terminal — it prints a URL and blocks
 * — and a turn spawned by a desktop app has neither a terminal nor anyone
 * reading its stdout. So it fails, every time, and the user is shown the
 * failure of the *repair* instead of the problem:
 *
 * ```
 * Error running awsAuthRefresh (in settings or ~/.claude.json)
 * ```
 *
 * Hive runs that same command itself, with `--no-browser`, and does the two
 * things a terminal would have done: it reads the verification URL out of the
 * output and opens the user's browser on it, then waits for the process to
 * exit and re-reads the token cache. The CLI is left completely alone — same
 * binary, same profile, same `~/.aws/sso/cache` — which is why a session
 * established here works in the user's terminal too, and vice versa.
 *
 * Three properties this is built around:
 *
 *  - **Single-flight.** Several turns can hit an expired token at the same
 *    instant (a queue draining, a background turn). They share one login: a
 *    second browser window opening on a second URL would invalidate the first.
 *  - **Invisible when it can be.** `ensureReady` on a valid token is a file
 *    read and nothing else — no process, no UI, no delay. That is the case
 *    that happens all day.
 *  - **Nothing here handles a secret.** The access token is written and read by
 *    the AWS CLI; this module reads only `expiresAt`.
 */

/** How a login is going, in the words the interface uses. */
export type AwsLoginPhase =
  /** Nothing in flight. */
  | 'idle'
  /** `aws sso login` spawned; its verification URL hasn't been printed yet. */
  | 'starting'
  /** The URL is out and the browser is open — the user is in AWS's hands. */
  | 'browser'
  /** The browser came back; the CLI is exchanging the code for a token. */
  | 'finishing'
  | 'success'
  | 'failed'
  /** The user (or a new login) stopped this one. */
  | 'canceled'

/** The live state of the one in-flight login, broadcast on every change. */
export interface AwsLoginState {
  phase: AwsLoginPhase
  profile: string | null
  /** The verification URL, once printed. Also what the browser was opened on. */
  url: string | null
  /**
   * The device code, on the device-code fallback only. The authorization-code
   * flow (the default) has none, and showing an empty slot for it would invent
   * a step the user doesn't have to perform.
   */
  code: string | null
  /** Failure detail, verbatim from the CLI — shown only when `phase` is `failed`. */
  message: string | null
  /** When this attempt started, for the elapsed-time readout. */
  startedAt: number | null
  /** After a success: when the freshly-minted session expires. */
  expiresAt: string | null
}

/** What `status()` answers — everything the panel and the chip draw. */
export interface AwsAuthStatus {
  /** Whether Claude is pointed at Bedrock at all. False = nothing to show. */
  active: boolean
  profile: string
  profileSource: AwsProfileSource
  region: string | null
  accountId: string | null
  roleName: string | null
  startUrl: string | null
  authKind: AwsAuthKind
  /**
   * The one word the interface branches on.
   *
   * `ready`/`expiring`/`expired`/`absent` describe a cached SSO token;
   * `unmanaged` means the profile authenticates some other way (static keys, a
   * `credential_process`) and there is nothing for Hive to refresh;
   * `not-configured` means the profile the CLI will use isn't in `~/.aws/config`
   * at all, which is a different problem with a different fix.
   */
  state: 'ready' | 'expiring' | 'expired' | 'absent' | 'unmanaged' | 'not-configured'
  expiresAt: string | null
  /** Milliseconds of session left; negative once it has expired. */
  expiresInMs: number | null
  /** Whether `aws` is on the widened `PATH` — without it nothing here can run. */
  cliAvailable: boolean
  /** Every profile on the machine, so the panel can offer a switch. */
  profiles: AwsProfileSummary[]
  /** The `awsAuthRefresh` command in the Claude settings chain, when there is one. */
  authRefreshCommand: string | null
}

/** One row of the profile picker. */
export interface AwsProfileSummary {
  name: string
  accountId: string | null
  roleName: string | null
  region: string | null
  authKind: AwsAuthKind
  /** Whether this profile has a live cached session right now. */
  signedIn: boolean
}

/** What a preflight (or an explicit login) came back with. */
export type AwsPreflightResult =
  | { ok: true; refreshed: boolean }
  | { ok: false; reason: 'no-cli' | 'failed' | 'canceled' | 'unsupported'; message: string }

export interface AwsAuthServiceDeps {
  processRunner: ProcessRunner
  /** Opens the user's browser — injected so the whole flow is testable. */
  openExternal: (url: string) => Promise<void> | void
  /** The pinned profile, read fresh so a change in settings applies at once. */
  preferredProfile?: () => string | null
  /** Detection seams handed straight to `detectBedrockSetup` (tests use them). */
  detect?: (deps: BedrockDetectDeps) => BedrockSetup
  /** Resolves `aws` on the widened PATH; injected for tests. */
  resolveAws?: () => string | null
  /** Reads one profile's cached session — injected for tests, disk in production. */
  tokenFor?: (profile: AwsProfile) => SsoTokenInfo | null
  now?: () => number
}

export interface AwsAuthService {
  /** Reads the machine and answers what the panel draws. Cheap: files only. */
  status(workspace?: string): AwsAuthStatus
  /**
   * The turn gate. Resolves immediately when the session is good — the case
   * that happens all day — and otherwise runs one login and resolves when it
   * lands.
   */
  ensureReady(workspace?: string, onBlocked?: () => void): Promise<AwsPreflightResult>
  /** Starts a login the user asked for, on `profile` or the detected one. */
  login(profile?: string | null, workspace?: string): Promise<AwsPreflightResult>
  /** Stops the in-flight login (the dialog's "Cancelar"). */
  cancel(): void
  /** The live login state, for a window that opens mid-flight. */
  loginState(): AwsLoginState
  /** Subscribes to login-state changes; returns an unsubscribe. */
  onState(listener: (state: AwsLoginState) => void): () => void
}

/** How long a login may sit unfinished before it is abandoned. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

/** The binary. Not configurable: `aws sso login` is the only thing that writes that cache. */
const AWS_COMMAND = 'aws'

/** Every URL the AWS CLI prints during a login, in the order it prints them. */
export function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'<>]+/g) ?? []
}

/**
 * The user code, on the device-code flow.
 *
 * Measured against AWS CLI 2.32 (`aws sso login --use-device-code
 * --no-browser`), which prints `VFRM-JRXW` on a line of its own after "Then
 * enter the code:". Anchored to the whole line so a code-shaped fragment
 * inside a URL can't be mistaken for it.
 */
export function codeIn(text: string): string | null {
  const match = /^\s*([A-Z0-9]{4}-[A-Z0-9]{4})\s*$/m.exec(text)
  return match ? match[1] : null
}

/**
 * Which URL to send the user to.
 *
 * The device-code flow prints two: the bare portal, then the same portal with
 * `?user_code=` appended, which fills the code in for them. When both are
 * there the second is strictly better — it removes the only manual step in the
 * flow. The authorization-code flow prints exactly one and this returns it.
 */
export function verificationUrl(text: string): string | null {
  const urls = urlsIn(text)
  if (urls.length === 0) return null
  const autofill = urls.find((url) => url.includes('user_code='))
  return autofill ?? urls[0]
}

const IDLE_STATE: AwsLoginState = {
  phase: 'idle',
  profile: null,
  url: null,
  code: null,
  message: null,
  startedAt: null,
  expiresAt: null
}

/**
 * Turns a `BedrockSetup` into the status the UI reads.
 *
 * Kept separate from the service — and pure over its two inputs — so the whole
 * of the branching is testable without a process runner. `tokenFor` exists for
 * the profile rows: "which of my profiles am I already logged into?" is the
 * question that makes switching profiles a decision rather than a guess, and
 * answering it is one cache read per profile, not one full re-detection.
 */
export function statusFrom(
  setup: BedrockSetup,
  cliAvailable: boolean,
  tokenFor: (profile: AwsProfile) => SsoTokenInfo | null = (profile) =>
    readSsoToken(ssoCacheKeyOf(profile))
): AwsAuthStatus {
  const profile = setup.awsProfile
  const state: AwsAuthStatus['state'] = !profile
    ? 'not-configured'
    : !isSsoKind(setup.authKind)
      ? 'unmanaged'
      : setup.tokenState === 'valid'
        ? 'ready'
        : setup.tokenState
  return {
    active: setup.active,
    profile: setup.profile,
    profileSource: setup.profileSource,
    region: setup.region,
    accountId: profile?.ssoAccountId ?? null,
    roleName: profile?.ssoRoleName ?? null,
    startUrl: profile?.ssoStartUrl ?? null,
    authKind: setup.authKind,
    state,
    expiresAt: setup.token?.expiresAt ?? null,
    expiresInMs: setup.token?.expiresInMs ?? null,
    cliAvailable,
    authRefreshCommand: setup.authRefreshCommand,
    profiles: setup.profiles.map((entry) => ({
      name: entry.name,
      accountId: entry.ssoAccountId,
      roleName: entry.ssoRoleName,
      region: entry.region,
      authKind: authKindOf(entry),
      signedIn:
        entry.name === setup.profile
          ? setup.tokenState === 'valid'
          : (tokenFor(entry)?.expiresInMs ?? -1) > 0
    }))
  }
}

export function createAwsAuthService(deps: AwsAuthServiceDeps): AwsAuthService {
  const detect = deps.detect ?? detectBedrockSetup
  const now = deps.now ?? Date.now
  const resolveAws = deps.resolveAws ?? (() => resolveExecutable(AWS_COMMAND))
  const listeners = new Set<(state: AwsLoginState) => void>()

  let state: AwsLoginState = { ...IDLE_STATE }
  /** The one login in flight, shared by every caller that asks while it runs. */
  let inFlight: Promise<AwsPreflightResult> | null = null
  let killCurrent: (() => void) | null = null

  function publish(next: Partial<AwsLoginState>): void {
    state = { ...state, ...next }
    for (const listener of listeners) listener(state)
  }

  function setupFor(workspace?: string): BedrockSetup {
    return detect({
      ...(workspace ? { workspace } : {}),
      preferredProfile: deps.preferredProfile?.() ?? null
    })
  }

  function status(workspace?: string): AwsAuthStatus {
    return statusFrom(setupFor(workspace), resolveAws() !== null, deps.tokenFor)
  }

  /**
   * Runs one `aws sso login`, start to finish.
   *
   * `--no-browser` is not a downgrade here, it is the point: it makes the CLI
   * print the URL instead of trying to open a browser it can't reach (a GUI
   * app's child process has no `DISPLAY` habits worth relying on, and under
   * WSL there is no Linux browser at all), and it hands Hive the URL to open
   * properly through Electron. The exchange, the polling and the cache write
   * all stay inside the AWS CLI.
   */
  async function runLogin(profile: string, workspace?: string): Promise<AwsPreflightResult> {
    if (resolveAws() === null) {
      publish({
        phase: 'failed',
        profile,
        message: 'aws-cli-missing',
        startedAt: now(),
        url: null,
        code: null
      })
      return { ok: false, reason: 'no-cli', message: 'aws-cli-missing' }
    }

    publish({
      phase: 'starting',
      profile,
      url: null,
      code: null,
      message: null,
      startedAt: now(),
      expiresAt: null
    })

    const handle = deps.processRunner.run(
      AWS_COMMAND,
      ['sso', 'login', '--profile', profile, '--no-browser'],
      { processGroup: true }
    )
    let canceled = false
    killCurrent = () => {
      canceled = true
      handle.kill()
    }
    const timeout = setTimeout(() => {
      if (state.phase === 'browser' || state.phase === 'starting') killCurrent?.()
    }, LOGIN_TIMEOUT_MS)
    timeout.unref?.()

    let transcript = ''
    let opened = false
    try {
      for await (const chunk of handle.output) {
        transcript += chunk.data
        if (opened) continue
        const url = verificationUrl(transcript)
        if (!url) continue
        opened = true
        publish({ phase: 'browser', url, code: codeIn(transcript) })
        // A browser that refuses to open is not a failed login: the URL is on
        // screen with a copy control, and the CLI is still waiting.
        try {
          await deps.openExternal(url)
        } catch {
          publish({ url, code: codeIn(transcript) })
        }
      }
      if (!canceled) publish({ phase: 'finishing' })
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
      // The CLI exited clean; the cache is the proof. Reading it back is also
      // how the panel learns the new expiry without a second detection pass.
      const after = setupFor(workspace)
      publish({ phase: 'success', message: null, expiresAt: after.token?.expiresAt ?? null })
      return { ok: true, refreshed: true }
    } finally {
      clearTimeout(timeout)
      killCurrent = null
    }
  }

  /** The last line worth showing — CLI errors end with the useful sentence. */
  function lastMeaningfulLine(transcript: string): string {
    const lines = transcript
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
    return lines.length > 0 ? lines[lines.length - 1].slice(0, 300) : 'login-failed'
  }

  function start(profile: string, workspace?: string): Promise<AwsPreflightResult> {
    if (inFlight) return inFlight
    const run = runLogin(profile, workspace).finally(() => {
      inFlight = null
    })
    inFlight = run
    return run
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
    login(profile, workspace) {
      const setup = setupFor(workspace)
      return start(profile?.trim() || setup.profile, workspace)
    },
    async ensureReady(workspace, onBlocked) {
      // Someone else is already logging in: join them rather than opening a
      // second browser window that would invalidate the first one's code.
      if (inFlight) {
        onBlocked?.()
        return inFlight
      }
      const setup = setupFor(workspace)
      if (!needsSsoLogin(setup)) return { ok: true, refreshed: false }
      onBlocked?.()
      return start(setup.profile, workspace)
    }
  }
}
