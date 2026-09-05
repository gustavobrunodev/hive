import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'

interface UnsavedGuardDialogProps {
  open: boolean
  /**
   * The file being asked about, when the guard is about exactly one.
   *
   * A close of several tabs asks once per file, and "este arquivo" with no
   * name is a question the user cannot answer: they are looking at whichever
   * editor happens to be visible, which is not necessarily the one at stake.
   */
  fileName?: string
  /** How many files the same run will still ask about after this one (0 = none). */
  remaining?: number
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
  fileName,
  remaining = 0,
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
        {fileName !== undefined && (
          <p className="wb-guard-subject">
            <span className="wb-guard-file">{t('explorer.unsavedGuardFile', fileName)}</span>
            {remaining > 0 && (
              <span className="wb-guard-remaining">
                {t('explorer.unsavedGuardRemaining', remaining)}
              </span>
            )}
          </p>
        )}
        <div className="wb-dialog-actions">
          <Button variant="ghost" className="wb-btn" onClick={onCancel}>
            {t('explorer.unsavedGuardCancelCta')}
          </Button>
          <Button className="wb-btn wb-btn-danger" onClick={onDiscard}>
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
