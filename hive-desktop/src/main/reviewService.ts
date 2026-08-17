import { statSync } from 'fs'
import { join } from 'path'
import type { CheckpointService } from './checkpointService'
import { findHunk, type GitDiff } from './gitParse'
import type { ReviewChange, ReviewResult, ReviewSnapshot, TurnMark } from './reviewTypes'

// Re-export the data types so preload/renderer import them from one place
// (mirrors gitService re-exporting gitParse's types).
export type { ReviewChange, ReviewResult, ReviewSnapshot, TurnMark } from './reviewTypes'

/**
 * The single **pending review set** per workspace and the accept/reject
 * semantics over it (Agent Change Review, design.md §3, ACR-C1/C5). Optimistic
 * model: the agent already wrote to disk; reviewing means **keep** (advance the
 * baseline) or **revert** (restore the pre-turn bytes) against a `CheckpointService`
 * baseline tree.
 *
 * Invariant (ACR-C5 accumulation): `changes = diff(baseline → now)` always.
 * Accept/reject only move the baseline (accept) or the work tree (reject) — the
 * set is never hand-mutated, so no surface can drift and a re-touched file never
 * duplicates. There is exactly one live pending set per workspace; it
 * accumulates across turns until reviewed.
 *
 * `CheckpointService` is injected (composed over real git in tests); the file is
 * Electron-free and unit-tested against a throwaway workspace + store.
 */

export interface ReviewServiceDeps {
  checkpoint: CheckpointService
  /** Emits the fresh snapshot to the renderer (`review:changed` push). */
  onChanged: (workspace: string, snapshot: ReviewSnapshot) => void
  /** Injected clock (tests pin it); defaults to `Date.now`. */
  now?: () => number
}

export interface ReviewService {
  /**
   * Turn start: if the set is clean, snapshot a fresh baseline; record a turn
   * mark (ACR-R1.1). `conversationId` is the stored conversation the turn was
   * asked from — the chat renders this turn's card only there (see
   * `TurnMark.conversationId`). Omit it when the caller has no conversation
   * (or doesn't have its id yet — see `attachTurn`).
   */
  beginTurn(workspace: string, turnId: string, conversationId?: string): Promise<void>
  /**
   * Names the conversation a turn belongs to after the fact. The chat pane
   * starts a brand-new conversation's first turn *before* the conversation
   * exists on disk (its id is minted asynchronously, and waiting for it would
   * delay the agent), so that turn's mark is attributed here the moment the id
   * lands. Unknown turn ids and already-attributed marks are no-ops.
   */
  attachTurn(workspace: string, turnId: string, conversationId: string): void
  /** A file-system change during/after a turn: recompute the set + emit (debounce lives at the caller/IPC layer). */
  onFsActivity(workspace: string): Promise<void>
  /** Turn end: final recompute; attach the turn's touched `paths` to its mark (ACR-R1.2). */
  endTurn(workspace: string, turnId: string, paths: string[]): Promise<void>
  /** The current snapshot (rehydrate on mount / workspace switch). Recomputes if a baseline exists. */
  get(workspace: string): Promise<ReviewSnapshot>
  /** Keep a file's current bytes; advance the baseline for it so it leaves the set (ACR-R1.5). */
  acceptFile(workspace: string, path: string): Promise<ReviewResult>
  /** Restore a file's pre-turn bytes on disk; it leaves the set (ACR-R1.6). */
  rejectFile(workspace: string, path: string): Promise<ReviewResult>
  /**
   * The same decision over a *set* of files — one turn's worth — settled in a
   * single pass. Not a loop over `acceptFile` at the caller: that fires N
   * independent baseline advances that each recompute and emit, and the
   * intermediate snapshots race each other, which is what made "Aceitar" on a
   * change card visibly approve one file at a time.
   */
  acceptFiles(workspace: string, paths: string[]): Promise<ReviewResult>
  rejectFiles(workspace: string, paths: string[]): Promise<ReviewResult>
  /** Keep one hunk; advance the baseline for it (ACR-R3.1). */
  acceptHunk(workspace: string, path: string, hunkId: string): Promise<ReviewResult>
  /** Reverse-apply one hunk on disk; the rest of the file stays pending (ACR-R3.1). */
  rejectHunk(workspace: string, path: string, hunkId: string): Promise<ReviewResult>
  /** Keep everything: re-baseline the whole work tree; clear the set (ACR-R1.7). */
  acceptAll(workspace: string): Promise<ReviewResult>
  /** Revert everything to the baseline; clear the set (ACR-R1.7, confirmed in UI). */
  rejectAll(workspace: string): Promise<ReviewResult>
  /** Tear down a workspace's in-memory state (workspace switch / close, ACR-R4.3). */
  teardown(workspace: string): void
}

/** Per-workspace in-memory state. `baseline` null = clean (no un-reviewed turn yet). */
interface WorkspaceState {
  baseline: string | null
  turns: TurnMark[]
  changes: ReviewChange[]
  /** path → mtimeMs captured at the last recompute, for the STALE guard (ACR-R3.2). */
  mtimes: Map<string, number>
  /**
   * R-08 authorship tracking. `classified` is every path we have already made a
   * call on (first observation wins — a file the agent created stays the
   * agent's even if the user edits it afterwards, which is what the STALE guard
   * is for); `userAuthored` is the subset attributed to the user.
   */
  classified: Set<string>
  userAuthored: Set<string>
  /** Turn ids currently in flight — empty means the agent is not writing. */
  openTurns: Set<string>
}

/** Sums a diff's add/del line counts (binary/tooLarge → 0/0, rendered as a state, never a count). */
function countLines(diff: GitDiff): { adds: number; dels: number } {
  let adds = 0
  let dels = 0
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') adds++
      else if (line.type === 'del') dels++
    }
  }
  return { adds, dels }
}

export function createReviewService(deps: ReviewServiceDeps): ReviewService {
  const { checkpoint, onChanged } = deps
  const now = deps.now ?? Date.now
  const states = new Map<string, WorkspaceState>()

  function stateFor(workspace: string): WorkspaceState {
    let s = states.get(workspace)
    if (!s) {
      s = {
        baseline: null,
        turns: [],
        changes: [],
        mtimes: new Map(),
        classified: new Set(),
        userAuthored: new Set(),
        openTurns: new Set()
      }
      states.set(workspace, s)
    }
    return s
  }

  /** Current on-disk mtime of a workspace-relative path, or `null` if it's gone. */
  function mtimeOf(workspace: string, path: string): number | null {
    try {
      return statSync(join(workspace, path)).mtimeMs
    } catch {
      return null
    }
  }

  /**
   * Recomputes `changes` from `diff(baseline → now)` and refreshes the mtime
   * baseline. The single source of truth — every decision ends here so the set
   * can never drift. Emits nothing on its own; callers decide when to `emit`.
   * Only ever called with a non-null baseline (every caller guards).
   */
  async function recompute(workspace: string): Promise<void> {
    const s = stateFor(workspace)
    const raw = await checkpoint.diffToWorkTree(workspace, s.baseline as string)
    const mtimes = new Map<string, number>()
    // R-08 authorship. The agent only writes while a turn is in flight, so a
    // change first seen with no turn open cannot be the agent's. First
    // observation wins — see `classified`.
    const agentWriting = s.openTurns.size > 0
    s.changes = raw.map((c) => {
      const { adds, dels } = countLines(c.diff)
      const m = mtimeOf(workspace, c.path)
      if (m !== null) mtimes.set(c.path, m)
      if (!s.classified.has(c.path)) {
        s.classified.add(c.path)
        if (!agentWriting) s.userAuthored.add(c.path)
      }
      const change: ReviewChange = { path: c.path, status: c.status, diff: c.diff, adds, dels }
      if (s.userAuthored.has(c.path)) change.userAuthored = true
      return change
    })
    s.mtimes = mtimes
    // The set went empty (everything reviewed) → drop the baseline so the next
    // turn starts a fresh accumulation (ACR-C5).
    if (s.changes.length === 0) {
      s.baseline = null
      s.turns = []
      s.classified.clear()
      s.userAuthored.clear()
    }
  }

  /**
   * R-08 (DATA, score 6) — refuse to throw away a change the agent did not make.
   *
   * The review model is "baseline tree × work tree", so *anything* newer than
   * the baseline read as agent output. Measured 2026-07-30: `rejectAll` deleted
   * a file the user created while a turn was open, and `rejectFile` silently
   * reverted a user edit to a file the agent never touched — both reporting
   * success, with nothing committed and the trash not involved.
   *
   * The signal is the TURN WINDOW, not `TurnMark.paths`. The paths come from
   * the adapter's tool_use and their own doc-comment calls them "best-effort …
   * empty is fine" — scoping a revert to a list that is allowed to be empty
   * would silently turn reject into a no-op. Whether a turn was in flight is
   * something this service knows first-hand.
   *
   * Direction of failure is chosen deliberately: a misclassified agent change
   * is left on disk, visible in the pending set, and the user can still reject
   * it per-file after accepting the rest — annoying and recoverable. A
   * misclassified user file is deleted with no undo. So when in doubt, keep.
   */
  function unattributedResult(): ReviewResult {
    return { ok: false, unattributed: true }
  }

  function isUserAuthored(workspace: string, path: string): boolean {
    return stateFor(workspace).userAuthored.has(path)
  }

  function snapshotOf(s: WorkspaceState): ReviewSnapshot {
    return { changes: s.changes, turns: s.turns }
  }

  function emit(workspace: string): void {
    onChanged(workspace, snapshotOf(stateFor(workspace)))
  }

  async function beginTurn(
    workspace: string,
    turnId: string,
    conversationId?: string
  ): Promise<void> {
    const s = stateFor(workspace)
    // Only the first un-reviewed turn establishes the baseline; later turns
    // accumulate into the same set (ACR-C5).
    if (s.baseline === null) {
      s.baseline = await checkpoint.snapshot(workspace)
      s.changes = []
      s.turns = []
    }
    const mark: TurnMark = { turnId, at: now(), paths: [] }
    if (conversationId !== undefined) mark.conversationId = conversationId
    s.turns.push(mark)
    s.openTurns.add(turnId)
    emit(workspace)
  }

  function attachTurn(workspace: string, turnId: string, conversationId: string): void {
    const mark = stateFor(workspace).turns.find((t) => t.turnId === turnId)
    // First attribution wins: a mark that already names its conversation is
    // never re-pointed by a late-arriving id.
    if (!mark || mark.conversationId !== undefined) return
    mark.conversationId = conversationId
    emit(workspace)
  }

  async function onFsActivity(workspace: string): Promise<void> {
    const s = stateFor(workspace)
    if (s.baseline === null) return // idle manual edits don't spin up a set
    await recompute(workspace)
    emit(workspace)
  }

  async function endTurn(workspace: string, turnId: string, paths: string[]): Promise<void> {
    const s = stateFor(workspace)
    const mark = s.turns.find((t) => t.turnId === turnId)
    if (mark) mark.paths = paths
    // Recompute BEFORE closing the window: the writes this turn just made are
    // the agent's, and a file first observed here must not be misread as the
    // user's.
    if (s.baseline !== null) await recompute(workspace)
    s.openTurns.delete(turnId)
    emit(workspace)
  }

  async function get(workspace: string): Promise<ReviewSnapshot> {
    const s = stateFor(workspace)
    if (s.baseline !== null) await recompute(workspace)
    return snapshotOf(s)
  }

  /**
   * True when `path`'s current on-disk mtime differs from the one captured at
   * the last recompute — a hand-edit landed after the turn (ACR-R3.2). Returns
   * false when we have no baseline mtime (nothing to protect).
   */
  function isStale(workspace: string, path: string): boolean {
    const s = stateFor(workspace)
    const known = s.mtimes.get(path)
    if (known === undefined) return false
    const current = mtimeOf(workspace, path)
    return current !== null && current !== known
  }

  /** Marks a path stale in-place + emits, returning the STALE result the UI turns into a choice. */
  function staleResult(workspace: string, path: string): ReviewResult {
    const s = stateFor(workspace)
    const change = s.changes.find((c) => c.path === path)
    if (change) change.staleUserEdit = true
    emit(workspace)
    return { ok: false, stale: true }
  }

  async function acceptFile(workspace: string, path: string): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    if (isStale(workspace, path)) return staleResult(workspace, path)
    s.baseline = await checkpoint.advanceBaseline(workspace, s.baseline, [path])
    await recompute(workspace)
    emit(workspace)
    return { ok: true }
  }

  async function rejectFile(workspace: string, path: string): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    if (isUserAuthored(workspace, path)) return unattributedResult()
    if (isStale(workspace, path)) return staleResult(workspace, path)
    await checkpoint.revertPath(workspace, s.baseline, path)
    await recompute(workspace)
    emit(workspace)
    return { ok: true }
  }

  /**
   * "Aceitar tudo" scoped to one turn's files: a single baseline advance over
   * the whole set, then one recompute and one emit.
   *
   * The card used to do this by firing `acceptFile` per path from the
   * renderer. Each of those advances the baseline, recomputes and emits on its
   * own, so the UI redrew between them and the user watched files being
   * approved one at a time — and a decision landing mid-flight raced the
   * others. Batching is both the fix and the honest model: the user made *one*
   * decision.
   *
   * A file hand-edited since the turn still stops the batch (the STALE guard,
   * ACR-R3.2) — silently clobbering the user's own edit is the one outcome
   * worse than asking.
   */
  async function acceptFiles(workspace: string, paths: string[]): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null || paths.length === 0) return { ok: true }
    const stale = paths.find((path) => isStale(workspace, path))
    if (stale !== undefined) return staleResult(workspace, stale)
    s.baseline = await checkpoint.advanceBaseline(workspace, s.baseline, paths)
    await recompute(workspace)
    emit(workspace)
    return { ok: true }
  }

  /**
   * "Rejeitar tudo" scoped to one turn's files. Files the user authored are
   * skipped and reported (R-08) rather than reverted — same rule as
   * `rejectAll`, applied to a subset.
   */
  async function rejectFiles(workspace: string, paths: string[]): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null || paths.length === 0) return { ok: true }
    const stale = paths.find((path) => isStale(workspace, path))
    if (stale !== undefined) return staleResult(workspace, stale)
    let skipped = 0
    for (const path of paths) {
      if (s.userAuthored.has(path)) {
        skipped++
        continue
      }
      await checkpoint.revertPath(workspace, s.baseline, path)
    }
    await recompute(workspace)
    emit(workspace)
    return skipped > 0 ? { ok: true, skipped } : { ok: true }
  }

  /** Resolves a hunk object from the current change set by its stable id, or null. */
  function resolveHunk(
    workspace: string,
    path: string,
    hunkId: string
  ): ReturnType<typeof findHunk> {
    const change = stateFor(workspace).changes.find((c) => c.path === path)
    if (!change) return null
    return findHunk(change.diff, hunkId)
  }

  async function acceptHunk(
    workspace: string,
    path: string,
    hunkId: string
  ): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    if (isStale(workspace, path)) return staleResult(workspace, path)
    const hunk = resolveHunk(workspace, path, hunkId)
    if (!hunk) return { ok: false }
    s.baseline = await checkpoint.advanceBaselineHunk(workspace, s.baseline, path, hunk)
    await recompute(workspace)
    emit(workspace)
    return { ok: true }
  }

  async function rejectHunk(
    workspace: string,
    path: string,
    hunkId: string
  ): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    if (isUserAuthored(workspace, path)) return unattributedResult()
    if (isStale(workspace, path)) return staleResult(workspace, path)
    const hunk = resolveHunk(workspace, path, hunkId)
    if (!hunk) return { ok: false }
    await checkpoint.applyReverseHunk(workspace, path, hunk)
    await recompute(workspace)
    emit(workspace)
    return { ok: true }
  }

  async function acceptAll(workspace: string): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    // Keep every current byte: the whole work tree becomes the new baseline.
    s.baseline = await checkpoint.snapshot(workspace)
    await recompute(workspace) // → empty → clears baseline + turns
    emit(workspace)
    return { ok: true }
  }

  async function rejectAll(workspace: string): Promise<ReviewResult> {
    const s = stateFor(workspace)
    if (s.baseline === null) return { ok: true }
    // Revert each pending path to its baseline bytes (created→delete,
    // modified→revert, deleted→restore), then the set diffs clean — EXCEPT the
    // user's own changes (R-08), which are left on disk and stay in the set so
    // the user can see exactly what "reject all" did not touch.
    let skipped = 0
    for (const change of s.changes) {
      if (s.userAuthored.has(change.path)) {
        skipped++
        continue
      }
      await checkpoint.revertPath(workspace, s.baseline, change.path)
    }
    await recompute(workspace) // → empty (unless skips remain) → clears baseline
    emit(workspace)
    return skipped > 0 ? { ok: true, skipped } : { ok: true }
  }

  function teardown(workspace: string): void {
    states.delete(workspace)
  }

  return {
    beginTurn,
    attachTurn,
    onFsActivity,
    endTurn,
    get,
    acceptFile,
    rejectFile,
    acceptFiles,
    rejectFiles,
    acceptHunk,
    rejectHunk,
    acceptAll,
    rejectAll,
    teardown
  }
}
