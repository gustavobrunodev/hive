/**
 * Context compaction, as the chat pane models it.
 *
 * ## What compaction is, and whose job it turned out to be
 *
 * A model has no memory: every turn re-sends the whole conversation, and when
 * that stops fitting, the agent starts forgetting the beginning — which in a
 * BMAD session is the requirements everything else is built against.
 * Compaction is the way out: replace the history with a summary of itself and
 * keep going in the same conversation.
 *
 * The first design here was going to *perform* that — ask the agent for a
 * summary, drop the resume handle, seed a fresh session. Measuring the two CLIs
 * killed it, and for the right reason: they already do this, and they do it
 * better than an app can from the outside, because they own the transcript and
 * can drop its middle while keeping the session id alive. `claude -p "/compact"
 * --resume <id>` compacts and answers with its own numbers; Devin's ACP session
 * lists `compact` among its commands and compacts on its own besides.
 *
 * So Hive does two things instead, and neither of them is summarising:
 *
 *  1. **It asks.** `/compact` in the composer is forwarded to the agent as
 *     `/compact` — the command it already answers to.
 *  2. **It shows.** Every compaction that happens — the one the user asked for
 *     *and* the one Devin performs by itself mid-session — becomes a seam in
 *     the transcript. This is the part that was actually missing: before it,
 *     the context meter would simply fall off a cliff with nothing on screen
 *     to explain why.
 *
 * ## And one thing it decides
 *
 * `shouldAutoCompact` is the exception, and it exists because of a measured
 * asymmetry: Claude's auto-compaction belongs to its interactive loop and does
 * not run in the print mode Hive drives (verified with a ~2k ceiling over a
 * 22 577-token context — nothing compacted). On that transport nobody is
 * watching the ceiling unless Hive is. On Devin's, somebody already is, and a
 * second compaction would spend a turn reclaiming what was already reclaimed.
 * The rule reads the agent's own declaration rather than its name.
 *
 * Pure and DOM-free.
 */

import {
  CONTEXT_WARN_FRACTION,
  contextFraction,
  contextTokens,
  type SessionUsage
} from './sessionUsage'

/**
 * The command name, mirrored from `main/agentAdapter.ts`. English on purpose:
 * this string is not UI copy — it is what gets typed at a CLI that only knows
 * the English one, and it is the name users already have muscle memory for.
 */
export const COMPACT_COMMAND = 'compact'

/** Structural mirror of `main/agentAdapter.ts`'s `CompactionSupport`. */
export interface CompactionSupport {
  command: boolean
  automatic: boolean
}

/**
 * What an agent that declared nothing is assumed to do: nothing. An
 * unmeasured CLI must not be offered a command it may answer as a question.
 */
export const NO_COMPACTION: CompactionSupport = { command: false, automatic: false }

/** Structural mirror of `main/agentAdapter.ts`'s `CompactEvent`. */
export interface CompactEventIn {
  type: 'compact'
  turnId?: string
  phase: 'start' | 'end'
  trigger: 'manual' | 'auto'
  preTokens?: number
  postTokens?: number
  durationMs?: number
  summary?: string
}

/**
 * One compaction, as the transcript's seam renders it.
 *
 * `preTokens` may come from the agent (Claude reports it) or from the pane's
 * own last reading (Devin reports none) — and `measured` says which, because
 * "22,7k → 757" and "≈22,7k → ?" are different claims and the seam must not
 * make the weaker one look like the stronger.
 */
export interface CompactionRecord {
  trigger: 'manual' | 'auto'
  /** Occupancy before, in tokens, or `null` when nothing knew. */
  preTokens: number | null
  /** Occupancy after, in tokens, or `null` — Devin reports none. */
  postTokens: number | null
  /** Whether `preTokens` is the agent's own figure rather than the pane's reading. */
  measured: boolean
  durationMs: number | null
  /** The agent's account of what it kept, or `''`. */
  summary: string
}

/**
 * Builds the seam from the agent's `end` event plus what the meter last read.
 *
 * The fallback is the whole reason this is a function: an agent that reports no
 * counts still compacted something, and a seam that could only say "compactado"
 * would throw away a number the pane was already holding. It just has to admit
 * where the number came from.
 */
export function compactionRecord(event: CompactEventIn, usage: SessionUsage): CompactionRecord {
  const observed = contextTokens(usage.context)
  const reported = typeof event.preTokens === 'number' ? event.preTokens : null
  // The pane's own reading only stands in when the agent reported nothing —
  // and `measured` is what keeps the two apart on screen.
  const fallback = observed > 0 ? observed : null
  return {
    trigger: event.trigger,
    preTokens: reported ?? fallback,
    postTokens: typeof event.postTokens === 'number' ? event.postTokens : null,
    measured: reported !== null,
    durationMs: typeof event.durationMs === 'number' ? event.durationMs : null,
    summary: event.summary ?? ''
  }
}

/**
 * Folds a finished compaction into the session's usage.
 *
 * The context reading is *replaced*, never merely reduced: what the window
 * holds now is the agent's business, and the pane's last snapshot describes a
 * conversation that no longer exists. When the agent reported a post-count the
 * meter can show it immediately; when it didn't, the honest state is "unknown
 * until the next turn reports", which is exactly what a `null` context renders
 * as — the meter hides itself rather than showing a number it no longer
 * believes.
 *
 * The session totals — cost, turns, wall clock — are untouched. Compacting the
 * window does not un-spend what the conversation spent.
 */
export function applyCompaction(current: SessionUsage, record: CompactionRecord): SessionUsage {
  const reclaimed =
    record.preTokens === null ? 0 : Math.max(0, record.preTokens - (record.postTokens ?? 0))
  return {
    ...current,
    context:
      record.postTokens === null
        ? null
        : {
            inputTokens: record.postTokens,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            ...(current.context?.model ? { model: current.context.model } : {})
          },
    compactions: current.compactions + 1,
    reclaimedTokens: current.reclaimedTokens + reclaimed
  }
}

/**
 * Should Hive compact this conversation *before* the next turn goes out?
 *
 * Three conditions, and every one of them is a refusal to be clever:
 *  - the agent must accept the command at all;
 *  - it must not already compact on its own — that agent is not ours to manage;
 *  - the user must not have turned this off.
 *
 * The threshold is the meter's own warning line rather than a second number:
 * the moment the bar turns is the moment the advice applies, and two thresholds
 * would mean the UI warns at one point and acts at another with nothing on
 * screen explaining the gap.
 */
export function shouldAutoCompact(
  usage: SessionUsage,
  support: CompactionSupport,
  enabled: boolean
): boolean {
  if (!enabled || !support.command || support.automatic) return false
  const fraction = contextFraction(usage)
  return fraction !== null && fraction >= CONTEXT_WARN_FRACTION
}

/** The line the composer sends. `instructions` become the agent's focus for the summary. */
export function compactPrompt(instructions?: string): string {
  const focus = instructions?.trim() ?? ''
  return focus === '' ? `/${COMPACT_COMMAND}` : `/${COMPACT_COMMAND} ${focus}`
}
