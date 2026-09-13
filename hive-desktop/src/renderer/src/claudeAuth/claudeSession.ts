import { t } from '../i18n'

/**
 * The reading half of the Claude-account surface: how main's answer becomes
 * the words and the shapes on screen. Pure, DOM-free and unit-tested here so
 * the components stay a thin drawing of it — the same split `awsSession.ts`
 * uses for the other credential lane.
 */

/** Mirror of main's `ClaudeAuthState` (renderer files mirror, never import across the boundary). */
export type ClaudeAuthState =
  'connected' | 'signed-out' | 'api-key' | 'third-party' | 'no-cli' | 'unknown'

/** Mirror of main's `ClaudeLoginPhase`. */
export type ClaudePhase =
  'idle' | 'starting' | 'browser' | 'code' | 'finishing' | 'success' | 'failed' | 'canceled'

/** How the connection reads at a glance — the one word every surface branches on. */
export type ClaudeTone = 'ok' | 'warn' | 'bad' | 'idle'

/**
 * The tone each state carries.
 *
 * `third-party` and `api-key` are deliberately quiet rather than green: both
 * are working arrangements this lane has no say over, and a tick beside them
 * would claim a check that was never made. Only `signed-out` is loud, because
 * it is the only one that stops the next message *and* has a repair here.
 */
export function toneFor(state: ClaudeAuthState): ClaudeTone {
  if (state === 'connected') return 'ok'
  if (state === 'signed-out') return 'bad'
  if (state === 'no-cli') return 'warn'
  return 'idle'
}

/** The four steps of a sign-in, and where the current phase puts each one. */
export type ClaudeStepId = 'open' | 'authorize' | 'code' | 'connected'

export interface ClaudeStepView {
  id: ClaudeStepId
  status: 'pending' | 'active' | 'done' | 'failed'
}

/**
 * The flow's shape for one phase.
 *
 * A table, because it is one: eight phases × four steps, every cell decided
 * rather than derived. The cell that matters most is `failed`/`canceled` —
 * the cross goes on *authorize*, the step the user was on when the hand-off
 * broke, not on the connection they never reached.
 */
export function loginSteps(phase: ClaudePhase): ClaudeStepView[] {
  const table: Record<
    ClaudePhase,
    [
      ClaudeStepView['status'],
      ClaudeStepView['status'],
      ClaudeStepView['status'],
      ClaudeStepView['status']
    ]
  > = {
    idle: ['pending', 'pending', 'pending', 'pending'],
    starting: ['active', 'pending', 'pending', 'pending'],
    browser: ['done', 'active', 'pending', 'pending'],
    code: ['done', 'done', 'active', 'pending'],
    finishing: ['done', 'done', 'done', 'active'],
    success: ['done', 'done', 'done', 'done'],
    failed: ['done', 'failed', 'pending', 'pending'],
    canceled: ['done', 'failed', 'pending', 'pending']
  }
  const [open, authorize, code, connected] = table[phase]
  return [
    { id: 'open', status: open },
    { id: 'authorize', status: authorize },
    { id: 'code', status: code },
    { id: 'connected', status: connected }
  ]
}

/**
 * Whether the machine has credentials the agent can actually run on —
 * `null` while the app has not read an answer yet.
 *
 * `api-key` and `third-party` count: both are working arrangements this lane
 * has no say over, and a turn will not die for want of an account under either.
 * `unknown` deliberately stays `null` rather than guessing: it is the state
 * where `claude auth status` said something this app does not parse, and a
 * guess there would be a claim with nothing behind it.
 */
export function accountReady(state: ClaudeAuthState | null | undefined): boolean | null {
  if (state === null || state === undefined || state === 'unknown') return null
  return state !== 'signed-out' && state !== 'no-cli'
}

/** Whether a sign-in is happening right now — what makes the live surface appear. */
export function isLoginLive(phase: ClaudePhase): boolean {
  return phase === 'starting' || phase === 'browser' || phase === 'code' || phase === 'finishing'
}

/**
 * Whether the live surface should still be on screen.
 *
 * A landed sign-in stays up for a beat: the user is coming back from a browser
 * tab, and a card that vanished the instant the CLI exited would leave them
 * with no evidence the trip worked. `canceled` is the opposite — they asked
 * for it to go away.
 */
export function isLoginVisible(phase: ClaudePhase): boolean {
  return isLoginLive(phase) || phase === 'success' || phase === 'failed'
}

/** Whether the field for the browser's code belongs on screen for this phase. */
export function wantsCode(phase: ClaudePhase): boolean {
  return phase === 'code' || phase === 'finishing'
}

/** Elapsed seconds of the current attempt, for the live readout. */
export function elapsedSeconds(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

/** One account, as a person would say it: `pessoa@exemplo.dev · Plano Pro`. */
export function accountLine(
  account: { email: string | null; subscription: string | null; organization: string | null } | null
): string | null {
  if (!account) return null
  const plan = account.subscription ? t('claude.planLabel', planName(account.subscription)) : null
  const parts = [account.email ?? account.organization, plan].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** `pro` → `Pro`, `max` → `Max`. The CLI lowercases them; a plan is a name. */
export function planName(subscription: string): string {
  return subscription.charAt(0).toUpperCase() + subscription.slice(1)
}

/**
 * The turn-error codes main sends instead of a CLI stack of text, mapped to
 * the sentence the chat shows — and to whether "connect" belongs under it.
 *
 * Same contract as `awsTurnError`, and for the same reason: main holds no copy
 * (all UI text is pt-BR through `t()`), and "which failures are an account
 * problem" is a fact about the feature, testable without rendering anything.
 */
const CLAUDE_ERROR_COPY: Record<string, string> = {
  'claude-auth:signed-out': 'claude.turnErrorSignedOut'
}

/** The account reading of a turn error, or `null` when it is an ordinary failure. */
export function claudeTurnError(message: string): { text: string; canConnect: boolean } | null {
  const key = CLAUDE_ERROR_COPY[message.trim()]
  if (key === undefined) return null
  return { text: t(key as Parameters<typeof t>[0]), canConnect: true }
}
