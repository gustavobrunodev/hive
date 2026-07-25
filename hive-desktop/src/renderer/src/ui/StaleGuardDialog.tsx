import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { useReview } from '../scm/useReview'

/**
 * The concurrent-edit (STALE) guard dialog (Agent Change Review, ACR-R3.2,
 * design.md §8) — reuses the M4 STALE convention. When an accept/reject would
 * clobber a file the user hand-edited after the turn, the store records the
 * conflict and this dialog offers a choice instead of silently overwriting:
 * keep my edits, restore the pre-turn state, or cancel. Mounted once in WorkUI;
 * shows only while `staleConflict` is set.
 */
export function StaleGuardDialog(): React.JSX.Element | null {
  const review = useReview()
  const conflict = review.staleConflict
  if (!conflict) return null

  return (
    <Dialog open onOpenChange={(next: boolean) => !next && void review.resolveStale('cancel')}>
      <DialogContent>
        <DialogTitle>{t('review.staleTitle')}</DialogTitle>
        <DialogDescription>{t('review.staleDescription', conflict.path)}</DialogDescription>
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={() => void review.resolveStale('cancel')}>
            {t('review.staleCancel')}
          </Button>
          <Button
            className="wb-btn wb-btn-danger"
            onClick={() => void review.resolveStale('agent')}
          >
            {t('review.staleTakeAgent')}
          </Button>
          <Button
            className="wb-btn hds-btn-primary"
            onClick={() => void review.resolveStale('mine')}
          >
            {t('review.staleKeepMine')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
