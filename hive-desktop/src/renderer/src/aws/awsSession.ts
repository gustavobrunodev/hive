import { t } from '../i18n'

/**
 * The reading half of the AWS surface: how a session's numbers become the
 * words and the shapes on screen. Pure, DOM-free and unit-tested here so the
 * components can stay a thin drawing of it — the same split
 * `sessionUsage.ts` uses for the context meter.
 */

/** Mirror of main's `AwsAuthStatus['state']` (renderer files mirror, never import across the boundary). */
export type AwsState = 'ready' | 'expiring' | 'expired' | 'absent' | 'unmanaged' | 'not-configured'

/** Mirror of main's `AwsLoginPhase`. */
export type AwsPhase =
  'idle' | 'starting' | 'browser' | 'finishing' | 'success' | 'failed' | 'canceled'

/** How the status reads at a glance — the one word every surface branches on. */
export type AwsTone = 'ok' | 'warn' | 'bad' | 'idle'

/**
 * A full SSO session, in milliseconds, used as the gauge's denominator.
 *
 * Eight hours is the AWS Identity Center default and the overwhelmingly common
 * setting; a longer-lived session simply shows a full ring for a while, which
 * is honest — the ring's job is "how much of your day is left", not "what
 * fraction of a number you never chose".
 */
export const DEFAULT_SESSION_MS = 8 * 60 * 60 * 1000

/** The tone each state carries. `unmanaged` is deliberately quiet: nothing is wrong. */
export function toneFor(state: AwsState): AwsTone {
  if (state === 'ready') return 'ok'
  if (state === 'expiring') return 'warn'
  if (state === 'expired' || state === 'absent' || state === 'not-configured') return 'bad'
  return 'idle'
}

/**
 * How full the session ring is: 0–1 of a nominal full session.
 *
 * Clamped at both ends so a session longer than the nominal one draws a full
 * ring rather than overflowing, and an expired one draws an empty ring rather
 * than a negative arc.
 */
export function sessionFraction(
  expiresInMs: number | null,
  fullMs: number = DEFAULT_SESSION_MS
): number {
  if (expiresInMs === null || !Number.isFinite(expiresInMs)) return 0
  return Math.min(1, Math.max(0, expiresInMs / fullMs))
}

/**
 * A duration as a person would say it: `6 h`, `48 min`, `40 s`.
 *
 * Two units are never shown at once. A countdown that reads "5 h 58 min" asks
 * to be read twice and is stale a minute later; the coarse unit is what the
 * reader is actually deciding on ("do I have time for this task?"), and the
 * fine one only matters at the end, which is exactly where this switches to it.
 */
export function formatRemaining(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return t('aws.remainingNone')
  const minutes = Math.floor(ms / 60000)
  if (minutes >= 60) return t('aws.remainingHours', Math.floor(minutes / 60))
  if (minutes >= 1) return t('aws.remainingMinutes', minutes)
  return t('aws.remainingSeconds', Math.max(1, Math.floor(ms / 1000)))
}

/** The expiry as a wall clock the user can compare with their own — `expira às 18:42`. */
export function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const when = new Date(expiresAt)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** The three steps of a login, and where the current phase puts each one. */
export type LoginStepId = 'request' | 'authorize' | 'connected'

export interface LoginStepView {
  id: LoginStepId
  status: 'pending' | 'active' | 'done' | 'failed'
}

/**
 * The flow's shape for one phase.
 *
 * Written as a table rather than a chain of conditionals because it is a table:
 * seven phases × three steps, and every cell was decided deliberately. The one
 * that is easy to get wrong is `failed` — the *authorize* step is what failed,
 * not the connection, so the cross belongs on the step the user was on.
 */
export function loginSteps(phase: AwsPhase): LoginStepView[] {
  const table: Record<
    AwsPhase,
    [LoginStepView['status'], LoginStepView['status'], LoginStepView['status']]
  > = {
    idle: ['pending', 'pending', 'pending'],
    starting: ['active', 'pending', 'pending'],
    browser: ['done', 'active', 'pending'],
    finishing: ['done', 'done', 'active'],
    success: ['done', 'done', 'done'],
    failed: ['done', 'failed', 'pending'],
    canceled: ['done', 'failed', 'pending']
  }
  const [request, authorize, connected] = table[phase]
  return [
    { id: 'request', status: request },
    { id: 'authorize', status: authorize },
    { id: 'connected', status: connected }
  ]
}

/** Whether a login is happening right now — what makes the live surface appear. */
export function isLoginLive(phase: AwsPhase): boolean {
  return phase === 'starting' || phase === 'browser' || phase === 'finishing'
}

/**
 * Whether the live surface should still be on screen at all.
 *
 * A finished login stays up for a beat: `success` is the only moment the user
 * gets to see that the thing they were asked to do worked, and a card that
 * vanishes the instant the browser tab closes leaves them wondering whether it
 * did. `canceled` is the opposite — the user asked for it to go away.
 */
export function isLoginVisible(phase: AwsPhase): boolean {
  return isLoginLive(phase) || phase === 'success' || phase === 'failed'
}

/** Elapsed seconds of the current attempt, for the live readout. */
export function elapsedSeconds(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

/**
 * The profile line: `acme-dev · us-east-1 · AdministratorAccess`.
 *
 * Only the parts that exist, joined by a separator rather than laid out in
 * fixed slots — a profile with no role would otherwise render a dangling dot,
 * and this line appears in three different widths across the app.
 */
export function profileLine(parts: {
  profile: string
  region: string | null
  roleName: string | null
}): string {
  return [parts.profile, parts.region, parts.roleName].filter(Boolean).join(' · ')
}

/**
 * The account id, grouped the way AWS prints it (`0607-9590-2845`).
 *
 * Twelve undifferentiated digits are unreadable and unverifiable; the console
 * itself groups them, so a user comparing "is this the right account?" against
 * another window is comparing the same shape.
 */
export function formatAccountId(accountId: string | null): string | null {
  if (!accountId) return null
  const digits = accountId.replace(/\D/g, '')
  if (digits.length !== 12) return accountId
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`
}

/**
 * The turn-error codes main sends instead of a CLI stack of text, mapped to
 * the sentence the chat shows — and to whether a "reconnect" button belongs
 * under it.
 *
 * The codes exist because main holds no copy (all UI text is pt-BR through
 * `t()`), and the mapping lives here rather than in the component because
 * "which failures are an AWS problem" is a fact about the feature, testable
 * without rendering anything.
 */
const AWS_ERROR_COPY: Record<string, string> = {
  'aws-auth:sso-expired': 'aws.turnErrorExpired',
  'aws-auth:no-credentials': 'aws.turnErrorExpired',
  'aws-auth:no-cli': 'aws.turnErrorNoCli',
  'aws-auth:canceled': 'aws.turnErrorCanceled',
  'aws-auth:failed': 'aws.turnErrorFailed',
  'aws-auth:unsupported': 'aws.turnErrorFailed'
}

/** The AWS reading of a turn error, or `null` when it is an ordinary failure. */
export function awsTurnError(message: string): { text: string; canReconnect: boolean } | null {
  const key = AWS_ERROR_COPY[message.trim()]
  if (key === undefined) return null
  return {
    text: t(key as Parameters<typeof t>[0]),
    // Nothing to retry when the CLI itself is missing: the repair is an
    // install, and a button that reopens a browser would fail identically.
    canReconnect: message.trim() !== 'aws-auth:no-cli'
  }
}
