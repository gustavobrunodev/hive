import { describe, expect, it, vi } from 'vitest'
import {
  asksForCode,
  codeRejection,
  createClaudeAuthService,
  readAccount,
  stateOf,
  urlsIn,
  verificationUrl,
  type ClaudeLoginState
} from './claudeAuthService'
import type {
  ProcessExitResult,
  ProcessHandle,
  ProcessRunner,
  ProcessStreamChunk,
  RunOptions
} from './processRunner'

/**
 * The first-party (Claude account) auth lane.
 *
 * The payloads below are **verbatim** from `claude 2.1.226` on a real machine —
 * signed in, signed out, with a key in the environment, and pointed at Bedrock.
 * They are the whole reason this module can tell the two arrangements apart
 * without guessing from settings files, so they are pinned here as fixtures
 * rather than paraphrased.
 */
const SIGNED_IN = JSON.stringify({
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  analyticsDisabled: false,
  projectsDirectory: '/home/u/.claude/projects',
  email: 'pessoa@exemplo.dev',
  orgId: 'f89d7196',
  orgName: "pessoa@exemplo.dev's Organization",
  subscriptionType: 'pro'
})

const SIGNED_OUT = JSON.stringify({
  loggedIn: false,
  authMethod: 'none',
  apiProvider: 'firstParty'
})

const ON_BEDROCK = JSON.stringify({
  loggedIn: true,
  authMethod: 'third_party',
  apiProvider: 'bedrock',
  analyticsDisabled: true
})

const WITH_KEY = JSON.stringify({
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  apiKeySource: 'ANTHROPIC_API_KEY',
  email: 'pessoa@exemplo.dev'
})

/** The login output as the CLI really prints it: an OSC-8 hyperlink, so the URL appears twice. */
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const OAUTH_URL =
  'https://claude.com/cai/oauth/authorize?code=true&client_id=9d1c250a&state=Z-3SiFig7X9'
const LOGIN_BANNER =
  `Opening browser to sign in…\nIf the browser didn't open, visit: ` +
  `${ESC}]8;;${OAUTH_URL}${BEL}${OAUTH_URL}${ESC}]8;;${BEL}\n`
const CODE_PROMPT = 'Paste code here if prompted > '

describe('readAccount', () => {
  it('reads a signed-in first-party account, plan and all', () => {
    expect(readAccount(SIGNED_IN)).toEqual({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      apiKeySource: null,
      email: 'pessoa@exemplo.dev',
      organization: "pessoa@exemplo.dev's Organization",
      subscription: 'pro'
    })
  })

  it('reads the signed-out and Bedrock answers', () => {
    expect(readAccount(SIGNED_OUT)?.loggedIn).toBe(false)
    expect(readAccount(ON_BEDROCK)?.apiProvider).toBe('bedrock')
  })

  it('answers null for anything that is not an auth-status payload', () => {
    expect(readAccount(null)).toBeNull()
    expect(readAccount('not json at all')).toBeNull()
    expect(readAccount('{"other":"shape"}')).toBeNull()
  })
})

describe('stateOf', () => {
  it('is the CLI missing before it is anything else', () => {
    expect(stateOf(readAccount(SIGNED_IN), false)).toBe('no-cli')
  })

  it('reads a signed-in first-party account as connected', () => {
    expect(stateOf(readAccount(SIGNED_IN), true)).toBe('connected')
  })

  it('reads a signed-out first-party account as the one state with a repair', () => {
    expect(stateOf(readAccount(SIGNED_OUT), true)).toBe('signed-out')
  })

  it('never calls a Bedrock machine signed-out — those credentials are the other lane', () => {
    expect(stateOf(readAccount(ON_BEDROCK), true)).toBe('third-party')
  })

  it('reads a key in the environment as a key, not as an account', () => {
    expect(stateOf(readAccount(WITH_KEY), true)).toBe('api-key')
  })

  it('says so when the CLI answered something it cannot read', () => {
    expect(stateOf(null, true)).toBe('unknown')
  })
})

describe('reading the login transcript', () => {
  it('takes the URL out of an OSC-8 hyperlink without the escape bytes', () => {
    expect(urlsIn(LOGIN_BANNER)).toEqual([OAUTH_URL])
    expect(verificationUrl(LOGIN_BANNER)).toBe(OAUTH_URL)
  })

  it('prefers the oauth URL when the CLI prints more than one', () => {
    expect(verificationUrl(`see https://docs.claude.com/help and ${OAUTH_URL}`)).toBe(OAUTH_URL)
    expect(verificationUrl('no links here')).toBeNull()
  })

  it('sees the paste prompt even though it arrives without a newline', () => {
    expect(asksForCode(LOGIN_BANNER + CODE_PROMPT)).toBe(true)
    expect(asksForCode(LOGIN_BANNER)).toBe(false)
  })

  it('reads a rejected code as the retry it is', () => {
    expect(codeRejection('Invalid code. Please make sure the full code was copied.\n')).toBe(
      'Invalid code. Please make sure the full code was copied.'
    )
    expect(codeRejection('all good')).toBeNull()
  })
})

/** A push-at-will async channel, so a test can drive a process that is still running. */
function channel<T>(): {
  push: (item: T) => void
  end: () => void
  [Symbol.asyncIterator]: () => AsyncIterator<T>
} {
  const items: T[] = []
  let wake: (() => void) | null = null
  let done = false
  return {
    push(item: T): void {
      items.push(item)
      wake?.()
      wake = null
    },
    end(): void {
      done = true
      wake?.()
      wake = null
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        const next = items.shift()
        if (next !== undefined) {
          yield next
          continue
        }
        if (done) return
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
    }
  }
}

/**
 * A process the test drives by hand.
 *
 * The shipped `createFakeProcessRunner` delivers every chunk and exits, which
 * cannot model this flow at all: the login's whole point is that it stays
 * alive, printing a prompt, until something is written to its stdin.
 */
/** A finished process that printed `payload` and exited 0. */
function canned(payload: string): ProcessHandle {
  const output = channel<ProcessStreamChunk>()
  output.push({ stream: 'stdout', data: payload })
  output.end()
  return {
    output,
    exitCode: Promise.resolve({ code: 0, signal: null }),
    kill(): void {
      // Already finished.
    }
  }
}

function interactiveRunner(statusPayload = SIGNED_IN): {
  runner: ProcessRunner
  calls: Array<{ command: string; args: string[]; opts?: RunOptions }>
  written: string[]
  emit: (data: string, stream?: 'stdout' | 'stderr') => Promise<void>
  exit: (code: number) => Promise<void>
  killed: () => boolean
} {
  const calls: Array<{ command: string; args: string[]; opts?: RunOptions }> = []
  const written: string[] = []
  const output = channel<ProcessStreamChunk>()
  let resolveExit: ((result: ProcessExitResult) => void) | null = null
  let wasKilled = false
  const exitCode = new Promise<ProcessExitResult>((resolve) => {
    resolveExit = resolve
  })
  const handle: ProcessHandle = {
    output,
    exitCode,
    kill(): void {
      wasKilled = true
      output.end()
      resolveExit?.({ code: null, signal: 'SIGTERM' })
    },
    write(chunk: string): boolean {
      written.push(chunk)
      return true
    }
  }
  return {
    runner: {
      run(command, args, opts) {
        calls.push({ command, args, opts })
        // Only the login is interactive. The `auth status` the service reads
        // back afterwards is a one-shot, and it has to answer *something* —
        // handing it the login's spent handle is what made the first version
        // of this fake report `unknown` for every account.
        if (args[1] === 'status') return canned(statusPayload)
        return handle
      }
    },
    calls,
    written,
    // A macrotask, not a microtask hop: the service's read loop awaits inside
    // (it opens the browser), so a fixed number of `Promise.resolve()`s would
    // be a guess about how many awaits it happens to contain today.
    async emit(data, stream = 'stdout') {
      output.push({ stream, data })
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
    async exit(code) {
      output.end()
      resolveExit?.({ code, signal: null })
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
    killed: () => wasKilled
  }
}

/** A runner that answers `auth status` from a queue of payloads. */
function statusRunner(payloads: string[]): {
  runner: ProcessRunner
  calls: Array<{ command: string; args: string[]; opts?: RunOptions }>
} {
  const calls: Array<{ command: string; args: string[]; opts?: RunOptions }> = []
  return {
    calls,
    runner: {
      run(command, args, opts) {
        calls.push({ command, args, opts })
        const payload = payloads.shift() ?? ''
        const output = channel<ProcessStreamChunk>()
        output.push({ stream: 'stdout', data: payload })
        output.end()
        return {
          output,
          exitCode: Promise.resolve({ code: 0, signal: null }),
          kill(): void {
            // Nothing to kill: this handle has already delivered and exited.
          }
        }
      }
    }
  }
}

describe('status', () => {
  it('asks the CLI, in the workspace, and reads its answer', async () => {
    const { runner, calls } = statusRunner([SIGNED_IN])
    const service = createClaudeAuthService({
      processRunner: runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const status = await service.status('/work')
    expect(calls[0]).toMatchObject({
      command: 'claude',
      args: ['auth', 'status', '--json'],
      opts: { cwd: '/work' }
    })
    expect(status.state).toBe('connected')
    expect(status.account?.email).toBe('pessoa@exemplo.dev')
  })

  it('caches the answer — the probe costs seconds against a Windows shim', async () => {
    const { runner, calls } = statusRunner([SIGNED_IN, SIGNED_OUT])
    const service = createClaudeAuthService({
      processRunner: runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    expect((await service.status()).state).toBe('connected')
    expect((await service.status()).state).toBe('connected')
    expect(calls).toHaveLength(1)
    // …and `refresh` is how a surface that just changed something gets truth.
    expect((await service.status(undefined, true)).state).toBe('signed-out')
    expect(calls).toHaveLength(2)
  })

  it('never spawns anything when the binary is not on the PATH', async () => {
    const { runner, calls } = statusRunner([SIGNED_IN])
    const service = createClaudeAuthService({
      processRunner: runner,
      openExternal: vi.fn(),
      resolveClaude: () => null
    })

    const status = await service.status()
    expect(status).toMatchObject({ state: 'no-cli', cliAvailable: false, account: null })
    expect(calls).toHaveLength(0)
  })
})

describe('login', () => {
  it('drives the whole hand-off: URL to the browser, code to stdin, account back', async () => {
    const fake = interactiveRunner()
    const openExternal = vi.fn()
    const seen: ClaudeLoginState[] = []
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal,
      resolveClaude: () => '/usr/bin/claude'
    })
    service.onState((state) => seen.push({ ...state }))

    const done = service.login('claudeai', '/work')
    await Promise.resolve()
    expect(fake.calls[0]).toMatchObject({
      command: 'claude',
      args: ['auth', 'login', '--claudeai'],
      opts: { stdin: 'pipe', cwd: '/work' }
    })
    expect(service.loginState().phase).toBe('starting')

    await fake.emit(LOGIN_BANNER)
    expect(openExternal).toHaveBeenCalledWith(OAUTH_URL)
    expect(service.loginState()).toMatchObject({ phase: 'browser', url: OAUTH_URL })

    await fake.emit(CODE_PROMPT)
    expect(service.loginState().phase).toBe('code')

    // A wrong paste is a retry: the process is still alive and still asking.
    expect(service.submitCode('  wrong-code  ')).toBe(true)
    expect(fake.written).toEqual(['wrong-code\n'])
    expect(service.loginState().phase).toBe('finishing')
    await fake.emit('Invalid code. Please make sure the full code was copied.\n', 'stderr')
    expect(service.loginState()).toMatchObject({
      phase: 'code',
      codeError: 'Invalid code. Please make sure the full code was copied.'
    })

    service.submitCode('right-code')
    await fake.exit(0)
    const result = await done
    expect(result.ok).toBe(true)
    expect(service.loginState().phase).toBe('success')
    // Every phase was announced, in order, to whoever was listening.
    expect(seen.map((state) => state.phase)).toEqual([
      'starting',
      'browser',
      'code',
      'finishing',
      'code',
      'finishing',
      'success'
    ])
  })

  it('calls a clean exit that left no account a failure — the chat re-sends on `ok`', async () => {
    // A browser tab closed on the consent screen, a code minted for another
    // install: the CLI can exit 0 and leave nothing behind. Answering `ok`
    // there would make the chat re-send the failed turn straight into the same
    // failure.
    const fake = interactiveRunner(SIGNED_OUT)
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const done = service.login()
    await Promise.resolve()
    await fake.emit('Sign-in cancelled in the browser\n', 'stderr')
    await fake.exit(0)

    expect(await done).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Sign-in cancelled in the browser'
    })
    expect(service.loginState().phase).toBe('failed')
  })

  it('reads back who signed in, and says so', async () => {
    const fake = interactiveRunner(SIGNED_IN)
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const done = service.login()
    await Promise.resolve()
    await fake.exit(0)
    const result = await done
    expect(result).toMatchObject({ ok: true })
    expect(service.loginState()).toMatchObject({
      phase: 'success',
      account: { email: 'pessoa@exemplo.dev', subscription: 'pro' }
    })
  })

  it('shares one attempt between callers — a second browser window would void the first code', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const first = service.login()
    const second = service.login()
    expect(first).toBe(second)
    await fake.exit(0)
    await first
    // One login. (The second call is the status re-read a landed login always
    // does — see `runLogin`.)
    expect(fake.calls.filter((call) => call.args[1] === 'login')).toHaveLength(1)
  })

  it('reports the CLI’s own last line when the login fails', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const done = service.login('console')
    await Promise.resolve()
    expect(fake.calls[0].args).toEqual(['auth', 'login', '--console'])
    await fake.emit('Error: could not reach claude.com\n', 'stderr')
    await fake.exit(1)

    expect(await done).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Error: could not reach claude.com'
    })
    expect(service.loginState().phase).toBe('failed')
  })

  it('cancels the attempt the user gave up on', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })

    const done = service.login()
    await Promise.resolve()
    service.cancel()
    expect(await done).toMatchObject({ ok: false, reason: 'canceled' })
    expect(fake.killed()).toBe(true)
    expect(service.loginState().phase).toBe('canceled')
  })

  it('fails without spawning when there is no CLI to sign into', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => null
    })

    expect(await service.login()).toMatchObject({ ok: false, reason: 'no-cli' })
    expect(fake.calls).toHaveLength(0)
    expect(service.submitCode('anything')).toBe(false)
  })

  it('ignores an empty paste and stops publishing to a listener that left', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn(),
      resolveClaude: () => '/usr/bin/claude'
    })
    const seen: string[] = []
    const off = service.onState((state) => seen.push(state.phase))

    const done = service.login()
    await Promise.resolve()
    expect(service.submitCode('   ')).toBe(false)
    off()
    await fake.exit(0)
    await done
    expect(seen).toEqual(['starting'])
  })

  it('keeps the login alive when the browser refuses to open', async () => {
    const fake = interactiveRunner()
    const service = createClaudeAuthService({
      processRunner: fake.runner,
      openExternal: vi.fn().mockRejectedValue(new Error('no browser')),
      resolveClaude: () => '/usr/bin/claude'
    })

    const done = service.login()
    await Promise.resolve()
    await fake.emit(LOGIN_BANNER)
    expect(service.loginState()).toMatchObject({ phase: 'browser', url: OAUTH_URL })
    await fake.exit(0)
    await done
  })
})
