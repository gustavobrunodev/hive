import { describe, expect, it } from 'vitest'
import {
  authKindOf,
  awsConfigPaths,
  findProfile,
  isSsoKind,
  parseIni,
  readAwsConfig,
  ssoCacheKeyOf,
  type AwsConfigView
} from './awsConfig'

/**
 * Every test hands a fake `~/.aws` in memory. No disk, no AWS account — and
 * the fixtures are the real files: the config below is byte-for-byte the shape
 * `aws configure sso` writes (verified against AWS CLI 2.32.23), because a
 * parser tested only against its own idea of the format is a parser that fails
 * on the first real machine.
 */
const CONFIG = `[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1

[profile acme-dev]
sso_session = acme
sso_account_id = 060795902845
sso_role_name = AdministratorAccess
region = us-east-1

[profile acme-prod]
sso_session = acme
sso_account_id = 241533149506
sso_role_name = ReadOnly
region = sa-east-1
`

function read(files: Record<string, string>): AwsConfigView {
  return readAwsConfig({
    home: '/home/u',
    env: {},
    readText: (path) => files[path] ?? null
  })
}

const CONFIG_PATH = '/home/u/.aws/config'
const CREDENTIALS_PATH = '/home/u/.aws/credentials'

describe('parseIni', () => {
  it('reads sections and lower-cases keys, keeping section names as written', () => {
    const parsed = parseIni('[profile Dev]\nRegion = us-east-1\n')
    expect(parsed.get('profile Dev')?.get('region')).toBe('us-east-1')
  })

  it('drops comments introduced by # or ; after whitespace', () => {
    const parsed = parseIni('[default]\nregion = us-east-1 # a comment\n; whole line\n')
    expect(parsed.get('default')?.get('region')).toBe('us-east-1')
    expect(parsed.get('default')?.size).toBe(1)
  })

  it('keeps a # that is part of a value, since a URL fragment is not a comment', () => {
    const parsed = parseIni('[default]\nsso_start_url = https://x/start#/\n')
    expect(parsed.get('default')?.get('sso_start_url')).toBe('https://x/start#/')
  })

  it('skips the indented sub-settings the AWS CLI allows, rather than reading them as keys', () => {
    const parsed = parseIni('[default]\ns3 =\n  max_concurrent_requests = 20\nregion = us-east-1\n')
    expect(parsed.get('default')?.has('max_concurrent_requests')).toBe(false)
    expect(parsed.get('default')?.get('region')).toBe('us-east-1')
  })

  it('ignores a key before any section, and a line with no separator', () => {
    const parsed = parseIni('stray = 1\n[default]\nno-separator\nregion = x\n')
    expect(parsed.size).toBe(1)
    expect(parsed.get('default')?.size).toBe(1)
  })

  it('merges a section repeated later in the file', () => {
    const parsed = parseIni('[default]\nregion = a\n[other]\nx = 1\n[default]\nrole_arn = b\n')
    expect(parsed.get('default')?.get('region')).toBe('a')
    expect(parsed.get('default')?.get('role_arn')).toBe('b')
  })
})

describe('readAwsConfig', () => {
  it('reads profiles and resolves each one against its sso-session', () => {
    const view = read({ [CONFIG_PATH]: CONFIG })
    expect(view.profiles.map((profile) => profile.name)).toEqual(['acme-dev', 'acme-prod'])
    const dev = findProfile(view, 'acme-dev')
    expect(dev?.ssoStartUrl).toBe('https://acme.awsapps.com/start')
    expect(dev?.ssoRegion).toBe('us-east-1')
    expect(dev?.ssoAccountId).toBe('060795902845')
    expect(dev?.ssoRoleName).toBe('AdministratorAccess')
  })

  it('names the unnamed [default] section "default"', () => {
    const view = read({ [CONFIG_PATH]: '[default]\nregion = us-east-1\n' })
    expect(view.profiles[0].name).toBe('default')
  })

  it('lists a profile that exists only in ~/.aws/credentials', () => {
    const view = read({
      [CONFIG_PATH]: CONFIG,
      [CREDENTIALS_PATH]: '[legacy]\naws_access_key_id = AKIA\naws_secret_access_key = s\n'
    })
    const legacy = findProfile(view, 'legacy')
    expect(legacy?.hasStaticKeys).toBe(true)
    expect(authKindOf(legacy)).toBe('static')
  })

  it('does not duplicate a profile that is in both files', () => {
    const view = read({
      [CONFIG_PATH]: '[profile acme-dev]\nregion = us-east-1\n',
      [CREDENTIALS_PATH]: '[acme-dev]\naws_access_key_id = AKIA\n'
    })
    expect(view.profiles).toHaveLength(1)
    expect(view.profiles[0].hasStaticKeys).toBe(true)
  })

  it('answers empty for a machine with no AWS config at all, rather than throwing', () => {
    const view = read({})
    expect(view.profiles).toEqual([])
    expect(view.sessions).toEqual([])
  })

  it('honours AWS_CONFIG_FILE / AWS_SHARED_CREDENTIALS_FILE', () => {
    const paths = awsConfigPaths({
      home: '/home/u',
      env: { AWS_CONFIG_FILE: '/etc/aws.conf', AWS_SHARED_CREDENTIALS_FILE: '/etc/aws.creds' }
    })
    expect(paths).toEqual({ configPath: '/etc/aws.conf', credentialsPath: '/etc/aws.creds' })
  })

  it('falls back to ~/.aws when the overrides are blank', () => {
    const paths = awsConfigPaths({ home: '/home/u', env: { AWS_CONFIG_FILE: '  ' } })
    expect(paths.configPath).toBe('/home/u/.aws/config')
  })
})

describe('authKindOf', () => {
  it('reads sso_session as the modern SSO form', () => {
    const view = read({ [CONFIG_PATH]: CONFIG })
    expect(authKindOf(findProfile(view, 'acme-dev'))).toBe('sso')
  })

  it('reads a bare sso_start_url as the legacy SSO form', () => {
    const view = read({
      [CONFIG_PATH]: '[profile old]\nsso_start_url = https://acme.awsapps.com/start\n'
    })
    expect(authKindOf(findProfile(view, 'old'))).toBe('sso-legacy')
  })

  it('prefers the session over the legacy keys on a migrated profile', () => {
    const view = read({
      [CONFIG_PATH]: `${CONFIG}\n[profile mixed]\nsso_session = acme\nsso_start_url = https://acme.awsapps.com/start\n`
    })
    expect(authKindOf(findProfile(view, 'mixed'))).toBe('sso')
  })

  it('recognises credential_process, static keys, assume-role and nothing at all', () => {
    const view = read({
      [CONFIG_PATH]:
        '[profile helper]\ncredential_process = /bin/creds\n' +
        '[profile chained]\nrole_arn = arn:aws:iam::1:role/x\nsource_profile = helper\n' +
        '[profile empty]\nregion = us-east-1\n'
    })
    expect(authKindOf(findProfile(view, 'helper'))).toBe('process')
    expect(authKindOf(findProfile(view, 'chained'))).toBe('assume-role')
    expect(authKindOf(findProfile(view, 'empty'))).toBe('unknown')
    expect(authKindOf(null)).toBe('unknown')
  })

  it('says which kinds Hive can repair with a login', () => {
    expect(isSsoKind('sso')).toBe(true)
    expect(isSsoKind('sso-legacy')).toBe(true)
    expect(isSsoKind('static')).toBe(false)
    expect(isSsoKind('process')).toBe(false)
  })
})

describe('ssoCacheKeyOf', () => {
  it('is the session name for a modern profile — that is what the CLI hashes', () => {
    const view = read({ [CONFIG_PATH]: CONFIG })
    expect(ssoCacheKeyOf(findProfile(view, 'acme-dev'))).toBe('acme')
  })

  it('is the start URL for a legacy profile', () => {
    const view = read({
      [CONFIG_PATH]: '[profile old]\nsso_start_url = https://acme.awsapps.com/start\n'
    })
    expect(ssoCacheKeyOf(findProfile(view, 'old'))).toBe('https://acme.awsapps.com/start')
  })

  it('is null for a profile with no SSO at all, and for no profile', () => {
    const view = read({ [CONFIG_PATH]: '[profile x]\nregion = us-east-1\n' })
    expect(ssoCacheKeyOf(findProfile(view, 'x'))).toBeNull()
    expect(ssoCacheKeyOf(null)).toBeNull()
  })
})

describe('findProfile', () => {
  it('answers null for an unknown name and for no name', () => {
    const view = read({ [CONFIG_PATH]: CONFIG })
    expect(findProfile(view, 'nope')).toBeNull()
    expect(findProfile(view, null)).toBeNull()
  })
})
