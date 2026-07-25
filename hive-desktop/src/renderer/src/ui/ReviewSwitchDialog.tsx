import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'

interface ReviewSwitchDialogProps {
  /** Number of pending changes in the workspace being left (0 → not shown). */
  count: number
  /** Accept the whole pending set, then continue the switch. */
  onAcceptAll: () => void
  /** Reject the whole pending set (restore pre-turn), then continue the switch. */
  onRejectAll: () => void
  /** Leave the set pending and switch anyway (it survives; returning re-shows it). */
  onKeep: () => void
  /** Dismiss — the switch never happens. */
  onCancel: () => void
}

/**
 * The workspace-switch guard for a non-empty pending review set (Agent Change
 * Review, ACR-R4.3, design.md §8) — reuses the M8 unsaved-guard convention.
 * Switching away with un-reviewed agent changes prompts a choice rather than
 * silently leaving them: accept all, reject all, keep-pending-and-leave, or
 * cancel. Rendered only while `count > 0` and a switch is in flight.
 */
export function ReviewSwitchDialog({
  count,
  onAcceptAll,
  onRejectAll,
  onKeep,
  onCancel
}: ReviewSwitchDialogProps): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('review.switchTitle')}</DialogTitle>
        <DialogDescription>{t('review.switchDescription', count)}</DialogDescription>
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onCancel}>
            {t('review.switchCancel')}
          </Button>
          <Button className="wb-btn wb-btn-danger" onClick={onRejectAll}>
            {t('review.switchRejectAll')}
          </Button>
          <Button className="wb-btn" onClick={onKeep}>
            {t('review.switchKeep')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={onAcceptAll}>
            {t('review.switchAcceptAll')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
