import { describe, expect, it } from 'vitest'
import {
  CONTEXT_WARN_FRACTION,
  EMPTY_SESSION_USAGE,
  applyTurnRuntime,
  applyUsage,
  contextFraction,
  contextIsTight,
  contextSegments,
  contextTokens,
  withContextWindow,
  type SessionUsage
} from './sessionUsage'
import type { TurnUsage } from './turnTiming'

function usage(over: Partial<TurnUsage> = {}): TurnUsage {
  return {
    inputTokens: 800,
    cacheReadTokens: 60_000,
    cacheCreationTokens: 14_000,
    outputTokens: 1200,
    ...over
  }
}

const windowed: SessionUsage = { ...EMPTY_SESSION_USAGE, contextWindow: 200_000 }

describe('contextTokens', () => {
  // The occupancy is what the model READ: output is what it wrote, and that
  // only joins the context on the following request.
  it('sums the three prompt tiers and excludes output', () => {
    expect(contextTokens(usage())).toBe(74_800)
    expect(contextTokens(null)).toBe(0)
  })
})

describe('applyUsage', () => {
  // The bug this pins: a turn emits several snapshots as it grows, each
  // restating the same request. Summing them reports a conversation four times
  // fuller than it is.
  it('an intermediate snapshot moves the context reading and nothing else', () => {
    const first = applyUsage(windowed, usage(), { final: false, runtimeMs: 3000 })
    const second = applyUsage(first, usage({ cacheReadTokens: 61_000 }), {
      final: false,
      runtimeMs: 5000
    })

    expect(contextTokens(second.context)).toBe(75_800)
    expect(second.turns).toBe(0)
    expect(second.outputTokens).toBe(0)
    expect(second.runtimeMs).toBe(0)
    expect(second.costUsd).toBeNull()
  })

  it('only the final report advances turns, tokens, cost and runtime', () => {
    const after = applyUsage(windowed, usage({ costUsd: 0.09, apiDurationMs: 21_000 }), {
      final: true,
      runtimeMs: 24_000
    })

    expect(after.turns).toBe(1)
    expect(after.outputTokens).toBe(1200)
    expect(after.costUsd).toBeCloseTo(0.09)
    expect(after.runtimeMs).toBe(24_000)
    expect(after.apiMs).toBe(21_000)
  })

  it('accumulates across turns', () => {
    const one = applyUsage(windowed, usage({ costUsd: 0.05 }), { final: true, runtimeMs: 1000 })
    const two = applyUsage(one, usage({ outputTokens: 800, costUsd: 0.02 }), {
      final: true,
      runtimeMs: 2000
    })

    expect(two.turns).toBe(2)
    expect(two.outputTokens).toBe(2000)
    expect(two.costUsd).toBeCloseTo(0.07)
    expect(two.runtimeMs).toBe(3000)
  })

  // Caught by the real-Electron E2E: the CLI names the model on its
  // `assistant` messages and NOT on the `result` line that closes the turn, so
  // taking each report at face value made the authoritative one erase the
  // model name a moment after showing it.
  it('keeps the model name a later report omits', () => {
    const named = applyUsage(windowed, usage({ model: 'claude-opus-5' }), { final: false })
    const closed = applyUsage(named, usage(), { final: true, runtimeMs: 1000 })

    expect(closed.context?.model).toBe('claude-opus-5')
  })

  it('a report that names a different model replaces it', () => {
    const named = applyUsage(windowed, usage({ model: 'claude-opus-5' }), { final: false })
    const switched = applyUsage(named, usage({ model: 'claude-haiku-4-5' }), { final: false })

    expect(switched.context?.model).toBe('claude-haiku-4-5')
  })

  // An adapter whose CLI reports no cost must not turn `null` (unknown) into
  // `0` (free) — those are different claims.
  it('leaves cost and API time unknown when the CLI reported neither', () => {
    const after = applyUsage(windowed, usage(), { final: true, runtimeMs: 1000 })
    expect(after.costUsd).toBeNull()
    expect(after.apiMs).toBeNull()
  })
})

describe('applyTurnRuntime', () => {
  // A turn interrupted before the CLI printed its result line still spent time.
  it('counts the wall-clock of a turn that never reported usage', () => {
    expect(applyTurnRuntime(windowed, 4000).runtimeMs).toBe(4000)
    expect(applyTurnRuntime(windowed, -10).runtimeMs).toBe(0)
  })
})

describe('withContextWindow', () => {
  it('rebinds the ceiling without touching anything measured', () => {
    const measured = applyUsage(windowed, usage(), { final: true, runtimeMs: 1000 })
    const rebound = withContextWindow(measured, 100_000)

    expect(rebound.contextWindow).toBe(100_000)
    expect(rebound.turns).toBe(1)
    // Same value in → same reference out, so React can skip the re-render.
    expect(withContextWindow(rebound, 100_000)).toBe(rebound)
  })
})

describe('contextSegments', () => {
  it('splits the window into three occupied tiers plus what is left', () => {
    const state = applyUsage(windowed, usage(), { final: false })
    const segments = contextSegments(state)

    expect(segments.map((segment) => segment.id)).toEqual([
      'cacheRead',
      'cacheCreation',
      'input',
      'free'
    ])
    expect(segments[3].tokens).toBe(200_000 - 74_800)
    // Fractions are shares of the whole window, so they sum to 1.
    expect(segments.reduce((total, segment) => total + segment.fraction, 0)).toBeCloseTo(1)
  })

  // An adapter that declares no context window (Copilot's GPT models) still
  // gets the composition — it just can't claim to show how much room is left.
  it('drops the free tier and falls back to shares of what was used', () => {
    const state = applyUsage(EMPTY_SESSION_USAGE, usage(), { final: false })
    const segments = contextSegments(state)

    expect(segments.map((segment) => segment.id)).toEqual(['cacheRead', 'cacheCreation', 'input'])
    expect(segments.reduce((total, segment) => total + segment.fraction, 0)).toBeCloseTo(1)
    expect(contextFraction(state)).toBeNull()
  })

  it('survives a session with no report yet', () => {
    expect(contextSegments(windowed).every((segment) => Number.isFinite(segment.fraction))).toBe(
      true
    )
    expect(contextFraction(EMPTY_SESSION_USAGE)).toBeNull()
  })
})

describe('contextIsTight', () => {
  it('turns advisory only once the window is genuinely close to full', () => {
    const roomy = applyUsage(windowed, usage(), { final: false })
    expect(contextIsTight(roomy)).toBe(false)

    const full = applyUsage(windowed, usage({ cacheReadTokens: 150_000 }), { final: false })
    expect(contextFraction(full)).toBeGreaterThanOrEqual(CONTEXT_WARN_FRACTION)
    expect(contextIsTight(full)).toBe(true)
  })

  it('never warns without a window to be near the end of', () => {
    const huge = applyUsage(EMPTY_SESSION_USAGE, usage({ cacheReadTokens: 900_000 }), {
      final: false
    })
    expect(contextIsTight(huge)).toBe(false)
  })

  it('caps the fraction at 1 when a report overruns the declared window', () => {
    const over = applyUsage(windowed, usage({ cacheReadTokens: 400_000 }), { final: false })
    expect(contextFraction(over)).toBe(1)
  })
})
