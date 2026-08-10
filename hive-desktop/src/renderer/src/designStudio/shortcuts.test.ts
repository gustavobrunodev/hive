import { describe, expect, it } from 'vitest'
import { historyShortcutFor, type HistoryKey } from './shortcuts'

/** design-studio T5.7 (DS-R9). Which keystroke is a history move, and which is not. */

function key(overrides: Partial<HistoryKey>): HistoryKey {
  return { key: 'z', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...overrides }
}

describe('historyShortcutFor', () => {
  it('reads Ctrl+Z as undo', () => {
    expect(historyShortcutFor(key({ ctrlKey: true }))).toBe('undo')
  })

  it('reads Cmd+Z as undo too, for the same hands on a Mac', () => {
    expect(historyShortcutFor(key({ metaKey: true }))).toBe('undo')
  })

  it('reads Ctrl+Shift+Z as redo', () => {
    expect(historyShortcutFor(key({ ctrlKey: true, shiftKey: true }))).toBe('redo')
  })

  it('reads the capital Z the Shift produces, not only the lowercase one', () => {
    expect(historyShortcutFor(key({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBe('redo')
  })

  it('ignores a bare Z, which is just typing', () => {
    expect(historyShortcutFor(key({}))).toBeNull()
  })

  it('ignores Alt+Ctrl+Z, which is a different keystroke altogether', () => {
    expect(historyShortcutFor(key({ ctrlKey: true, altKey: true }))).toBeNull()
  })

  it('ignores every other letter under the same modifier', () => {
    expect(historyShortcutFor(key({ key: 'y', ctrlKey: true }))).toBeNull()
    expect(historyShortcutFor(key({ key: 'p', ctrlKey: true }))).toBeNull()
  })
})
