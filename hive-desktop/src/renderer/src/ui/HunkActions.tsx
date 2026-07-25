import { t } from '../i18n'
import { CheckIcon, CloseIcon } from './icons'

export interface HunkActionsProps {
  /** Accept this hunk/file — keep the agent's bytes. */
  onAccept: () => void
  /** Reject this hunk/file — restore the pre-turn bytes. */
  onReject: () => void
  /** What the ✓/✗ act on, for the aria-label (e.g. "o trecho 2 de 3", "arquivo.ts"). */
  target: string
  /** Optional count label shown between the controls (e.g. "Trecho 2 de 3"). */
  label?: string
  /** Compact variant (icons only, tighter) for dense rows (panel/inline). */
  compact?: boolean
}

/**
 * The one accept/reject gesture, used identically inline, in the change card,
 * and in the panel — earned familiarity (Agent Change Review, G3, design.md
 * §6.6). A ✓ Aceitar / ✗ Rejeitar pair with an optional count label between
 * them. Quiet by default (it lets the diff be the interface); the danger/
 * success role tokens live in `workbench.css`. Keyboard/focusable buttons;
 * status by icon + text, never color alone (a11y).
 */
export function HunkActions({
  onAccept,
  onReject,
  target,
  label,
  compact
}: HunkActionsProps): React.JSX.Element {
  return (
    <div className="wb-hunk-actions" data-compact={compact || undefined}>
      <button
        type="button"
        className="wb-hunk-btn"
        data-kind="accept"
        aria-label={t('review.acceptAria', target)}
        onClick={onAccept}
      >
        <CheckIcon size={14} aria-hidden="true" />
        {!compact && <span>{t('review.accept')}</span>}
      </button>
      {label && <span className="wb-hunk-count">{label}</span>}
      <button
        type="button"
        className="wb-hunk-btn"
        data-kind="reject"
        aria-label={t('review.rejectAria', target)}
        onClick={onReject}
      >
        <CloseIcon size={14} aria-hidden="true" />
        {!compact && <span>{t('review.reject')}</span>}
      </button>
    </div>
  )
}
