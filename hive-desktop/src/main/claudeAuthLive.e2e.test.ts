import { describe, expect, it, vi } from 'vitest'
import { createClaudeAuthService } from './claudeAuthService'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import { createProcessRunner } from './processRunner'
import { diagnoseClaudeFailure } from './awsDiagnose'
import type { AgentEvent } from './agentAdapter'

/**
 * The first-party credential lane, against the **real `claude` binary**.
 *
 * Two claims no fake runner can make, and both are facts about a binary that
 * ships on its own schedule:
 *
 *  1. `claude auth status --json` still answers in the shape this feature
 *     reads (`loggedIn` / `authMethod` / `apiProvider`). Everything else —
 *     which lane the app shows, whether it offers a sign-in — hangs off that
 *     one payload.
 *  2. A turn that fails for a **credential** reason now says so. That is the
 *     whole bug: the CLI writes nothing to stderr in that case, so the app
 *     reported `claude exited with code 1` and stopped there.
 *
 * Excluded from `npm run test` (it is an `*.e2e.test.ts`); run with
 * `npm run test:e2e` on a machine with `claude` installed. The turn spends one
 * small `haiku` request, at the lowest effort.
 *
 * `HIVE_E2E_SIGNED_OUT_CLAUDE=<path>` is optional and points at a *second*
 * `claude` that is signed out — the only way to exercise claim 2 without
 * logging the machine out. Skipped when it isn't set.
 */
const AVAILABLE = process.env.HIVE_SKIP_CLAUDE_LIVE !== '1'
const SIGNED_OUT = process.env.HIVE_E2E_SIGNED_OUT_CLAUDE ?? ''

/** Polls `condition` until it holds, or gives up after ~30 s. */
async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 60 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

/** Drains one turn, returning every event it produced. */
async function runTurn(text: string): Promise<AgentEvent[]> {
  const adapter = createClaudeCliAdapter(createProcessRunner())
  const session = adapter.startSession({
    workspace: process.cwd(),
    model: 'haiku',
    effort: 'low'
  })
  session.send({ text, turnId: 'live-auth-1' })
  const events: AgentEvent[] = []
  for await (const event of session.events) {
    events.push(event)
    if (event.type === 'done' || event.type === 'error') break
  }
  session.stop()
  return events
}

describe.skipIf(!AVAILABLE)('the Claude account lane — against the real CLI', () => {
  it('reads this machine’s account out of `claude auth status --json`', async () => {
    const service = createClaudeAuthService({
      processRunner: createProcessRunner(),
      openExternal: vi.fn()
    })

    const status = await service.status(process.cwd(), true)
    // The point is the *shape*: a machine may be signed in, signed out, on
    // Bedrock or have no CLI at all, and each of those is a valid answer this
    // feature draws a different surface for. What must never happen is
    // `unknown`, which means the payload stopped being readable.
    expect(['connected', 'signed-out', 'api-key', 'third-party', 'no-cli']).toContain(status.state)
    if (status.state === 'connected') {
      expect(status.account?.loggedIn).toBe(true)
      expect(status.account?.apiProvider).toBe('firstParty')
    }
  })

  it('answers a real haiku turn when the account is good', async () => {
    const service = createClaudeAuthService({
      processRunner: createProcessRunner(),
      openExternal: vi.fn()
    })
    const status = await service.status(process.cwd(), true)
    if (status.state !== 'connected' && status.state !== 'api-key') {
      // Nothing to prove on a machine with no first-party credentials; the
      // failure path below is the one that covers that case.
      return
    }

    const events = await runTurn('Responda apenas com a palavra: pronto')
    const reply = events
      .filter((event): event is Extract<AgentEvent, { type: 'token' }> => event.type === 'token')
      .map((event) => event.text)
      .join('')
    expect(events.at(-1)?.type).toBe('done')
    expect(reply.toLowerCase()).toContain('pronto')
  })

  /**
   * The paste seam, against the real binary.
   *
   * Opt-in (`HIVE_E2E_CLAUDE_LOGIN=1`) because it starts a real sign-in: it
   * mints a verification URL, holds it open for a few seconds and cancels. The
   * browser is never opened (`openExternal` is a spy), and the code it sends is
   * deliberately wrong — what is being proven is the mechanism, not a login.
   *
   * Measured here on `claude 2.1.226`, driving the machine's own CLI:
   * `starting → browser → code → finishing → code(rejected) → canceled`. That
   * sequence is the whole feature: the CLI's terminal prompt is answerable from
   * a desktop app, and a wrong paste is a retry rather than a dead flow.
   */
  it.skipIf(process.env.HIVE_E2E_CLAUDE_LOGIN !== '1')(
    'drives a real `claude auth login` to its paste prompt, and gets a wrong code refused',
    async () => {
      const opened: string[] = []
      const service = createClaudeAuthService({
        processRunner: createProcessRunner(),
        openExternal: (url) => {
          opened.push(url)
        }
      })

      const done = service.login('claudeai')
      await waitFor(() => service.loginState().phase === 'code')
      expect(opened[0]).toMatch(/^https:\/\/claude\.com\/cai\/oauth\/authorize/)

      expect(service.submitCode('bogus-code-123')).toBe(true)
      await waitFor(() => service.loginState().codeError !== null)
      expect(service.loginState().codeError).toMatch(/invalid code/i)
      // …and the process is still alive, still asking: a wrong paste is a
      // retry. Cancelling is how this test gives the machine back.
      expect(service.loginState().phase).toBe('code')

      service.cancel()
      expect(await done).toMatchObject({ ok: false, reason: 'canceled' })
    },
    120_000
  )

  it.skipIf(SIGNED_OUT === '')(
    'names the credential failure instead of an exit code, and diagnoses it as the account',
    async () => {
      const previous = process.env.PATH
      // The signed-out binary first on PATH, so the adapter resolves it.
      process.env.PATH = `${SIGNED_OUT}:${previous ?? ''}`
      try {
        const { resetCliPathCache } = await import('./cliEnv')
        resetCliPathCache()
        const events = await runTurn('oi')
        const error = events.find(
          (event): event is Extract<AgentEvent, { type: 'error' }> => event.type === 'error'
        )
        expect(error).toBeDefined()
        // Measured here, on a real signed-out `claude 2.1.226`: stderr is
        // **empty** and the reason (`Failed to authenticate: OAuth session
        // expired and could not be refreshed`) exists only inside the JSON
        // stream. `cliAdapterCore` reads it, `diagnoseClaudeFailure` classifies
        // it, and the adapter hands the chat this code — which is what turns
        // "claude exited with code 1" into a sentence with a button under it.
        expect(error?.message).toBe('claude-auth:signed-out')
        expect(diagnoseClaudeFailure('Failed to authenticate: OAuth session expired').cause).toBe(
          'anthropic-auth'
        )
      } finally {
        process.env.PATH = previous
        const { resetCliPathCache } = await import('./cliEnv')
        resetCliPathCache()
      }
    }
  )
})
