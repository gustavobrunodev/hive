import { useCallback, useEffect, useRef, useState } from 'react'
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

let queuedIdCounter = 0
function nextQueuedId(): string {
  queuedIdCounter += 1
  return `queued-${queuedIdCounter}`
}

export interface QueueController {
  queue: MessageQueue
  /** Adds a send, minting its id. Returns nothing — the strip is the feedback. */
  add: (message: Omit<QueuedMessage, 'id'>) => void
  remove: (id: string) => void
  clear: () => void
  resume: () => void
  /**
   * Called when a turn reaches a terminal event: releases the head on a clean
   * finish, holds everything on a stop or a failure. The dispatcher is the
   * caller's — this hook owns the list, never the sending.
   */
  settle: (outcome: 'done' | 'interrupted' | 'error') => void
  /**
   * The pane moved to another conversation: park the current list under the
   * one being left and swap in whatever the one being entered had parked.
   */
  switchConversation: (from: string | null, to: string | null) => void
}

/**
 * Owns the composer's pending sends and decides when the next one goes out
 * (`messageQueue.ts` holds the rules; this holds the state and the dispatch
 * callback).
 *
 * `dispatch` is read through a ref rather than captured, because it closes
 * over the conversation's current resume handle, agent and model — all of
 * which change while messages sit in the queue. A stale closure here would
 * send the queued follow-up into the wrong conversation, which is the worst
 * failure this feature could have.
 *
 * ## A queue belongs to its conversation
 *
 * Switching the pane parks the list rather than dropping it: the messages were
 * written for *that* transcript, and discarding them because the user glanced
 * at another conversation is silent data loss. A parked list comes back
 * **held** — its turn may well have finished while it was away, so there is no
 * settle event coming to release it and one press should be all it takes.
 */
export function useMessageQueue(dispatch: (message: QueuedMessage) => void): QueueController {
  const [queue, setQueue] = useState<MessageQueue>(EMPTY_QUEUE)
  const dispatchRef = useRef(dispatch)
  const parked = useRef(new Map<string, MessageQueue>())
  useEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  const add = useCallback((message: Omit<QueuedMessage, 'id'>) => {
    setQueue((current) => enqueue(current, { ...message, id: nextQueuedId() }))
  }, [])

  const remove = useCallback((id: string) => {
    setQueue((current) => removeQueued(current, id))
  }, [])

  const clear = useCallback(() => setQueue(clearQueue), [])

  const settle = useCallback((outcome: 'done' | 'interrupted' | 'error') => {
    setQueue((current) => {
      const { queue: next, dispatch: head } = onTurnSettled(current, outcome)
      // Deferred out of the state updater: dispatching starts a turn, which
      // sets state of its own, and React forbids that during a reducer.
      if (head) queueMicrotask(() => dispatchRef.current(head))
      return next
    })
  }, [])

  // Resuming a held queue is itself a release: the user has now said "keep
  // going", and waiting for a *next* turn to settle would strand the queue
  // behind a conversation that has nothing running.
  const resume = useCallback(() => {
    setQueue((current) => {
      const lifted = resumeQueue(current)
      const { queue: next, dispatch: head } = onTurnSettled(lifted, 'done')
      if (head) queueMicrotask(() => dispatchRef.current(head))
      return next
    })
  }, [])

  const switchConversation = useCallback((from: string | null, to: string | null) => {
    setQueue((current) => {
      if (from !== null && current.items.length > 0) {
        parked.current.set(from, { ...current, held: true })
      } else if (from !== null) {
        parked.current.delete(from)
      }
      if (to === null) return EMPTY_QUEUE
      return parked.current.get(to) ?? EMPTY_QUEUE
    })
  }, [])

  return { queue, add, remove, clear, resume, settle, switchConversation }
}
