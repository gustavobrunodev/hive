/**
 * Renderer-local Agent Change Review types, derived from the `window.hive.review`
 * bridge signatures (mirrors `gitStatus.ts` deriving git types from
 * `window.hive.git`). This keeps the renderer (tsconfig.web) from importing
 * `src/main/*` directly — a project-boundary violation — while staying exactly
 * in sync with the main-side `ReviewService` shapes the bridge returns.
 */

/** The pending-set snapshot (`review.get` / the `review:changed` push body). */
export type ReviewSnapshot = Awaited<ReturnType<Window['hive']['review']['get']>>

/** One pending change (path + status + diff + adds/dels + optional staleUserEdit). */
export type ReviewChange = ReviewSnapshot['changes'][number]

/** One turn mark (turnId + at + touched paths) — annotates the chat card. */
export type TurnMark = ReviewSnapshot['turns'][number]

/** A decision's result (`{ ok, stale? }`). */
export type ReviewResult = Awaited<ReturnType<Window['hive']['review']['acceptFile']>>

/** The `review:changed` push payload the `onChanged` subscriber receives. */
export type ReviewChangedEvent = Parameters<Parameters<Window['hive']['review']['onChanged']>[0]>[0]
