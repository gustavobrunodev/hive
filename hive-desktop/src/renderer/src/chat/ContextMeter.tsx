import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger, RingMeter, Switch } from '@hive/design-system'
import { t } from '../i18n'
import { CompactIcon } from '../ui/icons'
import type { CompactionSupport } from './compaction'
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
  /** Opens a fresh conversation — the blunt remedy, and the only one for an agent that can't compact. */
  onNewConversation: () => void
  /** context-compaction: asks the agent to compact its own context, now. */
  onCompact: () => void
  /** Whether the agent takes `/compact`, and whether it already does it itself. */
  compaction: CompactionSupport
  /** True while a compaction is in flight — the CTA says so instead of firing twice. */
  compacting: boolean
  /** The agent's display name, for copy that has to say *which* agent is meant. */
  agentName: string
  /** Hive's own 80% threshold: on, and the setter behind the sheet's switch. */
  autoCompact: boolean
  onAutoCompactChange: (enabled: boolean) => void
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
 * descending emphasis they read as what they are: one dial filling up.
 * Colour is reserved for the one state that *is* semantic — near the ceiling.
 *
 * ## Why a ring and not a bar
 *
 * Occupancy is a state, not a journey — and a 4px-tall hairline 34px wide is
 * a shape the eye files as a divider, which is why the footer's reading used
 * to depend entirely on the number beside it. At the same footprint a 16px
 * ring still reads as *a dial with an amount in it*, so the percentage becomes
 * confirmation rather than the only evidence. In the sheet the same shape pays
 * again: the three provenances become runs of one lap with the total in the
 * middle, and the legend sits beside it instead of under it.
 */
export function ContextMeter({
  usage,
  onNewConversation,
  onCompact,
  compaction,
  compacting,
  agentName,
  autoCompact,
  onAutoCompactChange
}: ContextMeterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const used = contextTokens(usage.context)
  const fraction = contextFraction(usage)
  const tight = contextIsTight(usage)
  /**
   * A share that rounds to zero is not zero, and saying "0%" over a window that
   * really holds something is the one reading a meter must never give. Three
   * states became easy to hit: 757 tokens of 200k is what a compaction leaves
   * behind, an agent that reports no post-count leaves the occupancy genuinely
   * unknown until the next turn says, and a conversation reopened from a build
   * that stored no reading has turns behind it and no number.
   *
   * **The control itself no longer disappears in any of them.** It used to
   * return `null` whenever nothing had been measured — which is exactly the
   * moment a user switching between two conversations landed in, and the
   * footer's one indicator of how much room the agent has left simply vanished
   * from the composer. A gauge that removes itself teaches nobody that it
   * exists; one reading `—` says "no number yet" and is still there when there
   * is one. (The composer's footer only exists once the pane is showing a
   * conversation, so "nothing has been said yet" never reaches this control.)
   */
  const unread = used === 0
  const summary = unread ? t('usage.unread') : meterSummary(fraction, used)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="wb-ctx-meter"
          data-tight={tight || undefined}
          aria-label={unread ? t('usage.unreadAria') : t('usage.meterAria', summary)}
        >
          {/* No icon beside the ring: the ring already *is* the gauge glyph,
              and a second gauge-shaped mark next to it reads as a smudge at
              12px. Hidden from AT because the button's own `aria-label`
              already says the whole reading — a nested `meter` would announce
              the same number twice, in a worse order. */}
          <RingMeter
            className="wb-ctx-meter-ring"
            aria-hidden="true"
            label={t('usage.meterLabel')}
            size={16}
            value={unread ? 0 : (fraction ?? 1)}
            indeterminate={unread}
            // Not the ring's own `auto`: "tight" is this app's threshold
            // (`CONTEXT_WARN_FRACTION`), and the footer must turn at the same
            // moment the sheet's advice appears, not one of its own.
            tone={tight ? 'warning' : 'accent'}
          />
          <span className="wb-ctx-meter-value">{summary}</span>
          <span className="wb-ctx-meter-label">{t('usage.meterLabel')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="wb-ctx-sheet" align="start" side="top" sideOffset={10}>
        <ContextDetail
          usage={usage}
          compaction={compaction}
          compacting={compacting}
          agentName={agentName}
          autoCompact={autoCompact}
          onAutoCompactChange={onAutoCompactChange}
          onNewConversation={() => {
            setOpen(false)
            onNewConversation()
          }}
          onCompact={() => {
            setOpen(false)
            onCompact()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** The trigger's headline: a percentage, `<1%` for a non-zero sliver, or the raw count. */
function meterSummary(fraction: number | null, used: number): string {
  if (fraction === null) return formatTokens(used)
  const percent = Math.round(fraction * 100)
  return percent === 0 && used > 0 ? t('usage.underOnePercent') : t('usage.meterPercent', percent)
}

/** The sheet: what is in the window, then what the session has spent. */
function ContextDetail({
  usage,
  compaction,
  compacting,
  agentName,
  autoCompact,
  onAutoCompactChange,
  onNewConversation,
  onCompact
}: {
  usage: SessionUsage
  compaction: CompactionSupport
  compacting: boolean
  agentName: string
  autoCompact: boolean
  onAutoCompactChange: (enabled: boolean) => void
  onNewConversation: () => void
  onCompact: () => void
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

      {/* The window itself, to scale, as one dial: the ring is the reading and
          the legend is its key, side by side so the eye moves once. Runs are
          separated by a gap of the sheet's own surface rather than by a
          border, so three tints of one hue read as three parts of one fill
          without adding a fourth colour. */}
      <div className="wb-ctx-hero">
        <RingMeter
          className="wb-ctx-ring"
          size={104}
          label={t('usage.detailTitle')}
          valueText={t(
            'usage.barAria',
            formatTokens(used),
            usage.contextWindow === null ? '' : formatTokens(usage.contextWindow)
          )}
          tone={tight ? 'warning' : 'accent'}
          indeterminate={used === 0}
          segments={segments
            .filter((segment) => segment.id !== 'free' && segment.tokens > 0)
            .map((segment) => ({
              id: segment.id,
              value: segment.fraction,
              // The provenance ramp is this app's vocabulary, so it stays in
              // `workbench.css` next to the legend swatches that must match it
              // exactly — one declaration, two surfaces.
              color: `var(--wb-ctx-${segment.id})`
            }))}
          caption={
            usage.contextWindow === null
              ? undefined
              : t('usage.ofWindow', formatTokens(usage.contextWindow))
          }
        >
          {fraction === null
            ? formatTokens(used)
            : t('usage.meterPercent', Math.round(fraction * 100))}
        </RingMeter>

        <p className="wb-ctx-headline">
          <strong className="wb-ctx-used">{formatTokens(used)}</strong>
          <span className="wb-ctx-window">{t('usage.usedTokens')}</span>
        </p>
      </div>

      {/* The key runs the full width of the sheet rather than squeezing in
          beside the dial: at 160px "Reaproveitado do cache" ellipsised into
          "Reaproveitado do c…", losing the word that says WHICH cache — and a
          legend whose labels are cropped is not a legend. */}
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
        {/* context-compaction: without this row the totals above are unreadable
            after a compaction — 4k of context under an hour of spend looks
            like a session that barely started. */}
        {usage.compactions > 0 && (
          <>
            <div className="wb-ctx-total">
              <dt>{t('usage.compactionsLabel')}</dt>
              <dd>{usage.compactions}</dd>
            </div>
            {usage.reclaimedTokens > 0 && (
              <div className="wb-ctx-total">
                <dt>{t('usage.reclaimedLabel')}</dt>
                <dd>{formatTokens(usage.reclaimedTokens)}</dd>
              </div>
            )}
          </>
        )}
      </dl>

      <ContextAdvice
        tight={tight}
        compaction={compaction}
        compacting={compacting}
        onCompact={onCompact}
        onNewConversation={onNewConversation}
      />
      <AutoCompactSetting
        compaction={compaction}
        agentName={agentName}
        autoCompact={autoCompact}
        onAutoCompactChange={onAutoCompactChange}
      />
    </div>
  )
}

/**
 * The remedy, and who applies it.
 *
 * Compaction leads when the agent has it, because it *keeps* the
 * conversation — a fresh one throws the work away to save the window, which is
 * the blunt version of the same fix and belongs below it. The block is present
 * whenever compaction exists, not only when the window is tight: someone who
 * knows a long stretch of tool output just landed should be able to act before
 * the bar turns.
 */
function ContextAdvice({
  tight,
  compaction,
  compacting,
  onCompact,
  onNewConversation
}: {
  tight: boolean
  compaction: CompactionSupport
  compacting: boolean
  onCompact: () => void
  onNewConversation: () => void
}): React.JSX.Element | null {
  if (!tight && !compaction.command) return null
  return (
    <div className="wb-ctx-advice" data-tight={tight || undefined}>
      {tight && <p>{t('usage.tightAdvice')}</p>}
      {compaction.command && (
        <>
          <button
            type="button"
            className="wb-ctx-compact-cta"
            onClick={onCompact}
            disabled={compacting}
          >
            <CompactIcon size={14} />
            {compacting ? t('usage.compactBusy') : t('usage.compactCta')}
          </button>
          <p className="wb-ctx-advice-note">{t('usage.compactHint')}</p>
        </>
      )}
      {tight && (
        <button type="button" className="wb-ctx-advice-cta" onClick={onNewConversation}>
          {t('usage.tightCta')}
        </button>
      )}
    </div>
  )
}

/**
 * Hive's own 80% threshold, in the one surface where its consequence is
 * visible.
 *
 * Shown only for an agent that needs it. For one that already compacts itself
 * — Devin — the honest UI is a sentence saying so, not a switch that would do
 * nothing: a control whose state changes no behaviour is worse than no control,
 * because it invites the user to believe they configured something.
 */
function AutoCompactSetting({
  compaction,
  agentName,
  autoCompact,
  onAutoCompactChange
}: {
  compaction: CompactionSupport
  agentName: string
  autoCompact: boolean
  onAutoCompactChange: (enabled: boolean) => void
}): React.JSX.Element | null {
  if (!compaction.command) return null
  return (
    <div className="wb-ctx-auto">
      {compaction.automatic ? (
        <p className="wb-ctx-auto-managed">{t('usage.autoCompactManaged', agentName)}</p>
      ) : (
        <>
          <label className="wb-ctx-auto-row">
            <span className="wb-ctx-auto-label">{t('usage.autoCompactLabel')}</span>
            <Switch checked={autoCompact} onCheckedChange={onAutoCompactChange} />
          </label>
          <p className="wb-ctx-auto-hint">{t('usage.autoCompactHint', agentName)}</p>
        </>
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
