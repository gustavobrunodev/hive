import type { ReviewChange, TurnMark } from './reviewTypes'

/**
 * Who a pending review belongs to.
 *
 * The pending set is per **workspace** — the agent's bytes are on disk and
 * every conversation shares that disk. A *turn*, though, is per conversation:
 * someone asked for it, in one transcript, and that transcript is where its
 * change card belongs. The chat used to render every workspace turn's card in
 * whatever conversation happened to be open, so a review requested in one
 * conversation appeared — pending, actionable, with no explanation of where it
 * came from — at the bottom of the next one.
 *
 * These two derivations put each card back where it was asked for, and tell the
 * history list which *other* conversations are still holding something, so
 * scoping the card never turns into hiding it.
 */

/**
 * The turns whose change cards belong in `conversationId`'s transcript.
 *
 * A pane showing a conversation that isn't persisted yet (`null`) matches the
 * turns that carry no conversation: its own first turn, sent in the moment
 * before the conversation's id exists.
 *
 * `localOwners` (turnId → conversation, or `null` for "sent before this
 * conversation existed") is the sending pane's own record, and it wins nothing
 * — it only answers for turns main hasn't attributed yet. Main's mark is
 * durable and survives the pane; this map covers the round trip between a
 * conversation being created and `attachTurn` landing, so a card can't blink
 * out of the transcript that is watching it appear.
 */
export function turnsInConversation(
  turns: readonly TurnMark[],
  conversationId: string | null,
  localOwners?: ReadonlyMap<string, string | null>
): TurnMark[] {
  return turns.filter(
    (turn) => (turn.conversationId ?? localOwners?.get(turn.turnId) ?? null) === conversationId
  )
}

/**
 * How many pending files each conversation is holding — the history list's
 * "there's a review waiting over here" marker.
 *
 * Counts files, not turns, and counts each file once per conversation: two
 * turns that both touched `README.md` left the user *one* thing to decide.
 * Only paths still in `changes` count — a file already accepted or rejected is
 * no longer waiting on anyone. Turns with no recorded paths (attribution is
 * best-effort, ACR-C7) contribute nothing, exactly as they contribute no card.
 */
export function pendingByConversation(
  turns: readonly TurnMark[],
  changes: readonly ReviewChange[]
): Record<string, number> {
  const pendingPaths = new Set(changes.map((change) => change.path))
  const byConversation = new Map<string, Set<string>>()
  for (const turn of turns) {
    if (turn.conversationId === undefined) continue
    for (const path of turn.paths) {
      if (!pendingPaths.has(path)) continue
      let paths = byConversation.get(turn.conversationId)
      if (!paths) {
        paths = new Set()
        byConversation.set(turn.conversationId, paths)
      }
      paths.add(path)
    }
  }
  const counts: Record<string, number> = {}
  for (const [conversationId, paths] of byConversation) counts[conversationId] = paths.size
  return counts
}
