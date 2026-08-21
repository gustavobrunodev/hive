/**
 * How full the conversation's context window is, and what the session has cost
 * so far.
 *
 * ## What "context" means here, exactly
 *
 * A model has no memory. Every turn re-sends the entire conversation, and the
 * window is the ceiling on how much of it fits. When that ceiling is reached
 * the agent starts forgetting the beginning of the work — which, in a
 * multi-hour BMAD session, is the requirements it is supposed to be building
 * against. Users of Claude Code learn to watch this number; before this module
 * Hive had nothing to watch.
 *
 * The number is not estimated. Each `usage` event carries the model's own
 * accounting of the request it just made, and `input + cacheRead +
 * cacheCreation` **is** the prompt it read — the occupancy of the window at
 * that instant. `outputTokens` is excluded on purpose: it is what the model
 * *wrote*, and it only joins the context on the following request.
 *
 * ## Live snapshot vs. accumulated totals
 *
 * Two different accumulations, from two different events, and conflating them
 * is the easy bug:
 *  - **Context** is the *latest* snapshot, not a sum. A turn emits several as
 *    it grows; each restates the same request. Summing them would report a
 *    conversation four times fuller than it is. The adapter guarantees every
 *    report's input side is one request (`agentAdapter.ts`'s `TurnUsage`), so
 *    this module can take the newest one at face value.
 *  - **Session totals** (tokens generated, cost) come only from the `final`
 *    reports — the CLI's own end-of-turn line, the only place per-turn totals
 *    exist. A turn may emit several of those, each restating the same turn's
 *    running totals, so a repeat *replaces* that turn's contribution instead of
 *    adding to it (`settled`, below).
 *
 * Pure and DOM-free; presentation lives in `ContextMeter.tsx`.
 */

import type { TurnUsage } from './turnTiming'

/**
 * What one turn's `final` reports have already contributed to the session
 * totals. Kept per turn so a second report for the same turn — which restates
 * that turn's running totals rather than adding a new slice — can be folded in
 * as a replacement.
 */
interface SettledTurn {
  outputTokens: number
  costUsd?: number
  apiMs?: number
  runtimeMs: number
}

/** Everything the session status surface reads. */
export interface SessionUsage {
  /** The newest per-request snapshot, or `null` before the first turn reports one. */
  context: TurnUsage | null
  /** The context window of the model in use, in tokens — `null` when the adapter declares none. */
  contextWindow: number | null
  /**
   * The window the CLI itself reported running at, when it did. Outranks the
   * adapter's curated figure (see `withContextWindow`): the curated one is what
   * the model *usually* gets, this one is what this conversation *has*.
   */
  reportedWindow: number | null
  /** Per-turn ledger behind the totals below; see `SettledTurn`. */
  settled: Record<string, SettledTurn>
  /** Sum of every settled turn's generated tokens. */
  outputTokens: number
  /** Sum of every settled turn's cost, in USD. `null` when no turn reported one. */
  costUsd: number | null
  /** How many turns have settled with a final report. */
  turns: number
  /** Sum of the turns' measured wall-clock, in ms (see `turnTiming.ts` on why it is measured here). */
  runtimeMs: number
  /** Sum of the CLI's own reported API time, in ms; `null` when it reported none. */
  apiMs: number | null
}

export const EMPTY_SESSION_USAGE: SessionUsage = {
  context: null,
  contextWindow: null,
  reportedWindow: null,
  settled: {},
  outputTokens: 0,
  costUsd: null,
  turns: 0,
  runtimeMs: 0,
  apiMs: null
}

/**
 * Tokens the model read on the last request — the window's occupancy.
 *
 * The three fields are coalesced rather than trusted. A report missing any one
 * of them — a CLI version that stops sending `cacheCreationTokens`, an adapter
 * other than Claude's — turned this sum into `NaN`, and the composer footer
 * then read **"NaN% de contexto"** for the rest of the session. The breakdown
 * in `contextBreakdown` below already coalesced; the headline did not, so the
 * detail sheet stayed plausible while the number everybody actually looks at
 * was garbage. Degrading to a low reading is wrong by exactly the missing
 * field; `NaN` is wrong in a way the user cannot even read.
 */
export function contextTokens(usage: TurnUsage | null): number {
  if (!usage) return 0
  return (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0)
}

/**
 * Folds one report in. `final` reports (off the CLI's `result` line) also
 * advance the session totals; intermediate snapshots only move the context
 * reading. `runtimeMs` comes from the caller because only the caller knows when
 * the user pressed Enter.
 *
 * `turnId` is what makes a repeated `final` safe: a turn can emit several, each
 * restating the same turn's running totals (measured on a `claude` turn that
 * ran a subagent), so the turn's previous contribution is backed out before the
 * new one goes in. Without an id every restatement would look like another
 * turn, and one prompt would bill as two.
 */
export function applyUsage(
  current: SessionUsage,
  usage: TurnUsage,
  opts: { final: boolean; runtimeMs?: number; turnId?: string }
): SessionUsage {
  const next: SessionUsage = {
    ...current,
    // The model rides on the CLI's `assistant` messages and is absent from the
    // `result` line that closes the turn — so taking each report at face value
    // means the authoritative one *erases* the model name a moment after
    // showing it. It didn't change mid-turn; carry it forward.
    context: { ...usage, model: usage.model ?? current.context?.model },
    reportedWindow: usage.contextWindow ?? current.reportedWindow
  }
  if (!opts.final) return next

  const contribution: SettledTurn = {
    outputTokens: usage.outputTokens,
    costUsd: usage.costUsd,
    apiMs: usage.apiDurationMs,
    runtimeMs: Math.max(0, opts.runtimeMs ?? 0)
  }
  // A turn with no id can't be recognised on a second report, so it is counted
  // as it arrives — the pre-`turnId` behaviour, kept for adapters/tests that
  // don't stamp one.
  const previous = opts.turnId === undefined ? undefined : current.settled[opts.turnId]
  if (opts.turnId !== undefined) {
    next.settled = { ...current.settled, [opts.turnId]: contribution }
  }
  if (previous === undefined) next.turns = current.turns + 1

  next.outputTokens =
    current.outputTokens - (previous?.outputTokens ?? 0) + contribution.outputTokens
  next.runtimeMs = Math.max(
    0,
    current.runtimeMs - (previous?.runtimeMs ?? 0) + contribution.runtimeMs
  )
  next.costUsd = rebase(current.costUsd, previous?.costUsd, contribution.costUsd)
  next.apiMs = rebase(current.apiMs, previous?.apiMs, contribution.apiMs)
  return next
}

/**
 * Swaps one turn's contribution to a running total for its restated value.
 * Stays `null` — "the CLI never reported this" — until something real arrives:
 * turning an unknown cost into `0` would claim the turn was free.
 */
function rebase(
  total: number | null,
  previous: number | undefined,
  next: number | undefined
): number | null {
  if (next === undefined) return total
  return Math.max(0, (total ?? 0) - (previous ?? 0) + next)
}

/**
 * Records a turn that ended without ever reporting usage — an adapter that
 * doesn't emit it, or a turn the user interrupted before the CLI printed its
 * result. The session's wall-clock still counts: time spent is time spent,
 * whether or not anyone billed for it.
 */
export function applyTurnRuntime(current: SessionUsage, runtimeMs: number): SessionUsage {
  return { ...current, runtimeMs: current.runtimeMs + Math.max(0, runtimeMs) }
}

/**
 * Rebinds the window when the conversation's model changes; everything measured
 * stays. `declared` is the adapter's curated figure for the selected model — a
 * window the CLI reported for itself wins over it, because the same model id
 * runs at different ceilings depending on how the CLI was configured, and a
 * denominator that is merely usually right makes the meter usually right.
 */
export function withContextWindow(current: SessionUsage, declared: number | null): SessionUsage {
  const contextWindow = current.reportedWindow ?? declared
  return current.contextWindow === contextWindow ? current : { ...current, contextWindow }
}

/**
 * The composition of the window, as the meter draws it.
 *
 * The three occupied tiers are **one quantity at three provenances**, not
 * three categories — so they render as one hue at descending emphasis rather
 * than as three colours, which would read as three unrelated statuses. `free`
 * is the empty track and is present only when the model declares a window.
 */
export type ContextSegmentId = 'cacheRead' | 'cacheCreation' | 'input' | 'free'

export interface ContextSegment {
  id: ContextSegmentId
  tokens: number
  /** Share of the whole window (0-1), or of the used tokens when no window is declared. */
  fraction: number
}

/**
 * Splits a snapshot into drawable segments. With no declared window the
 * segments are shares of what was used — the bar still shows the composition,
 * it just can't claim to show how much room is left, and the meter suppresses
 * the percentage accordingly.
 */
export function contextSegments(usage: SessionUsage): ContextSegment[] {
  const used = contextTokens(usage.context)
  const window = usage.contextWindow
  const denominator = window !== null && window > 0 ? window : used
  const share = (tokens: number): number => (denominator > 0 ? tokens / denominator : 0)
  const occupied: Array<[ContextSegmentId, number]> = [
    ['cacheRead', usage.context?.cacheReadTokens ?? 0],
    ['cacheCreation', usage.context?.cacheCreationTokens ?? 0],
    ['input', usage.context?.inputTokens ?? 0]
  ]
  const segments: ContextSegment[] = occupied.map(([id, tokens]) => ({
    id,
    tokens,
    fraction: share(tokens)
  }))
  if (window === null || window <= 0) return segments
  const free = Math.max(0, window - used)
  return [...segments, { id: 'free', tokens: free, fraction: share(free) }]
}

/** Occupancy as a 0-1 fraction, or `null` when the model declares no window. */
export function contextFraction(usage: SessionUsage): number | null {
  const window = usage.contextWindow
  if (window === null || window <= 0) return null
  return Math.min(1, contextTokens(usage.context) / window)
}

/**
 * Past this share of the window, the meter stops being neutral chrome and
 * starts being advice: the conversation is close enough to the ceiling that
 * the agent may begin losing its earliest context, and the fix (start a fresh
 * conversation) is cheap only if you do it before that happens.
 */
export const CONTEXT_WARN_FRACTION = 0.8

export function contextIsTight(usage: SessionUsage): boolean {
  const fraction = contextFraction(usage)
  return fraction !== null && fraction >= CONTEXT_WARN_FRACTION
}
