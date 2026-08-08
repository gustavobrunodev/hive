import { describe, expect, it } from 'vitest'
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
import type { TurnBlock } from './turnTimeline'
import type { ToolActivity } from './toolActivity'

function activity(over: Partial<ToolActivity> = {}): ToolActivity {
  return { id: 't1', name: 'Read', state: 'running', seq: 0, startedAt: 0, ...over }
}

function tools(...activities: ToolActivity[]): TurnBlock {
  return { kind: 'tools', id: 'tools-0', activities }
}

const text: TurnBlock = { kind: 'text', id: 'text-0', text: 'oi' }

describe('formatDuration', () => {
  // Tenths below a second: a fast step collapsing to "0s" reads as "didn't
  // happen", which is the one thing it definitely did.
  it('shows tenths below a second, whole seconds above it', () => {
    expect(formatDuration(400)).toBe('0,4s')
    expect(formatDuration(999)).toBe('0,9s')
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(12_400)).toBe('12s')
  })

  it('switches to the coarser unit once nobody is counting seconds', () => {
    expect(formatDuration(72_000)).toBe('1min 12s')
    // Seconds are zero-padded so a column of durations stays a column.
    expect(formatDuration(64_000)).toBe('1min 04s')
    expect(formatDuration(3_720_000)).toBe('1h 02min')
  })

  it('never renders a negative or non-finite duration', () => {
    expect(formatDuration(-5)).toBe('0,0s')
    expect(formatDuration(Number.NaN)).toBe('0,0s')
  })
})

describe('formatTokens', () => {
  it('says magnitudes the way people say them out loud', () => {
    expect(formatTokens(842)).toBe('842')
    expect(formatTokens(8420)).toBe('8,4 mil')
    // A trailing ",0" is noise at this size.
    expect(formatTokens(12_000)).toBe('12 mil')
    expect(formatTokens(1_240_000)).toBe('1,2 mi')
  })

  it('floors at zero for a missing or nonsense count', () => {
    expect(formatTokens(-3)).toBe('0')
    expect(formatTokens(Number.NaN)).toBe('0')
  })
})

describe('formatCost', () => {
  it('keeps enough digits for a cheap turn to be distinguishable from a free one', () => {
    expect(formatCost(0.0918)).toBe('US$ 0,09')
    expect(formatCost(0.0004)).toBe('US$ 0,0004')
  })
})

describe('turnPhase', () => {
  // The phase is read off the timeline rather than tracked in parallel — the
  // blocks already are the record, and a second copy is a second thing to drift.
  it('reads the phase off the turn, ordered by what outranks what', () => {
    expect(turnPhase([])).toBe('starting')
    expect(turnPhase([text])).toBe('writing')
    expect(turnPhase([tools(activity())])).toBe('working')
    // A settled tool group with nothing after it is the real gap: a step ended
    // and no prose has started.
    expect(turnPhase([tools(activity({ state: 'ok' }))])).toBe('thinking')
  })

  it('an unanswered permission outranks everything else on screen', () => {
    const approval: TurnBlock = {
      kind: 'approval',
      id: 'approval-1',
      request: { requestId: 'r1', tool: 'Bash', answer: null }
    }
    expect(turnPhase([tools(activity()), approval, text])).toBe('waiting')
  })

  it('every phase has copy', () => {
    for (const phase of ['starting', 'waiting', 'working', 'writing', 'thinking'] as const) {
      expect(phaseLabel(phase).length).toBeGreaterThan(0)
    }
  })
})

describe('turnElapsed', () => {
  it('counts up while the turn runs and freezes when it ends', () => {
    const live: TurnMetrics = { startedAt: 1000, steps: 0 }
    expect(turnElapsed(live, 4000)).toBe(3000)
    expect(turnElapsed({ ...live, endedAt: 2500 }, 9999)).toBe(1500)
  })

  // The shared clock can lag the turn's start by up to one tick (see
  // useTicker) — a turn that just started must read as 0, never as negative.
  it('clamps a clock that is behind the turn it measures', () => {
    expect(turnElapsed({ startedAt: 5000, steps: 0 }, 4800)).toBe(0)
  })
})

describe('countSteps', () => {
  it('counts every tool call across every group in the turn', () => {
    expect(countSteps([])).toBe(0)
    expect(
      countSteps([
        tools(activity({ id: 'a' }), activity({ id: 'b' })),
        text,
        { kind: 'tools', id: 'tools-2', activities: [activity({ id: 'c' })] }
      ])
    ).toBe(3)
  })
})

describe('deservesReceipt', () => {
  // A one-second "oi" needs no accounting; keeping the noisy majority of short
  // turns silent is what keeps the line meaningful when it does appear.
  it('stays silent for a short, toolless, unmetered turn', () => {
    expect(deservesReceipt({ startedAt: 0, endedAt: 900, steps: 0, outcome: 'done' })).toBe(false)
  })

  it('reports whenever the turn did something worth accounting for', () => {
    expect(deservesReceipt({ startedAt: 0, endedAt: 900, steps: 1, outcome: 'done' })).toBe(true)
    expect(deservesReceipt({ startedAt: 0, endedAt: 900, steps: 0, outcome: 'interrupted' })).toBe(
      true
    )
    expect(deservesReceipt({ startedAt: 0, endedAt: 5000, steps: 0, outcome: 'done' })).toBe(true)
    expect(
      deservesReceipt({
        startedAt: 0,
        endedAt: 900,
        steps: 0,
        outcome: 'done',
        usage: {
          inputTokens: 1,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          outputTokens: 4
        }
      })
    ).toBe(true)
  })
})
