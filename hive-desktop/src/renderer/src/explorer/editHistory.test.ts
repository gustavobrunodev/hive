import { describe, expect, it } from 'vitest'
import { EditHistory, type EditSnapshot } from './editHistory'

/** A snapshot with the caret parked at the end — what typing produces. */
function typed(value: string): EditSnapshot {
  return { value, selectionStart: value.length, selectionEnd: value.length }
}

describe('EditHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const history = new EditHistory('hello')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBeNull()
    expect(history.current.value).toBe('hello')
  })

  it('coalesces a typing run into one undo step', () => {
    const history = new EditHistory('')
    history.record(typed('h'), 1000)
    history.record(typed('he'), 1100)
    history.record(typed('hel'), 1200)

    // One Ctrl+Z takes back the word, not the last letter.
    expect(history.undo()?.value).toBe('')
    expect(history.canUndo).toBe(false)
  })

  it('breaks the run after a pause', () => {
    const history = new EditHistory('')
    history.record(typed('a'), 1000)
    history.record(typed('ab'), 1100)
    // …coffee…
    history.record(typed('abc'), 5000)

    expect(history.undo()?.value).toBe('ab')
    expect(history.undo()?.value).toBe('')
  })

  it('breaks the run when typing turns into deleting', () => {
    const history = new EditHistory('')
    history.record(typed('abc'), 1000)
    history.record(typed('ab'), 1050)

    expect(history.undo()?.value).toBe('abc')
  })

  it('breaks the run on a newline, so an undo takes back a line', () => {
    const history = new EditHistory('')
    for (const value of ['o', 'on', 'one']) history.record(typed(value), 1000)
    history.record(typed('one\n'), 1050)
    for (const value of ['one\nt', 'one\ntw', 'one\ntwo']) history.record(typed(value), 1100)

    // Enter is a boundary on both sides: the new line, then the line it closed.
    expect(history.undo()?.value).toBe('one\n')
    expect(history.undo()?.value).toBe('one')
    expect(history.undo()?.value).toBe('')
  })

  it('gives a paste its own step, however fast it lands', () => {
    const history = new EditHistory('a')
    history.record(typed('ab'), 1000)
    history.record(typed('ab' + 'x'.repeat(50)), 1010)

    expect(history.undo()?.value).toBe('ab')
  })

  it('restores the caret along with the text', () => {
    const history = new EditHistory('hello world')
    history.record({ value: 'hello brave world', selectionStart: 11, selectionEnd: 11 }, 1000)
    history.record({ value: 'hello world', selectionStart: 5, selectionEnd: 5 }, 5000)

    const back = history.undo()
    expect(back?.value).toBe('hello brave world')
    expect(back?.selectionStart).toBe(11)
  })

  it('redoes what an undo took back, until a new edit lands', () => {
    const history = new EditHistory('')
    history.record(typed('one'), 1000)
    history.record(typed('one two'), 5000)

    expect(history.undo()?.value).toBe('one')
    expect(history.redo()?.value).toBe('one two')

    history.undo()
    history.record(typed('one three'), 9000)
    // The branch that was not taken is gone.
    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBeNull()
  })

  it('does not spend an undo step on a caret move', () => {
    const history = new EditHistory('abc')
    history.record(typed('abcd'), 1000)
    history.record({ value: 'abcd', selectionStart: 0, selectionEnd: 0 }, 1200)

    expect(history.undo()?.value).toBe('abc')
    expect(history.canUndo).toBe(false)
  })

  it('reset drops the whole history for the document that replaced it', () => {
    const history = new EditHistory('old')
    history.record(typed('old edited'), 1000)
    history.reset('brand new from disk')

    expect(history.canUndo).toBe(false)
    expect(history.current.value).toBe('brand new from disk')
  })

  it('keeps the stack bounded on a long session', () => {
    const history = new EditHistory('')
    // Each of these is its own step (a second apart, so nothing coalesces).
    for (let i = 1; i <= 600; i += 1) history.record(typed('x'.repeat(i)), i * 1000)

    let depth = 0
    while (history.undo() !== null) depth += 1
    expect(depth).toBe(399)
  })
})
