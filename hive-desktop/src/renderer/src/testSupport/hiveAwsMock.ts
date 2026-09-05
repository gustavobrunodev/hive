import { vi, type Mock } from 'vitest'

/** Each AWS bridge method as a vitest `Mock`, so a test can override one. */
export type HiveAwsMock = Record<keyof Window['hive']['aws'], Mock>

type Status = Awaited<ReturnType<Window['hive']['aws']['status']>>
type LoginState = Awaited<ReturnType<Window['hive']['aws']['loginState']>>

/**
 * The **inactive** status — Claude is not on Bedrock, which is the majority
 * machine and therefore the right default: every surface this feature adds has
 * to be invisible here, and a fixture that defaulted to "connected" would let
 * a regression that shows the panel to everyone pass its tests.
 */
export function awsStatusFixture(overrides: Partial<Status> = {}): Status {
  return {
    active: false,
    profile: 'default',
    profileSource: 'default',
    region: null,
    accountId: null,
    roleName: null,
    startUrl: null,
    authKind: 'unknown',
    state: 'not-configured',
    expiresAt: null,
    expiresInMs: null,
    cliAvailable: false,
    profiles: [],
    authRefreshCommand: null,
    ...overrides
  }
}

/**
 * Six hours of session, expressed **both** ways — as a duration and as the
 * wall-clock instant it lands on.
 *
 * They have to agree: every live surface prefers `expiresAt` (so the ring
 * counts down between refreshes) and falls back to `expiresInMs`, and a
 * fixture whose two halves disagree tests a machine that cannot exist. The
 * extra minute keeps the floor at "6 h" rather than sliding to "5 h" on a slow
 * test run.
 */
const SIX_HOURS_MS = 6 * 60 * 60 * 1000 + 60_000

/** A live Bedrock machine with a healthy session — the everyday happy path. */
export function awsReadyFixture(overrides: Partial<Status> = {}): Status {
  return awsStatusFixture({
    active: true,
    profile: 'acme-dev',
    profileSource: 'claude-settings',
    region: 'us-east-1',
    accountId: '060795902845',
    roleName: 'AdministratorAccess',
    startUrl: 'https://acme.awsapps.com/start',
    authKind: 'sso',
    state: 'ready',
    expiresAt: new Date(Date.now() + SIX_HOURS_MS).toISOString(),
    expiresInMs: SIX_HOURS_MS,
    cliAvailable: true,
    profiles: [
      {
        name: 'acme-dev',
        accountId: '060795902845',
        roleName: 'AdministratorAccess',
        region: 'us-east-1',
        authKind: 'sso',
        signedIn: true
      }
    ],
    ...overrides
  })
}

export function awsLoginStateFixture(overrides: Partial<LoginState> = {}): LoginState {
  return {
    phase: 'idle',
    profile: null,
    url: null,
    code: null,
    message: null,
    startedAt: null,
    expiresAt: null,
    ...overrides
  }
}

/**
 * A fully-stubbed `window.hive.aws` for tests that mount UI reading
 * `window.hive` but do not exercise the AWS flow. `onState` returns a no-op
 * unsubscribe, matching the real bridge.
 */
export function createHiveAwsMock(status: Status = awsStatusFixture()): HiveAwsMock {
  return {
    status: vi.fn().mockResolvedValue(status),
    loginState: vi.fn().mockResolvedValue(awsLoginStateFixture()),
    login: vi.fn().mockResolvedValue({ ok: true, refreshed: false }),
    cancel: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue(null),
    setProfile: vi.fn().mockResolvedValue(undefined),
    onState: vi.fn().mockReturnValue(() => {})
  }
}
