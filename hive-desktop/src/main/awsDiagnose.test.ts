import { describe, expect, it } from 'vitest'
import { diagnoseClaudeFailure, mayBeAwsFailure } from './awsDiagnose'

/** The message that started this feature, verbatim from the report. */
const REPORTED =
  'Warning: MCP server blocked by enterprise policy: hive_approvals Error running awsAuthRefresh (in settings or ~/.claude.json): No conversation found with session ID: 8d2c3ac9-3408-4f6a-9ce4-ec5ce3319281'

describe('diagnoseClaudeFailure', () => {
  it('reads the reported failure as an expired AWS session — not as the MCP warning, and not as the session id', () => {
    // The whole point. Three unrelated facts in one sentence, and the only one
    // with a repair is the middle one; a diagnosis that landed on either of the
    // other two would send the user somewhere useless.
    const diagnosis = diagnoseClaudeFailure(REPORTED)
    expect(diagnosis.cause).toBe('sso-expired')
    expect(diagnosis.needsAwsLogin).toBe(true)
    expect(diagnosis.retryWithoutResume).toBe(false)
  })

  it('reads a signed-out first-party CLI as an Anthropic problem, not an AWS one', () => {
    // Verbatim from `claude 2.1.226` with no account signed in. It contains
    // the words "session expired", which the AWS pattern also matches — read
    // in the wrong order this told users with no AWS account that their SSO
    // session had expired, and offered them a login they cannot complete.
    const diagnosis = diagnoseClaudeFailure(
      'Failed to authenticate: OAuth session expired and could not be refreshed'
    )
    expect(diagnosis.cause).toBe('anthropic-auth')
    expect(diagnosis.needsClaudeLogin).toBe(true)
    expect(diagnosis.needsAwsLogin).toBe(false)
  })

  it('reads the rest of the first-party auth vocabulary', () => {
    for (const text of [
      'API Error: 401 {"error":{"type":"authentication_error"},"code":"authentication_failed"}',
      'Invalid API key · Please run /login',
      'You are not logged in. Run claude auth login to continue.'
    ]) {
      expect(diagnoseClaudeFailure(text).cause).toBe('anthropic-auth')
    }
  })

  it('leaves the AWS vocabulary to the AWS lane', () => {
    // No first-party marker anywhere in these, so the order above costs the
    // Bedrock diagnosis nothing.
    expect(diagnoseClaudeFailure('ExpiredTokenException').needsClaudeLogin).toBe(false)
    expect(diagnoseClaudeFailure('Unable to locate credentials').needsClaudeLogin).toBe(false)
  })

  it('reads a bare awsAuthRefresh failure as the expiry it always is inside Hive', () => {
    expect(
      diagnoseClaudeFailure('Error running awsAuthRefresh (in settings or ~/.claude.json)').cause
    ).toBe('sso-expired')
  })

  it('reads the AWS SDK expiry vocabulary', () => {
    for (const text of [
      'ExpiredTokenException: The security token included in the request is expired',
      'The SSO session associated with this profile has expired',
      'Error when retrieving token from sso: Token has expired and refresh failed',
      'InvalidGrantException'
    ]) {
      expect(diagnoseClaudeFailure(text).cause).toBe('sso-expired')
    }
  })

  it('separates "no credentials at all" from "credentials that ran out"', () => {
    const diagnosis = diagnoseClaudeFailure('Unable to locate credentials')
    expect(diagnosis.cause).toBe('no-credentials')
    expect(diagnosis.needsAwsLogin).toBe(true)
  })

  it('reads a permissions failure as its own thing — a login would not fix it', () => {
    const diagnosis = diagnoseClaudeFailure(
      'AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel'
    )
    expect(diagnosis.cause).toBe('access-denied')
    expect(diagnosis.needsAwsLogin).toBe(false)
  })

  it('reads a dead --resume handle, and is the only cause that asks for a retry', () => {
    const diagnosis = diagnoseClaudeFailure('No conversation found with session ID: 8d2c3ac9')
    expect(diagnosis.cause).toBe('stale-session')
    expect(diagnosis.retryWithoutResume).toBe(true)
    expect(diagnosis.needsAwsLogin).toBe(false)
  })

  it('reads the policy warning on its own, when it is all there is', () => {
    expect(
      diagnoseClaudeFailure('Warning: MCP server blocked by enterprise policy: hive_approvals')
        .cause
    ).toBe('mcp-policy')
  })

  it('says nothing about a failure it does not recognise, rather than guessing', () => {
    const diagnosis = diagnoseClaudeFailure('TypeError: cannot read property of undefined')
    expect(diagnosis.cause).toBe('unknown')
    expect(diagnosis.retryWithoutResume).toBe(false)
    expect(diagnosis.needsAwsLogin).toBe(false)
  })

  it('handles empty and missing text', () => {
    expect(diagnoseClaudeFailure('').cause).toBe('unknown')
    expect(diagnoseClaudeFailure(undefined as unknown as string).cause).toBe('unknown')
  })
})

describe('mayBeAwsFailure', () => {
  it('is a wide net on purpose — the narrow answer comes from the token on disk', () => {
    expect(mayBeAwsFailure('could not reach bedrock endpoint')).toBe(true)
    expect(mayBeAwsFailure('unknown region')).toBe(true)
    expect(mayBeAwsFailure('syntax error in prompt')).toBe(false)
    expect(mayBeAwsFailure(undefined as unknown as string)).toBe(false)
  })
})
