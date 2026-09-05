import { homedir } from 'os'
import { readSettingsChain, type ClaudeSettings } from './claudeModelCatalog'
import { readJsonFile } from './modelCatalog'
import {
  authKindOf,
  findProfile,
  isSsoKind,
  readAwsConfig,
  ssoCacheKeyOf,
  type AwsAuthKind,
  type AwsConfigDeps,
  type AwsConfigView,
  type AwsProfile
} from './awsConfig'
import {
  readSsoToken,
  tokenState,
  type SsoCacheDeps,
  type SsoTokenInfo,
  type SsoTokenState
} from './awsSsoCache'

/**
 * "Is this machine driving Claude through Amazon Bedrock, and with whose
 * credentials?" — answered by reading, never by asking.
 *
 * The two halves that have to agree:
 *
 *  1. **Claude Code's own configuration** decides *whether* Bedrock is in play
 *     (`CLAUDE_CODE_USE_BEDROCK`) and, very often, *which AWS profile* is meant
 *     — through `env.AWS_PROFILE` in a settings file, or, more tellingly,
 *     through the `awsAuthRefresh` command a team writes there
 *     (`aws sso login --profile acme`). That command names the profile
 *     precisely because a human already decided which one is right.
 *  2. **The AWS CLI's configuration** decides whether that profile can be
 *     repaired by a login at all (`awsConfig.ts`) and whether its token is
 *     still good (`awsSsoCache.ts`).
 *
 * Precedence deliberately mirrors what the spawned `claude` will itself see:
 * the settings chain's `env` block is applied by the CLI to its own process, so
 * it outranks whatever Hive was launched with. Where neither names a profile,
 * `AWS_PROFILE`/`AWS_DEFAULT_PROFILE` from the environment stand in, and
 * `default` is the last resort — the same ladder the AWS SDKs climb.
 */

/** Where the answer "which profile" came from — shown so the user can check it. */
export type AwsProfileSource =
  /** `env.AWS_PROFILE` in a Claude settings file (user, project, or policy). */
  | 'claude-settings'
  /** Parsed out of the `awsAuthRefresh` command in those settings. */
  | 'auth-refresh-command'
  /** The user picked one in Hive. Outranks everything: it is an explicit choice. */
  | 'hive'
  /** `AWS_PROFILE` / `AWS_DEFAULT_PROFILE` in the environment Hive inherited. */
  | 'environment'
  /** Nothing named one — the AWS default profile. */
  | 'default'

/** Everything the auth layer needs to know about this machine, as one read. */
export interface BedrockSetup {
  /** Whether Claude Code is pointed at Bedrock at all. Everything else is moot when false. */
  active: boolean
  /** The profile the spawned CLI will authenticate as. */
  profile: string
  profileSource: AwsProfileSource
  /** The API region (`AWS_REGION`), which is not always the SSO token's region. */
  region: string | null
  /** The profile as `~/.aws/config` describes it, or `null` when it isn't there. */
  awsProfile: AwsProfile | null
  authKind: AwsAuthKind
  /** The cached SSO token for this profile, if any. */
  token: SsoTokenInfo | null
  tokenState: SsoTokenState
  /** `awsAuthRefresh` from the settings chain — the hook that fails inside Hive. */
  authRefreshCommand: string | null
  /**
   * True when the profile authenticates through IAM Identity Center, i.e. when
   * `aws sso login` is a repair Hive can actually perform. A `credential_process`
   * or a static key pair is somebody else's arrangement and is left alone.
   */
  repairable: boolean
  /** Every profile on the machine, for the picker. */
  profiles: AwsProfile[]
}

export interface BedrockDetectDeps extends AwsConfigDeps, SsoCacheDeps {
  home?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** The workspace, so a project's `.claude/settings.json` is part of the answer. */
  workspace?: string
  /** The profile the user picked inside Hive, which outranks every detected one. */
  preferredProfile?: string | null
  /** Injection seams (tests hand these fakes; production reads disk). */
  readJson?: <T>(path: string) => T | null
  settings?: ClaudeSettings
  config?: AwsConfigView
}

/** The AWS default profile name, as every SDK spells it. */
export const DEFAULT_AWS_PROFILE = 'default'

/** `1`/`true`/`yes`/`on` — the CLI's own truthiness, restated here to stay independent. */
function isOn(value: string | undefined): boolean {
  const text = value?.trim().toLowerCase()
  return text === '1' || text === 'true' || text === 'yes' || text === 'on'
}

function nonEmpty(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text === undefined || text === '' ? null : text
}

/**
 * Pulls the profile out of an `awsAuthRefresh` command.
 *
 * Both spellings the AWS CLI accepts (`--profile x`, `--profile=x`), plus the
 * `AWS_PROFILE=x aws sso login` form a shell-minded author is just as likely to
 * write. Quotes are stripped because a profile with a space in it is legal and
 * therefore quoted.
 */
export function profileFromCommand(command: string | null): string | null {
  if (!command) return null
  const flag = /--profile[=\s]+("([^"]+)"|'([^']+)'|([^\s]+))/.exec(command)
  if (flag) return nonEmpty(flag[2] ?? flag[3] ?? flag[4])
  const variable = /AWS_PROFILE=("([^"]+)"|'([^']+)'|([^\s]+))/.exec(command)
  if (variable) return nonEmpty(variable[2] ?? variable[3] ?? variable[4])
  return null
}

/** The `--sso-session` a refresh command may name instead of a profile. */
export function sessionFromCommand(command: string | null): string | null {
  if (!command) return null
  const match = /--sso-session[=\s]+("([^"]+)"|'([^']+)'|([^\s]+))/.exec(command)
  return match ? nonEmpty(match[2] ?? match[3] ?? match[4]) : null
}

/** Which profile the spawned CLI will use, and how we know. */
function resolveProfile(
  env: Record<string, string | undefined>,
  settings: ClaudeSettings,
  preferred: string | null | undefined,
  view: AwsConfigView
): { profile: string; source: AwsProfileSource } {
  const chosen = nonEmpty(preferred)
  if (chosen) return { profile: chosen, source: 'hive' }
  const fromSettings = nonEmpty(settings.env.AWS_PROFILE ?? settings.env.AWS_DEFAULT_PROFILE)
  if (fromSettings) return { profile: fromSettings, source: 'claude-settings' }
  const fromCommand = profileFromCommand(settings.awsAuthRefresh)
  if (fromCommand) return { profile: fromCommand, source: 'auth-refresh-command' }
  const fromEnv = nonEmpty(env.AWS_PROFILE ?? env.AWS_DEFAULT_PROFILE)
  if (fromEnv) return { profile: fromEnv, source: 'environment' }
  // A refresh command that names only an sso-session still points at exactly
  // one profile whenever that session has one — a common single-team setup.
  const session = sessionFromCommand(settings.awsAuthRefresh)
  const onlyProfile = session
    ? view.profiles.filter((profile) => profile.ssoSession === session)
    : []
  if (onlyProfile.length === 1) {
    return { profile: onlyProfile[0].name, source: 'auth-refresh-command' }
  }
  return { profile: DEFAULT_AWS_PROFILE, source: 'default' }
}

/**
 * Reads the machine and answers the whole question in one shot. Pure over
 * `deps` — no spawning, no network — so a test can assert the expired-token
 * path without an AWS account, and so the app can call it before every turn
 * without paying for it.
 */
export function detectBedrockSetup(deps: BedrockDetectDeps = {}): BedrockSetup {
  const home = deps.home ?? homedir()
  const baseEnv = deps.env ?? process.env
  const settings =
    deps.settings ??
    readSettingsChain(
      {
        env: baseEnv,
        home,
        platform: deps.platform ?? process.platform,
        ...(deps.workspace ? { workspace: deps.workspace } : {})
      },
      deps.readJson ?? readJsonFile
    )
  // What the *turn* will see: the CLI applies its settings `env` block over
  // its own environment, so that block wins here too.
  const env: Record<string, string | undefined> = { ...baseEnv, ...settings.env }
  const view = deps.config ?? readAwsConfig({ ...deps, home, env: baseEnv })
  const { profile, source } = resolveProfile(env, settings, deps.preferredProfile, view)
  const awsProfile = findProfile(view, profile)
  const authKind = authKindOf(awsProfile)
  const token = readSsoToken(ssoCacheKeyOf(awsProfile), { ...deps, home })

  return {
    active: isOn(env.CLAUDE_CODE_USE_BEDROCK),
    profile,
    profileSource: source,
    region: nonEmpty(env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? awsProfile?.region ?? null),
    awsProfile,
    authKind,
    token,
    tokenState: tokenState(token),
    authRefreshCommand: settings.awsAuthRefresh,
    repairable: isSsoKind(authKind),
    profiles: view.profiles
  }
}

/**
 * Whether a turn must stop and refresh before it spawns.
 *
 * Deliberately narrow. Only an SSO profile whose cached token is gone or about
 * to be is worth blocking a turn over: a static key pair never expires, a
 * `credential_process` refreshes itself, and an unreadable `~/.aws/config` is a
 * situation Hive should report rather than act on. Everything outside that one
 * case proceeds and, if it fails, fails with the CLI's own message — which is
 * still an improvement, because `awsDiagnose.ts` now reads those.
 */
export function needsSsoLogin(setup: BedrockSetup): boolean {
  if (!setup.active || !setup.repairable) return false
  return setup.tokenState === 'expired' || setup.tokenState === 'absent'
}

/**
 * The environment a Bedrock turn is spawned with.
 *
 * Just `AWS_PROFILE`, and only when Hive knows something the process doesn't:
 * the profile came from a Claude settings file, a refresh command, or the
 * user's own pick in Hive. The point is the case that made this feature
 * necessary — a user who logs in as `acme` in their terminal, where
 * `AWS_PROFILE` is exported by their shell rc, and then launches Hive from a
 * desktop icon that inherits none of it. Detection is not overridden when the
 * environment already agrees, so nothing changes for a setup that already
 * worked.
 */
export function bedrockTurnEnv(setup: BedrockSetup): Record<string, string> | undefined {
  if (!setup.active) return undefined
  if (setup.profileSource === 'default' || setup.profileSource === 'environment') return undefined
  return { AWS_PROFILE: setup.profile }
}
