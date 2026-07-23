import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { DiffView } from '../ui/DiffView'
import { useGit } from './useGit'
import type { GitDiff, GitDiffSide } from './gitStatus'

/** Basename of a POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export interface DiffTabProps {
  /** Workspace-relative file path. */
  path: string
  /** Which side: working tree (worktree vs index) or staged (index vs HEAD). */
  side: GitDiffSide
}

/**
 * An editor-pane tab body that loads a file's diff and renders it (git-management
 * §6.5). Reloads whenever the git status changes (a stage/commit/edit), so the
 * diff a user is reading stays in sync with the change list. Reads the active
 * workspace from the shared `useGit` store.
 */
export function DiffTab({ path, side }: DiffTabProps): React.JSX.Element {
  const git = useGit()
  const [diff, setDiff] = useState<GitDiff | null>(null)

  // `git.status` is a dependency so the diff refreshes after any mutation.
  const statusRef = git.status
  useEffect(() => {
    let cancelled = false
    void window.hive.git
      .diff(git.workspace, path, side)
      .then((next) => {
        if (!cancelled) setDiff(next)
      })
      .catch(() => {
        if (!cancelled) setDiff({ binary: false, hunks: [] })
      })
    return () => {
      cancelled = true
    }
  }, [git.workspace, path, side, statusRef])

  const title = t(
    'git.diffTitle',
    baseName(path),
    side === 'staged' ? t('git.diffSideStaged') : t('git.diffSideWorking')
  )

  if (!diff) {
    return (
      <div className="wb-diff">
        <div className="wb-diff-loading" aria-hidden="true" />
      </div>
    )
  }

  return <DiffView diff={diff} title={title} />
}
