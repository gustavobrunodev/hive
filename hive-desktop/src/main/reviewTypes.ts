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
}
