import { describe, expect, it, vi } from 'vitest'
import { createFakeProcessRunner } from './processRunner'
import {
  codeIn,
  createAwsAuthService,
  statusFrom,
  urlsIn,
  verificationUrl,
  type AwsAuthService,
  type AwsLoginState
} from './awsAuthService'
import type { BedrockSetup } from './awsBedrock'
import type { AwsProfile } from './awsConfig'

/**
 * The real output of `aws sso login --profile x --no-browser`, captured from
 * AWS CLI 2.32.23. The parser is only worth anything against the actual bytes
 * the CLI prints, so this is a transcript, not an invention.
 */
const AUTH_CODE_OUTPUT = `Browser will not be automatically opened.
Please visit the following URL:

https://oidc.us-east-1.amazonaws.com/authorize?response_type=code&client_id=ItNSDrjknlP2DhQ&redirect_uri=http%3A%2F%2F127.0.0.1%3A44783%2Foauth%2Fcallback&state=ae7df79e&code_challenge_method=S256&scopes=sso%3Aaccount%3Aaccess
`

/** The same command with `--use-device-code`, also captured live. */
const DEVICE_CODE_OUTPUT = `Browser will not be automatically opened.
Please visit the following URL:

https://acme.awsapps.com/start/#/device

Then enter the code:

VFRM-JRXW

Alternatively, you may visit the following URL which will autofill the code upon loading:
https://acme.awsapps.com/start/#/device?user_code=VFRM-JRXW
`

const SSO_PROFILE: AwsProfile = {
  name: 'acme-dev',
  region: 'us-east-1',
  ssoSession: 'acme',
  ssoStartUrl: 'https://acme.awsapps.com/start',
  ssoRegion: 'us-east-1',
  ssoAccountId: '060795902845',
  ssoRoleName: 'AdministratorAccess',
  credentialProcess: null,
  roleArn: null,
  sourceProfile: null,
  hasStaticKeys: false
}

function setup(overrides: Partial<BedrockSetup> = {}): BedrockSetup {
  return {
    active: true,
    profile: 'acme-dev',
    profileSource: 'claude-settings',
    region: 'us-east-1',
    awsProfile: SSO_PROFILE,
    authKind: 'sso',
    token: {
      startUrl: SSO_PROFILE.ssoStartUrl,
      region: 'us-east-1',
      expiresAt: '2026-09-04T20:00:00Z',
      expiresInMs: 8 * 60 * 60 * 1000,
      path: '/cache.json'
    },
    tokenState: 'valid',
    authRefreshCommand: null,
    repairable: true,
    profiles: [SSO_PROFILE],
    ...overrides
  }
}

interface Harness {
  service: AwsAuthService
  runner: ReturnType<typeof createFakeProcessRunner>
  opened: string[]
  states: AwsLoginState[]
  /** Lets a test change what detection answers between calls (a login lands). */
  setSetup: (next: BedrockSetup) => void
}

function harness(initial: BedrockSetup, options: { aws?: string | null } = {}): Harness {
  const runner = createFakeProcessRunner()
  const opened: string[] = []
  const states: AwsLoginState[] = []
  let current = initial
  const service = createAwsAuthService({
    processRunner: runner,
    openExternal: (url) => {
      opened.push(url)
    },
    detect: () => current,
    resolveAws: () => (options.aws === undefined ? '/usr/local/bin/aws' : options.aws),
    tokenFor: () => null
  })
  service.onState((state) => states.push({ ...state }))
  return {
    service,
    runner,
    opened,
    states,
    setSetup: (next) => {
      current = next
    }
  }
}

describe('output parsing', () => {
  it('finds the verification URL in the authorization-code flow', () => {
    expect(verificationUrl(AUTH_CODE_OUTPUT)).toMatch(
      /^https:\/\/oidc\.us-east-1\.amazonaws\.com\/authorize\?/
    )
    expect(codeIn(AUTH_CODE_OUTPUT)).toBeNull()
  })

  it('prefers the autofill URL and reads the code in the device-code flow', () => {
    // The autofill link removes the only manual step in that flow, so when the
    // CLI prints both, sending the user to the bare portal is strictly worse.
    expect(verificationUrl(DEVICE_CODE_OUTPUT)).toBe(
      'https://acme.awsapps.com/start/#/device?user_code=VFRM-JRXW'
    )
    expect(codeIn(DEVICE_CODE_OUTPUT)).toBe('VFRM-JRXW')
  })

  it('answers nothing for output with no URL yet', () => {
    expect(verificationUrl('Browser will not be automatically opened.')).toBeNull()
    expect(urlsIn('nothing here')).toEqual([])
  })

  it('does not mistake a code-shaped fragment inside a URL for the user code', () => {
    expect(codeIn('https://x/?state=ABCD-EFGH')).toBeNull()
  })
})

describe('statusFrom', () => {
  it('reads a live SSO session as ready', () => {
    const status = statusFrom(setup(), true, () => null)
    expect(status.state).toBe('ready')
    expect(status.accountId).toBe('060795902845')
    expect(status.roleName).toBe('AdministratorAccess')
    expect(status.cliAvailable).toBe(true)
  })

  it('passes the token state straight through when it is not valid', () => {
    expect(statusFrom(setup({ tokenState: 'expired' }), true, () => null).state).toBe('expired')
    expect(statusFrom(setup({ tokenState: 'expiring' }), true, () => null).state).toBe('expiring')
    expect(statusFrom(setup({ tokenState: 'absent' }), true, () => null).state).toBe('absent')
  })

  it('says `unmanaged` for a profile that authenticates some other way', () => {
    const status = statusFrom(
      setup({ authKind: 'static', repairable: false, tokenState: 'absent' }),
      true,
      () => null
    )
    expect(status.state).toBe('unmanaged')
  })

  it('says `not-configured` when the profile the CLI will use is not in ~/.aws/config', () => {
    const status = statusFrom(setup({ awsProfile: null, authKind: 'unknown' }), true, () => null)
    expect(status.state).toBe('not-configured')
  })

  it('marks the active profile signed-in from the setup, and the others from their own cache', () => {
    const other: AwsProfile = { ...SSO_PROFILE, name: 'acme-prod' }
    const status = statusFrom(setup({ profiles: [SSO_PROFILE, other] }), true, (profile) =>
      profile.name === 'acme-prod'
        ? { startUrl: null, region: null, expiresAt: 'x', expiresInMs: 1000, path: 'p' }
        : null
    )
    expect(status.profiles.map((entry) => entry.signedIn)).toEqual([true, true])
  })

  it('reads an expired cache for another profile as signed out', () => {
    const other: AwsProfile = { ...SSO_PROFILE, name: 'acme-prod' }
    const status = statusFrom(setup({ profiles: [SSO_PROFILE, other] }), true, () => ({
      startUrl: null,
      region: null,
      expiresAt: 'x',
      expiresInMs: -1,
      path: 'p'
    }))
    expect(status.profiles[1].signedIn).toBe(false)
  })
})

describe('ensureReady', () => {
  it('resolves instantly on a good session, spawning nothing and saying nothing', async () => {
    // The case that happens all day. A gate that costs a process — or draws a
    // surface — on a healthy machine would be worse than no gate.
    const { service, runner, states } = harness(setup())
    const onBlocked = vi.fn()
    await expect(service.ensureReady(undefined, onBlocked)).resolves.toEqual({
      ok: true,
      refreshed: false
    })
    expect(runner.calls).toHaveLength(0)
    expect(onBlocked).not.toHaveBeenCalled()
    expect(states).toHaveLength(0)
  })

  it('runs a login for an expired session and resolves when the CLI comes back', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    const onBlocked = vi.fn()
    const promise = h.service.ensureReady(undefined, onBlocked)
    h.setSetup(setup())
    await expect(promise).resolves.toEqual({ ok: true, refreshed: true })
    expect(onBlocked).toHaveBeenCalledOnce()
    expect(h.runner.calls[0]).toMatchObject({
      command: 'aws',
      args: ['sso', 'login', '--profile', 'acme-dev', '--no-browser']
    })
  })

  it('opens the user browser on the URL the CLI printed', async () => {
    const h = harness(setup({ tokenState: 'absent' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.ensureReady()
    expect(h.opened).toHaveLength(1)
    expect(h.opened[0]).toContain('oidc.us-east-1.amazonaws.com/authorize')
  })

  it('walks the phases in order, and publishes the URL with the browser phase', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.ensureReady()
    expect(h.states.map((state) => state.phase)).toEqual([
      'starting',
      'browser',
      'finishing',
      'success'
    ])
    expect(h.states[1].url).toContain('authorize')
    expect(h.states[1].profile).toBe('acme-dev')
  })

  it('carries the device code through when the CLI prints one', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: DEVICE_CODE_OUTPUT }], code: 0 })
    await h.service.ensureReady()
    expect(h.states.find((state) => state.phase === 'browser')?.code).toBe('VFRM-JRXW')
  })

  it('reports the CLI failure with its last meaningful line', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({
      chunks: [{ stream: 'stderr', data: '\nError loading SSO Token: profile acme-dev\n' }],
      code: 255
    })
    await expect(h.service.ensureReady()).resolves.toEqual({
      ok: false,
      reason: 'failed',
      message: 'Error loading SSO Token: profile acme-dev'
    })
    expect(h.states[h.states.length - 1].phase).toBe('failed')
  })

  it('reports a failure with no output at all rather than an empty message', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ code: 1 })
    const result = await h.service.ensureReady()
    expect(result).toEqual({ ok: false, reason: 'failed', message: 'login-failed' })
  })

  it('refuses, without spawning, when the aws CLI is not on this machine', async () => {
    const h = harness(setup({ tokenState: 'expired' }), { aws: null })
    await expect(h.service.ensureReady()).resolves.toEqual({
      ok: false,
      reason: 'no-cli',
      message: 'aws-cli-missing'
    })
    expect(h.runner.calls).toHaveLength(0)
  })

  it('shares one login between concurrent callers — a second browser window would kill the first', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    const [first, second] = await Promise.all([h.service.ensureReady(), h.service.ensureReady()])
    expect(first).toEqual(second)
    expect(h.runner.calls).toHaveLength(1)
    expect(h.opened).toHaveLength(1)
  })

  it('keeps the login going when the browser refuses to open — the URL is still on screen', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    const service = createAwsAuthService({
      processRunner: runner,
      openExternal: () => {
        throw new Error('no browser')
      },
      detect: () => setup({ tokenState: 'expired' }),
      resolveAws: () => '/usr/local/bin/aws',
      tokenFor: () => null
    })
    await expect(service.ensureReady()).resolves.toEqual({ ok: true, refreshed: true })
  })
})

describe('login and cancel', () => {
  it('logs into the profile the caller names, over the detected one', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.login('acme-prod')
    expect(h.runner.calls[0].args).toContain('acme-prod')
  })

  it('falls back to the detected profile for a blank name', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.login('   ')
    expect(h.runner.calls[0].args).toContain('acme-dev')
  })

  it('logs in on demand even when the session is perfectly good', async () => {
    const h = harness(setup())
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.login()
    expect(h.runner.calls).toHaveLength(1)
  })

  it('cancels the in-flight login and says so', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    h.runner.script({
      chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }],
      code: 0,
      delayMs: 50
    })
    const promise = h.service.login()
    await new Promise((resolve) => setTimeout(resolve, 10))
    h.service.cancel()
    await expect(promise).resolves.toEqual({
      ok: false,
      reason: 'canceled',
      message: 'canceled'
    })
    expect(h.states[h.states.length - 1].phase).toBe('canceled')
  })

  it('cancelling with nothing in flight is a no-op', () => {
    const h = harness(setup())
    expect(() => h.service.cancel()).not.toThrow()
  })

  it('starts idle and hands the current state to a window that opens mid-flight', () => {
    const h = harness(setup())
    expect(h.service.loginState()).toMatchObject({ phase: 'idle', url: null, profile: null })
  })

  it('stops notifying an unsubscribed listener', async () => {
    const h = harness(setup({ tokenState: 'expired' }))
    const seen: string[] = []
    const off = h.service.onState((state) => seen.push(state.phase))
    off()
    h.runner.script({ chunks: [{ stream: 'stdout', data: AUTH_CODE_OUTPUT }], code: 0 })
    await h.service.ensureReady()
    expect(seen).toEqual([])
  })
})

describe('status', () => {
  it('answers from the machine, with the CLI availability folded in', () => {
    const h = harness(setup())
    const status = h.service.status('/work')
    expect(status.profile).toBe('acme-dev')
    expect(status.state).toBe('ready')
    expect(status.cliAvailable).toBe(true)
  })

  it('reports a missing aws CLI, which is what makes the panel offer the install', () => {
    const h = harness(setup(), { aws: null })
    expect(h.service.status().cliAvailable).toBe(false)
  })
})
