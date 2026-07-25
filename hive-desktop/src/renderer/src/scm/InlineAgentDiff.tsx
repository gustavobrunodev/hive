import { useMemo, useRef, useState } from 'react'
import { t } from '../i18n'
import { HunkActions } from '../ui/HunkActions'
import { ChevronRightIcon } from '../ui/icons'
import { hunkKey } from './gitStatus'
import { buildInlineModel, stepHunk } from './inlineDiff'
import { useReview } from './useReview'

interface InlineAgentDiffProps {
  /** The open pending file (workspace-relative POSIX path). */
  path: string
  /** The file's current on-disk text (the agent's post-image) — supplied by the editor. */
  fileText: string
}

/**
 * The Cursor-tier inline editor diff (Agent Change Review, ACR-R2.1) — the
 * agent's changes to the open pending file rendered in place: added lines
 * green, removed lines struck/red as phantom rows, per the T13 overlay model.
 * Each hunk carries a floating `✓ Aceitar / ✗ Rejeitar` control (the shared
 * HunkActions gesture, G3) and a `‹ n de m ›` nav jumps between changes. Reads
 * the single `useReview` store, so accepting a hunk here updates the card, bar,
 * and panel instantly (ACR-R2.5). Renders nothing when the file isn't pending.
 */
export function InlineAgentDiff({
  path,
  fileText
}: InlineAgentDiffProps): React.JSX.Element | null {
  const review = useReview()
  const change = review.changes.find((c) => c.path === path)

  const model = useMemo(
    () => (change ? buildInlineModel(change.diff, fileText.split('\n')) : null),
    [change, fileText]
  )

  const total = change?.diff.hunks.length ?? 0
  const [rawCurrent, setCurrent] = useState(0)
  // Clamp by derivation (not an effect) so the cursor stays in range as hunks
  // are accepted/rejected and the set re-diffs.
  const current = total > 0 ? Math.min(rawCurrent, total - 1) : 0

  const anchorRefs = useRef<Array<HTMLDivElement | null>>([])

  if (!change || !model || change.diff.binary || change.diff.tooLarge) return null

  const go = (dir: 'next' | 'prev'): void => {
    const next = stepHunk(current, total, dir)
    setCurrent(next)
    anchorRefs.current[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const currentHunk = change.diff.hunks[current]
  const acceptCurrent = (): void => {
    if (currentHunk) void review.acceptHunk(path, hunkKey(currentHunk, current))
  }
  const rejectCurrent = (): void => {
    if (currentHunk) void review.rejectHunk(path, hunkKey(currentHunk, current))
  }

  // Keyboard flow (ACR-R4.1, Cursor parity): A/R accept/reject the current
  // hunk; J/↓ and K/↑ step between changes. Discoverable via the control
  // tooltips (title) below.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const key = e.key.toLowerCase()
    if (key === 'a') acceptCurrent()
    else if (key === 'r') rejectCurrent()
    else if (key === 'j' || e.key === 'ArrowDown') go('next')
    else if (key === 'k' || e.key === 'ArrowUp') go('prev')
    else return
    e.preventDefault()
  }

  // Which model-row index starts each hunk (for anchoring the controls + nav).
  const hunkFirstRow = new Map<number, number>()
  model.rows.forEach((row, i) => {
    if (row.hunkIndex !== null && !hunkFirstRow.has(row.hunkIndex))
      hunkFirstRow.set(row.hunkIndex, i)
  })

  return (
    <div
      className="wb-inline-diff"
      aria-label={t('review.panelTitle')}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {total > 1 && (
        <div className="wb-inline-nav">
          <button
            type="button"
            className="wb-inline-nav-btn"
            aria-label={t('review.inlinePrevAria')}
            title={t('review.keyPrevHint')}
            onClick={() => go('prev')}
          >
            <ChevronRightIcon size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="wb-inline-nav-label">{t('review.inlineNav', current + 1, total)}</span>
          <button
            type="button"
            className="wb-inline-nav-btn"
            aria-label={t('review.inlineNextAria')}
            title={t('review.keyNextHint')}
            onClick={() => go('next')}
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>
      )}

      <div className="wb-inline-rows">
        {model.rows.map((row, i) => {
          const startsHunk = row.hunkIndex !== null && hunkFirstRow.get(row.hunkIndex) === i
          const hunk = row.hunkIndex !== null ? change.diff.hunks[row.hunkIndex] : null
          return (
            <div
              key={i}
              ref={(el) => {
                if (startsHunk && row.hunkIndex !== null) anchorRefs.current[row.hunkIndex] = el
              }}
              className="wb-inline-row"
              data-type={row.type}
              data-current={row.hunkIndex === current || undefined}
            >
              <span className="wb-inline-lineno" aria-hidden="true">
                {row.lineNo ?? ''}
              </span>
              <span className="wb-inline-sign" aria-hidden="true">
                {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ''}
              </span>
              <span className="wb-inline-text">{row.text}</span>
              {startsHunk && hunk && row.hunkIndex !== null && (
                <HunkActions
                  compact
                  target={t('review.hunkLabel', row.hunkIndex + 1, total)}
                  onAccept={() => void review.acceptHunk(path, hunkKey(hunk, row.hunkIndex!))}
                  onReject={() => void review.rejectHunk(path, hunkKey(hunk, row.hunkIndex!))}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
