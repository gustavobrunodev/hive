import { useEffect, useState } from 'react'
import { Button } from '@hive/design-system'
import { t } from '../i18n'
import {
  applyResolutions,
  conflictCount,
  hasConflictMarkers,
  parseConflicts,
  type ConflictChoice,
  type ConflictSegment
} from '../scm/conflictParse'
import { useGit } from '../scm/useGit'
import { CheckCircleIcon } from './icons'

export interface ConflictViewProps {
  /** Workspace-relative path of the conflicted file. */
  path: string
}

/** Renders one conflict block with per-side accept controls (GIT-R9.2). */
function ConflictBlock({
  segment,
  choice,
  onChoose
}: {
  segment: Extract<ConflictSegment, { type: 'conflict' }>
  choice: ConflictChoice | undefined
  onChoose: (choice: ConflictChoice) => void
}): React.JSX.Element {
  return (
    <div className="wb-conflict-block" aria-label={t('git.conflictBlockAria', segment.id + 1)}>
      <div
        className="wb-conflict-side"
        data-side="ours"
        data-chosen={choice === 'current' || undefined}
      >
        <div className="wb-conflict-side-head">
          <span className="wb-conflict-side-label">{t('git.conflictOurs')}</span>
          <button type="button" className="wb-conflict-accept" onClick={() => onChoose('current')}>
            {t('git.acceptCurrent')}
          </button>
        </div>
        <pre className="wb-conflict-code">{segment.ours.join('\n')}</pre>
      </div>
      <div
        className="wb-conflict-side"
        data-side="theirs"
        data-chosen={choice === 'incoming' || undefined}
      >
        <div className="wb-conflict-side-head">
          <span className="wb-conflict-side-label">{t('git.conflictTheirs')}</span>
          <button type="button" className="wb-conflict-accept" onClick={() => onChoose('incoming')}>
            {t('git.acceptIncoming')}
          </button>
        </div>
        <pre className="wb-conflict-code">{segment.theirs.join('\n')}</pre>
      </div>
      <button
        type="button"
        className="wb-conflict-both"
        data-chosen={choice === 'both' || undefined}
        onClick={() => onChoose('both')}
      >
        {t('git.acceptBoth')}
      </button>
    </div>
  )
}

/**
 * The merge-conflict resolution surface (git-management §6.5, GIT-R9), opened
 * as a `kind:'conflict'` editor tab. Reads the conflicted file, splits it into
 * blocks, and lets the user accept current / incoming / both per block. Once
 * every block is resolved it writes the reconstructed file and stages it
 * (GIT-R9.3) — the merge-level Continuar/Abortar live in the SCM header.
 */
export function ConflictView({ path }: ConflictViewProps): React.JSX.Element {
  const git = useGit()
  const [content, setContent] = useState<string | null>(null)
  const [resolutions, setResolutions] = useState<Map<number, ConflictChoice>>(new Map())

  useEffect(() => {
    let cancelled = false
    window.hive
      .readFile(git.workspace, path)
      .then((next) => {
        if (cancelled) return
        setContent(next)
        setResolutions(new Map())
      })
      .catch(() => {
        if (!cancelled) setContent('')
      })
    return () => {
      cancelled = true
    }
  }, [git.workspace, path, git.status])

  if (content === null) {
    return (
      <div className="wb-diff">
        <div className="wb-diff-loading" aria-hidden="true" />
      </div>
    )
  }

  // Already resolved (no markers) — offer to stage it and finish the merge.
  if (!hasConflictMarkers(content)) {
    return (
      <div className="wb-scm-empty">
        <span className="wb-scm-empty-icon" aria-hidden="true">
          <CheckCircleIcon size={22} />
        </span>
        <p className="wb-scm-empty-title">{t('git.conflictResolvedTitle')}</p>
        <p className="wb-scm-empty-desc">{t('git.conflictResolvedDesc')}</p>
        <div className="wb-scm-empty-action">
          <Button className="wb-btn hds-btn-primary" onClick={() => void git.stage([path])}>
            {t('git.markResolved')}
          </Button>
        </div>
      </div>
    )
  }

  const segments = parseConflicts(content)
  const total = conflictCount(segments)
  const remaining = total - resolutions.size
  const allResolved = remaining === 0

  const choose = (id: number, choice: ConflictChoice): void => {
    setResolutions((prev) => new Map(prev).set(id, choice))
  }

  const markResolved = async (): Promise<void> => {
    const merged = applyResolutions(segments, resolutions)
    await window.hive.fs.saveFile(git.workspace, path, merged)
    await git.stage([path])
  }

  return (
    <div className="wb-conflict">
      <div className="wb-conflict-bar">
        <span className="wb-conflict-status">
          {allResolved ? t('git.conflictResolvedTitle') : t('git.conflictRemaining', remaining)}
        </span>
        <Button
          className="wb-btn hds-btn-primary"
          disabled={!allResolved}
          onClick={() => void markResolved()}
        >
          {t('git.markResolved')}
        </Button>
      </div>
      <div className="wb-conflict-body">
        {segments.map((segment, index) =>
          segment.type === 'text' ? (
            segment.lines.some((line) => line.length > 0) && (
              <pre key={`t${index}`} className="wb-conflict-context">
                {segment.lines.join('\n')}
              </pre>
            )
          ) : (
            <ConflictBlock
              key={`c${segment.id}`}
              segment={segment}
              choice={resolutions.get(segment.id)}
              onChoose={(choice) => choose(segment.id, choice)}
            />
          )
        )}
      </div>
    </div>
  )
}
