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
 *    conversation four times fuller than it is.
 *  - **Session totals** (tokens generated, cost) sum only the `final` reports,
 *    one per turn — the CLI's own end-of-turn line, which is the only place
 *    per-turn totals exist.
 *
 * Pure and DOM-free; presentation lives in `ContextMeter.tsx`.
 */

import type { TurnUsage } from './turnTiming'

/** Everything the session status surface reads. */
export interface SessionUsage {
  /** The newest per-request snapshot, or `null` before the first turn reports one. */
  context: TurnUsage | null
  /** The context window of the model in use, in tokens — `null` when the adapter declares none. */
  contextWindow: number | null
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
  outputTokens: 0,
  costUsd: null,
  turns: 0,
  runtimeMs: 0,
  apiMs: null
}

/** Tokens the model read on the last request — the window's occupancy. */
export function contextTokens(usage: TurnUsage | null): number {
  if (!usage) return 0
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
}

/**
 * Folds one report in. `final` reports (one per turn, off the CLI's `result`
 * line) also advance the session totals; intermediate snapshots only move the
 * context reading. `runtimeMs` comes from the caller because only the caller
 * knows when the user pressed Enter.
 */
export function applyUsage(
  current: SessionUsage,
  usage: TurnUsage,
  opts: { final: boolean; runtimeMs?: number }
): SessionUsage {
  const next: SessionUsage = {
    ...current,
    // The model rides on the CLI's `assistant` messages and is absent from the
    // `result` line that closes the turn — so taking each report at face value
    // means the authoritative one *erases* the model name a moment after
    // showing it. It didn't change mid-turn; carry it forward.
    context: { ...usage, model: usage.model ?? current.context?.model }
  }
  if (!opts.final) return next
  next.turns = current.turns + 1
  next.outputTokens = current.outputTokens + usage.outputTokens
  next.runtimeMs = current.runtimeMs + Math.max(0, opts.runtimeMs ?? 0)
  if (usage.costUsd !== undefined) next.costUsd = (current.costUsd ?? 0) + usage.costUsd
  if (usage.apiDurationMs !== undefined) next.apiMs = (current.apiMs ?? 0) + usage.apiDurationMs
  return next
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

/** Rebinds the window when the conversation's model changes; everything measured stays. */
export function withContextWindow(current: SessionUsage, contextWindow: number | null): SessionUsage {
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
