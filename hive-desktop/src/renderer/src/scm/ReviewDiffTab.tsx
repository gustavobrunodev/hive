import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { DiffView } from '../ui/DiffView'
import { InlineAgentDiff } from './InlineAgentDiff'
import { useReview } from './useReview'

export interface ReviewDiffTabProps {
  /** Workspace-relative file path whose agent-review diff to show. */
  path: string
}

/**
 * An editor-pane tab body for a pending file's agent-review diff (Agent Change
 * Review, ACR-R2.4/R2.1, design.md §6.5). Reads the change from the shared
 * `useReview` store — so it re-diffs live on `review:changed` (accepting a hunk
 * elsewhere updates it instantly, ACR-R2.5) — and, for a modified/created file,
 * renders the Cursor-tier `InlineAgentDiff` over the file's current text. A
 * deleted file (no current text) falls back to the plain `DiffView` with the
 * same per-hunk ✓/✗ controls. When the file leaves the set (fully reviewed),
 * it shows the calm empty affordance rather than a blank void (ACR-R1.8).
 */
export function ReviewDiffTab({ path }: ReviewDiffTabProps): React.JSX.Element {
  const review = useReview()
  const change = review.changes.find((c) => c.path === path)
  const [fileText, setFileText] = useState<string | null>(null)

  // Load the file's current text for the inline overlay. Re-read when the set
  // changes (an accepted/rejected hunk rewrote the file on disk). A deleted
  // file read fails → null, and we render the DiffView fallback.
  // A deleted/absent change needs no text — the render branch below takes the
  // DiffView path regardless of `fileText`, so we simply skip the read (no
  // synchronous setState in the effect).
  const needsText = change !== undefined && change.status !== 'deleted'
  const changeKey = change ? `${change.adds}:${change.dels}:${change.status}` : 'none'
  useEffect(() => {
    if (!needsText) return
    let cancelled = false
    void window.hive
      .readFile(review.workspace, path)
      .then((text) => {
        if (!cancelled) setFileText(text)
      })
      .catch(() => {
        if (!cancelled) setFileText(null)
      })
    return () => {
      cancelled = true
    }
  }, [path, review.workspace, changeKey, needsText])

  if (!change) {
    return (
      <div className="wb-diff">
        <div className="wb-diff-state">
          <p className="wb-diff-state-title">{t('review.emptyTitle')}</p>
          <p className="wb-diff-state-desc">{t('review.emptyDescription')}</p>
        </div>
      </div>
    )
  }

  // Modified/created with text on disk → the inline Cursor-tier overlay.
  if (
    fileText !== null &&
    change.status !== 'deleted' &&
    !change.diff.binary &&
    !change.diff.tooLarge
  ) {
    return <InlineAgentDiff path={path} fileText={fileText} />
  }

  // Deleted / binary / too-large → the plain diff with per-hunk controls.
  return (
    <DiffView
      diff={change.diff}
      title={path}
      onHunkAccept={(hunkId) => void review.acceptHunk(path, hunkId)}
      onHunkReject={(hunkId) => void review.rejectHunk(path, hunkId)}
    />
  )
}
