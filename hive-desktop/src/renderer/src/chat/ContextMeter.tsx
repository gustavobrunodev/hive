import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@hive/design-system'
import { t } from '../i18n'
import {
  contextFraction,
  contextIsTight,
  contextSegments,
  contextTokens,
  type ContextSegment,
  type ContextSegmentId,
  type SessionUsage
} from './sessionUsage'
import { formatCost, formatDuration, formatTokens } from './turnTiming'

interface ContextMeterProps {
  usage: SessionUsage
  /** Opens a fresh conversation — the one real remedy when the window fills up. */
  onNewConversation: () => void
}

/**
 * How full this conversation's context window is, parked in the composer's
 * footer with a detail sheet behind it.
 *
 * ## The thing users can't otherwise know
 *
 * A model has no memory: every turn re-sends the whole conversation, and when
 * it stops fitting the agent quietly starts forgetting the beginning — which
 * in a BMAD session is the requirements everything else is built against.
 * Claude Code users learn to watch this. Hive showed nothing, so the first
 * symptom was the agent contradicting a decision made an hour earlier.
 *
 * ## Why the footer
 *
 * It sits on the line under the composer, next to the keyboard hints — the
 * strip your eyes are already on after typing, and the same place Claude Code
 * puts its own status line. In the pane header it would have competed with the
 * conversation controls; as a panel it would have taken space from the
 * transcript for a number that matters twice an hour.
 *
 * ## Why one hue, not four
 *
 * The three occupied tiers (reused from cache, written to cache this turn,
 * sent fresh) are one quantity at three provenances — not three statuses.
 * Drawn in three colours they would read as good/warn/bad; drawn as one hue at
 * descending emphasis they read as what they are: a single bar filling up.
 * Colour is reserved for the one state that *is* semantic — near the ceiling.
 */
export function ContextMeter({ usage, onNewConversation }: ContextMeterProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const used = contextTokens(usage.context)
  if (used === 0) return null

  const fraction = contextFraction(usage)
  const tight = contextIsTight(usage)
  const percent = fraction === null ? null : Math.round(fraction * 100)
  const summary =
    percent === null ? formatTokens(used) : t('usage.meterPercent', percent)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="wb-ctx-meter"
          data-tight={tight || undefined}
          aria-label={t('usage.meterAria', summary)}
        >
          {/* No icon beside the bar: the bar already *is* the gauge glyph, and
              a second gauge-shaped mark next to it reads as a smudge at 12px. */}
          <span className="wb-ctx-meter-bar" aria-hidden="true">
            <span
              className="wb-ctx-meter-fill"
              style={{ width: `${Math.min(100, (fraction ?? 1) * 100)}%` }}
            />
          </span>
          <span className="wb-ctx-meter-value">{summary}</span>
          <span className="wb-ctx-meter-label">{t('usage.meterLabel')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="wb-ctx-sheet" align="start" side="top" sideOffset={10}>
        <ContextDetail
          usage={usage}
          onNewConversation={() => {
            setOpen(false)
            onNewConversation()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** The sheet: what is in the window, then what the session has spent. */
function ContextDetail({
  usage,
  onNewConversation
}: {
  usage: SessionUsage
  onNewConversation: () => void
}): React.JSX.Element {
  const used = contextTokens(usage.context)
  const fraction = contextFraction(usage)
  const segments = contextSegments(usage)
  const tight = contextIsTight(usage)

  return (
    <div className="wb-ctx-detail">
      <header className="wb-ctx-detail-head">
        <h2 className="wb-ctx-detail-title">{t('usage.detailTitle')}</h2>
        {usage.context?.model && <span className="wb-ctx-model">{usage.context.model}</span>}
      </header>

      <p className="wb-ctx-headline">
        <strong className="wb-ctx-used">{formatTokens(used)}</strong>
        {usage.contextWindow !== null && (
          <span className="wb-ctx-window">
            {t('usage.ofWindow', formatTokens(usage.contextWindow))}
          </span>
        )}
        {fraction !== null && (
          <span className="wb-ctx-percent">{t('usage.meterPercent', Math.round(fraction * 100))}</span>
        )}
      </p>

      {/* The window itself, to scale. Segments are separated by a 1px gap of
          the sheet's own surface rather than by a border, so three tints of one
          hue still read as three blocks without adding a fourth colour. */}
      <div
        className="wb-ctx-bar"
        role="img"
        aria-label={t('usage.barAria', formatTokens(used), usage.contextWindow === null ? '' : formatTokens(usage.contextWindow))}
      >
        {segments
          .filter((segment) => segment.tokens > 0)
          .map((segment) => (
            <span
              key={segment.id}
              className="wb-ctx-seg"
              data-seg={segment.id}
              style={{ flexGrow: segment.fraction }}
            />
          ))}
      </div>

      <dl className="wb-ctx-legend">
        {segments.map((segment) => (
          <div key={segment.id} className="wb-ctx-legend-row">
            <dt>
              <span className="wb-ctx-swatch" data-seg={segment.id} aria-hidden="true" />
              {segmentLabel(segment.id)}
            </dt>
            <dd>
              <span className="wb-ctx-legend-tokens">{formatTokens(segment.tokens)}</span>
              <span className="wb-ctx-legend-share">{sharePercent(segment)}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="wb-ctx-note">{t('usage.contextNote')}</p>

      <dl className="wb-ctx-totals">
        <div className="wb-ctx-total">
          <dt>{t('usage.totalRuntime')}</dt>
          <dd>{formatDuration(usage.runtimeMs)}</dd>
        </div>
        {usage.apiMs !== null && (
          <div className="wb-ctx-total">
            <dt>{t('usage.totalApi')}</dt>
            <dd>{formatDuration(usage.apiMs)}</dd>
          </div>
        )}
        <div className="wb-ctx-total">
          <dt>{t('usage.totalTurns')}</dt>
          <dd>{usage.turns}</dd>
        </div>
        <div className="wb-ctx-total">
          <dt>{t('usage.totalOutput')}</dt>
          <dd>{formatTokens(usage.outputTokens)}</dd>
        </div>
        {usage.costUsd !== null && (
          <div className="wb-ctx-total">
            <dt>{t('usage.totalCost')}</dt>
            <dd>{formatCost(usage.costUsd)}</dd>
          </div>
        )}
      </dl>

      {tight && (
        <div className="wb-ctx-advice">
          <p>{t('usage.tightAdvice')}</p>
          <button type="button" className="wb-ctx-advice-cta" onClick={onNewConversation}>
            {t('usage.tightCta')}
          </button>
        </div>
      )}
    </div>
  )
}

const SEGMENT_LABELS: Record<ContextSegmentId, string> = {
  cacheRead: t('usage.segCacheRead'),
  cacheCreation: t('usage.segCacheCreation'),
  input: t('usage.segInput'),
  free: t('usage.segFree')
}

function segmentLabel(id: ContextSegmentId): string {
  return SEGMENT_LABELS[id]
}

/** A share below half a percent rounds to `0%`, which reads as "nothing" — say "<1%" instead. */
function sharePercent(segment: ContextSegment): string {
  if (segment.tokens === 0) return t('usage.meterPercent', 0)
  const percent = segment.fraction * 100
  return percent < 1 ? t('usage.underOnePercent') : t('usage.meterPercent', Math.round(percent))
}
