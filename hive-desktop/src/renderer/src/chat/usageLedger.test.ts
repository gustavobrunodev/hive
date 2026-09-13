import { describe, expect, it } from 'vitest'
import { EMPTY_SESSION_USAGE, applyUsage, type SessionUsage } from './sessionUsage'
import {
  forgetUsage,
  parkUsage,
  restore,
  snapshot,
  takeUsage,
  type UsageStore
} from './usageLedger'

/**
 * How full each conversation's context window is, kept per conversation.
 *
 * The defect this closes is the one a user reported in one sentence: moving
 * between two conversations blanked the composer's context percentage. The
 * meter lived on the pane, so leaving a conversation threw its reading away.
 */
function measured(tokens = 60_000): SessionUsage {
  return applyUsage(
    EMPTY_SESSION_USAGE,
    {
      inputTokens: tokens,
      outputTokens: 900,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      contextWindow: 200_000,
      model: 'claude-opus-5'
    },
    { final: true, turnId: 't1', runtimeMs: 4_000 }
  )
}

describe('usageLedger — parking a conversation’s reading', () => {
  it('hands back what a conversation parked', () => {
    const store: UsageStore = new Map()
    const usage = measured()
    parkUsage(store, 'conv-1', usage)
    expect(takeUsage(store, 'conv-1')).toBe(usage)
  })

  /**
   * `null` rather than an empty reading: the caller has a second place to look
   * (what the conversation itself has on disk), and "nothing measured here"
   * and "measured as empty" must not be the same answer.
   */
  it('answers null for a conversation this window has nothing for', () => {
    expect(takeUsage(new Map(), 'conv-x')).toBeNull()
  })

  /** A conversation with no id yet has no handle to be brought back by. */
  it('files nothing under a conversation that has no id', () => {
    const store: UsageStore = new Map()
    parkUsage(store, null, measured())
    expect(store.size).toBe(0)
    expect(takeUsage(store, null)).toBeNull()
  })

  /**
   * Unlike a parked draft, a reading is NOT consumed by being restored: a
   * conversation left running in the background goes on reporting usage, and
   * the record belongs to it — not to whoever looked at it last.
   */
  it('keeps the slot after handing the reading back', () => {
    const store: UsageStore = new Map()
    parkUsage(store, 'conv-1', measured())
    takeUsage(store, 'conv-1')
    expect(takeUsage(store, 'conv-1')).not.toBeNull()
  })

  it('forgets a conversation that no longer exists', () => {
    const store: UsageStore = new Map()
    parkUsage(store, 'conv-1', measured())
    forgetUsage(store, 'conv-1')
    expect(takeUsage(store, 'conv-1')).toBeNull()
  })
})

describe('usageLedger — what crosses a restart', () => {
  /**
   * Occupancy is a property of the conversation (the prompt the agent re-reads
   * next turn) and is just as true tomorrow. The session totals are a record of
   * *this window's* work on it, and persisting them would turn "what this
   * window spent" into a lifetime bill under the same label.
   */
  it('stores the occupancy and leaves the session totals behind', () => {
    const stored = snapshot(measured())
    expect(stored?.context.inputTokens).toBe(60_000)
    expect(stored?.reportedWindow).toBe(200_000)
    expect(stored).not.toHaveProperty('turns')
    expect(stored).not.toHaveProperty('costUsd')
    expect(stored).not.toHaveProperty('runtimeMs')
  })

  it('stores nothing for a conversation nothing has measured', () => {
    expect(snapshot(EMPTY_SESSION_USAGE)).toBeNull()
  })

  it('omits a compaction count of zero rather than writing it', () => {
    const stored = snapshot(measured())
    expect(stored).not.toHaveProperty('compactions')
    const compacted = snapshot({ ...measured(), compactions: 2, reclaimedTokens: 90_000 })
    expect(compacted?.compactions).toBe(2)
    expect(compacted?.reclaimedTokens).toBe(90_000)
  })

  it('round-trips a reading through the file', () => {
    const back = restore(snapshot(measured()))
    expect(back?.context?.inputTokens).toBe(60_000)
    expect(back?.reportedWindow).toBe(200_000)
    // The totals come back empty — they were never this conversation's to keep.
    expect(back?.turns).toBe(0)
    expect(back?.costUsd).toBeNull()
  })

  it('tolerates a payload written by an older build, hand-edited, or truncated', () => {
    expect(restore(undefined)).toBeNull()
    expect(restore(null)).toBeNull()
    expect(restore('nonsense')).toBeNull()
    expect(restore({})).toBeNull()
    expect(restore({ context: 'nope' })).toBeNull()
    // One bad field costs that field, never the whole reading.
    const partial = restore({ context: { inputTokens: 1_000 }, reportedWindow: 'wide' })
    expect(partial?.context?.inputTokens).toBe(1_000)
    expect(partial?.reportedWindow).toBeNull()
    expect(restore({ context: { inputTokens: 1_000 }, compactions: -3 })?.compactions).toBe(0)
  })

  /**
   * A reading of nothing is not a reading. Restoring it would draw a 0% meter
   * over a conversation whose real occupancy is unknown, which is the one thing
   * a gauge must never do — so it comes back as "nothing stored" instead.
   */
  it('refuses a stored reading that measures nothing', () => {
    expect(restore({ context: { inputTokens: 0, cacheReadTokens: 0 } })).toBeNull()
    // …unless a compaction is the news, which is itself worth restoring.
    expect(restore({ context: { inputTokens: 0 }, compactions: 1 })?.compactions).toBe(1)
  })
})
