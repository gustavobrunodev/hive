import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEWPORT,
  MAX_VIEWPORT,
  MIN_VIEWPORT,
  VIEWPORT_PRESETS,
  VIEWPORT_PRESET_ORDER,
  clampViewport,
  customViewport,
  viewportForPreset
} from './viewport'

/** design-studio T4.4 / DS-R3 — the device the stage claims to be. */
describe('viewport presets', () => {
  it('carries the real device sizes, which is what makes the Preview honest (D-DS-7)', () => {
    expect(VIEWPORT_PRESETS.mobile).toEqual({ width: 390, height: 844 })
    expect(VIEWPORT_PRESETS.tablet).toEqual({ width: 834, height: 1112 })
    expect(VIEWPORT_PRESETS.desktop).toEqual({ width: 1440, height: 900 })
  })

  it('orders the segments smallest first', () => {
    expect(VIEWPORT_PRESET_ORDER).toEqual(['mobile', 'tablet', 'desktop'])
  })

  it('opens on Desktop', () => {
    expect(DEFAULT_VIEWPORT).toEqual({ presetId: 'desktop', width: 1440, height: 900 })
  })

  it('resolves a preset to its size, tagged with the preset it came from', () => {
    expect(viewportForPreset('mobile')).toEqual({ presetId: 'mobile', width: 390, height: 844 })
  })
})

describe('custom viewport (DS-R3)', () => {
  it('drops the preset tag even when the typed size matches a preset exactly', () => {
    expect(customViewport({ width: 1440, height: 900 })).toEqual({
      presetId: null,
      width: 1440,
      height: 900
    })
  })

  it('clamps a size that would make the stage unreadable', () => {
    expect(customViewport({ width: 10, height: 99999 })).toEqual({
      presetId: null,
      width: MIN_VIEWPORT,
      height: MAX_VIEWPORT
    })
  })

  it('rounds a fractional size to a whole pixel', () => {
    expect(clampViewport(390.6)).toBe(391)
  })
})
