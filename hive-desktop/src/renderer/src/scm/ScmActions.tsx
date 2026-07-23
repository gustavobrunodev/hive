import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { DiscardIcon, MinusIcon, PlusIcon } from '../ui/icons'
import type { RowSide } from './ChangeGroups'
import type { GitFileChange } from './gitStatus'

/** Basename of a workspace-relative POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export interface RowActionsProps {
  change: GitFileChange
  side: RowSide
  onStage: (change: GitFileChange) => void
  onUnstage: (change: GitFileChange) => void
  onDiscard: (change: GitFileChange) => void
}

/**
 * Inline hover/focus actions for one change row (GIT-R3): staged rows offer
 * Unstage; unstaged rows offer Discard + Stage; a conflict row offers Stage
 * ("mark resolved"). Buttons are keyboard-reachable (the row's
 * `:focus-within` reveals them) — not hover-only.
 */
export function RowActions({
  change,
  side,
  onStage,
  onUnstage,
  onDiscard
}: RowActionsProps): React.JSX.Element {
  return (
    <>
      {side === 'unstaged' && (
        <IconButton
          className="wb-scm-act"
          label={t('git.discard')}
          onClick={() => onDiscard(change)}
        >
          <DiscardIcon size={14} />
        </IconButton>
      )}
      {side === 'staged' ? (
        <IconButton
          className="wb-scm-act"
          label={t('git.unstage')}
          onClick={() => onUnstage(change)}
        >
          <MinusIcon size={14} />
        </IconButton>
      ) : (
        <IconButton className="wb-scm-act" label={t('git.stage')} onClick={() => onStage(change)}>
          <PlusIcon size={14} />
        </IconButton>
      )}
    </>
  )
}

export interface GroupActionsProps {
  side: RowSide
  onStageAll: () => void
  onUnstageAll: () => void
  onDiscardAll: () => void
}

/** Section-header actions (GIT-R3): Stage all / Unstage all / Discard all. */
export function GroupActions({
  side,
  onStageAll,
  onUnstageAll,
  onDiscardAll
}: GroupActionsProps): React.JSX.Element {
  if (side === 'staged') {
    return (
      <IconButton className="wb-scm-act" label={t('git.unstageAll')} onClick={onUnstageAll}>
        <MinusIcon size={14} />
      </IconButton>
    )
  }
  if (side === 'unstaged') {
    return (
      <>
        <IconButton className="wb-scm-act" label={t('git.discardAll')} onClick={onDiscardAll}>
          <DiscardIcon size={14} />
        </IconButton>
        <IconButton className="wb-scm-act" label={t('git.stageAll')} onClick={onStageAll}>
          <PlusIcon size={14} />
        </IconButton>
      </>
    )
  }
  // Conflict group: staging (mark-resolved) is per-row; no group action here.
  return <></>
}

/** Discard confirmation (GIT-R3.3) — a real modal, since discard is irreversible-by-surprise. */
export function DiscardDialog({
  target,
  onCancel,
  onConfirm
}: {
  target: GitFileChange[] | null
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element | null {
  if (!target || target.length === 0) return null

  let description: string
  if (target.length === 1) {
    const only = target[0]
    description = only.isUntracked
      ? t('git.discardUntrackedOne', baseName(only.path))
      : t('git.discardTrackedOne', baseName(only.path))
  } else {
    description = t('git.discardMany', target.length)
  }

  return (
    <AlertDialog open onOpenChange={(open: boolean) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('git.discardTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <div className="wb-dialog-actions">
          <AlertDialogCancel className="wb-btn" onClick={onCancel}>
            {t('git.discardCancel')}
          </AlertDialogCancel>
          <AlertDialogAction className="wb-btn wb-btn-danger" onClick={onConfirm}>
            {t('git.discardConfirm')}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
