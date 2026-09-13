import { describe, expect, it } from 'vitest'
import { allSelected, extend, setAll, toggle, visible } from './conversationSelection'

/**
 * The conversation list's multi-select, as pure functions.
 *
 * Every rule here is one a screenshot cannot check and a user notices
 * immediately: a tick that outlives the row it was put on, a Shift-click that
 * silently drops what was already picked, a "select all" that reaches rows the
 * search box is hiding.
 */
const ROWS = ['a', 'b', 'c', 'd']

describe('conversationSelection — what is ticked', () => {
  it('reads ticks through the rows on screen, in the order they are shown', () => {
    expect(visible(new Set(['c', 'a']), ROWS)).toEqual(['a', 'c'])
  })

  /**
   * The list is filtered by a window, an order and a search box, and all three
   * move under a selection. A tick that survived its row disappearing would be
   * a conversation the next "Excluir 3" deletes without ever having shown it.
   */
  it('drops ticks whose rows are no longer on screen', () => {
    const ticked = new Set(['a', 'zzz'])
    expect(visible(ticked, ROWS)).toEqual(['a'])
    expect(visible(ticked, [])).toEqual([])
  })

  it('knows when every visible row is ticked — and that an empty list is not "all"', () => {
    expect(allSelected(new Set(ROWS), ROWS)).toBe(true)
    expect(allSelected(new Set(['a', 'b']), ROWS)).toBe(false)
    expect(allSelected(new Set(), [])).toBe(false)
    // Ticks outside the visible rows do not count towards "all".
    expect(allSelected(new Set(['a', 'b', 'c', 'zzz']), ROWS)).toBe(false)
  })
})

describe('conversationSelection — changing it', () => {
  it('toggles one row on and off, and never mutates the set it was given', () => {
    const before = new Set(['a'])
    const on = toggle(before, 'b')
    expect([...on]).toEqual(['a', 'b'])
    expect([...before]).toEqual(['a'])
    expect([...toggle(on, 'a')]).toEqual(['b'])
  })

  it('extends from the anchor through the visible order, in either direction', () => {
    expect([...extend(new Set(['b']), ROWS, 'b', 'd')]).toEqual(['b', 'c', 'd'])
    expect([...extend(new Set(['d']), ROWS, 'd', 'b')]).toEqual(['d', 'b', 'c'])
  })

  /**
   * "Tick three here, shift-click three more there" is the gesture the whole
   * feature exists for; a range that cleared everything outside itself would
   * make it impossible.
   */
  it('adds a range instead of replacing what was already ticked', () => {
    expect([...extend(new Set(['a']), ROWS, 'c', 'd')].sort()).toEqual(['a', 'c', 'd'])
  })

  it('degrades to a plain toggle when either end is not on screen', () => {
    // No anchor yet — the first Shift-click of a session.
    expect([...extend(new Set(), ROWS, null, 'c')]).toEqual(['c'])
    // The anchor scrolled out of the filter.
    expect([...extend(new Set(['a']), ROWS, 'zzz', 'c')].sort()).toEqual(['a', 'c'])
    // The target itself is not visible — nothing to range to.
    expect([...extend(new Set(['a']), ROWS, 'a', 'zzz')].sort()).toEqual(['a', 'zzz'])
  })

  it('ticks or clears every visible row, leaving ticks outside the view alone', () => {
    const kept = new Set(['offscreen'])
    expect([...setAll(kept, ROWS, true)].sort()).toEqual(['a', 'b', 'c', 'd', 'offscreen'])
    expect([...setAll(new Set([...ROWS, 'offscreen']), ROWS, false)]).toEqual(['offscreen'])
  })
})
