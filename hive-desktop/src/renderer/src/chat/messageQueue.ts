/**
 * The composer's send queue.
 *
 * ## The defect this closes
 *
 * While a turn was running, the composer's primary control became a Stop
 * button and Enter did nothing. So the natural thing — reading the reply as it
 * streams, thinking of the follow-up, typing it — had no landing place: you
 * held the thought, or you interrupted work you wanted to keep. Every coding
 * agent worth using lets you keep typing; the message simply waits its turn.
 *
 * ## The model
 *
 * A conversation owns an ordered list of pending sends and one `held` flag.
 * When the running turn settles cleanly, the head is dispatched and becomes a
 * real turn. When the turn is *stopped by the user* or *fails*, the queue is
 * **held** instead: firing three more messages into a session someone just
 * interrupted — or into one that is erroring — is the opposite of what the
 * stop meant. Nothing is discarded; the strip says it is holding and offers
 * one control to resume.
 *
 * Pure and DOM-free; presentation lives in `QueuedMessages.tsx`.
 */

/** Structural mirror of `main/agentAdapter.ts`'s `WorkflowCommand`. */
export interface QueuedWorkflow {
  key: string
  prompt?: string
}

/**
 * One send the user committed to while the agent was busy. It carries
 * everything the eventual dispatch needs, because the composer's state (its
 * attachments, its `#` references) is gone by the time the queue drains.
 */
export interface QueuedMessage {
  id: string
  /** What the transcript will show — the typed text, or the slash command. */
  text: string
  /** A `/skill` pick queues as the workflow it invokes, not as prose. */
  workflow?: QueuedWorkflow
  /** Resolved context paths travelling with the send (absolute or workspace-relative). */
  contextFiles?: string[]
  /** Display names for the bubble's attachment chips. */
  attachmentNames?: string[]
}

export interface MessageQueue {
  items: QueuedMessage[]
  /**
   * The queue is waiting on the user rather than on the agent — set when a
   * turn was interrupted or errored while messages were still pending.
   */
  held: boolean
}

export const EMPTY_QUEUE: MessageQueue = { items: [], held: false }

/** Appends a send. Enqueuing always un-holds: the user just told us to keep going. */
export function enqueue(queue: MessageQueue, message: QueuedMessage): MessageQueue {
  return { items: [...queue.items, message], held: false }
}

/** Drops one pending send by id. Emptying the queue also clears the hold — there is nothing left to hold. */
export function removeQueued(queue: MessageQueue, id: string): MessageQueue {
  const items = queue.items.filter((item) => item.id !== id)
  if (items.length === queue.items.length) return queue
  return { items, held: items.length === 0 ? false : queue.held }
}

export function clearQueue(queue: MessageQueue): MessageQueue {
  return queue.items.length === 0 && !queue.held ? queue : EMPTY_QUEUE
}

/** Lifts a hold so the next settle dispatches again. */
export function resumeQueue(queue: MessageQueue): MessageQueue {
  return queue.held ? { ...queue, held: false } : queue
}

/**
 * What a settled turn does to the queue.
 *
 * A clean finish releases the head; a user stop or a failure holds everything
 * where it is. Returns the message to dispatch (or `null`) alongside the next
 * queue, so the caller never has to re-derive which of the two happened.
 */
export function onTurnSettled(
  queue: MessageQueue,
  outcome: 'done' | 'interrupted' | 'error'
): { queue: MessageQueue; dispatch: QueuedMessage | null } {
  if (queue.items.length === 0) return { queue, dispatch: null }
  if (outcome !== 'done') return { queue: { ...queue, held: true }, dispatch: null }
  if (queue.held) return { queue, dispatch: null }
  const [head, ...rest] = queue.items
  return { queue: { items: rest, held: false }, dispatch: head }
}
