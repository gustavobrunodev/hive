import { describe, expect, it } from 'vitest'
import {
  bedrockTurnEnv,
  detectBedrockSetup,
  needsSsoLogin,
  profileFromCommand,
  sessionFromCommand,
  type BedrockDetectDeps,
  type BedrockSetup
} from './awsBedrock'
import { ssoCacheDir, ssoCacheFileName } from './awsSsoCache'

const HOME = '/home/u'
const NOW = Date.parse('2026-09-04T12:00:00Z')

const AWS_CONFIG = `[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1

[profile acme-dev]
sso_session = acme
sso_account_id = 060795902845
sso_role_name = AdministratorAccess
region = us-east-1

[profile acme-prod]
sso_session = acme
region = sa-east-1
`

const cachePath = (key: string): string => `${ssoCacheDir({ home: HOME })}/${ssoCacheFileName(key)}`

function token(expiresAt: string): Record<string, string> {
  return { startUrl: 'https://acme.awsapps.com/start', accessToken: 't', expiresAt }
}

/**
 * One machine, described entirely in memory: the Claude settings chain
 * (`json`), the AWS config text, and the SSO cache. Nothing spawns, nothing
 * touches disk — which is the only way the expired-session path is testable at
 * all on a laptop with a healthy session.
 */
function detect(options: {
  json?: Record<string, unknown>
  awsConfig?: string
  cache?: Record<string, unknown>
  env?: NodeJS.ProcessEnv
  preferredProfile?: string | null
  workspace?: string
}): BedrockSetup {
  const json = { ...(options.json ?? {}), ...(options.cache ?? {}) }
  const deps: BedrockDetectDeps = {
    home: HOME,
    platform: 'linux',
    env: options.env ?? {},
    now: () => NOW,
    readJson: <T>(path: string) => (json[path] as T) ?? null,
    readText: (path) => (path.endsWith('config') ? (options.awsConfig ?? AWS_CONFIG) : null),
    listDir: () => [],
    ...(options.workspace ? { workspace: options.workspace } : {}),
    ...(options.preferredProfile !== undefined
      ? { preferredProfile: options.preferredProfile }
      : {})
  }
  return detectBedrockSetup(deps)
}

const USER_SETTINGS = '/home/u/.claude/settings.json'

describe('profileFromCommand', () => {
  it('reads the profile a team wrote into awsAuthRefresh — both flag spellings', () => {
    expect(profileFromCommand('aws sso login --profile acme-dev')).toBe('acme-dev')
    expect(profileFromCommand('aws sso login --profile=acme-dev')).toBe('acme-dev')
  })

  it('reads a quoted profile, since a profile name may contain a space', () => {
    expect(profileFromCommand('aws sso login --profile "my team"')).toBe('my team')
    expect(profileFromCommand("aws sso login --profile 'my team'")).toBe('my team')
  })

  it('reads the shell-variable form an author is just as likely to write', () => {
    expect(profileFromCommand('AWS_PROFILE=acme-dev aws sso login')).toBe('acme-dev')
  })

  it('answers null when the command names no profile', () => {
    expect(profileFromCommand('aws sso login')).toBeNull()
    expect(profileFromCommand(null)).toBeNull()
  })

  it('reads --sso-session separately', () => {
    expect(sessionFromCommand('aws sso login --sso-session acme')).toBe('acme')
    expect(sessionFromCommand('aws sso login --profile x')).toBeNull()
  })
})

describe('detectBedrockSetup — is Bedrock even in play', () => {
  it('is inactive on a machine with nothing configured', () => {
    expect(detect({}).active).toBe(false)
  })

  it('is active when a Claude settings file switches it on, whatever Hive was launched with', () => {
    const setup = detect({
      json: { [USER_SETTINGS]: { env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-east-1' } } }
    })
    expect(setup.active).toBe(true)
    expect(setup.region).toBe('us-east-1')
  })

  it('accepts every truthy spelling the CLI itself accepts', () => {
    for (const value of ['1', 'true', 'yes', 'on', 'TRUE']) {
      expect(detect({ env: { CLAUDE_CODE_USE_BEDROCK: value } }).active).toBe(true)
    }
    for (const value of ['0', 'false', '']) {
      expect(detect({ env: { CLAUDE_CODE_USE_BEDROCK: value } }).active).toBe(false)
    }
  })

  it('lets a settings file turn Bedrock OFF over an environment that turned it on', () => {
    const setup = detect({
      env: { CLAUDE_CODE_USE_BEDROCK: '1' },
      json: { [USER_SETTINGS]: { env: { CLAUDE_CODE_USE_BEDROCK: '0' } } }
    })
    expect(setup.active).toBe(false)
  })
})

describe('detectBedrockSetup — which profile, and how we know', () => {
  it('prefers the profile the user pinned in Hive over everything else', () => {
    const setup = detect({
      preferredProfile: 'acme-prod',
      env: { AWS_PROFILE: 'acme-dev' },
      json: { [USER_SETTINGS]: { env: { AWS_PROFILE: 'acme-dev' } } }
    })
    expect(setup.profile).toBe('acme-prod')
    expect(setup.profileSource).toBe('hive')
  })

  it('then the Claude settings env block', () => {
    const setup = detect({ json: { [USER_SETTINGS]: { env: { AWS_PROFILE: 'acme-dev' } } } })
    expect(setup.profile).toBe('acme-dev')
    expect(setup.profileSource).toBe('claude-settings')
  })

  it('then the profile named inside awsAuthRefresh — the command a human already got right', () => {
    const setup = detect({
      json: { [USER_SETTINGS]: { awsAuthRefresh: 'aws sso login --profile acme-prod' } }
    })
    expect(setup.profile).toBe('acme-prod')
    expect(setup.profileSource).toBe('auth-refresh-command')
    expect(setup.authRefreshCommand).toBe('aws sso login --profile acme-prod')
  })

  it('then the inherited environment', () => {
    const setup = detect({ env: { AWS_PROFILE: 'acme-dev' } })
    expect(setup.profileSource).toBe('environment')
  })

  it('resolves an --sso-session command to its one profile when the session has exactly one', () => {
    const setup = detect({
      awsConfig: `[sso-session acme]\nsso_start_url = https://acme.awsapps.com/start\n\n[profile only]\nsso_session = acme\n`,
      json: { [USER_SETTINGS]: { awsAuthRefresh: 'aws sso login --sso-session acme' } }
    })
    expect(setup.profile).toBe('only')
    expect(setup.profileSource).toBe('auth-refresh-command')
  })

  it('does not guess when a session has two profiles', () => {
    const setup = detect({
      json: { [USER_SETTINGS]: { awsAuthRefresh: 'aws sso login --sso-session acme' } }
    })
    expect(setup.profile).toBe('default')
    expect(setup.profileSource).toBe('default')
  })

  it('reads a project settings file over the user one', () => {
    const setup = detect({
      workspace: '/work',
      json: {
        [USER_SETTINGS]: { env: { AWS_PROFILE: 'acme-dev' } },
        '/work/.claude/settings.json': { env: { AWS_PROFILE: 'acme-prod' } }
      }
    })
    expect(setup.profile).toBe('acme-prod')
  })
})

describe('detectBedrockSetup — the session itself', () => {
  const bedrock = {
    [USER_SETTINGS]: { env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_PROFILE: 'acme-dev' } }
  }

  it('reads a live session as valid and repairable', () => {
    const setup = detect({
      json: bedrock,
      cache: { [cachePath('acme')]: token('2026-09-04T20:00:00Z') }
    })
    expect(setup.tokenState).toBe('valid')
    expect(setup.repairable).toBe(true)
    expect(needsSsoLogin(setup)).toBe(false)
  })

  it('reads a stale session as expired, and asks for a login', () => {
    const setup = detect({
      json: bedrock,
      cache: { [cachePath('acme')]: token('2026-09-04T06:00:00Z') }
    })
    expect(setup.tokenState).toBe('expired')
    expect(needsSsoLogin(setup)).toBe(true)
  })

  it('asks for a login when there is no cached session at all', () => {
    const setup = detect({ json: bedrock })
    expect(setup.tokenState).toBe('absent')
    expect(needsSsoLogin(setup)).toBe(true)
  })

  it('never asks for a login when Bedrock is not in play', () => {
    const setup = detect({ json: { [USER_SETTINGS]: { env: { AWS_PROFILE: 'acme-dev' } } } })
    expect(needsSsoLogin(setup)).toBe(false)
  })

  it('leaves a static-key profile alone — nothing expires, nothing to repair', () => {
    const setup = detect({
      awsConfig: '[profile keys]\nregion = us-east-1\naws_access_key_id = AKIA\n',
      json: {
        [USER_SETTINGS]: { env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_PROFILE: 'keys' } }
      }
    })
    expect(setup.authKind).toBe('static')
    expect(setup.repairable).toBe(false)
    expect(needsSsoLogin(setup)).toBe(false)
  })

  it('falls back to the profile region when no AWS_REGION is set', () => {
    const setup = detect({
      json: { [USER_SETTINGS]: { env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_PROFILE: 'acme-prod' } } }
    })
    expect(setup.region).toBe('sa-east-1')
  })
})

describe('bedrockTurnEnv', () => {
  const withSource = (source: BedrockSetup['profileSource'], active = true): BedrockSetup =>
    ({ active, profile: 'acme-dev', profileSource: source }) as BedrockSetup

  it('passes AWS_PROFILE when Hive knows something the process would not have found', () => {
    expect(bedrockTurnEnv(withSource('claude-settings'))).toEqual({ AWS_PROFILE: 'acme-dev' })
    expect(bedrockTurnEnv(withSource('auth-refresh-command'))).toEqual({ AWS_PROFILE: 'acme-dev' })
    expect(bedrockTurnEnv(withSource('hive'))).toEqual({ AWS_PROFILE: 'acme-dev' })
  })

  it('changes nothing when the environment already agrees, or when nothing named a profile', () => {
    expect(bedrockTurnEnv(withSource('environment'))).toBeUndefined()
    expect(bedrockTurnEnv(withSource('default'))).toBeUndefined()
  })

  it('changes nothing at all off Bedrock', () => {
    expect(bedrockTurnEnv(withSource('claude-settings', false))).toBeUndefined()
  })
})
