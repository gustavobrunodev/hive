import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Textarea
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { ChevronDownIcon, PlusIcon, StashIcon } from '../ui/icons'
import { useGit } from './useGit'
import type { GitStash } from './gitStatus'

/** The stash-creation dialog (optional message + include-untracked, GIT-R10). */
function StashCreateDialog({
  open,
  onOpenChange,
  onConfirm
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (opts: { message?: string; untracked: boolean }) => void
}): React.JSX.Element | null {
  const [message, setMessage] = useState('')
  const [untracked, setUntracked] = useState(false)
  if (!open) return null
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('git.stashDialogTitle')}</DialogTitle>
        <DialogDescription>{t('git.stashIncludeUntracked')}</DialogDescription>
        <Textarea
          className="wb-stash-message"
          placeholder={t('git.stashMessagePlaceholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <label className="wb-stash-untracked">
          <Checkbox checked={untracked} onCheckedChange={(next) => setUntracked(next === true)} />
          {t('git.stashIncludeUntracked')}
        </label>
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={() => onOpenChange(false)}>
            {t('git.stashCancel')}
          </Button>
          <Button
            className="wb-btn hds-btn-primary"
            onClick={() => onConfirm({ message: message.trim() || undefined, untracked })}
          >
            {t('git.stashConfirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The stash list (git-management §5.2, GIT-R10) — a collapsible section with a
 * "Guardar alterações" action (optional message + include-untracked) and
 * per-stash Aplicar / Pop / Descartar (drop confirmed, since it's
 * irreversible). Applying a stash that conflicts simply surfaces the conflict
 * entries, which route into `ConflictView` like any other merge (GIT-R10.3 —
 * no special wiring). Reads the list fresh on every status change.
 */
export function StashPanel(): React.JSX.Element | null {
  const git = useGit()
  const [stashes, setStashes] = useState<GitStash[]>([])
  const [expanded, setExpanded] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState<GitStash | null>(null)

  useEffect(() => {
    let cancelled = false
    window.hive.git
      .stashList(git.workspace)
      .then((list) => {
        if (!cancelled) setStashes(list)
      })
      .catch(() => {
        if (!cancelled) setStashes([])
      })
    return () => {
      cancelled = true
    }
  }, [git.workspace, git.status])

  const hasStashes = stashes.length > 0

  return (
    <section className="wb-stash">
      <div className="wb-stash-header">
        <button
          type="button"
          className="wb-stash-toggle"
          aria-expanded={expanded}
          disabled={!hasStashes}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <ChevronDownIcon
            size={14}
            className="wb-stash-caret"
            data-collapsed={!expanded || undefined}
          />
          <StashIcon size={14} />
          <span className="wb-stash-title">{t('git.stashSection')}</span>
          {hasStashes && <span className="wb-stash-count">{stashes.length}</span>}
        </button>
        <IconButton label={t('git.stashCreate')} onClick={() => setCreateOpen(true)}>
          <PlusIcon size={14} />
        </IconButton>
      </div>

      {expanded && hasStashes && (
        <ul className="wb-stash-list">
          {stashes.map((stash) => (
            <li key={stash.ref} className="wb-stash-item">
              <span className="wb-stash-message" title={stash.message}>
                {stash.message}
              </span>
              <span className="wb-stash-actions">
                <button
                  type="button"
                  className="wb-stash-act"
                  onClick={() => void git.stashApply(stash.index)}
                >
                  {t('git.stashApply')}
                </button>
                <button
                  type="button"
                  className="wb-stash-act"
                  onClick={() => void git.stashApply(stash.index, true)}
                >
                  {t('git.stashPop')}
                </button>
                <button
                  type="button"
                  className="wb-stash-act wb-stash-act-danger"
                  onClick={() => setDropTarget(stash)}
                >
                  {t('git.stashDrop')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <StashCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={(opts) => {
          setCreateOpen(false)
          void git.stash(opts)
        }}
      />

      {dropTarget !== null && (
        <AlertDialog open onOpenChange={(next: boolean) => !next && setDropTarget(null)}>
          <AlertDialogContent>
            <AlertDialogTitle>{t('git.stashDropTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('git.stashDropDescription', dropTarget.message)}
            </AlertDialogDescription>
            <div className="wb-dialog-actions">
              <AlertDialogCancel className="wb-btn" onClick={() => setDropTarget(null)}>
                {t('git.stashDropCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="wb-btn wb-btn-danger"
                onClick={() => {
                  void git.stashDrop(dropTarget.index)
                  setDropTarget(null)
                }}
              >
                {t('git.stashDropConfirm')}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  )
}
