import { describe, expect, it } from 'vitest'
import {
  EMPTY_SESSION,
  canRedo,
  canUndo,
  isEdited,
  pushStep,
  redoStep,
  sessionFor,
  undoStep,
  withSession
} from './screenSessions'

/**
 * design-studio T4.4/T4.7 — the per-Tela undo cursor the toolbar reads and the
 * Tela switch has to carry (DS-R9, DS-R4 AC-2/3).
 */
describe('screenSessions — availability', () => {
  it('a Tela nobody has touched can neither undo nor redo', () => {
    expect(canUndo(EMPTY_SESSION)).toBe(false)
    expect(canRedo(EMPTY_SESSION)).toBe(false)
    expect(isEdited(EMPTY_SESSION)).toBe(false)
  })

  it('one step makes undo available and redo not', () => {
    const session = pushStep(EMPTY_SESSION, 'g1')
    expect(canUndo(session)).toBe(true)
    expect(canRedo(session)).toBe(false)
    expect(isEdited(session)).toBe(true)
  })

  it('undoing makes redo available without losing the step', () => {
    const session = undoStep(pushStep(EMPTY_SESSION, 'g1'))
    expect(canUndo(session)).toBe(false)
    expect(canRedo(session)).toBe(true)
    expect(session.steps).toEqual(['g1'])
  })

  it('redo walks the cursor forward exactly one step (DS-R9 AC-7)', () => {
    const session = redoStep(undoStep(pushStep(pushStep(EMPTY_SESSION, 'g1'), 'g2')))
    expect(session.cursor).toBe(2)
  })

  it('a Tela undone back to the origin is still an edited Tela (DS-R4 AC-3)', () => {
    // The mark says "you worked here", not "the document differs" — undoing
    // to the start does not put the user back before they arrived.
    expect(isEdited(undoStep(pushStep(EMPTY_SESSION, 'g1')))).toBe(true)
  })

  it('undo at the origin and redo at the tip are no-ops, not underflows', () => {
    expect(undoStep(EMPTY_SESSION)).toBe(EMPTY_SESSION)
    const tip = pushStep(EMPTY_SESSION, 'g1')
    expect(redoStep(tip)).toBe(tip)
  })

  it('a new step with the cursor mid-log truncates the redo branch (DS-R9 AC-8)', () => {
    const undone = undoStep(pushStep(pushStep(EMPTY_SESSION, 'g1'), 'g2'))
    const next = pushStep(undone, 'g3')

    expect(next.steps).toEqual(['g1', 'g3'])
    expect(canRedo(next)).toBe(false)
  })
})

describe('screenSessions — one Tela never touches another (DS-R4 AC-2)', () => {
  it('reads the empty session for a Tela that has none yet, and for no Tela at all', () => {
    expect(sessionFor({}, 'login')).toBe(EMPTY_SESSION)
    expect(sessionFor({}, null)).toBe(EMPTY_SESSION)
  })

  it('updating one Tela leaves every other Tela byte-for-byte as it was', () => {
    const withA = withSession({}, 'a', (session) => pushStep(session, 'g1'))
    const withBoth = withSession(withA, 'b', (session) => pushStep(session, 'g2'))

    expect(withBoth.a).toBe(withA.a)
    expect(withBoth.a.steps).toEqual(['g1'])
    expect(withBoth.b.steps).toEqual(['g2'])
  })
})
