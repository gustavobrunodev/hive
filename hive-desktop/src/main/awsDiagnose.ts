/**
 * Reading a failed `claude` turn's output for the cause the user can act on.
 *
 * The message that started this feature, verbatim from a Bedrock user:
 *
 * ```
 * claude exited with code 1: Warning: MCP server blocked by enterprise policy:
 * hive_approvals Error running awsAuthRefresh (in settings or ~/.claude.json):
 * No conversation found with session ID: 8d2c3ac9-…
 * ```
 *
 * Three unrelated facts glued into one sentence, none of which says the true
 * thing — *your AWS SSO session expired, log in again*. Worse, two of them are
 * misleading: the MCP warning is benign policy noise, and the session id at the
 * end is a **second, independent** failure (a `--resume` handle whose
 * conversation no longer exists), which reads as if it were the reason.
 *
 * So the CLI's stderr is parsed rather than printed. Each cause below carries
 * its own repair, and the ones Hive can perform it performs — `sso-expired`
 * opens a login, `stale-session` retries the turn without the dead handle —
 * instead of handing the user a paragraph of machine text to interpret.
 *
 * The patterns are matched against the stderr *tail* the adapter already keeps,
 * so this costs nothing on the happy path.
 */

/** What actually went wrong, at the granularity a repair can be attached to. */
export type ClaudeFailureCause =
  /** The AWS SSO token expired (or `awsAuthRefresh` tried and failed to renew it). */
  | 'sso-expired'
  /** No AWS credentials at all — a profile that isn't there, or was never configured. */
  | 'no-credentials'
  /** The credentials are valid but the account may not call this model. */
  | 'access-denied'
  /** The `--resume` handle names a conversation the CLI no longer has. */
  | 'stale-session'
  /** An administrator's managed settings blocked one of Hive's MCP servers. */
  | 'mcp-policy'
  /** Nothing recognised — the caller shows the CLI's own words. */
  | 'unknown'

export interface ClaudeFailureDiagnosis {
  cause: ClaudeFailureCause
  /**
   * Whether Hive should retry the turn itself once, having removed the dead
   * `--resume` handle. Only `stale-session` sets this: it is the one cause
   * whose repair is free, invisible, and cannot make things worse.
   */
  retryWithoutResume: boolean
  /** Whether the repair is "log in to AWS again", i.e. the SSO flow applies. */
  needsAwsLogin: boolean
}

/**
 * Patterns, most specific first.
 *
 * `awsAuthRefresh` is listed under `sso-expired` on purpose. The CLI only runs
 * that hook when it has decided its credentials need renewing, so the hook
 * failing *is* the expiry, seen one layer down — and inside Hive it always
 * fails, because the command it runs (`aws sso login`) wants a terminal.
 */
const PATTERNS: Array<{ cause: ClaudeFailureCause; test: RegExp }> = [
  {
    cause: 'sso-expired',
    test: /awsAuthRefresh|ExpiredToken|expired.{0,40}(token|session|credential)|(token|session|credential).{0,40}(has\s+)?expired|refresh.{0,20}sso|sso.{0,20}(session|token).{0,20}(expired|invalid)|InvalidGrantException/i
  },
  {
    cause: 'no-credentials',
    test: /Unable to locate credentials|could not be found|NoCredentialProviders|CredentialsProviderError|The config profile|profile\s+\S+\s+could not be found|Missing credentials|Could not load credentials/i
  },
  {
    cause: 'access-denied',
    test: /AccessDenied|not authorized to perform|UnrecognizedClientException|don'?t have access to the model|ValidationException.{0,60}model|You don'?t have access/i
  },
  { cause: 'stale-session', test: /No conversation found with session ID/i },
  { cause: 'mcp-policy', test: /MCP server blocked by enterprise policy/i }
]

/**
 * Classifies one failed turn's output.
 *
 * The order of the two "hard" causes matters and is not the order of the text.
 * A message can carry both a stale session id and an auth failure — the
 * reported one did — and the auth failure is the one that must win: retrying
 * without `--resume` against credentials that don't work just fails again,
 * one message further from the truth.
 */
export function diagnoseClaudeFailure(detail: string): ClaudeFailureDiagnosis {
  const text = detail ?? ''
  for (const { cause, test } of PATTERNS) {
    if (!test.test(text)) continue
    return {
      cause,
      retryWithoutResume: cause === 'stale-session',
      needsAwsLogin: cause === 'sso-expired' || cause === 'no-credentials'
    }
  }
  return { cause: 'unknown', retryWithoutResume: false, needsAwsLogin: false }
}

/**
 * Whether this failure is worth re-checking AWS for even when the pattern above
 * didn't fire.
 *
 * A Bedrock turn that dies in under a couple of seconds with *anything* is far
 * more likely to be an auth problem than a model one — but guessing that from
 * the text alone would mislabel real errors. So the caller pairs this with the
 * cheap on-disk token read: the text says "maybe", `awsSsoCache` says "yes" or
 * "no", and only their agreement produces the login prompt.
 */
export function mayBeAwsFailure(detail: string): boolean {
  return /aws|bedrock|credential|sso|region|token/i.test(detail ?? '')
}
