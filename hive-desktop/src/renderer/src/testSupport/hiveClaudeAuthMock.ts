import { vi, type Mock } from 'vitest'

/** Each Claude-account bridge method as a vitest `Mock`, so a test can override one. */
export type HiveClaudeAuthMock = Record<keyof Window['hive']['claudeAuth'], Mock>

type Status = Awaited<ReturnType<Window['hive']['claudeAuth']['status']>>
type LoginState = Awaited<ReturnType<Window['hive']['claudeAuth']['loginState']>>
type Account = NonNullable<Status['account']>

/**
 * The **connected** status — a machine signed into a Claude account, which is
 * the majority arrangement and therefore the right default: every surface this
 * feature adds is a repair for a problem this machine does not have, and a
 * fixture that defaulted to "signed out" would let a regression that nags
 * everyone pass its tests.
 */
export function claudeAccountFixture(overrides: Partial<Account> = {}): Account {
  return {
    loggedIn: true,
    authMethod: 'claude.ai',
    apiProvider: 'firstParty',
    apiKeySource: null,
    email: 'pessoa@exemplo.dev',
    organization: 'Organização de pessoa@exemplo.dev',
    subscription: 'pro',
    ...overrides
  }
}

export function claudeStatusFixture(overrides: Partial<Status> = {}): Status {
  return {
    state: 'connected',
    account: claudeAccountFixture(),
    cliAvailable: true,
    checkedAt: Date.now(),
    ...overrides
  }
}

/** The one state with a repair: no account on this machine. */
export function claudeSignedOutFixture(overrides: Partial<Status> = {}): Status {
  return claudeStatusFixture({
    state: 'signed-out',
    account: claudeAccountFixture({
      loggedIn: false,
      authMethod: 'none',
      email: null,
      organization: null,
      subscription: null
    }),
    ...overrides
  })
}

export function claudeLoginStateFixture(overrides: Partial<LoginState> = {}): LoginState {
  return {
    phase: 'idle',
    mode: 'claudeai',
    url: null,
    codeError: null,
    message: null,
    startedAt: null,
    account: null,
    ...overrides
  }
}

/**
 * A fully-stubbed `window.hive.claudeAuth` for tests that mount UI reading
 * `window.hive` but do not exercise the sign-in. `onState` returns a no-op
 * unsubscribe, matching the real bridge.
 */
export function createHiveClaudeAuthMock(
  status: Status = claudeStatusFixture()
): HiveClaudeAuthMock {
  return {
    status: vi.fn().mockResolvedValue(status),
    loginState: vi.fn().mockResolvedValue(claudeLoginStateFixture()),
    login: vi.fn().mockResolvedValue({ ok: true, account: status.account }),
    submitCode: vi.fn().mockResolvedValue(true),
    cancel: vi.fn().mockResolvedValue(undefined),
    onState: vi.fn().mockReturnValue(() => {})
  }
}
