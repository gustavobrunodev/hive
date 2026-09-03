/**
 * How long things took, and what the agent is doing right now.
 *
 * ## The defect this closes
 *
 * A BMAD workflow spends minutes working. Until now the transcript showed
 * *what* it was doing (the activity rail) but never *for how long* — so a step
 * that had been reading the same file for ninety seconds looked exactly like
 * one that started a second ago, and a finished turn left no record of what it
 * cost. "Is this slow or is this stuck?" was unanswerable, which is the
 * question that actually makes people kill a run.
 *
 * ## Where the numbers come from
 *
 * Durations are measured in the renderer, off the arrival of the adapter's own
 * events. That is deliberate: the number a user wants is *the time since I
 * pressed Enter*, not the CLI's internal accounting, and IPC latency is orders
 * of magnitude below the resolution anything here displays. The CLI's own
 * `duration_ms` still arrives on the final `usage` event and is shown as the
 * agent's API time in the session detail — two different measurements,
 * labelled as two different things, never averaged into a lie.
 *
 * Pure and DOM-free; presentation lives in `TurnMeter.tsx` and
 * `ToolActivityFeed.tsx`.
 */

import { t } from '../i18n'
import { hasPendingApproval, type TurnBlock } from './turnTimeline'

/** Structural mirror of `main/agentAdapter.ts`'s `TurnUsage`. */
export interface TurnUsage {
  inputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  outputTokens: number
  model?: string
  contextWindow?: number
  costUsd?: number
  durationMs?: number
  apiDurationMs?: number
}

/**
 * One turn's execution record. Live while the turn runs (`endedAt` unset),
 * frozen when it settles. Live-only, like `TurnBlock[]` — a conversation
 * reopened from disk has no metrics and simply renders no receipt.
 */
export interface TurnMetrics {
  /** `Date.now()` at the moment the turn was handed to the agent. */
  startedAt: number
  /** `Date.now()` at its terminal event; unset while it runs. */
  endedAt?: number
  /** How many tool calls the turn made — the "tarefas" count on the receipt. */
  steps: number
  /** The newest token report for this turn (see `sessionUsage.ts`). */
  usage?: TurnUsage
  /** How the turn ended. Unset while it runs. */
  outcome?: 'done' | 'interrupted' | 'error'
}

/** A live turn's elapsed ms, or a settled turn's total. */
export function turnElapsed(metrics: TurnMetrics, now: number): number {
  return Math.max(0, (metrics.endedAt ?? now) - metrics.startedAt)
}

/** How many tool calls a turn made, read off its timeline rather than counted in parallel. */
export function countSteps(blocks: TurnBlock[]): number {
  let total = 0
  for (const block of blocks) if (block.kind === 'tools') total += block.activities.length
  return total
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/**
 * A duration as a working stopwatch reads it: tenths below a second (so a fast
 * step doesn't collapse to a meaningless "0s"), whole seconds up to a minute,
 * then the coarser unit — because past a minute nobody is counting seconds,
 * they're deciding whether to walk away.
 *
 * Deliberately compact (`1min 12s`, not `1 minuto e 12 segundos`): these
 * render inline, dozens per transcript, next to the thing they measure.
 */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0
  if (safe < SECOND) {
    // Floored, not rounded: 999 ms rounds to "1,0s", which claims a second in
    // the branch that exists precisely because a second hasn't passed — and
    // reads as a different number from the "1s" the next branch prints.
    return t('timing.subSecond', (Math.floor(safe / 100) / 10).toFixed(1).replace('.', ','))
  }
  if (safe < MINUTE) return t('timing.seconds', Math.round(safe / SECOND))
  if (safe < HOUR) {
    const minutes = Math.floor(safe / MINUTE)
    return t('timing.minutes', minutes, Math.round((safe - minutes * MINUTE) / SECOND))
  }
  const hours = Math.floor(safe / HOUR)
  return t('timing.hours', hours, Math.floor((safe - hours * HOUR) / MINUTE))
}

/**
 * What the turn is doing at this instant, read off its own timeline rather
 * than tracked as a separate state machine — the blocks already are the
 * record, and a second copy would be a second thing to drift.
 *
 * Ordered by what outranks what: a permission the agent is parked on is the
 * whole story, whatever else is on screen; a running tool beats prose that has
 * already stopped arriving; text arriving beats the gap before it.
 */
export type TurnPhase = 'starting' | 'waiting' | 'working' | 'writing' | 'thinking'

export function turnPhase(blocks: TurnBlock[]): TurnPhase {
  if (blocks.length === 0) return 'starting'
  if (hasPendingApproval(blocks)) return 'waiting'
  const last = blocks[blocks.length - 1]
  if (last.kind === 'tools') {
    return last.activities.some((activity) => activity.state === 'running') ? 'working' : 'thinking'
  }
  if (last.kind === 'text') return 'writing'
  // An open reasoning block is the agent literally thinking — the one case
  // where this label is a live report rather than a guess about a gap.
  if (last.kind === 'thinking') return 'thinking'
  return 'thinking'
}

const PHASE_LABELS: Record<TurnPhase, string> = {
  starting: t('timing.phaseStarting'),
  waiting: t('timing.phaseWaiting'),
  working: t('timing.phaseWorking'),
  writing: t('timing.phaseWriting'),
  thinking: t('timing.phaseThinking')
}

export function phaseLabel(phase: TurnPhase): string {
  return PHASE_LABELS[phase]
}

/**
 * Token counts, shortened the way people say them out loud: `842`, `8,4 mil`,
 * `1,2 mi`. An exact five-digit count is noise on a status line — the reader
 * is judging a magnitude, not auditing a bill.
 */
export function formatTokens(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.round(count) : 0
  if (safe < 1000) return String(safe)
  if (safe < 1_000_000) return t('timing.thousands', trimTenth(safe / 1000))
  return t('timing.millions', trimTenth(safe / 1_000_000))
}

/** `8.42 → "8,4"`, `12.0 → "12"` — a trailing `,0` is noise at this size. */
function trimTenth(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

/** USD as pt-BR writes it, at the resolution a turn actually costs. */
export function formatCost(usd: number): string {
  const safe = Number.isFinite(usd) && usd > 0 ? usd : 0
  // Below a cent, two decimals is a row of zeros; show the extra digits that
  // make a cheap turn distinguishable from a free one.
  const digits = safe > 0 && safe < 0.01 ? 4 : 2
  return t('timing.cost', safe.toFixed(digits).replace('.', ','))
}

/**
 * Whether a settled turn earned its receipt line. A one-second "oi" needs no
 * accounting; a turn that ran tools, took real time, or reported real tokens
 * does. Keeping the noisy majority of short turns silent is what keeps the
 * line meaningful when it does show up.
 */
const RECEIPT_MIN_MS = 2000

export function deservesReceipt(metrics: TurnMetrics): boolean {
  if (metrics.steps > 0) return true
  if (metrics.outcome === 'interrupted') return true
  if (metrics.usage !== undefined) return true
  return turnElapsed(metrics, metrics.endedAt ?? metrics.startedAt) >= RECEIPT_MIN_MS
}
