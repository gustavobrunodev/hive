import { t } from '../i18n'
import { formatRemaining } from './awsSession'
import type { AwsStatus } from './useAwsSession'

/**
 * The one-line summary the profile index shows on the "Conexão AWS" row.
 *
 * Four answers, and the difference between them is the whole value of the row:
 *
 *  - `null` — main hasn't replied; the index draws a skeleton rather than a
 *    fact that may be about to change.
 *  - **not on Bedrock** — the honest "nothing to see here" for the majority
 *    machine. The row still exists (a user who is *about to* switch their team
 *    to Bedrock should find it) but it makes no claim.
 *  - **a duration** — the reading that matters, stated on the index so the
 *    check costs no clicks: `acme-dev · 6 h`.
 *  - **expired** — the one state worth its own words, because it is the one
 *    that will stop the next message.
 *
 * Its own module rather than a component's, because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function awsSummary(status: AwsStatus | null): string | null {
  if (status === null) return null
  if (!status.active) return t('profile.awsInactiveSummary')
  if (status.state === 'ready' || status.state === 'expiring') {
    return `${status.profile} · ${formatRemaining(status.expiresInMs)}`
  }
  if (status.state === 'unmanaged') return status.profile
  return `${status.profile} · ${t('aws.chipExpiredShort')}`
}
