import { contextTokens, EMPTY_SESSION_USAGE, type SessionUsage } from './sessionUsage'
import type { TurnUsage } from './turnTiming'

/**
 * How full each conversation's context window is — kept per conversation, so
 * the reading survives switching away from one and back.
 *
 * ## The defect this closes
 *
 * The meter lived on the *pane*. Opening another conversation reset it to
 * `EMPTY_SESSION_USAGE`, and the composer's footer — where the percentage is
 * the one thing on screen that says how much room the agent has left — simply
 * went blank. Two conversations in a session was all it took: the number
 * vanished, and it only came back after the next turn answered, which on a long
 * BMAD run can be minutes. The comment that justified it ("a restored
 * transcript's real occupancy is unknown") was right about a *restored* one and
 * wrong about the case users actually hit: a conversation this window measured
 * ten seconds ago, whose reading it then threw away.
 *
 * ## The model
 *
 * Exactly the one the send queue and the composer draft already use: leaving a
 * conversation **parks** its reading under its id, entering one **takes** back
 * what it parked. The difference is that a reading is not consumed by being
 * restored — the conversation keeps filling up whether or not it is on screen
 * (a background turn is still a turn), so `take` leaves the slot in place.
 *
 * A conversation with no id yet (`null`) has no slot: there is no handle to
 * bring it back by, and a brand-new conversation's occupancy is genuinely zero.
 *
 * ## What crosses a restart
 *
 * `snapshot`/`restore` below are the persisted half — the *context* reading
 * only (see `UsageSnapshot`). Pure and DOM-free; `Chat` owns the store, and
 * `chatHistoryStore` owns the file it is written to.
 */
export type UsageStore = Map<string, SessionUsage>

/** Files a conversation's reading under its id. */
export function parkUsage(store: UsageStore, key: string | null, usage: SessionUsage): void {
  if (key === null) return
  store.set(key, usage)
}

/**
 * The conversation's reading, or `null` when this window has none for it.
 *
 * `null` rather than an empty reading, because the caller has a second place to
 * look — what the conversation itself has on disk — and "nothing measured here"
 * and "measured as empty" would otherwise be the same answer.
 *
 * Unlike `takeDraft`, the slot is **not** released: a conversation left running
 * in the background goes on reporting usage, and the record of how full it is
 * belongs to it for as long as it exists — not to whoever looked at it last.
 */
export function takeUsage(store: UsageStore, key: string | null): SessionUsage | null {
  if (key === null) return null
  return store.get(key) ?? null
}

/** Drops a conversation's reading — for one deleted from history. */
export function forgetUsage(store: UsageStore, key: string): void {
  store.delete(key)
}

/**
 * The part of a reading worth writing to disk: **the window's occupancy, and
 * what it was measured against.**
 *
 * Not the session totals. Cost, turn count and wall-clock are a record of *this
 * app session's* work on the conversation; persisting them would turn "what
 * this window has spent" into a lifetime bill that keeps growing across
 * launches, which is a different number under the same label. Occupancy is the
 * opposite: it is a property of the conversation itself — the prompt the agent
 * will re-read on its next turn — and it is just as true tomorrow.
 */
export interface UsageSnapshot {
  /** The newest per-request reading. */
  context: TurnUsage
  /** The ceiling the CLI itself reported running at, when it reported one. */
  reportedWindow?: number
  /** How many times this conversation has been compacted, and by how much. */
  compactions?: number
  reclaimedTokens?: number
}

/** What to persist for this conversation, or `null` when nothing has been measured yet. */
export function snapshot(usage: SessionUsage): UsageSnapshot | null {
  if (usage.context === null) return null
  return {
    context: usage.context,
    ...(usage.reportedWindow === null ? {} : { reportedWindow: usage.reportedWindow }),
    ...(usage.compactions === 0 ? {} : { compactions: usage.compactions }),
    ...(usage.reclaimedTokens === 0 ? {} : { reclaimedTokens: usage.reclaimedTokens })
  }
}

/**
 * A stored snapshot, back as a reading.
 *
 * Tolerant field by field, like every other restore in this app: a payload
 * written by an older build, hand-edited, or truncated costs that field rather
 * than the whole reading. A snapshot whose context is unreadable is no
 * snapshot — the meter goes back to saying it has nothing yet, which is honest.
 */
export function restore(value: unknown): SessionUsage | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as {
    context?: unknown
    reportedWindow?: unknown
    compactions?: unknown
    reclaimedTokens?: unknown
  }
  if (!raw.context || typeof raw.context !== 'object') return null
  const context = raw.context as TurnUsage
  const usage: SessionUsage = {
    ...EMPTY_SESSION_USAGE,
    context,
    reportedWindow: count(raw.reportedWindow) ?? null,
    compactions: count(raw.compactions) ?? 0,
    reclaimedTokens: count(raw.reclaimedTokens) ?? 0
  }
  // A reading of nothing is not a reading. It would draw a 0% meter over a
  // conversation whose real occupancy is simply unknown, which is the one thing
  // a gauge must never do.
  return contextTokens(usage.context) === 0 && usage.compactions === 0 ? null : usage
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
