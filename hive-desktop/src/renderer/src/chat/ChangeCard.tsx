import { useState } from 'react'
import { t } from '../i18n'
import { DiffView } from '../ui/DiffView'
import { HunkActions } from '../ui/HunkActions'
import { CheckIcon, ChevronRightIcon, PencilIcon } from '../ui/icons'
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

/** Everything before the basename, for the dimmed path prefix on a row. */
function dirName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i + 1)
}

/**
 * The in-chat change card (Cursor / Claude-Desktop tier, Agent Change Review,
 * ACR-R2.2): what one turn changed, reviewable without leaving the transcript.
 *
 * ## Two scopes, and they are not the same control
 *
 * The header decides the **turn**: *Aceitar tudo* / *Rejeitar tudo*, one
 * gesture, one operation. Each row decides **its own file**. That split is the
 * whole point of this rework — the header used to be labelled *Aceitar* (a
 * per-file word) while looping `acceptFile` over every path, so the user
 * clicked one button and watched files being approved one at a time, with no
 * way to accept a single file at all. Now the batch is a batch (`acceptFiles`,
 * settled in main in a single pass) and the per-file decision lives where the
 * file is.
 *
 * A row expands in place to its own diff, with the same per-hunk ✓/✗ used
 * everywhere else (earned familiarity, G3) — one file at a time, rather than
 * every pending diff dumped at once.
 *
 * Reads the single `useReview` store, so a file accepted here checks off in
 * the bar, the panel and the editor gutter at the same moment, and a fully
 * reviewed card settles into a quiet "Revisado" (ACR-R2.5). Renders nothing
 * for a turn that touched no files.
 */
export function ChangeCard({ turn }: ChangeCardProps): React.JSX.Element | null {
  const review = useReview()
  const [openPath, setOpenPath] = useState<string | null>(null)

  if (turn.paths.length === 0) return null

  // Cross-reference the turn's files with the live pending set: a path still in
  // `changes` is pending (show ✓/✗); one that's gone has been reviewed (checked).
  const byPath = new Map<string, ReviewChange>(review.changes.map((c) => [c.path, c]))
  const pending = turn.paths.filter((p) => byPath.has(p))
  const allReviewed = pending.length === 0

  return (
    <div className="wb-change-card" data-reviewed={allReviewed || undefined}>
      <header className="wb-change-card-head">
        <span className="wb-change-card-mark" aria-hidden="true">
          {allReviewed ? <CheckIcon size={13} /> : <PencilIcon size={13} />}
        </span>
        <span className="wb-change-card-titles">
          <span className="wb-change-card-title">
            {allReviewed ? t('review.cardReviewed') : t('review.cardTitle', turn.paths.length)}
          </span>
          {!allReviewed && (
            <span className="wb-change-card-sub">
              {t('review.cardPendingCount', pending.length)}
            </span>
          )}
        </span>
        {!allReviewed && (
          <div className="wb-change-card-bulk">
            <button
              type="button"
              className="wb-change-card-bulk-btn"
              data-kind="reject"
              aria-label={t('review.cardRejectAllAria', pending.length)}
              onClick={() => void review.rejectFiles(pending)}
            >
              {t('review.cardRejectAll')}
            </button>
            <button
              type="button"
              className="wb-change-card-bulk-btn"
              data-kind="accept"
              aria-label={t('review.cardAcceptAllAria', pending.length)}
              onClick={() => void review.acceptFiles(pending)}
            >
              {t('review.cardAcceptAll')}
            </button>
          </div>
        )}
      </header>

      <ul className="wb-change-card-files">
        {turn.paths.map((path) => {
          const change = byPath.get(path)
          const open = openPath === path
          return (
            <li key={path} className="wb-change-card-file" data-reviewed={!change || undefined}>
              <div className="wb-change-card-row">
                {change ? (
                  // The name is the disclosure: clicking a file opens its diff,
                  // which is what a file row in a review list should do.
                  <button
                    type="button"
                    className="wb-change-card-open"
                    aria-expanded={open}
                    aria-label={
                      open
                        ? t('review.cardFileCollapseAria', path)
                        : t('review.cardFileExpandAria', path)
                    }
                    onClick={() => setOpenPath(open ? null : path)}
                  >
                    <ChevronRightIcon
                      size={11}
                      className="wb-change-card-chevron"
                      data-open={open || undefined}
                      aria-hidden="true"
                    />
                    <span
                      className="wb-change-card-dot"
                      data-status={change.status}
                      aria-hidden="true"
                    />
                    <span className="wb-change-card-name">
                      {dirName(path) !== '' && (
                        <span className="wb-change-card-dir">{dirName(path)}</span>
                      )}
                      {baseName(path)}
                    </span>
                    {!change.diff.binary && (
                      <span className="wb-change-card-counts">
                        {t('review.addsDels', change.adds, change.dels)}
                      </span>
                    )}
                  </button>
                ) : (
                  <span
                    className="wb-change-card-open"
                    aria-label={t('review.cardFileReviewedAria', path)}
                  >
                    <CheckIcon size={12} className="wb-change-card-check" aria-hidden="true" />
                    <span className="wb-change-card-name">
                      {dirName(path) !== '' && (
                        <span className="wb-change-card-dir">{dirName(path)}</span>
                      )}
                      {baseName(path)}
                    </span>
                  </span>
                )}
                {/* The per-file decision, on the file — the affordance that
                    was missing entirely before this rework. */}
                {change && (
                  <HunkActions
                    compact
                    target={baseName(path)}
                    onAccept={() => void review.acceptFile(path)}
                    onReject={() => void review.rejectFile(path)}
                  />
                )}
              </div>

              {open && change && (
                <div className="wb-change-card-diff">
                  <DiffView
                    diff={change.diff}
                    title={path}
                    onHunkAccept={(hunkId) => void review.acceptHunk(path, hunkId)}
                    onHunkReject={(hunkId) => void review.rejectHunk(path, hunkId)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
