import { useState } from 'react'
import { t } from '../i18n'
import { DiffView } from '../ui/DiffView'
import { HunkActions } from '../ui/HunkActions'
import { CheckIcon, ChevronRightIcon } from '../ui/icons'
import { useReview, type ReviewChange, type TurnMark } from '../scm/useReview'

interface ChangeCardProps {
  /** The turn this card annotates (its touched paths + id). */
  turn: TurnMark
}

/** Basename of a workspace-relative POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/**
 * The in-chat change card (Claude-Desktop tier, Agent Change Review, ACR-R2.2),
 * rendered in the transcript for a turn that changed files (keyed off its
 * `TurnMark`). Compact: an "Editei N arquivos" header, a file list with `+/-`
 * counts + status dots, expand → the per-file `DiffView` with the shared
 * per-hunk ✓/✗ gesture, and turn-level accept/reject. It reads the single
 * `useReview` store, so accepted files check off live and a fully-reviewed card
 * settles into a quiet "Revisado" state (ACR-R2.5). Renders nothing for a turn
 * that touched no files.
 */
export function ChangeCard({ turn }: ChangeCardProps): React.JSX.Element | null {
  const review = useReview()
  const [expanded, setExpanded] = useState(false)

  if (turn.paths.length === 0) return null

  // Cross-reference the turn's files with the live pending set: a path still in
  // `changes` is pending (show ✓/✗); one that's gone has been reviewed (checked).
  const byPath = new Map<string, ReviewChange>(review.changes.map((c) => [c.path, c]))
  const pending = turn.paths.filter((p) => byPath.has(p))
  const allReviewed = pending.length === 0

  return (
    <div className="wb-change-card" data-reviewed={allReviewed || undefined}>
      <header className="wb-change-card-head">
        <span className="wb-change-card-title">
          {allReviewed ? t('review.cardReviewed') : t('review.cardTitle', turn.paths.length)}
        </span>
        {!allReviewed && (
          <>
            <button
              type="button"
              className="wb-change-card-expand"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t('review.cardCollapse') : t('review.cardExpand')}
              <ChevronRightIcon
                size={12}
                style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
              />
            </button>
            <HunkActions
              target={t('review.cardTitle', pending.length)}
              onAccept={() => pending.forEach((p) => void review.acceptFile(p))}
              onReject={() => pending.forEach((p) => void review.rejectFile(p))}
            />
          </>
        )}
      </header>

      <ul className="wb-change-card-files">
        {turn.paths.map((path) => {
          const change = byPath.get(path)
          return (
            <li key={path} className="wb-change-card-file" data-reviewed={!change || undefined}>
              {change ? (
                <span
                  className="wb-change-card-dot"
                  data-status={change.status}
                  aria-hidden="true"
                />
              ) : (
                <CheckIcon size={12} className="wb-change-card-check" aria-hidden="true" />
              )}
              <span className="wb-change-card-name">{baseName(path)}</span>
              {change && !change.diff.binary && (
                <span className="wb-change-card-counts">
                  {t('review.addsDels', change.adds, change.dels)}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {expanded &&
        pending.map((path) => {
          const change = byPath.get(path)!
          return (
            <div key={path} className="wb-change-card-diff">
              <DiffView
                diff={change.diff}
                title={path}
                onHunkAccept={(hunkId) => void review.acceptHunk(path, hunkId)}
                onHunkReject={(hunkId) => void review.rejectHunk(path, hunkId)}
              />
            </div>
          )
        })}
    </div>
  )
}
