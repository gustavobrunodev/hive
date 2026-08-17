import { describe, expect, it } from 'vitest'
import { pendingByConversation, turnsInConversation } from './reviewScope'
import type { ReviewChange, TurnMark } from './reviewTypes'

/**
 * Who a pending review belongs to. The regression these two guard: the chat
 * used to render every workspace turn's change card in whatever conversation
 * was open, so a review asked for in conversation A appeared at the bottom of
 * conversation B.
 */

function turn(turnId: string, paths: string[], conversationId?: string): TurnMark {
  const mark: TurnMark = { turnId, at: 1, paths }
  if (conversationId !== undefined) mark.conversationId = conversationId
  return mark
}

function change(path: string): ReviewChange {
  return { path, status: 'modified', diff: { hunks: [], binary: false }, adds: 1, dels: 0 }
}

describe('turnsInConversation', () => {
  const turns = [
    turn('t1', ['a.md'], 'conv-a'),
    turn('t2', ['b.md'], 'conv-b'),
    turn('t3', ['c.md'], 'conv-a'),
    turn('t4', ['d.md'])
  ]

  it('keeps only the turns asked from that conversation', () => {
    expect(turnsInConversation(turns, 'conv-a').map((t) => t.turnId)).toEqual(['t1', 't3'])
  })

  it('never leaks another conversation’s turn into this transcript', () => {
    expect(turnsInConversation(turns, 'conv-b').map((t) => t.turnId)).toEqual(['t2'])
  })

  it('matches unattributed turns to a conversation that is not persisted yet', () => {
    // The pane's own first turn, in the moment before its conversation exists.
    expect(turnsInConversation(turns, null).map((t) => t.turnId)).toEqual(['t4'])
  })

  it('shows nothing for a conversation that ran no turns', () => {
    expect(turnsInConversation(turns, 'conv-z')).toEqual([])
  })

  it('falls back to the sending pane’s own record while a turn is unattributed', () => {
    // `attachTurn` hasn't made the round trip yet: without this the card would
    // blink out of the very transcript that watched it appear.
    const local = new Map([['t4', 'conv-a']])
    expect(turnsInConversation(turns, 'conv-a', local).map((t) => t.turnId)).toEqual([
      't1',
      't3',
      't4'
    ])
    expect(turnsInConversation(turns, null, local)).toEqual([])
  })

  it('lets the durable mark from main win over the pane’s record', () => {
    const local = new Map([['t2', 'conv-a']])
    expect(turnsInConversation(turns, 'conv-a', local).map((t) => t.turnId)).toEqual(['t1', 't3'])
  })

  it('reads a local owner of null as “sent before this conversation existed”', () => {
    const local = new Map([['t4', null]])
    expect(turnsInConversation(turns, null, local).map((t) => t.turnId)).toEqual(['t4'])
  })
})

describe('pendingByConversation', () => {
  it('counts each conversation’s files still awaiting a decision', () => {
    const counts = pendingByConversation(
      [turn('t1', ['a.md', 'b.md'], 'conv-a'), turn('t2', ['c.md'], 'conv-b')],
      [change('a.md'), change('b.md'), change('c.md')]
    )
    expect(counts).toEqual({ 'conv-a': 2, 'conv-b': 1 })
  })

  it('counts a file touched by two turns of one conversation once', () => {
    const counts = pendingByConversation(
      [turn('t1', ['a.md'], 'conv-a'), turn('t2', ['a.md'], 'conv-a')],
      [change('a.md')]
    )
    expect(counts).toEqual({ 'conv-a': 1 })
  })

  it('drops files already accepted or rejected', () => {
    const counts = pendingByConversation(
      [turn('t1', ['a.md', 'gone.md'], 'conv-a')],
      [change('a.md')]
    )
    expect(counts).toEqual({ 'conv-a': 1 })
  })

  it('omits a conversation whose files were all reviewed', () => {
    expect(pendingByConversation([turn('t1', ['a.md'], 'conv-a')], [])).toEqual({})
  })

  it('ignores turns with no conversation and turns with no recorded paths', () => {
    const counts = pendingByConversation(
      [turn('t1', ['a.md']), turn('t2', [], 'conv-a')],
      [change('a.md')]
    )
    expect(counts).toEqual({})
  })
})
