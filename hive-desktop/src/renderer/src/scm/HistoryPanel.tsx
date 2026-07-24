import { useCallback, useEffect, useState } from 'react'
import { relativeTimeLabel, t } from '../i18n'
import { CommitIcon } from '../ui/icons'
import { useGit } from './useGit'
import type { GitCommit } from './gitStatus'

/** Commits fetched per page (GIT-R8 load-more). */
const PAGE_SIZE = 30

export interface HistoryPanelProps {
  /** Opens a commit's diff in the editor pane (GIT-R8.2). */
  onOpenCommit: (hash: string, label: string) => void
  /** Scope the timeline to a single file's commits (GIT-R8.3); undefined = whole repo. */
  file?: string
  /** Clears a file scope back to the whole-repo history. */
  onClearScope?: () => void
}

/** Basename of a POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/**
 * The commit history timeline (git-management §5.2, GIT-R8) — newest first,
 * with load-more paging. Selecting a commit opens its diff in the editor
 * (GIT-R8.2); when scoped to a `file` (from a row's "Ver histórico"), only that
 * file's commits show (GIT-R8.3). Reads the active workspace from `useGit`.
 */
export function HistoryPanel({
  onOpenCommit,
  file,
  onClearScope
}: HistoryPanelProps): React.JSX.Element {
  const git = useGit()
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (skip: number): Promise<void> => {
      setBusy(true)
      try {
        const page = await window.hive.git.log(git.workspace, { skip, limit: PAGE_SIZE, file })
        setCommits((prev) => (skip === 0 ? page : [...prev, ...page]))
        setHasMore(page.length === PAGE_SIZE)
      } catch {
        if (skip === 0) setCommits([])
        setHasMore(false)
      } finally {
        setBusy(false)
      }
    },
    [git.workspace, file]
  )

  // First page on mount / workspace / file-scope change (microtask-deferred so
  // the write isn't a synchronous setState in the effect body).
  useEffect(() => {
    queueMicrotask(() => void load(0))
  }, [load])

  if (commits.length === 0 && !busy) {
    return (
      <div className="wb-scm-empty">
        <span className="wb-scm-empty-icon" aria-hidden="true">
          <CommitIcon size={22} />
        </span>
        <p className="wb-scm-empty-title">{t('git.historyEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="wb-history">
      {file && (
        <div className="wb-history-scope">
          <span className="wb-history-scope-name">{t('git.historyFileScope', baseName(file))}</span>
          {onClearScope && (
            <button type="button" className="wb-history-scope-clear" onClick={onClearScope}>
              {t('git.historyClearScope')}
            </button>
          )}
        </div>
      )}
      <ol className="wb-history-list">
        {commits.map((commit) => {
          const when = relativeTimeLabel(Date.parse(commit.date))
          return (
            <li key={commit.hash} className="wb-history-item">
              <button
                type="button"
                className="wb-history-commit"
                aria-label={t('git.commitAria', commit.subject, commit.author, when)}
                onClick={() => onOpenCommit(commit.hash, commit.subject)}
              >
                <span className="wb-history-dot" aria-hidden="true" />
                <span className="wb-history-body">
                  <span className="wb-history-subject">{commit.subject}</span>
                  <span className="wb-history-meta">
                    <code className="wb-history-hash">{commit.shortHash}</code>
                    <span className="wb-history-author">{commit.author}</span>
                    <span className="wb-history-when">{when}</span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {hasMore && (
        <button
          type="button"
          className="wb-history-more"
          disabled={busy}
          onClick={() => void load(commits.length)}
        >
          {t('git.loadMore')}
        </button>
      )}
    </div>
  )
}
