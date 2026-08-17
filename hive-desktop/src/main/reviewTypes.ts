import type { GitDiff } from './gitParse'

/**
 * The plain data types for Agent Change Review, split out of `reviewService.ts`
 * so the preload bridge and its `.d.ts` can import them **without** dragging the
 * service's runtime deps (`checkpointService`, `fs`) into the renderer's
 * composite typecheck — mirroring how `gitParse.ts` holds the git types apart
 * from `gitService.ts`. `reviewService.ts` re-exports these so existing
 * consumers import them from one place.
 */

/** One turn that ran while the set was pending — annotates the in-chat change card (ACR-R2.2). */
export interface TurnMark {
  turnId: string
  /** Epoch ms when the turn started. */
  at: number
  /** Paths the turn touched (best-effort from the adapter's tool_use, ACR-C7; empty is fine). */
  paths: string[]
  /**
   * The stored conversation (session-history id) this turn was asked from — the
   * chat card belongs to *that* transcript and nowhere else.
   *
   * The pending set is per **workspace** (files on disk are shared by every
   * conversation), but a turn is per **conversation**. Without this the chat
   * rendered every workspace turn's card in whatever conversation happened to
   * be open, so a review asked for in one conversation showed up — pending,
   * actionable, unexplained — in the next one.
   *
   * Undefined means "not attributable to a conversation": a turn started before
   * its conversation existed on disk (backfilled by `attachTurn` as soon as the
   * id is created) or one driven by something other than the chat pane. Such a
   * turn is still in the pending set, still in the review bar and panel; it just
   * has no transcript to hang a card in.
   */
  conversationId?: string
}

/** One pending change, as the renderer consumes it (design.md §3). */
export interface ReviewChange {
  /** Workspace-relative POSIX path. */
  path: string
  status: 'created' | 'modified' | 'deleted'
  /** Parsed pre-turn→now diff (hunks / binary / tooLarge), from `gitParse`. */
  diff: GitDiff
  /** Added / deleted line counts (for the +/- pills). */
  adds: number
  dels: number
  /** ACR-R3.2 — the user edited this file by hand after the last recompute. */
  staleUserEdit?: boolean
  /**
   * R-08 — this change first appeared while NO agent turn was in flight, so
   * the agent cannot have written it. Shown, but never reverted automatically:
   * a reject targeting it is refused rather than silently destroying the
   * user's own work. See `reviewService.ts` for why the turn window is the
   * signal and `TurnMark.paths` is not.
   */
  userAuthored?: boolean
}

/** The renderer-facing snapshot of the set (what `review:get`/`review:changed` ship). */
export interface ReviewSnapshot {
  changes: ReviewChange[]
  turns: TurnMark[]
}

/** The result of a decision op. `stale` short-circuits a clobber into a UI choice (ACR-R3.2). */
export interface ReviewResult {
  ok: boolean
  /** Set when a concurrent hand-edit was detected — the UI turns this into keep-mine/take-agent/cancel. */
  stale?: boolean
  /**
   * R-08 — the reject was refused because the target is the user's own change
   * (`ReviewChange.userAuthored`), not the agent's. Refusing is deliberate:
   * the change is not the agent's to throw away.
   */
  unattributed?: boolean
  /** R-08 — `rejectAll` only: how many user-authored changes it deliberately left alone. */
  skipped?: number
}
