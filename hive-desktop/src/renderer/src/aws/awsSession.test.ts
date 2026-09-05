import { describe, expect, it } from 'vitest'
import {
  awsTurnError,
  DEFAULT_SESSION_MS,
  elapsedSeconds,
  formatAccountId,
  formatExpiry,
  formatRemaining,
  isLoginLive,
  isLoginVisible,
  loginSteps,
  profileLine,
  sessionFraction,
  toneFor
} from './awsSession'
import { awsSummary } from './awsSummary'
import { awsReadyFixture, awsStatusFixture } from '../testSupport/hiveAwsMock'

describe('toneFor', () => {
  it('maps every state, and keeps `unmanaged` quiet — nothing is wrong there', () => {
    expect(toneFor('ready')).toBe('ok')
    expect(toneFor('expiring')).toBe('warn')
    expect(toneFor('expired')).toBe('bad')
    expect(toneFor('absent')).toBe('bad')
    expect(toneFor('not-configured')).toBe('bad')
    expect(toneFor('unmanaged')).toBe('idle')
  })
})

describe('sessionFraction', () => {
  it('reads a full session as a full ring', () => {
    expect(sessionFraction(DEFAULT_SESSION_MS)).toBe(1)
  })

  it('halves at half', () => {
    expect(sessionFraction(DEFAULT_SESSION_MS / 2)).toBeCloseTo(0.5)
  })

  it('clamps a longer-than-nominal session instead of overflowing the arc', () => {
    expect(sessionFraction(DEFAULT_SESSION_MS * 3)).toBe(1)
  })

  it('clamps an expired session to an empty ring instead of a negative arc', () => {
    expect(sessionFraction(-1000)).toBe(0)
    expect(sessionFraction(null)).toBe(0)
    expect(sessionFraction(Number.NaN)).toBe(0)
  })
})

describe('formatRemaining', () => {
  it('never shows two units at once — the coarse one is what the reader decides on', () => {
    expect(formatRemaining(6 * 60 * 60 * 1000 + 58 * 60 * 1000)).toBe('6 h')
    expect(formatRemaining(60 * 60 * 1000)).toBe('1 h')
    expect(formatRemaining(48 * 60 * 1000)).toBe('48 min')
  })

  it('switches to seconds only at the very end, where they start to matter', () => {
    expect(formatRemaining(40_000)).toBe('40 s')
    expect(formatRemaining(400)).toBe('1 s')
  })

  it('says "expirada" rather than a zero', () => {
    expect(formatRemaining(0)).toBe('expirada')
    expect(formatRemaining(-1)).toBe('expirada')
    expect(formatRemaining(null)).toBe('expirada')
  })
})

describe('formatExpiry', () => {
  it('is a wall clock the user can compare with their own', () => {
    expect(formatExpiry('2026-09-04T20:00:00Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('answers null for nothing and for nonsense, rather than "Invalid Date"', () => {
    expect(formatExpiry(null)).toBeNull()
    expect(formatExpiry('soon')).toBeNull()
  })
})

describe('loginSteps', () => {
  it('walks the rail forward as the login progresses', () => {
    expect(loginSteps('starting').map((step) => step.status)).toEqual([
      'active',
      'pending',
      'pending'
    ])
    expect(loginSteps('browser').map((step) => step.status)).toEqual(['done', 'active', 'pending'])
    expect(loginSteps('finishing').map((step) => step.status)).toEqual(['done', 'done', 'active'])
    expect(loginSteps('success').map((step) => step.status)).toEqual(['done', 'done', 'done'])
  })

  it('puts the cross on the step the user was actually on', () => {
    // Not on "connected": what failed is the authorisation, and marking the
    // last step would say the browser part succeeded.
    expect(loginSteps('failed').map((step) => step.status)).toEqual(['done', 'failed', 'pending'])
    expect(loginSteps('canceled').map((step) => step.status)).toEqual(['done', 'failed', 'pending'])
  })

  it('names its steps in order', () => {
    expect(loginSteps('idle').map((step) => step.id)).toEqual(['request', 'authorize', 'connected'])
  })
})

describe('login visibility', () => {
  it('is live only while something is actually happening', () => {
    expect(isLoginLive('starting')).toBe(true)
    expect(isLoginLive('browser')).toBe(true)
    expect(isLoginLive('finishing')).toBe(true)
    expect(isLoginLive('success')).toBe(false)
    expect(isLoginLive('idle')).toBe(false)
  })

  it('stays on screen through success and failure, and disappears on cancel', () => {
    // The success linger is the receipt: the user is coming back from another
    // window, and a card that vanished on exit leaves no evidence it worked.
    expect(isLoginVisible('success')).toBe(true)
    expect(isLoginVisible('failed')).toBe(true)
    expect(isLoginVisible('canceled')).toBe(false)
    expect(isLoginVisible('idle')).toBe(false)
  })
})

describe('elapsedSeconds', () => {
  it('counts from the start, and never below zero', () => {
    expect(elapsedSeconds(1000, 12_400)).toBe(11)
    expect(elapsedSeconds(5000, 1000)).toBe(0)
    expect(elapsedSeconds(null, 5000)).toBe(0)
  })
})

describe('profileLine and formatAccountId', () => {
  it('joins only the parts that exist, with no dangling separator', () => {
    expect(profileLine({ profile: 'acme-dev', region: 'us-east-1', roleName: 'Admin' })).toBe(
      'acme-dev · us-east-1 · Admin'
    )
    expect(profileLine({ profile: 'acme-dev', region: null, roleName: null })).toBe('acme-dev')
  })

  it('groups a twelve-digit account the way the AWS console prints it', () => {
    expect(formatAccountId('060795902845')).toBe('0607-9590-2845')
  })

  it('leaves anything that is not twelve digits alone rather than mangling it', () => {
    expect(formatAccountId('12345')).toBe('12345')
    expect(formatAccountId(null)).toBeNull()
  })
})

describe('awsTurnError', () => {
  it('reads the expired-session code and offers the repair', () => {
    const error = awsTurnError('aws-auth:sso-expired')
    expect(error?.canReconnect).toBe(true)
    expect(error?.text).toContain('sessão AWS expirou')
  })

  it('offers no reconnect when the CLI itself is missing — the repair is an install', () => {
    const error = awsTurnError('aws-auth:no-cli')
    expect(error?.canReconnect).toBe(false)
  })

  it('says nothing about an ordinary failure, so the CLI keeps its own words', () => {
    expect(awsTurnError('claude exited with code 1: boom')).toBeNull()
  })
})

describe('awsSummary', () => {
  it('draws a skeleton (null) until main answers', () => {
    expect(awsSummary(null)).toBeNull()
  })

  it('makes no claim on a machine that is not on Bedrock', () => {
    expect(awsSummary(awsStatusFixture())).toBe('Sem Bedrock')
  })

  it('states the profile and how much session is left', () => {
    expect(awsSummary(awsReadyFixture())).toBe('acme-dev · 6 h')
  })

  it('names the one state that will stop the next message', () => {
    expect(awsSummary(awsReadyFixture({ state: 'expired', expiresInMs: -1 }))).toBe(
      'acme-dev · sessão expirada'
    )
  })

  it('says just the profile when there is no session to count', () => {
    expect(awsSummary(awsReadyFixture({ state: 'unmanaged' }))).toBe('acme-dev')
  })
})
