import { useEffect, useState } from 'react'
import { Button, StepFlow, type StepFlowStep } from '@hive/design-system'
import { t } from '../i18n'
import { CheckCircleIcon, CloudKeyIcon, CopyIcon, ExternalLinkIcon } from '../ui/icons'
import {
  elapsedSeconds,
  formatRemaining,
  isLoginLive,
  loginSteps,
  type AwsPhase,
  type LoginStepId
} from './awsSession'

/** The live login, as main reports it (mirror of `AwsLoginState`). */
export interface AwsLoginView {
  phase: AwsPhase
  profile: string | null
  url: string | null
  code: string | null
  message: string | null
  startedAt: number | null
  expiresAt: string | null
}

export interface AwsLoginFlowProps {
  state: AwsLoginView
  /** Shared clock (`useTicker`) — the elapsed readout counts against it. */
  now: number
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  onCancel: () => void
  onRetry: () => void
}

const STEP_LABELS = {
  request: 'aws.stepRequest',
  authorize: 'aws.stepAuthorize',
  connected: 'aws.stepConnected'
} as const satisfies Record<LoginStepId, string>

const STEP_HINTS = {
  request: 'aws.stepRequestHint',
  authorize: 'aws.stepAuthorizeHint',
  connected: 'aws.stepConnectedHint'
} as const satisfies Record<LoginStepId, string>

/**
 * A step's hint is shown **only while that step is the live one**.
 *
 * Three permanent captions under three permanent labels is a paragraph the
 * reader has to scan every time; one caption under the step that is actually
 * asking for something is an instruction. The exception is a failure, which
 * has to say what failed even though it is no longer active.
 */
function stepsFor(phase: AwsPhase): StepFlowStep[] {
  return loginSteps(phase).map((step) => {
    const label = t(STEP_LABELS[step.id])
    if (step.status === 'failed') {
      return { id: step.id, label, hint: t('aws.stepFailedHint'), status: step.status }
    }
    if (step.status !== 'active') return { id: step.id, label, status: step.status }
    return { id: step.id, label, hint: t(STEP_HINTS[step.id]), status: step.status }
  })
}

/** The card's one-line verdict — the only text that changes with the phase. */
function titleFor(phase: AwsPhase): string {
  if (phase === 'success') return t('aws.successTitle')
  if (phase === 'failed') return t('aws.failedTitle')
  if (phase === 'canceled') return t('aws.canceledTitle')
  return t('aws.loginTitle')
}

/** Header: what is happening, to whom, and for how long. */
function FlowHead({ state, now }: { state: AwsLoginView; now: number }): React.JSX.Element {
  const succeeded = state.phase === 'success'
  return (
    <div className="wb-aws-flow-head">
      <span className="wb-aws-flow-mark" data-phase={state.phase} aria-hidden="true">
        {succeeded ? <CheckCircleIcon size={16} /> : <CloudKeyIcon size={16} />}
      </span>
      <span className="wb-aws-flow-title">{titleFor(state.phase)}</span>
      {state.profile && (
        <span className="wb-aws-flow-profile">{t('aws.loginProfile', state.profile)}</span>
      )}
      {isLoginLive(state.phase) && (
        <span className="wb-aws-flow-elapsed">
          {t('aws.elapsed', elapsedSeconds(state.startedAt, now))}
        </span>
      )}
    </div>
  )
}

/** The verification code, in the one place it can be compared character by character. */
function VerificationCode({ code }: { code: string }): React.JSX.Element {
  return (
    <div className="wb-aws-code">
      <span className="wb-aws-code-label">{t('aws.codeLabel')}</span>
      <strong className="wb-aws-code-value">{code}</strong>
      <span className="wb-aws-code-hint">{t('aws.codeHint')}</span>
    </div>
  )
}

/**
 * The live sign-in, drawn wherever it is needed (the floating beacon, the
 * settings panel).
 *
 * ## Why it looks like this
 *
 * The user is being sent *out of the app* and asked to come back. That hand-off
 * is the whole design problem: between the click and the return there is a
 * browser tab in front of Hive, and when they switch back they need to know, in
 * one glance, whether it worked and whether it is still their turn.
 *
 * So the surface commits to three things and nothing else: **where the flow is**
 * (the step rail — the only element that changes shape), **what the user must
 * do now** (one hint, under the live step), and **the way back in** (the URL,
 * openable again and copyable, because a browser that opened on the wrong
 * profile or never opened at all is the single most common failure of this
 * flow and a dead end is unforgivable there).
 *
 * The elapsed counter is deliberately quiet and deliberately present: a login
 * that has been waiting eleven seconds and one that has been waiting four
 * minutes call for different reactions, and without it both look identical.
 */
export function AwsLoginFlow({
  state,
  now,
  onOpenUrl,
  onCopyUrl,
  onCancel,
  onRetry
}: AwsLoginFlowProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const live = isLoginLive(state.phase)
  const failed = state.phase === 'failed' || state.phase === 'canceled'
  const succeeded = state.phase === 'success'

  function handleCopy(url: string): void {
    onCopyUrl(url)
    setCopied(true)
  }

  return (
    <div className="wb-aws-flow" data-phase={state.phase}>
      <FlowHead state={state} now={now} />

      {succeeded ? (
        <p className="wb-aws-flow-success">
          {t('aws.successHint', formatRemaining(remainingOf(state.expiresAt, now)))}
        </p>
      ) : (
        <StepFlow
          className="wb-aws-flow-steps"
          steps={stepsFor(state.phase)}
          label={t('aws.loginTitle')}
        />
      )}

      {live && state.code && <VerificationCode code={state.code} />}

      {live && state.url && (
        <div className="wb-aws-flow-url">
          <span className="wb-aws-flow-url-label">{t('aws.urlLabel')}</span>
          <code className="wb-aws-flow-url-value" title={state.url}>
            {state.url}
          </code>
        </div>
      )}

      <FlowActions
        state={state}
        copied={copied}
        detailsOpen={detailsOpen}
        onOpenUrl={onOpenUrl}
        onCopy={handleCopy}
        onCancel={onCancel}
        onRetry={onRetry}
        onToggleDetails={() => setDetailsOpen((open) => !open)}
      />

      {failed && detailsOpen && state.message && (
        <pre className="wb-aws-flow-detail">{state.message}</pre>
      )}
    </div>
  )
}

/**
 * The action row: what the user can do *right now*, and nothing else.
 *
 * Its shape is the phase's: while the CLI waits, the two ways back into the
 * browser plus the way out; once it has failed, a retry and the CLI's own
 * words behind a disclosure. Split from the card so the card stays a layout.
 */
function FlowActions({
  state,
  copied,
  detailsOpen,
  onOpenUrl,
  onCopy,
  onCancel,
  onRetry,
  onToggleDetails
}: {
  state: AwsLoginView
  copied: boolean
  detailsOpen: boolean
  onOpenUrl: (url: string) => void
  onCopy: (url: string) => void
  onCancel: () => void
  onRetry: () => void
  onToggleDetails: () => void
}): React.JSX.Element {
  const live = isLoginLive(state.phase)
  const failed = state.phase === 'failed' || state.phase === 'canceled'
  return (
    <div className="wb-aws-flow-actions">
      {live && state.url && (
        <LiveActions url={state.url} copied={copied} onOpenUrl={onOpenUrl} onCopy={onCopy} />
      )}
      {live && (
        <Button variant="ghost" className="wb-btn wb-btn-sm wb-aws-flow-cancel" onClick={onCancel}>
          {t('aws.cancelCta')}
        </Button>
      )}
      {failed && (
        <Button className="wb-btn wb-btn-sm" onClick={onRetry}>
          {t('aws.retryCta')}
        </Button>
      )}
      {failed && state.message && (
        <Button
          className="wb-btn wb-btn-sm"
          variant="ghost"
          aria-expanded={detailsOpen}
          onClick={onToggleDetails}
        >
          {detailsOpen ? t('aws.detailsHide') : t('aws.detailsShow')}
        </Button>
      )}
    </div>
  )
}

/**
 * The two controls that keep the hand-off from being a dead end: open the
 * verification page again, and copy its address.
 *
 * Both matter more than they look. A browser that opened on the wrong profile,
 * or did not open at all, is the most common way this flow fails — and the
 * user is by then looking at a window that is not Hive.
 */
function LiveActions({
  url,
  copied,
  onOpenUrl,
  onCopy
}: {
  url: string
  copied: boolean
  onOpenUrl: (url: string) => void
  onCopy: (url: string) => void
}): React.JSX.Element {
  return (
    <>
      <Button className="wb-btn wb-btn-sm" variant="ghost" onClick={() => onOpenUrl(url)}>
        <ExternalLinkIcon size={14} aria-hidden="true" />
        {t('aws.openAgainCta')}
      </Button>
      <Button className="wb-btn wb-btn-sm" variant="ghost" onClick={() => onCopy(url)}>
        <CopyIcon size={14} aria-hidden="true" />
        {copied ? t('aws.copiedLabel') : t('aws.copyUrlCta')}
      </Button>
    </>
  )
}

/** Milliseconds left of a freshly-minted session, for the success line. */
function remainingOf(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null
  const when = Date.parse(expiresAt)
  return Number.isNaN(when) ? null : when - now
}
