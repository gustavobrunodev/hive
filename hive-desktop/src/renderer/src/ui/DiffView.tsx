import { useState, type ReactNode } from 'react'
import { t } from '../i18n'
import {
  hunkKey,
  toSplitRows,
  type GitDiff,
  type GitDiffHunk,
  type GitDiffLine
} from '../scm/gitStatus'
import { HunkActions } from './HunkActions'

type DiffMode = 'unified' | 'split'

/** Optional per-hunk accept/reject callbacks (Agent Change Review, ACR-R3.1). When absent, DiffView is the plain M10 renderer (backward compatible). */
interface HunkHandlers {
  onHunkAccept: (hunkId: string) => void
  onHunkReject: (hunkId: string) => void
  /** Total hunk count, for the "Trecho n de m" label. */
  total: number
}

/** The `+`/`-`/` ` sign for a line type. */
function sign(type: GitDiffLine['type']): string {
  return type === 'add' ? '+' : type === 'del' ? '-' : ' '
}

/** A calm centered state (binary / too-large / empty) — never garbled text (GIT-R4.3). */
function DiffState({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="wb-diff-state">
      <p className="wb-diff-state-title">{title}</p>
      <p className="wb-diff-state-desc">{description}</p>
    </div>
  )
}

/** One unified diff line: old|new gutters, sign, colored text. */
function UnifiedLine({ line }: { line: GitDiffLine }): React.JSX.Element {
  return (
    <div className="wb-diff-line" data-type={line.type}>
      <span className="wb-diff-gutter" aria-label={t('git.diffOldLineAria')}>
        {line.oldNo ?? ''}
      </span>
      <span className="wb-diff-gutter" aria-label={t('git.diffNewLineAria')}>
        {line.newNo ?? ''}
      </span>
      <span className="wb-diff-sign" aria-hidden="true">
        {sign(line.type)}
      </span>
      <span className="wb-diff-text">{line.text}</span>
    </div>
  )
}

/** A per-hunk control strip rendered in the hunk header when handlers are provided (ACR-R2.1/R3.1). */
function HunkHeader({
  hunk,
  index,
  hunks
}: {
  hunk: GitDiffHunk
  index: number
  hunks?: HunkHandlers
}): React.JSX.Element {
  return (
    <div className="wb-diff-hunk-header">
      <span className="wb-diff-hunk-range">{hunk.header}</span>
      {hunks && (
        <HunkActions
          compact
          target={t('review.hunkLabel', index + 1, hunks.total)}
          label={t('review.hunkLabel', index + 1, hunks.total)}
          onAccept={() => hunks.onHunkAccept(hunkKey(hunk, index))}
          onReject={() => hunks.onHunkReject(hunkKey(hunk, index))}
        />
      )}
    </div>
  )
}

function UnifiedHunk({
  hunk,
  index,
  hunks
}: {
  hunk: GitDiffHunk
  index: number
  hunks?: HunkHandlers
}): React.JSX.Element {
  return (
    <div className="wb-diff-hunk">
      <HunkHeader hunk={hunk} index={index} hunks={hunks} />
      {hunk.lines.map((line, i) => (
        <UnifiedLine key={i} line={line} />
      ))}
    </div>
  )
}

function SplitCell({
  line,
  side
}: {
  line: GitDiffLine | null
  side: 'old' | 'new'
}): React.JSX.Element {
  if (!line) return <div className="wb-diff-scell" data-type="empty" aria-hidden="true" />
  const no = side === 'old' ? line.oldNo : line.newNo
  return (
    <div className="wb-diff-scell" data-type={line.type}>
      <span className="wb-diff-gutter">{no ?? ''}</span>
      <span className="wb-diff-text">{line.text}</span>
    </div>
  )
}

function SplitHunk({
  hunk,
  index,
  hunks
}: {
  hunk: GitDiffHunk
  index: number
  hunks?: HunkHandlers
}): React.JSX.Element {
  const rows = toSplitRows(hunk.lines)
  return (
    <div className="wb-diff-hunk">
      <HunkHeader hunk={hunk} index={index} hunks={hunks} />
      {rows.map((row, i) => (
        <div className="wb-diff-srow" key={i}>
          <SplitCell line={row.left} side="old" />
          <SplitCell line={row.right} side="new" />
        </div>
      ))}
    </div>
  )
}

export interface DiffViewProps {
  diff: GitDiff
  /** Header label, e.g. "arquivo.ts (árvore de trabalho)". */
  title?: string
  /** Toolbar action slot (stage/unstage this file, open the actual file) — wired in T20. */
  actions?: ReactNode
  /**
   * Per-hunk accept/reject (Agent Change Review, ACR-R3.1). When both are
   * given, each hunk header gains a ✓/✗ strip; the `hunkId` matches main's
   * `gitParse.hunkId`. Omit for the plain M10 SCM diff (backward compatible).
   */
  onHunkAccept?: (hunkId: string) => void
  onHunkReject?: (hunkId: string) => void
}

/**
 * The diff renderer (git-management §6.1) — unified or side-by-side, with
 * add/remove/context coloring (semantic tokens, contrast-verified), old/new
 * line numbers and hunk headers. Binary/too-large diffs show a calm affordance
 * rather than garbled text (GIT-R4.3). Scrolls inside its own container — never
 * the page (GIT-R4).
 */
export function DiffView({
  diff,
  title,
  actions,
  onHunkAccept,
  onHunkReject
}: DiffViewProps): React.JSX.Element {
  const [mode, setMode] = useState<DiffMode>('unified')

  // Per-hunk controls render only when both handlers are supplied (the review
  // surfaces pass them; M10 SCM callers don't).
  const hunks: HunkHandlers | undefined =
    onHunkAccept && onHunkReject
      ? { onHunkAccept, onHunkReject, total: diff.hunks.length }
      : undefined

  let body: ReactNode
  if (diff.binary) {
    body = (
      <DiffState title={t('git.diffBinaryTitle')} description={t('git.diffBinaryDescription')} />
    )
  } else if (diff.tooLarge) {
    body = (
      <DiffState
        title={t('git.diffTooLargeTitle')}
        description={t('git.diffTooLargeDescription')}
      />
    )
  } else if (diff.hunks.length === 0) {
    body = <DiffState title={t('git.diffEmptyTitle')} description={t('git.diffEmptyDescription')} />
  } else {
    body = (
      <div className="wb-diff-scroll" data-mode={mode}>
        {diff.hunks.map((hunk, i) =>
          mode === 'unified' ? (
            <UnifiedHunk key={i} hunk={hunk} index={i} hunks={hunks} />
          ) : (
            <SplitHunk key={i} hunk={hunk} index={i} hunks={hunks} />
          )
        )}
      </div>
    )
  }

  const showToggle = !diff.binary && !diff.tooLarge && diff.hunks.length > 0

  return (
    <div className="wb-diff">
      <div className="wb-diff-toolbar">
        {title && <span className="wb-diff-title">{title}</span>}
        <span className="wb-diff-toolbar-spacer" />
        {actions}
        {showToggle && (
          <div className="wb-diff-toggle" role="group" aria-label={t('git.diffModeLabel')}>
            <button
              type="button"
              data-active={mode === 'unified' || undefined}
              aria-pressed={mode === 'unified'}
              onClick={() => setMode('unified')}
            >
              {t('git.diffUnified')}
            </button>
            <button
              type="button"
              data-active={mode === 'split' || undefined}
              aria-pressed={mode === 'split'}
              onClick={() => setMode('split')}
            >
              {t('git.diffSideBySide')}
            </button>
          </div>
        )}
      </div>
      {body}
    </div>
  )
}
