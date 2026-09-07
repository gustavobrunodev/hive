import { useEffect, useState } from 'react'
import { Button, PasteField, StepFlow, type StepFlowStep } from '@hive/design-system'
import { t } from '../i18n'
import { AgentClaudeIcon, CheckCircleIcon, CopyIcon, ExternalLinkIcon } from '../ui/icons'
import {
  accountLine,
  elapsedSeconds,
  isLoginLive,
  loginSteps,
  wantsCode,
  type ClaudePhase,
  type ClaudeStepId
} from './claudeSession'

/** One account as main describes it (mirror of `ClaudeAccount`). */
export interface ClaudeAccountView {
  loggedIn: boolean
  authMethod: string | null
  apiProvider: string | null
  apiKeySource: string | null
  email: string | null
  organization: string | null
  subscription: string | null
}

/** The live sign-in, as main reports it (mirror of `ClaudeLoginState`). */
export interface ClaudeLoginView {
  phase: ClaudePhase
  mode: 'claudeai' | 'console'
  url: string | null
  codeError: string | null
  message: string | null
  startedAt: number | null
  account: ClaudeAccountView | null
}

export interface ClaudeSignInFlowProps {
  state: ClaudeLoginView
  /** Shared clock (`useTicker`) — the elapsed readout counts against it. */
  now: number
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  /** Hands one pasted code to the CLI that is waiting for it. */
  onSubmitCode: (code: string) => void
  /** Reads the system clipboard for the field's own paste control. */
  onReadClipboard: () => Promise<string>
  onCancel: () => void
  onRetry: () => void
}

const STEP_LABELS = {
  open: 'claude.stepOpen',
  authorize: 'claude.stepAuthorize',
  code: 'claude.stepCode',
  connected: 'claude.stepConnected'
} as const satisfies Record<ClaudeStepId, string>

const STEP_HINTS = {
  open: 'claude.stepOpenHint',
  authorize: 'claude.stepAuthorizeHint',
  code: 'claude.stepCodeHint',
  connected: 'claude.stepConnectedHint'
} as const satisfies Record<ClaudeStepId, string>

/**
 * A step's hint shows **only while that step is the live one** — three standing
 * captions is a paragraph to re-scan, one caption under the step that is asking
 * for something is an instruction. A failure is the exception: it has to say
 * what broke even though it is no longer active.
 */
function stepsFor(phase: ClaudePhase): StepFlowStep[] {
  return loginSteps(phase).map((step) => {
    const label = t(STEP_LABELS[step.id])
    if (step.status === 'failed') {
      return { id: step.id, label, hint: t('claude.stepFailedHint'), status: step.status }
    }
    if (step.status !== 'active') return { id: step.id, label, status: step.status }
    return { id: step.id, label, hint: t(STEP_HINTS[step.id]), status: step.status }
  })
}

/** The card's one-line verdict — the only text that changes with the phase. */
function titleFor(phase: ClaudePhase): string {
  if (phase === 'success') return t('claude.successTitle')
  if (phase === 'failed') return t('claude.failedTitle')
  if (phase === 'canceled') return t('claude.canceledTitle')
  return t('claude.loginTitle')
}

/**
 * The live sign-in to a Claude account, drawn wherever it is needed (the
 * floating beacon, the connection panel).
 *
 * ## The problem this shape solves
 *
 * The user is sent **out of the app** and asked to bring something back. That
 * round trip is the whole design problem: between the click and the return
 * there is a browser tab in front of Hive, and the CLI on the other side is
 * sitting at a terminal prompt — `Paste code here if prompted >` — that nobody
 * can type into. So this surface has to be, in order: the rail saying where in
 * the trip we are, the *one* thing to do now, and a way back in that is never a
 * dead end (open again, copy the address).
 *
 * ## Why the code field is the loudest element
 *
 * Because it is the step people lose. Every other step happens somewhere else —
 * a browser opens, a page is authorised — and this is the single moment the app
 * needs a hand. It sits where the hint is, it carries its own paste control
 * (`PasteField`), and a code the CLI rejects leaves the value in place with the
 * reason under it: a wrong paste is a retry, not a restart.
 *
 * The elapsed counter is deliberately quiet and deliberately present: eleven
 * seconds and four minutes call for different reactions, and without it they
 * look identical.
 */
export function ClaudeSignInFlow({
  state,
  now,
  onOpenUrl,
  onCopyUrl,
  onSubmitCode,
  onReadClipboard,
  onCancel,
  onRetry
}: ClaudeSignInFlowProps): React.JSX.Element {
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  // A rejected code clears nothing; a *new* attempt does. Keyed on the start
  // time, so re-opening the flow never inherits the last try's value.
  useEffect(() => {
    function reset(): void {
      setCode('')
    }
    reset()
  }, [state.startedAt])

  const live = isLoginLive(state.phase)
  const failed = state.phase === 'failed' || state.phase === 'canceled'
  const succeeded = state.phase === 'success'

  return (
    <div className="wb-claude-flow" data-phase={state.phase}>
      <div className="wb-claude-flow-head">
        <span className="wb-claude-flow-mark" data-phase={state.phase} aria-hidden="true">
          {succeeded ? <CheckCircleIcon size={16} /> : <AgentClaudeIcon size={16} />}
        </span>
        <span className="wb-claude-flow-title">{titleFor(state.phase)}</span>
        {live && (
          <span className="wb-claude-flow-elapsed">
            {t('claude.elapsed', elapsedSeconds(state.startedAt, now))}
          </span>
        )}
      </div>

      {succeeded ? (
        <ConnectedBadge account={state.account} />
      ) : (
        <StepFlow
          className="wb-claude-flow-steps"
          steps={stepsFor(state.phase)}
          label={t('claude.loginTitle')}
        />
      )}

      {wantsCode(state.phase) && (
        <PasteField
          className="wb-claude-code"
          label={t('claude.codeFieldLabel')}
          description={t('claude.codeFieldHint')}
          placeholder={t('claude.codePlaceholder')}
          value={code}
          onValueChange={setCode}
          onSubmit={onSubmitCode}
          submitLabel={t('claude.codeSubmit')}
          onPaste={onReadClipboard}
          pasteLabel={t('claude.codePaste')}
          submitOnPaste
          busy={state.phase === 'finishing'}
          autoFocus
          {...(state.codeError ? { error: t('claude.codeInvalid') } : {})}
        />
      )}

      {live && state.url && (
        <div className="wb-claude-flow-url">
          <span className="wb-claude-flow-url-label">{t('claude.urlLabel')}</span>
          <code className="wb-claude-flow-url-value" title={state.url}>
            {state.url}
          </code>
        </div>
      )}

      <FlowActions
        state={state}
        copied={copied}
        detailsOpen={detailsOpen}
        onOpenUrl={onOpenUrl}
        onCopy={(url) => {
          onCopyUrl(url)
          setCopied(true)
        }}
        onCancel={onCancel}
        onRetry={onRetry}
        onToggleDetails={() => setDetailsOpen((open) => !open)}
      />

      {failed && detailsOpen && state.message && (
        <pre className="wb-claude-flow-detail">{state.message}</pre>
      )}
    </div>
  )
}

/**
 * The action row: what the user can do *right now*, and nothing else.
 *
 * Its shape is the phase's — while the CLI waits, the two ways back into the
 * browser plus the way out; once it has failed, a retry and the CLI's own words
 * behind a disclosure. Split from the card so the card stays a layout.
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
  state: ClaudeLoginView
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
  const url = state.url
  return (
    <div className="wb-claude-flow-actions">
      {live && url && (
        <>
          <Button className="wb-btn wb-btn-sm" variant="ghost" onClick={() => onOpenUrl(url)}>
            <ExternalLinkIcon size={14} aria-hidden="true" />
            {t('claude.openAgainCta')}
          </Button>
          <Button className="wb-btn wb-btn-sm" variant="ghost" onClick={() => onCopy(url)}>
            <CopyIcon size={14} aria-hidden="true" />
            {copied ? t('claude.copiedLabel') : t('claude.copyUrlCta')}
          </Button>
        </>
      )}
      {live && (
        <Button
          variant="ghost"
          className="wb-btn wb-btn-sm wb-claude-flow-cancel"
          onClick={onCancel}
        >
          {t('claude.cancelCta')}
        </Button>
      )}
      {failed && (
        <Button className="wb-btn wb-btn-sm" onClick={onRetry}>
          {t('claude.retryCta')}
        </Button>
      )}
      {failed && state.message && (
        <Button
          className="wb-btn wb-btn-sm"
          variant="ghost"
          aria-expanded={detailsOpen}
          onClick={onToggleDetails}
        >
          {detailsOpen ? t('claude.detailsHide') : t('claude.detailsShow')}
        </Button>
      )}
    </div>
  )
}

/**
 * The receipt: who is now signed in.
 *
 * A tick alone would be an assertion; the account is evidence. It matters more
 * than it looks — people run several Claude accounts (a personal plan, a work
 * org), and "connected" without a name is exactly how the wrong one gets used
 * for a week.
 */
function ConnectedBadge({ account }: { account: ClaudeAccountView | null }): React.JSX.Element {
  const line = accountLine(account)
  return (
    <div className="wb-claude-connected">
      <span className="wb-claude-connected-mark" aria-hidden="true">
        {(account?.email ?? '?').charAt(0).toUpperCase()}
      </span>
      <span className="wb-claude-connected-text">
        <span className="wb-claude-connected-line">{line ?? t('claude.successGeneric')}</span>
        <span className="wb-claude-connected-hint">{t('claude.successHint')}</span>
      </span>
    </div>
  )
}
