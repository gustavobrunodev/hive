import { t } from '../i18n'
import { CheckIcon, CloseIcon, StopIcon } from '../ui/icons'
import type { TurnBlock } from './turnTimeline'
import {
  countSteps,
  deservesReceipt,
  formatCost,
  formatDuration,
  formatTokens,
  phaseLabel,
  turnElapsed,
  turnPhase,
  type TurnMetrics
} from './turnTiming'

interface TurnMeterProps {
  metrics: TurnMetrics
  /** The turn's timeline — the phase and the step count are read off it, never tracked in parallel. */
  blocks: TurnBlock[]
  /** `true` while the turn is running: the meter counts, rather than reporting. */
  live: boolean
  /** The shared clock (`useTicker`); ignored once the turn has settled. */
  now: number
}

/**
 * One line at the foot of an assistant turn that says what it is doing and how
 * long it has been at it — and, once it settles, what the whole thing cost.
 *
 * ## Why a line and not a panel
 *
 * This is the third thing on screen competing for the same attention as the
 * reply itself (after the prose and the step rail), so it gets the least ink
 * of the three: one row, one weight below the rail, numbers in the tabular
 * face. A panel would win an argument it shouldn't be in.
 *
 * ## Live and settled are the same row, in two tenses
 *
 * Running, it names the phase (`Executando`, `Aguardando você`) and counts:
 * elapsed, steps so far, tokens read. Settled, the same row becomes the
 * receipt: total time, steps, tokens generated, cost. Keeping them one
 * component — and one line, in one place — is what makes the transition read
 * as *the same fact resolving* rather than as one widget replacing another.
 *
 * The live state carries a pulsing dot, which is the only looping motion here:
 * the step rail already owns the spinning arc, and a second competing loop
 * would make the turn feel busier than it is. Once settled the dot is replaced
 * by an outcome glyph — so the state survives a screenshot and a reduced-motion
 * user, who never sees either animation.
 */
export function TurnMeter({
  metrics,
  blocks,
  live,
  now
}: TurnMeterProps): React.JSX.Element | null {
  if (!live && !deservesReceipt(metrics)) return null

  const elapsed = turnElapsed(metrics, now)
  const steps = countSteps(blocks)
  const parts = live
    ? livePartsOf(metrics, elapsed, steps)
    : receiptPartsOf(metrics, elapsed, steps)

  return (
    <div className="wb-turn-meter" data-live={live || undefined} data-outcome={metrics.outcome}>
      {live ? (
        <span className="wb-turn-meter-pulse" aria-hidden="true" />
      ) : (
        <span className="wb-turn-meter-mark" aria-hidden="true">
          {outcomeIcon(metrics.outcome)}
        </span>
      )}
      <span className="wb-turn-meter-lead">
        {live ? phaseLabel(turnPhase(blocks)) : outcomeLabel(metrics, elapsed)}
      </span>
      {parts.map((part) => (
        <span key={part} className="wb-turn-meter-stat">
          {part}
        </span>
      ))}
    </div>
  )
}

function outcomeIcon(outcome: TurnMetrics['outcome']): React.JSX.Element {
  if (outcome === 'interrupted') return <StopIcon size={9} />
  if (outcome === 'error') return <CloseIcon size={11} />
  return <CheckIcon size={11} />
}

/** The settled row's opening clause: what happened, and in how long. */
function outcomeLabel(metrics: TurnMetrics, elapsed: number): string {
  const duration = formatDuration(elapsed)
  if (metrics.outcome === 'interrupted') return t('timing.receiptInterrupted', duration)
  if (metrics.outcome === 'error') return t('timing.receiptFailed', duration)
  return t('timing.receiptDone', duration)
}

/**
 * Running: elapsed first (it is the number being watched), then the work done
 * so far. Tokens are the *context* the request carried — the same figure the
 * session meter tracks — which is why they read as "lidos", not "gerados".
 */
function livePartsOf(metrics: TurnMetrics, elapsed: number, steps: number): string[] {
  const parts = [formatDuration(elapsed)]
  if (steps > 0) parts.push(t('activity.stepsCount', steps))
  const usage = metrics.usage
  if (usage) {
    const read = usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
    if (read > 0) parts.push(t('timing.tokensRead', formatTokens(read)))
  }
  return parts
}

/** Settled: the duration already opened the line, so the receipt lists only what it cost. */
function receiptPartsOf(metrics: TurnMetrics, _elapsed: number, steps: number): string[] {
  const parts: string[] = []
  if (steps > 0) parts.push(t('activity.stepsCount', steps))
  const usage = metrics.usage
  if (usage) {
    if (usage.outputTokens > 0)
      parts.push(t('timing.tokensWritten', formatTokens(usage.outputTokens)))
    if (usage.costUsd !== undefined && usage.costUsd > 0) parts.push(formatCost(usage.costUsd))
  }
  return parts
}
