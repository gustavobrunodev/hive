import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'

interface UnsavedGuardDialogProps {
  open: boolean
  /** Dismiss without proceeding. */
  onCancel: () => void
  /** Proceed, dropping the unsaved drafts. */
  onDiscard: () => void
  /** Save the drafts first, then proceed. */
  onSave: () => void
}

/**
 * The shared three-way "unsaved changes" guard dialog (Cancelar / Descartar /
 * Salvar), reused across every action that would abandon in-editor drafts — a
 * workspace switch, a tab close, and a branch checkout (git-management
 * GIT-R6.3). Extracted so `WorkUI` mounts it declaratively (`open={…}`) instead
 * of repeating the same dialog three times behind `&&` gates.
 */
export function UnsavedGuardDialog({
  open,
  onCancel,
  onDiscard,
  onSave
}: UnsavedGuardDialogProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <Dialog open onOpenChange={(next: boolean) => !next && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('explorer.unsavedGuardTitle')}</DialogTitle>
        <DialogDescription>{t('explorer.unsavedGuardDescription')}</DialogDescription>
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onCancel}>
            {t('explorer.unsavedGuardCancelCta')}
          </Button>
          <Button className="wb-btn" onClick={onDiscard}>
            {t('explorer.unsavedGuardConfirmCta')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={onSave}>
            {t('explorer.unsavedGuardSaveCta')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
