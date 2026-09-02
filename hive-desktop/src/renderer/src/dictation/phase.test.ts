import { describe, expect, it } from 'vitest'
import { isActive, isCapturing, type DictationPhase } from './phase'

const PHASES: DictationPhase[] = [
  { status: 'idle' },
  { status: 'listening', seconds: 1, silentMs: 0, pending: 0 },
  { status: 'preparing', seconds: 1, silentMs: 0, pending: 0, engine: { status: 'loading' } },
  { status: 'finalizing', pending: 1 },
  { status: 'error', kind: 'denied' }
]

describe('isCapturing', () => {
  // The microphone-open question decides teardown (VP-R4.6), so it is answered
  // in one place rather than re-derived at each call site.
  it('is true exactly while the microphone is open', () => {
    expect(PHASES.map(isCapturing)).toEqual([false, true, true, false, false])
  })
})

describe('isActive', () => {
  it('is true for every phase but idle — it drives the composer accent ring', () => {
    expect(PHASES.map(isActive)).toEqual([false, true, true, true, true])
  })
})
