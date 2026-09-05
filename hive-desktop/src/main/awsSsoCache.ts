import { createHash } from 'crypto'
import { readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { readJsonFile } from './modelCatalog'

/**
 * The AWS CLI's SSO token cache, read as a clock — the other half of
 * "Claude via Bedrock should just work".
 *
 * `aws sso login` ends by writing one JSON file per SSO session under
 * `~/.aws/sso/cache/`, named `sha1(<key>).json`. Measured on AWS CLI 2.32.23:
 *
 * ```json
 * { "startUrl": "https://acme.awsapps.com/start", "region": "us-east-1",
 *   "accessToken": "…", "expiresAt": "2026-01-06T02:33:59Z",
 *   "clientId": "…", "refreshToken": "…" }
 * ```
 *
 * That `expiresAt` is the whole answer to "will `claude` work right now?" —
 * the CLI reads the same file, and when it is stale every Bedrock call fails.
 * Reading it is instant, offline, and needs no AWS permissions, so Hive can
 * check before **every** turn instead of discovering the problem from a failed
 * one. The directory also holds the client *registration* file (no `startUrl`,
 * no `accessToken`), which is skipped — mistaking it for a token is how a
 * scan-based lookup reports a session that cannot sign anything as valid.
 *
 * Nothing here ever reads, logs, or returns `accessToken`/`refreshToken`. The
 * app has no use for them (it drives the CLI, which reads the file itself), and
 * a secret that never enters the process cannot leak from it.
 */

/** One cached SSO session, as far as this app is concerned. */
export interface SsoTokenInfo {
  /** The portal the token belongs to — how a scan matches a legacy profile. */
  startUrl: string | null
  region: string | null
  /** ISO-8601, verbatim from the file. */
  expiresAt: string
  /** Milliseconds until it expires; negative once it has. */
  expiresInMs: number
  /** The file it came from — useful in diagnostics, never in the UI. */
  path: string
}

/**
 * How close to expiry a token has to be for a turn to refresh it **first**.
 *
 * Two minutes, not zero: a token that is technically valid for another thirty
 * seconds will die mid-turn, and a turn that dies halfway through has already
 * spent the user's time and tokens. Refreshing pre-emptively costs one browser
 * round-trip the user was going to make anyway, a couple of minutes earlier.
 */
export const SSO_REFRESH_MARGIN_MS = 2 * 60 * 1000

/**
 * How close to expiry the *interface* starts saying so.
 *
 * Half an hour — long enough to be a heads-up ("this will ask you to log in
 * during your next long task"), short enough that it isn't standing noise for
 * most of an eight-hour session.
 */
export const SSO_WARN_WINDOW_MS = 30 * 60 * 1000

/** The lifecycle of a cached token, as the UI names it. */
export type SsoTokenState =
  /** Comfortably valid. */
  | 'valid'
  /** Valid, but inside the warning window — worth mentioning, not worth blocking. */
  | 'expiring'
  /** Past `expiresAt`, or so close that a turn must refresh first. */
  | 'expired'
  /** No cache file for this session at all — never logged in, or cache cleared. */
  | 'absent'

export interface SsoCacheDeps {
  home?: string
  env?: NodeJS.ProcessEnv
  /** Injection seam; defaults to the shared JSON read (null on any failure). */
  readJson?: <T>(path: string) => T | null
  /** Injection seam for the scan fallback. */
  listDir?: (path: string) => string[]
  /** `Date.now`, injected so expiry is testable without waiting a day. */
  now?: () => number
}

/** The raw shape of a token file, narrowed to the fields that are read. */
interface RawSsoToken {
  startUrl?: unknown
  region?: unknown
  expiresAt?: unknown
  accessToken?: unknown
}

/** Where the cache lives. `AWS_SSO_CACHE_DIR` is not a real AWS variable —
 *  the home override is the one that matters, and tests use it. */
export function ssoCacheDir(deps: SsoCacheDeps = {}): string {
  return join(deps.home ?? homedir(), '.aws', 'sso', 'cache')
}

/** The AWS CLI's own file naming: SHA-1 of the session name (or start URL). */
export function ssoCacheFileName(key: string): string {
  return `${createHash('sha1').update(key).digest('hex')}.json`
}

function readDirSafe(path: string, listDir?: (path: string) => string[]): string[] {
  try {
    return (listDir ?? ((dir: string) => readdirSync(dir)))(path)
  } catch {
    return []
  }
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Turns one cache file into a token, or `null` when it isn't one.
 *
 * The registration file in the same directory has an `expiresAt` too — its own,
 * months out — but no `accessToken`. Requiring the token field is what keeps a
 * scan from reporting "valid until March" for a session that expired this
 * morning.
 */
function toToken(path: string, raw: RawSsoToken | null, nowMs: number): SsoTokenInfo | null {
  if (!raw) return null
  const expiresAt = asText(raw.expiresAt)
  if (!expiresAt || asText(raw.accessToken) === null) return null
  const expiresMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresMs)) return null
  return {
    startUrl: asText(raw.startUrl),
    region: asText(raw.region),
    expiresAt,
    expiresInMs: expiresMs - nowMs,
    path
  }
}

/**
 * The cached token for `key` (an sso-session name or a legacy start URL).
 *
 * Two lookups, in order. The hashed filename is the fast, exact one. The scan
 * is the fallback that earns its keep on migrated setups: a profile that names
 * an `sso_session` whose token was last written under the *start URL* form
 * still has a perfectly good token on disk, and reporting "logged out" to
 * someone who is logged in is the single worst answer this module can give.
 */
export function readSsoToken(key: string | null, deps: SsoCacheDeps = {}): SsoTokenInfo | null {
  if (!key) return null
  const readJson = deps.readJson ?? readJsonFile
  const nowMs = (deps.now ?? Date.now)()
  const dir = ssoCacheDir(deps)

  const direct = join(dir, ssoCacheFileName(key))
  const hit = toToken(direct, readJson<RawSsoToken>(direct), nowMs)
  if (hit) return hit

  // Fallback: the key may be a start URL cached under a session name, or the
  // reverse. Match on the one field a token file always carries.
  if (!/^https?:\/\//i.test(key)) return null
  for (const entry of readDirSafe(dir, deps.listDir)) {
    if (!entry.endsWith('.json')) continue
    const path = join(dir, entry)
    const token = toToken(path, readJson<RawSsoToken>(path), nowMs)
    if (token && token.startUrl === key) return token
  }
  return null
}

/** Where a token sits in its lifecycle, given the two thresholds above. */
export function tokenState(token: SsoTokenInfo | null): SsoTokenState {
  if (!token) return 'absent'
  if (token.expiresInMs <= SSO_REFRESH_MARGIN_MS) return 'expired'
  if (token.expiresInMs <= SSO_WARN_WINDOW_MS) return 'expiring'
  return 'valid'
}
