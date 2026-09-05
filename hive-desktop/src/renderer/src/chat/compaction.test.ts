import { describe, expect, it } from 'vitest'
import {
  applyCompaction,
  compactPrompt,
  compactionRecord,
  shouldAutoCompact,
  NO_COMPACTION,
  type CompactEventIn
} from './compaction'
import { EMPTY_SESSION_USAGE, type SessionUsage } from './sessionUsage'

/** A session usage snapshot holding `tokens` in the window, out of 200k. */
function usageAt(tokens: number): SessionUsage {
  return {
    ...EMPTY_SESSION_USAGE,
    context: {
      inputTokens: tokens,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: 'claude-haiku-4-5'
    },
    contextWindow: 200_000
  }
}

const CLAUDE_EVENT: CompactEventIn = {
  type: 'compact',
  phase: 'end',
  trigger: 'manual',
  preTokens: 22_678,
  postTokens: 757,
  durationMs: 8400
}

const DEVIN_EVENT: CompactEventIn = {
  type: 'compact',
  phase: 'end',
  trigger: 'auto',
  summary: 'Resumo da conversa até aqui.'
}

describe('compactionRecord', () => {
  // Claude's `compact_boundary` carries the real numbers — measured on a live
  // `claude -p "/compact" --resume <id>` run.
  it('takes the agent’s own figures when it reports them', () => {
    expect(compactionRecord(CLAUDE_EVENT, usageAt(30_000))).toEqual({
      trigger: 'manual',
      preTokens: 22_678,
      postTokens: 757,
      measured: true,
      durationMs: 8400,
      summary: ''
    })
  })

  // Devin reports a prose summary and no counts at all. Throwing away the
  // reading the pane already had would make the seam say less than it knows —
  // but it has to say *where the number came from*.
  it('falls back to the pane’s own reading, and says it is an estimate', () => {
    const record = compactionRecord(DEVIN_EVENT, usageAt(23_062))
    expect(record.preTokens).toBe(23_062)
    expect(record.measured).toBe(false)
    expect(record.postTokens).toBeNull()
    expect(record.summary).toBe('Resumo da conversa até aqui.')
  })

  it('claims nothing when neither side knows', () => {
    const record = compactionRecord(DEVIN_EVENT, EMPTY_SESSION_USAGE)
    expect(record.preTokens).toBeNull()
    expect(record.measured).toBe(false)
  })
})

describe('applyCompaction', () => {
  it('replaces the reading with the reported post-count and counts what was freed', () => {
    const next = applyCompaction(usageAt(30_000), compactionRecord(CLAUDE_EVENT, usageAt(30_000)))
    expect(next.context?.inputTokens).toBe(757)
    expect(next.context?.cacheReadTokens).toBe(0)
    expect(next.compactions).toBe(1)
    expect(next.reclaimedTokens).toBe(22_678 - 757)
  })

  // "Unknown until the next turn reports" is the honest state, and a `null`
  // context is exactly what the meter renders as nothing rather than as a
  // number it no longer believes.
  it('drops the reading entirely when the agent reported no post-count', () => {
    const next = applyCompaction(usageAt(23_062), compactionRecord(DEVIN_EVENT, usageAt(23_062)))
    expect(next.context).toBeNull()
    expect(next.reclaimedTokens).toBe(23_062)
  })

  it('keeps the model name so the sheet still says what is running', () => {
    const next = applyCompaction(usageAt(30_000), compactionRecord(CLAUDE_EVENT, usageAt(30_000)))
    expect(next.context?.model).toBe('claude-haiku-4-5')
  })

  // Compacting the window does not un-spend what the conversation spent.
  it('leaves the session totals alone', () => {
    const spent: SessionUsage = { ...usageAt(30_000), turns: 7, costUsd: 1.25, outputTokens: 900 }
    const next = applyCompaction(spent, compactionRecord(CLAUDE_EVENT, spent))
    expect(next.turns).toBe(7)
    expect(next.costUsd).toBe(1.25)
    expect(next.outputTokens).toBe(900)
  })

  it('accumulates across compactions', () => {
    const once = applyCompaction(usageAt(30_000), compactionRecord(CLAUDE_EVENT, usageAt(30_000)))
    const twice = applyCompaction(once, compactionRecord(CLAUDE_EVENT, once))
    expect(twice.compactions).toBe(2)
  })
})

describe('shouldAutoCompact', () => {
  const claude = { command: true, automatic: false }
  const devin = { command: true, automatic: true }

  it('fires past the meter’s own warning line for an agent nobody else is minding', () => {
    expect(shouldAutoCompact(usageAt(160_000), claude, true)).toBe(true)
  })

  it('stays quiet below it', () => {
    expect(shouldAutoCompact(usageAt(120_000), claude, true)).toBe(false)
  })

  // The measured asymmetry this whole flag exists for: Devin compacts itself,
  // so a second compaction would spend a turn reclaiming what was reclaimed.
  it('never touches an agent that compacts on its own', () => {
    expect(shouldAutoCompact(usageAt(999_000), devin, true)).toBe(false)
  })

  it('respects the setting, and an agent with no such command', () => {
    expect(shouldAutoCompact(usageAt(160_000), claude, false)).toBe(false)
    expect(shouldAutoCompact(usageAt(160_000), NO_COMPACTION, true)).toBe(false)
  })

  // No declared window means no fraction to compare, and guessing one would
  // fire the threshold on a conversation that may be nowhere near it.
  it('cannot fire without a declared context window', () => {
    const noWindow = { ...usageAt(160_000), contextWindow: null }
    expect(shouldAutoCompact(noWindow, claude, true)).toBe(false)
  })
})

describe('compactPrompt', () => {
  it('is the bare command by default', () => {
    expect(compactPrompt()).toBe('/compact')
    expect(compactPrompt('   ')).toBe('/compact')
  })

  it('passes focus instructions through — both CLIs read them as what to keep', () => {
    expect(compactPrompt('foque nas decisões')).toBe('/compact foque nas decisões')
  })
})

describe('applyCompaction — edges', () => {
  // A conversation whose model was never reported still compacts; the seam and
  // the sheet simply have no model name to show.
  it('carries no model when none was known', () => {
    const noModel: SessionUsage = { ...EMPTY_SESSION_USAGE, contextWindow: 200_000 }
    const next = applyCompaction(noModel, compactionRecord(CLAUDE_EVENT, noModel))
    expect(next.context).toEqual({
      inputTokens: 757,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    })
  })

  // Nothing known on either side: the compaction is still counted (it happened)
  // but nothing was measurably reclaimed, and claiming otherwise would invent a
  // number.
  it('counts a compaction it can put no number on', () => {
    const blind = compactionRecord(
      { type: 'compact', phase: 'end', trigger: 'manual' },
      EMPTY_SESSION_USAGE
    )
    const next = applyCompaction(EMPTY_SESSION_USAGE, blind)
    expect(next.compactions).toBe(1)
    expect(next.reclaimedTokens).toBe(0)
  })

  // A "post" larger than the "before" is the agent contradicting itself; the
  // total must not go backwards on the strength of it.
  it('never reclaims a negative amount', () => {
    const odd = compactionRecord(
      { type: 'compact', phase: 'end', trigger: 'auto', preTokens: 100, postTokens: 900 },
      EMPTY_SESSION_USAGE
    )
    expect(applyCompaction(EMPTY_SESSION_USAGE, odd).reclaimedTokens).toBe(0)
  })
})
