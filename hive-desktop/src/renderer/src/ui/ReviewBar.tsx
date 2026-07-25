import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { useReview } from '../scm/useReview'

interface ReviewBarProps {
  /** Opens the "Revisão do agente" sidebar panel (the `Revisar →` affordance). */
  onReview: () => void
}

/**
 * The persistent, ambient review bar (Agent Change Review, ACR-R2.3). Visible
 * only while the pending set is non-empty — `● N mudanças pendentes ·
 * [Rejeitar tudo] [Aceitar tudo] · Revisar →`. It reserves no space when clean
 * (returns null) and never blocks the app — the only friction is the one
 * destructive confirm (reject-all), exactly where it protects the user (G4).
 * Reads the single `useReview` store, so its count stays in lockstep with the
 * panel, card, and inline diff (ACR-R2.5).
 */
export function ReviewBar({ onReview }: ReviewBarProps): React.JSX.Element | null {
  const review = useReview()
  const [confirmRejectAll, setConfirmRejectAll] = useState(false)

  if (review.pendingCount === 0) return null

  return (
    <div className="wb-review-bar" role="region" aria-label={t('review.barLabel')}>
      <span className="wb-review-bar-dot" aria-hidden="true" />
      <span className="wb-review-bar-count">{t('review.barPending', review.pendingCount)}</span>
      <span className="wb-review-bar-spacer" />
      <button
        type="button"
        className="wb-review-bar-btn"
        data-kind="reject"
        onClick={() => setConfirmRejectAll(true)}
      >
        {t('review.barRejectAll')}
      </button>
      <button
        type="button"
        className="wb-review-bar-btn"
        data-kind="accept"
        onClick={() => void review.acceptAll()}
      >
        {t('review.barAcceptAll')}
      </button>
      <button type="button" className="wb-review-bar-review" onClick={onReview}>
        {t('review.barReview')}
        <span aria-hidden="true"> →</span>
      </button>

      {confirmRejectAll && (
        <Dialog open onOpenChange={(next: boolean) => !next && setConfirmRejectAll(false)}>
          <DialogContent>
            <DialogTitle>{t('review.rejectAllTitle')}</DialogTitle>
            <DialogDescription>
              {t('review.rejectAllDescription', review.pendingCount)}
            </DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={() => setConfirmRejectAll(false)}>
                {t('review.rejectAllCancel')}
              </Button>
              <Button
                className="wb-btn wb-btn-danger"
                onClick={() => {
                  setConfirmRejectAll(false)
                  void review.rejectAll()
                }}
              >
                {t('review.rejectAllConfirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
