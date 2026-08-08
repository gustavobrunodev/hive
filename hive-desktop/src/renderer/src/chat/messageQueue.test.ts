import { describe, expect, it } from 'vitest'
import {
  EMPTY_QUEUE,
  clearQueue,
  enqueue,
  onTurnSettled,
  removeQueued,
  resumeQueue,
  type MessageQueue,
  type QueuedMessage
} from './messageQueue'

function message(id: string, text = id): QueuedMessage {
  return { id, text }
}

const two: MessageQueue = { items: [message('a'), message('b')], held: false }

describe('enqueue', () => {
  it('appends in order', () => {
    const queue = enqueue(enqueue(EMPTY_QUEUE, message('a')), message('b'))
    expect(queue.items.map((item) => item.id)).toEqual(['a', 'b'])
  })

  // Adding is itself an instruction to keep going — it would be absurd for a
  // message the user just committed to land in a list marked "paused".
  it('lifts a hold', () => {
    expect(enqueue({ ...two, held: true }, message('c')).held).toBe(false)
  })
})

describe('removeQueued', () => {
  it('drops one by id and returns the same reference for an unknown one', () => {
    expect(removeQueued(two, 'a').items.map((item) => item.id)).toEqual(['b'])
    expect(removeQueued(two, 'zzz')).toBe(two)
  })

  it('emptying the queue also clears the hold — there is nothing left to hold', () => {
    const held: MessageQueue = { items: [message('a')], held: true }
    expect(removeQueued(held, 'a')).toEqual(EMPTY_QUEUE)
  })

  it('keeps the hold while messages remain', () => {
    expect(removeQueued({ ...two, held: true }, 'a').held).toBe(true)
  })
})

describe('clearQueue', () => {
  it('empties, and no-ops on an already empty queue', () => {
    expect(clearQueue(two)).toEqual(EMPTY_QUEUE)
    expect(clearQueue(EMPTY_QUEUE)).toBe(EMPTY_QUEUE)
  })
})

describe('onTurnSettled', () => {
  it('a clean finish releases exactly the head', () => {
    const { queue, dispatch } = onTurnSettled(two, 'done')
    expect(dispatch?.id).toBe('a')
    expect(queue.items.map((item) => item.id)).toEqual(['b'])
    expect(queue.held).toBe(false)
  })

  // The whole point of the hold: firing three more messages into a session the
  // user just interrupted is the opposite of what pressing Stop meant.
  it('a user stop holds everything where it is, dispatching nothing', () => {
    const { queue, dispatch } = onTurnSettled(two, 'interrupted')
    expect(dispatch).toBeNull()
    expect(queue.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(queue.held).toBe(true)
  })

  it('a failure holds too — nothing drains into a session that is erroring', () => {
    expect(onTurnSettled(two, 'error').queue.held).toBe(true)
  })

  it('a held queue stays put even when the next turn finishes cleanly', () => {
    const { queue, dispatch } = onTurnSettled({ ...two, held: true }, 'done')
    expect(dispatch).toBeNull()
    expect(queue.items).toHaveLength(2)
  })

  it('an empty queue is a no-op on every outcome', () => {
    for (const outcome of ['done', 'interrupted', 'error'] as const) {
      const { queue, dispatch } = onTurnSettled(EMPTY_QUEUE, outcome)
      expect(dispatch).toBeNull()
      expect(queue).toBe(EMPTY_QUEUE)
    }
  })
})

describe('resumeQueue', () => {
  it('lifts the hold, and no-ops when there is none', () => {
    expect(resumeQueue({ ...two, held: true }).held).toBe(false)
    expect(resumeQueue(two)).toBe(two)
  })
})
