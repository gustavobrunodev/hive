import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { HunkActions } from '../ui/HunkActions'
import { useReview, type ReviewByStatus, type ReviewChange } from './useReview'

interface AgentReviewPanelProps {
  /** Opens `path`'s review diff (a DiffTab with per-hunk controls) — wired in T12/T15. */
  onOpenDiff: (path: string) => void
}

/** Basename of a workspace-relative POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Directory portion (without trailing slash), or '' at the root. */
function dirName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/** The human status label for a change (shape + text, never color alone). */
function statusLabel(status: ReviewChange['status']): string {
  return status === 'created'
    ? t('review.statusCreated')
    : status === 'deleted'
      ? t('review.statusDeleted')
      : t('review.statusModified')
}

/** One reviewable file row: status glyph + path + +/- pill + ✓/✗ + click-to-diff. */
function ReviewRow({
  change,
  onOpenDiff,
  onAccept,
  onReject
}: {
  change: ReviewChange
  onOpenDiff: (path: string) => void
  onAccept: (path: string) => void
  onReject: (path: string) => void
}): React.JSX.Element {
  const dir = dirName(change.path)
  return (
    <div
      className="wb-review-row"
      data-status={change.status}
      data-stale={change.staleUserEdit || undefined}
      data-user-authored={change.userAuthored || undefined}
    >
      <button
        type="button"
        className="wb-review-row-main"
        onClick={() => onOpenDiff(change.path)}
        aria-label={t('review.openDiffAria', change.path)}
      >
        <span className="wb-review-row-status" aria-hidden="true" data-status={change.status} />
        <span className="wb-review-row-name">{baseName(change.path)}</span>
        {dir && <span className="wb-review-row-dir">{dir}</span>}
        <span className="wb-review-row-meta">
          <span className="wb-review-row-badge">{statusLabel(change.status)}</span>
          {!change.diff.binary && (
            <span className="wb-review-row-counts">
              {t('review.addsDels', change.adds, change.dels)}
            </span>
          )}
        </span>
      </button>
      <HunkActions
        compact
        target={change.path}
        onAccept={() => onAccept(change.path)}
        onReject={() => onReject(change.path)}
        rejectDisabledReason={
          change.userAuthored ? t('review.rejectUserAuthoredReason') : undefined
        }
      />
    </div>
  )
}

/** One status group (Criados/Modificados/Removidos), hidden when empty. */
function ReviewGroup({
  title,
  changes,
  onOpenDiff,
  onAccept,
  onReject
}: {
  title: string
  changes: ReviewChange[]
  onOpenDiff: (path: string) => void
  onAccept: (path: string) => void
  onReject: (path: string) => void
}): React.JSX.Element | null {
  if (changes.length === 0) return null
  return (
    <section className="wb-review-group">
      <h3 className="wb-review-group-title">
        {title}
        <span className="wb-review-group-count">{changes.length}</span>
      </h3>
      {changes.map((change) => (
        <ReviewRow
          key={change.path}
          change={change}
          onOpenDiff={onOpenDiff}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </section>
  )
}

/**
 * The "Revisão do agente" sidebar view (Agent Change Review, ACR-R2.4) — the
 * dedicated home for the pending set, a sibling of Explorer/Source Control in
 * the `SidebarHost` switcher. A grouped list (Criados/Modificados/Removidos)
 * over the single `useReview` store: per-row ✓/✗ and click-to-diff, header
 * bulk actions, and a calm teaching empty state (ACR-R1.8). Reads/mutates the
 * same set as the bar, card, and inline diff — no surface can drift (ACR-R2.5).
 */
export function AgentReviewPanel({ onOpenDiff }: AgentReviewPanelProps): React.JSX.Element {
  const review = useReview()
  const [confirmRejectAll, setConfirmRejectAll] = useState(false)

  const groups: Array<{ title: string; changes: ReviewByStatus[keyof ReviewByStatus] }> = [
    { title: t('review.groupCreated'), changes: review.byStatus.created },
    { title: t('review.groupModified'), changes: review.byStatus.modified },
    { title: t('review.groupRemoved'), changes: review.byStatus.deleted }
  ]

  const accept = (path: string): void => void review.acceptFile(path)
  const reject = (path: string): void => void review.rejectFile(path)

  return (
    <div className="wb-review-panel" aria-label={t('review.panelTitle')}>
      <header className="wb-review-panel-head">
        <span className="wb-review-panel-title">{t('review.panelTitle')}</span>
        {review.pendingCount > 0 && (
          <div className="wb-review-panel-bulk">
            <button
              type="button"
              className="wb-review-bar-btn"
              data-kind="reject"
              onClick={() => setConfirmRejectAll(true)}
            >
              {t('review.barRejectAll')}
            </button>
            <button
              type="button"
              className="wb-review-bar-btn"
              data-kind="accept"
              onClick={() => void review.acceptAll()}
            >
              {t('review.barAcceptAll')}
            </button>
          </div>
        )}
      </header>

      {review.pendingCount === 0 ? (
        <div className="wb-review-empty">
          <p className="wb-review-empty-title">{t('review.emptyTitle')}</p>
          <p className="wb-review-empty-desc">{t('review.emptyDescription')}</p>
        </div>
      ) : (
        <div className="wb-review-list">
          {groups.map((group) => (
            <ReviewGroup
              key={group.title}
              title={group.title}
              changes={group.changes}
              onOpenDiff={onOpenDiff}
              onAccept={accept}
              onReject={reject}
            />
          ))}
        </div>
      )}

      {confirmRejectAll && (
        <Dialog open onOpenChange={(next: boolean) => !next && setConfirmRejectAll(false)}>
          <DialogContent>
            <DialogTitle>{t('review.rejectAllTitle')}</DialogTitle>
            <DialogDescription>
              {t('review.rejectAllDescription', review.pendingCount)}
            </DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={() => setConfirmRejectAll(false)}>
                {t('review.rejectAllCancel')}
              </Button>
              <Button
                className="wb-btn wb-btn-danger"
                onClick={() => {
                  setConfirmRejectAll(false)
                  void review.rejectAll()
                }}
              >
                {t('review.rejectAllConfirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
