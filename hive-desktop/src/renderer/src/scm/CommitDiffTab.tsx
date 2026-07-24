import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { DiffView } from '../ui/DiffView'
import { useGit } from './useGit'
import type { GitCommitDiff } from './gitStatus'

export interface CommitDiffTabProps {
  /** The commit hash to show. */
  hash: string
}

/** Basename of a POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/**
 * An editor-pane tab body showing a single commit's changed files + full patch
 * (git-management GIT-R8.2). Commits are immutable, so it loads once. Reads the
 * active workspace from the shared `useGit` store.
 */
export function CommitDiffTab({ hash }: CommitDiffTabProps): React.JSX.Element {
  const git = useGit()
  const [result, setResult] = useState<GitCommitDiff | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.hive.git
      .commitDiff(git.workspace, hash)
      .then((next) => {
        if (!cancelled) setResult(next)
      })
      .catch(() => {
        if (!cancelled) setResult({ files: [], diff: { binary: false, hunks: [] } })
      })
    return () => {
      cancelled = true
    }
  }, [git.workspace, hash])

  if (!result) {
    return (
      <div className="wb-diff">
        <div className="wb-diff-loading" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="wb-commitdiff">
      <div className="wb-commitdiff-files">
        <p className="wb-commitdiff-files-title">
          {t('git.commitFilesHeader', result.files.length)}
        </p>
        <ul className="wb-commitdiff-file-list">
          {result.files.map((file) => (
            <li key={file.path} className="wb-commitdiff-file">
              <span className="wb-commitdiff-file-name">{baseName(file.path)}</span>
              {!file.binary && (
                <span className="wb-commitdiff-file-stat">
                  <span className="wb-commitdiff-add">+{file.added ?? 0}</span>
                  <span className="wb-commitdiff-del">−{file.deleted ?? 0}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <DiffView diff={result.diff} title={t('git.commitDiffTitle', hash.slice(0, 7))} />
    </div>
  )
}
