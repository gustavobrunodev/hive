import { describe, expect, it } from 'vitest'
import {
  BAND_FULL_MIN,
  BAND_INSPECTOR_MIN,
  FOCUS_PROMOTION_MAX,
  bandFor,
  stageLayoutFor
} from './stageBands'
import { resetFocusHint, takeFocusHint } from './focusHint'

/** design-studio T4.8 / §3.8 — the fold order, at its exact boundaries. */
describe('bandFor', () => {
  it('is full at the threshold and above', () => {
    expect(bandFor(BAND_FULL_MIN)).toBe('full')
    expect(bandFor(1920)).toBe('full')
  })

  it('drops the Inspetor one pixel below the full threshold', () => {
    expect(bandFor(BAND_FULL_MIN - 1)).toBe('inspectorDrawer')
    expect(bandFor(BAND_INSPECTOR_MIN)).toBe('inspectorDrawer')
  })

  it('goes compact one pixel below the Inspetor threshold', () => {
    expect(bandFor(BAND_INSPECTOR_MIN - 1)).toBe('compact')
    expect(bandFor(320)).toBe('compact')
  })

  it('treats an unmeasured stage as full rather than folding on a guess', () => {
    expect(bandFor(0)).toBe('full')
  })
})

describe('stageLayoutFor — nothing is ever merely gone', () => {
  it('gives every folded surface a drawer, in every band', () => {
    for (const width of [1400, 950, 700, 400]) {
      const layout = stageLayoutFor(width)
      expect(layout.inspectorColumn || layout.inspectorDrawer).toBe(true)
      // The Árvore has either its column (inside the left one) or a drawer.
      expect(layout.leftColumn || layout.treeDrawer).toBe(true)
    }
  })

  it('never offers a surface as both a column and a drawer', () => {
    for (const width of [1400, 950, 700]) {
      const layout = stageLayoutFor(width)
      expect(layout.inspectorColumn && layout.inspectorDrawer).toBe(false)
      expect(layout.leftColumn && layout.treeDrawer).toBe(false)
    }
  })

  it('folds the Inspetor before the Árvore — consulted per selection, not per navigation', () => {
    const medium = stageLayoutFor(950)
    expect(medium.inspectorColumn).toBe(false)
    expect(medium.leftColumn).toBe(true)
  })

  it('promotes Focus Mode only below its own threshold, never on an unmeasured stage', () => {
    expect(stageLayoutFor(FOCUS_PROMOTION_MAX - 1).promoteFocusMode).toBe(true)
    expect(stageLayoutFor(FOCUS_PROMOTION_MAX).promoteFocusMode).toBe(false)
    expect(stageLayoutFor(0).promoteFocusMode).toBe(false)
  })
})

describe('the Focus Mode hint is an offer, not a nag', () => {
  it('is available exactly once per app session', () => {
    resetFocusHint()
    expect(takeFocusHint()).toBe(true)
    expect(takeFocusHint()).toBe(false)
    resetFocusHint()
    expect(takeFocusHint()).toBe(true)
  })
})
