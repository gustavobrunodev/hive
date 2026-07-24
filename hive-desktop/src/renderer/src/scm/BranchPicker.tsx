import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@hive/design-system'
import { t } from '../i18n'
import { BranchIcon, CheckIcon, PlusIcon, TrashIcon } from '../ui/icons'
import type { GitBranch, GitBranches } from './gitStatus'

export interface BranchPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: string
  /** Checks out `ref` — WorkUI guards unsaved editor drafts first (GIT-R6.3). */
  onCheckout: (ref: string) => void
  /** `switch -c <name>` from HEAD (GIT-R6.4). */
  onCreate: (name: string) => void
  /** `branch -d/-D <name>` after confirmation (GIT-R6.4). */
  onDelete: (name: string) => void
}

/** Local checkout ref for a branch: the short name for a remote (`origin/x` → `x`, auto-tracks). */
function checkoutRef(branch: GitBranch): string {
  return branch.isRemote ? branch.name.split('/').slice(1).join('/') : branch.name
}

/**
 * Branch quick-pick (git-management §5.2, GIT-R6) on the DS `Command` palette —
 * local + remote branches, fuzzy filter, create-from-query, checkout, and
 * delete-with-confirm. Opened from the status-bar branch pill (and the SCM
 * header). The dirty-tree guard lives in the caller's `onCheckout` (it reuses
 * the three-way unsaved dialog); git's own checkout refusal surfaces upstream
 * rather than being forced. A detached HEAD simply shows no current marker and
 * the create item branches from HEAD.
 */
export function BranchPicker({
  open,
  onOpenChange,
  workspace,
  onCheckout,
  onCreate,
  onDelete
}: BranchPickerProps): React.JSX.Element {
  const [branches, setBranches] = useState<GitBranches>({ branches: [], current: null })
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Fresh list on every open — branches change under the app constantly. The
  // filter reset is deferred a microtask so it isn't a synchronous setState in
  // the effect body.
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => setQuery(''))
    let cancelled = false
    window.hive.git
      .branches(workspace)
      .then((result) => {
        if (!cancelled) setBranches(result)
      })
      .catch(() => {
        if (!cancelled) setBranches({ branches: [], current: null })
      })
    return () => {
      cancelled = true
    }
  }, [open, workspace])

  const local = branches.branches.filter((b) => !b.isRemote)
  const remote = branches.branches.filter((b) => b.isRemote)
  const trimmed = query.trim()
  const exactMatch = branches.branches.some((b) => b.name === trimmed)

  const close = (): void => onOpenChange(false)

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        label={t('git.branchPickerLabel')}
        className="wb-branchpicker"
      >
        <CommandInput
          placeholder={t('git.branchFilterPlaceholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{t('git.branchEmpty')}</CommandEmpty>

          {trimmed !== '' && !exactMatch && (
            <CommandItem
              value={trimmed}
              onSelect={() => {
                onCreate(trimmed)
                close()
              }}
              aria-label={t('git.createBranchItem', trimmed)}
            >
              <span className="wb-branch-icon" aria-hidden="true">
                <PlusIcon size={14} />
              </span>
              <span className="wb-branch-name">{t('git.createBranchItem', trimmed)}</span>
            </CommandItem>
          )}

          {local.length > 0 && (
            <CommandGroup heading={t('git.localBranches')}>
              {local.map((branch) => (
                <CommandItem
                  key={branch.name}
                  value={branch.name}
                  onSelect={() => {
                    onCheckout(checkoutRef(branch))
                    close()
                  }}
                  aria-label={
                    branch.isHead
                      ? t('git.currentBranchAria', branch.name)
                      : t('git.checkoutAria', branch.name)
                  }
                >
                  <span className="wb-branch-icon" aria-hidden="true">
                    {branch.isHead ? <CheckIcon size={14} /> : <BranchIcon size={14} />}
                  </span>
                  <span className="wb-branch-name">{branch.name}</span>
                  {!branch.isHead && (
                    <button
                      type="button"
                      className="wb-branch-delete"
                      aria-label={t('git.deleteBranchLabel', branch.name)}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(branch.name)
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {remote.length > 0 && (
            <CommandGroup heading={t('git.remoteBranches')}>
              {remote.map((branch) => (
                <CommandItem
                  key={branch.name}
                  value={branch.name}
                  onSelect={() => {
                    onCheckout(checkoutRef(branch))
                    close()
                  }}
                  aria-label={t('git.checkoutAria', branch.name)}
                >
                  <span className="wb-branch-icon" aria-hidden="true">
                    <BranchIcon size={14} />
                  </span>
                  <span className="wb-branch-name">{branch.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {deleteTarget !== null && (
        <AlertDialog open onOpenChange={(next: boolean) => !next && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogTitle>{t('git.deleteBranchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('git.deleteBranchDescription', deleteTarget)}
            </AlertDialogDescription>
            <div className="wb-dialog-actions">
              <AlertDialogCancel className="wb-btn" onClick={() => setDeleteTarget(null)}>
                {t('git.deleteBranchCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="wb-btn wb-btn-danger"
                onClick={() => {
                  onDelete(deleteTarget)
                  setDeleteTarget(null)
                }}
              >
                {t('git.deleteBranchConfirm')}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
