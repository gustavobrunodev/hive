import { describe, expect, it } from 'vitest'
import { isSilent, levelToBar, pushLevel, rms, WAVE_BARS } from './waveform'

/** `n` samples of a full-scale sine — the shape real audio actually has. */
function sine(n: number, amplitude: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * i) / 32)
  return out
}

describe('rms', () => {
  it('is zero for digital silence', () => {
    expect(rms(new Float32Array(128))).toBe(0)
  })

  it('is the amplitude over root-two for a sine', () => {
    expect(rms(sine(320, 1))).toBeCloseTo(1 / Math.SQRT2, 2)
  })

  it('rises with level', () => {
    expect(rms(sine(320, 0.8))).toBeGreaterThan(rms(sine(320, 0.2)))
  })

  it('is unaffected by sign — a negative half-cycle is still sound', () => {
    expect(rms(new Float32Array([-0.5, -0.5]))).toBeCloseTo(0.5, 5)
  })

  it('handles an empty buffer rather than dividing by zero', () => {
    expect(rms(new Float32Array(0))).toBe(0)
  })
})

describe('levelToBar', () => {
  it('keeps a visible sliver at silence, so the meter never looks switched off', () => {
    expect(levelToBar(0)).toBeGreaterThan(0)
    expect(levelToBar(0)).toBeLessThan(0.1)
  })

  it('never overflows the track', () => {
    expect(levelToBar(1)).toBeLessThanOrEqual(1)
    expect(levelToBar(99)).toBeLessThanOrEqual(1)
  })

  it('lifts conversational level clear of the floor — the point of the curve', () => {
    // A linear meter would put this at ~5% of the track and read as dead.
    expect(levelToBar(0.05)).toBeGreaterThan(0.3)
  })

  it('is monotonic', () => {
    expect(levelToBar(0.3)).toBeGreaterThan(levelToBar(0.1))
  })
})

describe('pushLevel', () => {
  it('appends while there is room', () => {
    expect(pushLevel([0.1], 0.2, 4)).toEqual([0.1, 0.2])
  })

  it('drops the oldest sample once full, so the meter scrolls', () => {
    expect(pushLevel([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })

  it('defaults to the bar count the canvas draws', () => {
    const full = Array.from({ length: WAVE_BARS }, () => 0.5)
    expect(pushLevel(full, 0.9)).toHaveLength(WAVE_BARS)
  })

  it('does not mutate the history it was given', () => {
    const history = [0.1, 0.2]
    pushLevel(history, 0.3, 2)
    expect(history).toEqual([0.1, 0.2])
  })
})

describe('isSilent', () => {
  it('stays quiet until it has a full window — a take should not flash a warning', () => {
    expect(isSilent([0, 0, 0], 24)).toBe(false)
  })

  it('reports silence once the window is entirely below the floor', () => {
    expect(
      isSilent(
        Array.from({ length: 24 }, () => 0),
        24
      )
    ).toBe(true)
  })

  it('does not report silence when any recent frame carried signal', () => {
    const history = Array.from({ length: 24 }, () => 0)
    history[20] = 0.4
    expect(isSilent(history, 24)).toBe(false)
  })

  it('looks only at the recent window, not the whole take', () => {
    // Loud at the start, silent since: the microphone has dropped out.
    const history = [
      ...Array.from({ length: 10 }, () => 0.5),
      ...Array.from({ length: 24 }, () => 0)
    ]
    expect(isSilent(history, 24)).toBe(true)
  })

  it('treats microphone self-noise as silence, not as signal', () => {
    expect(
      isSilent(
        Array.from({ length: 24 }, () => 0.001),
        24
      )
    ).toBe(true)
  })
})
