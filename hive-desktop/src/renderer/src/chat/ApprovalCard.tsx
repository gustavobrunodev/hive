import { useState } from 'react'
import { Button } from '@hive/design-system'
import { t } from '../i18n'
import {
  CheckIcon,
  CloseIcon,
  CompassIcon,
  EyeIcon,
  LockIcon,
  PencilIcon,
  TerminalIcon,
  UnlockIcon
} from '../ui/icons'
import { toolKind, toolLabel, type ToolKind } from './toolActivity'

/** One pending (or already-answered) permission request, as the chat holds it. */
export interface ApprovalRequest {
  requestId: string
  tool: string
  detail?: string
  input?: Record<string, unknown>
  turnId?: string
  /** `null` while the agent is still blocked on it. */
  answer?: ApprovalAnswer | null
}

/**
 * The four answers. `allow-session` is the only one that is not about *this*
 * call: it stops the asking altogether until the app is closed, which is why
 * it is offered apart from the three and never as the filled button.
 */
export type ApprovalAnswer = 'allow' | 'allow-always' | 'allow-session' | 'deny'

interface ApprovalCardProps {
  request: ApprovalRequest
  onDecide: (requestId: string, decision: ApprovalAnswer) => void
}

const ICONS: Record<ToolKind, typeof TerminalIcon> = {
  run: TerminalIcon,
  web: CompassIcon,
  edit: PencilIcon,
  read: EyeIcon,
  search: EyeIcon,
  task: LockIcon,
  other: LockIcon
}

function titleFor(tool: string): string {
  switch (toolKind(tool)) {
    case 'run':
      return t('approval.titleRun')
    case 'web':
      return t('approval.titleWeb')
    case 'edit':
      return t('approval.titleEdit')
    case 'read':
      return t('approval.titleRead')
    default:
      return t('approval.titleOther', toolLabel(tool))
  }
}

/**
 * What "Sempre permitir" actually grants, spelled out before it's clicked.
 * Mirrors `main/approvalService.ts`'s `approvalRuleFor`: a shell command is
 * remembered by its executable, everything else by the tool. Showing the scope
 * is the difference between an informed standing grant and handing over the
 * shell on a button whose consequences were never stated.
 */
function alwaysScopeOf(tool: string, detail: string | undefined): string {
  if (tool !== 'Bash') return toolLabel(tool)
  const head = (detail ?? '').trim().split(/\s+/)[0]
  return head === '' ? toolLabel(tool) : head
}

/**
 * The permission prompt (agent-approvals), inline in the transcript at the
 * point the agent asked.
 *
 * This is the interaction that was missing entirely: the CLI runs
 * non-interactively, so a call it isn't pre-authorized for was refused with no
 * prompt anywhere, and the agent would tell the user to "approve the security
 * prompt" that Hive never showed. The turn is genuinely blocked while this
 * card is open — answering it is the only thing that moves the agent.
 *
 * Modelled on the same decision Claude Code presents: what is being asked, the
 * literal payload, and three answers — once, always, or no. The payload is
 * shown verbatim in a mono block, never summarized: a command the user can't
 * read is a command they can't consent to.
 */
export function ApprovalCard({ request, onDecide }: ApprovalCardProps): React.JSX.Element {
  const [showDetails, setShowDetails] = useState(false)
  const pending = request.answer == null
  const Icon = ICONS[toolKind(request.tool)]

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (!pending) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onDecide(request.requestId, 'deny')
    }
  }

  const extraInput = otherInputEntries(request)

  // Answered: the question is over, so the panel is over. What remains is one
  // log line in the transcript, indented onto the same rail as the steps around
  // it — a record, not a second thing competing with the reply for attention.
  // Keeping the full warning surface here is what made a long transcript read
  // as a stack of alerts about decisions the user already made.
  if (!pending) return <AnsweredNote request={request} extraInput={extraInput} />

  return (
    <div
      className="wb-approval"
      role="group"
      aria-label={t('approval.pendingAria', titleFor(request.tool))}
      onKeyDown={handleKeyDown}
    >
      {/* `role="alert"` (not a live region on the whole card): a blocked turn
          is exactly the "action required" case assistive tech should interrupt
          for, and it must announce the ask, not the payload. */}
      <span className="wb-visually-hidden" role="alert">
        {t('approval.pendingAria', titleFor(request.tool))}
      </span>
      <div className="wb-approval-head">
        <span className="wb-approval-mark" aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className="wb-approval-titles">
          <span className="wb-approval-title">{titleFor(request.tool)}</span>
          <span className="wb-approval-desc">{t('approval.description')}</span>
        </span>
      </div>

      {request.detail !== undefined && request.detail !== '' && (
        <pre className="wb-approval-payload">
          <code>{request.detail}</code>
        </pre>
      )}

      {extraInput.length > 0 && (
        <>
          <button
            type="button"
            className="wb-approval-details-toggle"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((value) => !value)}
          >
            {showDetails ? t('approval.detailsHideCta') : t('approval.detailsCta')}
          </button>
          {showDetails && (
            <dl className="wb-approval-details">
              {extraInput.map(([key, value]) => (
                <div key={key} className="wb-approval-details-row">
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}

      <div className="wb-approval-actions">
        <Button
          // The agent is stopped until this is answered, so the answer takes
          // focus the moment the card mounts — Enter approves and Esc
          // refuses without ever reaching for the mouse.
          autoFocus
          className="wb-btn hds-btn-primary wb-approval-allow"
          onClick={() => onDecide(request.requestId, 'allow')}
        >
          {t('approval.allowCta')}
        </Button>
        {/* Both alternatives stay ghost. One filled button is the answer
            being offered; a filled "Sempre permitir" would compete with it,
            and styling "Recusar" as destructive would be a lie — refusing a
            tool call is the safe outcome, not a damaging one. */}
        <Button
          variant="ghost"
          className="wb-btn"
          title={t('approval.allowAlwaysHint', alwaysScopeOf(request.tool, request.detail))}
          onClick={() => onDecide(request.requestId, 'allow-always')}
        >
          {t('approval.allowAlwaysCta')}
        </Button>
        <Button
          variant="ghost"
          className="wb-btn"
          onClick={() => onDecide(request.requestId, 'deny')}
        >
          {t('approval.denyCta')}
        </Button>
        <span className="wb-approval-keys">{t('approval.keyboardHint')}</span>
      </div>

      {/* The session-wide grant, deliberately *not* a fourth peer button. The
          three above answer this call; this one turns the asking off, and a
          row of four equal buttons would put the widest-reaching answer one
          mis-click from the narrowest. It sits under a hairline, at link
          weight, with its own end-condition spelled out beside it. */}
      <div className="wb-approval-session">
        <button
          type="button"
          className="wb-approval-session-cta"
          onClick={() => onDecide(request.requestId, 'allow-session')}
        >
          <UnlockIcon size={13} />
          {t('approval.allowSessionCta')}
        </button>
        <span className="wb-approval-session-hint">{t('approval.allowSessionHint')}</span>
      </div>
    </div>
  )
}

/**
 * A permission that has been answered, as one line of the log.
 *
 * It sits on the same 26px indent as the tool rows around it, so approving a
 * command and the command running read as consecutive entries in one story
 * rather than a panel followed by a list. The verdict leads (it is the reason
 * the line exists), the payload follows verbatim, and the details stay one
 * click away — the record of what was authorized has to survive, it just has
 * no business shouting once the question is closed.
 */
function AnsweredNote({
  request,
  extraInput
}: {
  request: ApprovalRequest
  extraInput: Array<[string, string]>
}): React.JSX.Element {
  const [showDetails, setShowDetails] = useState(false)
  const denied = request.answer === 'deny'
  const verdict = denied
    ? t('approval.deniedState')
    : request.answer === 'allow-always'
      ? t('approval.allowedAlwaysState')
      : request.answer === 'allow-session'
        ? t('approval.allowedSessionState')
        : t('approval.allowedState')

  return (
    <div className="wb-approval-note" data-answer={request.answer ?? undefined}>
      <span className="wb-approval-note-mark" aria-hidden="true">
        {denied ? <CloseIcon size={12} /> : <CheckIcon size={12} />}
      </span>
      <span className="wb-approval-note-text">
        <span className="wb-approval-note-verdict">{verdict}</span>
        <span className="wb-approval-note-payload" title={request.detail}>
          {request.detail !== undefined && request.detail !== ''
            ? request.detail
            : titleFor(request.tool)}
        </span>
      </span>
      {extraInput.length > 0 && (
        <button
          type="button"
          className="wb-approval-note-toggle"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
        >
          {showDetails ? t('approval.detailsHideCta') : t('approval.detailsCta')}
        </button>
      )}
      {showDetails && (
        <dl className="wb-approval-details wb-approval-note-details">
          {extraInput.map(([key, value]) => (
            <div key={key} className="wb-approval-details-row">
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * Input fields worth showing behind "Ver detalhes" — everything except the one
 * already displayed verbatim as the payload, and anything that isn't a short
 * scalar (a 400-line file body belongs in the diff review, not in a consent
 * dialog).
 */
const MAX_DETAIL_VALUE = 200

function otherInputEntries(request: ApprovalRequest): Array<[string, string]> {
  if (!request.input) return []
  return Object.entries(request.input)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [key, String(value)] as [string, string])
    .filter(([, value]) => value !== request.detail && value.length <= MAX_DETAIL_VALUE)
}
