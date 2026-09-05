import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/**
 * What the AWS CLI knows about this machine, read the same way it reads it —
 * the first half of "Claude via Bedrock should just work".
 *
 * The scenario this exists for: a team points Claude Code at Bedrock, logs in
 * once a day with `aws sso login --profile <p>`, and from then on every
 * `claude` in every terminal works because the CLI finds a **cached SSO access
 * token** on disk. Hive spawns the same binary, so it inherits exactly that
 * arrangement — including the day the token expires, where the CLI's own
 * repair (`awsAuthRefresh`, a settings hook that shells out to
 * `aws sso login`) needs a terminal Hive does not give it and fails with a
 * message nobody can act on:
 *
 * ```
 * Error running awsAuthRefresh (in settings or ~/.claude.json)
 * ```
 *
 * So Hive has to know what the AWS CLI knows *before* it spawns anything:
 * which profiles exist, which of them authenticate through IAM Identity Center
 * (SSO), and where each one's token cache lives. All of that is written down
 * in `~/.aws/config` — nothing here spawns a process or hits the network.
 *
 * Everything is injectable (`home`, `env`, `readText`) so the whole path is
 * testable on a machine with no AWS account at all.
 */

/** One `[profile x]` (or `[default]`) section, reduced to what auth depends on. */
export interface AwsProfile {
  /** The name as `--profile` takes it — `default` for the unnamed section. */
  name: string
  /** `region` (or `sso_region` when the profile only names the session's). */
  region: string | null
  /** `sso_session` — the modern, token-sharing form. */
  ssoSession: string | null
  /** `sso_start_url`, from the profile itself (legacy) or its session. */
  ssoStartUrl: string | null
  /** The region the SSO *token* is minted in — not necessarily the API region. */
  ssoRegion: string | null
  ssoAccountId: string | null
  ssoRoleName: string | null
  /** `credential_process` — an external helper mints credentials; nothing to log into. */
  credentialProcess: string | null
  /** `role_arn` + `source_profile`/`source_profile` chain — assume-role. */
  roleArn: string | null
  sourceProfile: string | null
  /** Whether `~/.aws/credentials` (or the config section) carries static keys. */
  hasStaticKeys: boolean
}

/** One `[sso-session x]` section — the thing whose token is actually cached. */
export interface AwsSsoSession {
  name: string
  startUrl: string | null
  region: string | null
}

/** How a profile proves who it is — which decides whether Hive can repair it. */
export type AwsAuthKind =
  /** `sso_session` — a cached token Hive can refresh with `aws sso login`. */
  | 'sso'
  /** Pre-`sso-session` form: `sso_start_url` on the profile itself. Same repair. */
  | 'sso-legacy'
  /** Static keys in `~/.aws/credentials`. Nothing expires; nothing to do. */
  | 'static'
  /** `credential_process` — someone else's helper owns the credentials. */
  | 'process'
  /** `role_arn` + `source_profile` — resolves through the source profile. */
  | 'assume-role'
  /** A profile that names none of the above (or no profile at all). */
  | 'unknown'

/** The whole machine-level view, as one read. */
export interface AwsConfigView {
  profiles: AwsProfile[]
  sessions: AwsSsoSession[]
  /** Which config file this came from — shown when a profile can't be found. */
  configPath: string
  credentialsPath: string
}

/** Injection seam: everything that touches the machine, in one place. */
export interface AwsConfigDeps {
  home?: string
  env?: NodeJS.ProcessEnv
  /** Reads a text file, `null` for every failure (missing, unreadable, binary). */
  readText?: (path: string) => string | null
}

/** The default text read — every failure mode collapses to `null`, on purpose. */
export function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Where the AWS CLI looks for its two files. `AWS_CONFIG_FILE` and
 * `AWS_SHARED_CREDENTIALS_FILE` are honoured because a team that sets them
 * sets them for a reason, and reading the wrong file would make Hive report
 * "no profiles" on a machine full of them.
 */
export function awsConfigPaths(deps: AwsConfigDeps = {}): {
  configPath: string
  credentialsPath: string
} {
  const env = deps.env ?? process.env
  const home = deps.home ?? homedir()
  return {
    configPath: env.AWS_CONFIG_FILE?.trim() || join(home, '.aws', 'config'),
    credentialsPath: env.AWS_SHARED_CREDENTIALS_FILE?.trim() || join(home, '.aws', 'credentials')
  }
}

/**
 * A minimal INI reader for the AWS files' actual dialect.
 *
 * Not a general parser, and deliberately so. It handles what these two files
 * really contain: `[section]` headers, `key = value` pairs, `#`/`;` comments,
 * and the **indented sub-settings** the CLI allows (`s3 =` followed by an
 * indented block). Those nested lines are skipped rather than modeled — no
 * auth setting is ever nested, and swallowing them keeps a `max_concurrent_requests`
 * from being read as a top-level key of the section.
 *
 * Keys are lower-cased (the CLI is case-insensitive here); section names keep
 * their case, since a profile name is user-facing.
 */
export function parseIni(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const withoutComment = stripComment(rawLine)
    if (withoutComment.trim() === '') continue
    const header = /^\s*\[([^\]]+)\]/.exec(withoutComment)
    if (header) {
      const name = header[1].trim()
      current = sections.get(name) ?? new Map<string, string>()
      sections.set(name, current)
      continue
    }
    // An indented line is a sub-setting of the key above it — see the header.
    if (/^\s/.test(withoutComment)) continue
    if (!current) continue
    const separator = withoutComment.indexOf('=')
    if (separator === -1) continue
    const key = withoutComment.slice(0, separator).trim().toLowerCase()
    const value = withoutComment.slice(separator + 1).trim()
    if (key !== '') current.set(key, value)
  }
  return sections
}

/**
 * Drops a trailing `#`/`;` comment.
 *
 * Only when the sigil is preceded by whitespace or starts the line — the AWS
 * docs' own rule, and the reason a value like `sso_start_url = https://x#y`
 * survives intact.
 */
function stripComment(line: string): string {
  const match = /(^|\s)[#;]/.exec(line)
  return match ? line.slice(0, match.index + (match[1] === '' ? 0 : 1)) : line
}

/** `[profile dev]` → `dev`; `[default]` → `default`; anything else → `null`. */
function profileNameOf(section: string): string | null {
  if (section === 'default') return 'default'
  const match = /^profile\s+(.+)$/.exec(section)
  return match ? match[1].trim() : null
}

function textOf(section: Map<string, string> | undefined, key: string): string | null {
  const value = section?.get(key)?.trim()
  return value === undefined || value === '' ? null : value
}

/**
 * Reads `~/.aws/config` (+ `~/.aws/credentials`) into the shape auth cares
 * about. A missing file is not an error — it is the honest answer "this
 * machine has no AWS profiles", which the UI states rather than crashing on.
 */
export function readAwsConfig(deps: AwsConfigDeps = {}): AwsConfigView {
  const readText = deps.readText ?? readTextFile
  const { configPath, credentialsPath } = awsConfigPaths(deps)
  const config = parseIni(readText(configPath) ?? '')
  const credentials = parseIni(readText(credentialsPath) ?? '')

  const sessions: AwsSsoSession[] = []
  for (const [section, entries] of config) {
    const match = /^sso-session\s+(.+)$/.exec(section)
    if (!match) continue
    sessions.push({
      name: match[1].trim(),
      startUrl: textOf(entries, 'sso_start_url'),
      region: textOf(entries, 'sso_region')
    })
  }

  const profiles: AwsProfile[] = []
  const seen = new Set<string>()
  for (const [section, entries] of config) {
    const name = profileNameOf(section)
    if (name === null) continue
    seen.add(name)
    profiles.push(buildProfile(name, entries, credentials.get(name), sessions))
  }
  // A profile can exist *only* in `~/.aws/credentials` (the classic
  // access-key setup, which never needed a config section at all). Leaving it
  // out would make Hive report "not configured" on a machine that works.
  for (const [name, entries] of credentials) {
    if (seen.has(name)) continue
    profiles.push(buildProfile(name, undefined, entries, sessions))
  }

  return { profiles, sessions, configPath, credentialsPath }
}

function buildProfile(
  name: string,
  entries: Map<string, string> | undefined,
  credentialEntries: Map<string, string> | undefined,
  sessions: AwsSsoSession[]
): AwsProfile {
  const sessionName = textOf(entries, 'sso_session')
  const session = sessions.find((candidate) => candidate.name === sessionName) ?? null
  return {
    name,
    region: textOf(entries, 'region') ?? session?.region ?? textOf(entries, 'sso_region'),
    ssoSession: sessionName,
    ssoStartUrl: textOf(entries, 'sso_start_url') ?? session?.startUrl ?? null,
    ssoRegion: textOf(entries, 'sso_region') ?? session?.region ?? null,
    ssoAccountId: textOf(entries, 'sso_account_id'),
    ssoRoleName: textOf(entries, 'sso_role_name'),
    credentialProcess: textOf(entries, 'credential_process'),
    roleArn: textOf(entries, 'role_arn'),
    sourceProfile: textOf(entries, 'source_profile'),
    hasStaticKeys:
      textOf(credentialEntries, 'aws_access_key_id') !== null ||
      textOf(entries, 'aws_access_key_id') !== null
  }
}

/**
 * How this profile authenticates. Order matters: `sso_session` is checked
 * before the legacy keys because a profile carrying both is a migrated one,
 * and the session is where its token now lives.
 */
export function authKindOf(profile: AwsProfile | null): AwsAuthKind {
  if (!profile) return 'unknown'
  if (profile.ssoSession) return 'sso'
  if (profile.ssoStartUrl) return 'sso-legacy'
  if (profile.credentialProcess) return 'process'
  if (profile.hasStaticKeys) return 'static'
  if (profile.roleArn) return 'assume-role'
  return 'unknown'
}

/** Whether Hive can repair this profile itself, i.e. `aws sso login` applies. */
export function isSsoKind(kind: AwsAuthKind): boolean {
  return kind === 'sso' || kind === 'sso-legacy'
}

/** One profile by name, or `null`. */
export function findProfile(view: AwsConfigView, name: string | null): AwsProfile | null {
  if (!name) return null
  return view.profiles.find((profile) => profile.name === name) ?? null
}

/**
 * The cache key whose SHA-1 names this profile's token file.
 *
 * Measured against a real `~/.aws/sso/cache` (AWS CLI 2.32): the modern form
 * hashes the **sso-session name**, the legacy form the **start URL**. Getting
 * this wrong doesn't error — it silently finds no token and reports a logged-in
 * user as expired, which is why it is stated here rather than guessed at the
 * call site.
 */
export function ssoCacheKeyOf(profile: AwsProfile | null): string | null {
  if (!profile) return null
  if (profile.ssoSession) return profile.ssoSession
  return profile.ssoStartUrl
}
