import { describe, expect, it } from 'vitest'
import {
  accountLine,
  claudeTurnError,
  elapsedSeconds,
  isLoginLive,
  isLoginVisible,
  loginSteps,
  planName,
  toneFor,
  wantsCode,
  type ClaudePhase
} from './claudeSession'

/**
 * The reading half of the Claude-account surface. Everything here is a fact
 * about the feature rather than about a component — which is the point of the
 * split, and why these assertions can be exact.
 */

describe('toneFor', () => {
  it('is loud only for the state that stops the next message and has a repair here', () => {
    expect(toneFor('signed-out')).toBe('bad')
    expect(toneFor('connected')).toBe('ok')
    expect(toneFor('no-cli')).toBe('warn')
  })

  it('stays quiet for the two working arrangements this lane does not own', () => {
    // A tick beside either would claim a check nobody made: on Bedrock the
    // credentials are AWS's, and an API key is a key, not an account.
    expect(toneFor('third-party')).toBe('idle')
    expect(toneFor('api-key')).toBe('idle')
    expect(toneFor('unknown')).toBe('idle')
  })
})

describe('loginSteps', () => {
  it('walks the four steps in order as the phases advance', () => {
    const active = (phase: ClaudePhase): string | undefined =>
      loginSteps(phase).find((step) => step.status === 'active')?.id
    expect(active('starting')).toBe('open')
    expect(active('browser')).toBe('authorize')
    expect(active('code')).toBe('code')
    expect(active('finishing')).toBe('connected')
    expect(loginSteps('success').every((step) => step.status === 'done')).toBe(true)
    expect(active('idle')).toBeUndefined()
  })

  it('puts the cross on the step the user was on, not on the connection they never reached', () => {
    for (const phase of ['failed', 'canceled'] as const) {
      const failed = loginSteps(phase).filter((step) => step.status === 'failed')
      expect(failed).toHaveLength(1)
      expect(failed[0].id).toBe('authorize')
    }
  })
})

describe('phase predicates', () => {
  it('calls a sign-in live only while the CLI is still waiting on something', () => {
    const live: ClaudePhase[] = ['starting', 'browser', 'code', 'finishing']
    const settled: ClaudePhase[] = ['idle', 'success', 'failed', 'canceled']
    expect(live.every(isLoginLive)).toBe(true)
    expect(settled.some(isLoginLive)).toBe(false)
  })

  it('keeps a landed sign-in on screen, and lets a cancelled one go', () => {
    expect(isLoginVisible('success')).toBe(true)
    expect(isLoginVisible('failed')).toBe(true)
    expect(isLoginVisible('canceled')).toBe(false)
    expect(isLoginVisible('idle')).toBe(false)
  })

  it('asks for the code exactly while the CLI is at its paste prompt', () => {
    expect(wantsCode('code')).toBe(true)
    // …and through the check that follows, so the field does not vanish under
    // the cursor the moment a code is sent.
    expect(wantsCode('finishing')).toBe(true)
    expect(wantsCode('browser')).toBe(false)
  })
})

describe('elapsedSeconds', () => {
  it('counts from the attempt, and never negative', () => {
    expect(elapsedSeconds(1000, 12_000)).toBe(11)
    expect(elapsedSeconds(null, 12_000)).toBe(0)
    expect(elapsedSeconds(12_000, 1000)).toBe(0)
  })
})

describe('accountLine', () => {
  it('says who, and on what plan', () => {
    expect(
      accountLine({ email: 'pessoa@exemplo.dev', subscription: 'pro', organization: null })
    ).toBe('pessoa@exemplo.dev · Plano Pro')
  })

  it('falls back to the organisation, and to nothing at all', () => {
    expect(accountLine({ email: null, subscription: null, organization: 'Acme' })).toBe('Acme')
    expect(accountLine({ email: null, subscription: null, organization: null })).toBeNull()
    expect(accountLine(null)).toBeNull()
  })

  it('names the plan the way a plan is named', () => {
    expect(planName('pro')).toBe('Pro')
    expect(planName('max')).toBe('Max')
  })
})

describe('claudeTurnError', () => {
  it('reads main’s code as a sentence with a repair attached', () => {
    const error = claudeTurnError('claude-auth:signed-out')
    expect(error?.text).toContain('não está conectada')
    expect(error?.canConnect).toBe(true)
  })

  it('leaves an ordinary failure alone — the CLI’s own words beat a paraphrase', () => {
    expect(claudeTurnError('claude exited with code 1: ENOENT')).toBeNull()
    expect(claudeTurnError('aws-auth:sso-expired')).toBeNull()
  })
})
