import type { AttachmentEntry } from './useAttachments'

/**
 * The composer's unsent draft: what is typed and what is attached, together.
 *
 * ## The defect this closes
 *
 * Attachments and the typed text lived on the *pane*, not on the conversation.
 * Attach a file to one conversation, don't send, open another — and the file
 * was still clipped to the composer, now pointed at a conversation it had
 * nothing to do with. One wrong Enter and private context went to the wrong
 * session. The typed text leaked the same way, for the same reason.
 *
 * ## The model
 *
 * A draft belongs to the conversation it was written for, exactly as the send
 * queue does (`messageQueue.ts`). Leaving a conversation *parks* the draft
 * under its id; entering one takes back whatever it had parked. Nothing is
 * discarded, and nothing travels: the composer a user comes back to is the one
 * they left.
 *
 * A conversation that has not been persisted yet has no id to park under
 * (`key === null`), so its draft goes with it — the same rule the queue
 * follows, and the only one available: there is no handle to bring it back by.
 *
 * Pure and DOM-free; `Chat` owns the store and the state it restores into.
 */
export interface ComposerDraft {
  text: string
  attachments: readonly AttachmentEntry[]
}

export type DraftStore = Map<string, ComposerDraft>

export const EMPTY_DRAFT: ComposerDraft = { text: '', attachments: [] }

/** Nothing worth keeping: blank text (whitespace included) and no files. */
export function isEmptyDraft(draft: ComposerDraft): boolean {
  return draft.text.trim() === '' && draft.attachments.length === 0
}

/**
 * Stores `draft` under the conversation being left. An empty draft *clears*
 * the slot rather than filling it with nothing — otherwise a conversation
 * whose draft was sent would keep resurrecting an empty one, and the restore
 * signal would fire on a conversation with nothing to restore.
 */
export function parkDraft(store: DraftStore, key: string | null, draft: ComposerDraft): void {
  if (key === null) return
  if (isEmptyDraft(draft)) {
    store.delete(key)
    return
  }
  store.set(key, { text: draft.text, attachments: [...draft.attachments] })
}

/**
 * Hands back the conversation's parked draft and releases the slot — the
 * composer owns it again, so a second copy in the store could only go stale.
 * Returns `EMPTY_DRAFT` for a conversation that parked nothing, which is also
 * the answer for a fresh conversation (`key === null`).
 */
export function takeDraft(store: DraftStore, key: string | null): ComposerDraft {
  if (key === null) return EMPTY_DRAFT
  const parked = store.get(key)
  if (!parked) return EMPTY_DRAFT
  store.delete(key)
  return parked
}

/**
 * Drops a conversation's parked draft outright — for a conversation that no
 * longer exists (deleted from history), whose draft can never be reached again.
 */
export function forgetDraft(store: DraftStore, key: string): void {
  store.delete(key)
}
