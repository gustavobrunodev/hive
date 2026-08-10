import { describe, expect, it } from 'vitest'
import { MIN_SCALE, STAGE_MARGIN, formatReadout, formatScale, scaleFor } from './stageScale'

/** design-studio T4.6 / D-DS-7 — the arithmetic behind an honest Preview. */
describe('scaleFor', () => {
  it('reduces a Desktop preset onto a 700px bench', () => {
    const scale = scaleFor(700, 1440)
    expect(scale).toBeLessThan(1)
    expect(scale).toBeCloseTo((700 - STAGE_MARGIN) / 1440, 10)
  })

  it('never magnifies — a mobile Tela on a wide bench stays at 1', () => {
    expect(scaleFor(1600, 390)).toBe(1)
    expect(scaleFor(4000, 390)).toBe(1)
  })

  it('fits exactly when the bench is the device plus its margin', () => {
    expect(scaleFor(1440 + STAGE_MARGIN, 1440)).toBe(1)
  })

  it('bottoms out instead of collapsing to nothing on an unusable bench', () => {
    expect(scaleFor(STAGE_MARGIN, 1440)).toBe(MIN_SCALE)
    expect(scaleFor(10, 1440)).toBe(MIN_SCALE)
  })

  it('reports 1 for a bench that has not been measured yet, rather than 4%', () => {
    expect(scaleFor(0, 1440)).toBe(1)
  })

  it('reports 1 for a device with no width, rather than dividing by zero', () => {
    expect(scaleFor(700, 0)).toBe(1)
  })
})

describe('the readout', () => {
  it('names the device size first and the reduction second (§3.3)', () => {
    expect(formatReadout(1440, 900, 0.75)).toBe('1440 × 900 · 75%')
  })

  it('says 100% at full size — the user is never left guessing whether it is reduced', () => {
    expect(formatReadout(390, 844, 1)).toBe('390 × 844 · 100%')
  })

  it('rounds to whole percents', () => {
    expect(formatScale(0.4416)).toBe('44%')
    expect(formatScale(0.995)).toBe('100%')
  })
})
