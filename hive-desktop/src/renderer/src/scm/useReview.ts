import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { ReviewChange, ReviewResult, ReviewSnapshot, TurnMark } from './reviewTypes'

/**
 * The single Agent Change Review store for the active workspace (design.md
 * §6.1, ACR-R2.5), consumed by all four surfaces — the review bar, the
 * "Revisão do agente" panel, the in-chat change card, and the inline editor
 * diff. Lifted once in `WorkUI` and shared via `ReviewProvider` so every
 * surface reads and mutates one object — accepting a hunk inline updates the
 * card, the bar count and the panel instantly, and vice-versa (no drift).
 *
 * Styled on `useGitStore` (M10): tag state with its workspace so a response
 * landing after a switch is filtered out by pure derivation, no reset effect.
 */
export type { ReviewChange, TurnMark } from './reviewTypes'

/** Changes grouped by status for the panel's Criados/Modificados/Removidos sections. */
export interface ReviewByStatus {
  created: ReviewChange[]
  modified: ReviewChange[]
  deleted: ReviewChange[]
}

export interface ReviewStore {
  /** The active workspace root (for reads a surface issues directly). */
  workspace: string
  changes: ReviewChange[]
  turns: TurnMark[]
  /** Number of pending files — drives the bar/badge visibility (ACR-R2.3/R2.4). */
  pendingCount: number
  byStatus: ReviewByStatus
  /** True when any pending file was hand-edited after the turn (ACR-R3.2). */
  isStale: boolean
  /** Re-fetch the snapshot from main (rehydrate on mount / workspace switch). */
  refresh: () => void
  acceptFile: (path: string) => Promise<ReviewResult>
  rejectFile: (path: string) => Promise<ReviewResult>
  acceptHunk: (path: string, hunkId: string) => Promise<ReviewResult>
  rejectHunk: (path: string, hunkId: string) => Promise<ReviewResult>
  acceptAll: () => Promise<ReviewResult>
  rejectAll: () => Promise<ReviewResult>
}

/** Snapshot tagged with the workspace it belongs to (stale-switch filtering, the useGit pattern). */
interface TaggedReview extends ReviewSnapshot {
  ws: string
}

const EMPTY: ReviewSnapshot = { changes: [], turns: [] }

/** Groups changes into the three status buckets (stable order for the panel). */
function groupByStatus(changes: ReviewChange[]): ReviewByStatus {
  const by: ReviewByStatus = { created: [], modified: [], deleted: [] }
  for (const change of changes) by[change.status].push(change)
  return by
}

/**
 * Owns review state for `workspace`. Loads via `review.get`, subscribes to the
 * `review:changed` push (filtered to this workspace), and exposes the
 * accept/reject actions. A decision's `ReviewResult` is returned so callers can
 * react to `{stale:true}` (the T18 STALE dialog) — the push keeps the set in
 * sync regardless.
 */
export function useReviewStore(workspace: string): ReviewStore {
  const [state, setState] = useState<TaggedReview>({ ws: workspace, ...EMPTY })

  const refresh = useCallback(() => {
    void window.hive.review.get(workspace).then((snap) => {
      setState({ ws: workspace, ...snap })
    })
  }, [workspace])

  // Initial load / re-fetch on workspace change.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Live updates: main pushes the fresh snapshot after every recompute/decision.
  // Ignore pushes for a different workspace (a stale switch).
  useEffect(() => {
    const off = window.hive.review.onChanged((evt) => {
      if (evt.workspace !== workspace) return
      setState({ ws: workspace, changes: evt.changes, turns: evt.turns })
    })
    return off
  }, [workspace])

  // Pure derivation: a since-switched workspace's snapshot reads as empty until
  // `refresh` lands the new one (no reset effect, no setState during render).
  const matches = state.ws === workspace
  const changes = useMemo(() => (matches ? state.changes : []), [matches, state.changes])
  const turns = matches ? state.turns : []

  const byStatus = useMemo(() => groupByStatus(changes), [changes])
  const pendingCount = changes.length
  const isStale = useMemo(() => changes.some((c) => c.staleUserEdit), [changes])

  const acceptFile = useCallback(
    (path: string) => window.hive.review.acceptFile(workspace, path),
    [workspace]
  )
  const rejectFile = useCallback(
    (path: string) => window.hive.review.rejectFile(workspace, path),
    [workspace]
  )
  const acceptHunk = useCallback(
    (path: string, hunkId: string) => window.hive.review.acceptHunk(workspace, path, hunkId),
    [workspace]
  )
  const rejectHunk = useCallback(
    (path: string, hunkId: string) => window.hive.review.rejectHunk(workspace, path, hunkId),
    [workspace]
  )
  const acceptAll = useCallback(() => window.hive.review.acceptAll(workspace), [workspace])
  const rejectAll = useCallback(() => window.hive.review.rejectAll(workspace), [workspace])

  return {
    workspace,
    changes,
    turns,
    pendingCount,
    byStatus,
    isStale,
    refresh,
    acceptFile,
    rejectFile,
    acceptHunk,
    rejectHunk,
    acceptAll,
    rejectAll
  }
}

const ReviewContext = createContext<ReviewStore | null>(null)

/** Provides a `ReviewStore` to the subtree (bar, panel, card, inline diff). */
export function ReviewProvider({
  store,
  children
}: {
  store: ReviewStore
  children?: ReactNode
}): React.JSX.Element {
  return createElement(ReviewContext.Provider, { value: store }, children)
}

/** Reads the review store; throws if used outside a `ReviewProvider`. */
export function useReview(): ReviewStore {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReview must be used within a ReviewProvider')
  return ctx
}
