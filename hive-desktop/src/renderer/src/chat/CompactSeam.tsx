import { useState, type ReactNode } from 'react'
import { t } from '../i18n'
import { ChevronDownIcon, CompactIcon } from '../ui/icons'
import { formatDuration, formatTokens } from './turnTiming'
import type { CompactionRecord } from './compaction'

interface CompactSeamProps {
  /** The finished compaction, or `null` while one is still running. */
  record: CompactionRecord | null
  /** True while the agent is compacting — the seam is on screen before it settles. */
  pending?: boolean
  /** Renders the agent's summary (Chat passes its Markdown body); plain text without it. */
  renderSummary?: (text: string) => ReactNode
}

/**
 * The seam in the transcript where the agent's context was compacted.
 *
 * ## Why it is a seam and not a message
 *
 * Nobody said this. It is a thing that *happened to* the conversation — the
 * agent's memory of everything above was replaced by a summary of itself — and
 * drawing it as a bubble would file it under "things said", which is the one
 * category it does not belong to. So: a rule across the column with a mark
 * sitting on it, the way a date divider or a "new messages" line works. The
 * messages above stay exactly where they are, because the transcript is the
 * record of the work and only the *agent's* memory was compacted.
 *
 * ## The number is the point
 *
 * Before this existed, a Devin session that compacted itself made the context
 * meter fall off a cliff with nothing on screen to explain it. "22,7k → 757" is
 * the explanation, and it is why the seam leads with the delta rather than with
 * a word. When the agent reported no counts the pane's own last reading stands
 * in — prefixed `≈`, because a figure we inferred must not dress up as one the
 * agent measured.
 *
 * ## One authored moment
 *
 * Compaction takes seconds (8,4 s on the measured Claude run), so the seam
 * appears *pending* and settles in place: the mark holds a running state, then
 * the numbers arrive and the rule draws itself outward from the centre. That
 * transition is the moment; nothing else here animates.
 */
export function CompactSeam({
  record,
  pending = false,
  renderSummary
}: CompactSeamProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const summary = record?.summary ?? ''
  const openable = !pending && summary !== ''

  return (
    <div
      className="wb-compact-seam"
      data-pending={pending || undefined}
      data-open={expanded || undefined}
    >
      <div className="wb-compact-rule" aria-hidden="true" />
      {openable ? (
        <button
          type="button"
          className="wb-compact-mark"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <SeamBody record={record} pending={pending} />
          <span className="wb-compact-caret" aria-hidden="true">
            <ChevronDownIcon size={13} />
          </span>
        </button>
      ) : (
        // Nothing to open — a button that does nothing is worse than a label.
        <p className="wb-compact-mark" data-static="">
          <SeamBody record={record} pending={pending} />
        </p>
      )}
      <div className="wb-compact-rule" aria-hidden="true" />
      {expanded && summary !== '' && (
        <div className="wb-compact-summary">
          <h3 className="wb-compact-summary-title">{t('compaction.summaryTitle')}</h3>
          <div className="wb-compact-summary-body">
            {renderSummary ? renderSummary(summary) : <p>{summary}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

/** The mark's contents — shared by its button and its static forms. */
function SeamBody({
  record,
  pending
}: {
  record: CompactionRecord | null
  pending: boolean
}): React.JSX.Element {
  return (
    <>
      <span className="wb-compact-icon" aria-hidden="true">
        <CompactIcon size={14} />
      </span>
      <span className="wb-compact-title">
        {pending ? t('compaction.seamPending') : t('compaction.seamTitle')}
      </span>
      {record !== null && <SeamDelta record={record} />}
      {record !== null && <SeamMeta record={record} />}
    </>
  )
}

/**
 * "22,7k → 757": what the window held, and what it holds now.
 *
 * Rendered as its own run with the arrow between, rather than as one
 * interpolated sentence, so the two figures line up as a before/after pair and
 * the arrow can carry the reduction visually. Absent entirely when neither
 * figure exists — a delta with one side missing is not a delta.
 */
function SeamDelta({ record }: { record: CompactionRecord }): React.JSX.Element | null {
  if (record.preTokens === null) return null
  const before = record.measured
    ? formatTokens(record.preTokens)
    : t('compaction.approx', formatTokens(record.preTokens))
  return (
    <span
      className="wb-compact-delta"
      aria-label={
        record.postTokens === null
          ? t('compaction.deltaOpenAria', before)
          : t('compaction.deltaAria', before, formatTokens(record.postTokens))
      }
    >
      <span className="wb-compact-from">{before}</span>
      <span className="wb-compact-arrow" aria-hidden="true">
        →
      </span>
      <span className="wb-compact-to">
        {record.postTokens === null ? t('compaction.postUnknown') : formatTokens(record.postTokens)}
      </span>
    </span>
  )
}

/** Who asked, and how long it took — the fine print, in one muted run. */
function SeamMeta({ record }: { record: CompactionRecord }): React.JSX.Element {
  const parts = [
    record.trigger === 'auto' ? t('compaction.triggerAuto') : t('compaction.triggerManual'),
    record.durationMs === null ? null : formatDuration(record.durationMs)
  ].filter((part): part is string => part !== null)
  return <span className="wb-compact-meta">{parts.join(' · ')}</span>
}
