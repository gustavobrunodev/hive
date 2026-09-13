import { useCallback, useState } from 'react'
import type { WorkView } from '../ui/sidebarNav'
import { saveWorkspaceSession } from '../ui/workspaceSession'
import type { Initiative } from './initiatives'
import { useInitiatives, type InitiativesStore } from './useInitiatives'

/**
 * Everything the workbench needs to know about initiatives, as one value.
 *
 * It lives in its own hook rather than as six `useState`s inside `WorkUI`
 * because `WorkUI` is already at the ceiling of what the React compiler will
 * take: adding the state and its derivation inline pushed the component past
 * the `complexity` limit *and* made the compiler bail out of memoizing it —
 * eight "Existing memoization could not be preserved" errors, none of them
 * about this feature, all of them caused by it. Measured on both sides.
 */
export interface OpenInitiativeStore {
  /** The workspace's initiatives, live from disk. */
  all: InitiativesStore
  /** The open initiative's folder, or `null` for a plain conversation. */
  path: string | null
  /** The open initiative itself — re-derived from the store, never a stored copy. */
  current: Initiative | null
  /**
   * The one the work pane should actually draw a rail for.
   *
   * `null` while a chat tool is in front: those cover the transcript the
   * initiative is worked in, so its rail would have nothing to sit beside.
   */
  shown: Initiative | null
  /** Opens one, or (with `null`) goes back to a plain conversation. */
  show: (path: string | null) => void
  createOpen: boolean
  setCreateOpen: (open: boolean) => void
}

export function useOpenInitiative(
  workspace: string,
  initialPath: string | null,
  /** What the work pane is showing — decides whether the rail has a place to be. */
  workView: WorkView,
  /** Called on the way in: an initiative is worked in the transcript, so whatever is covering it steps aside. */
  onEnter: () => void
): OpenInitiativeStore {
  const all = useInitiatives(workspace)
  const [path, setPath] = useState<string | null>(initialPath)
  const [createOpen, setCreateOpen] = useState(false)

  const show = useCallback(
    (next: string | null) => {
      setPath(next)
      saveWorkspaceSession(workspace, { initiativePath: next })
      if (next !== null) onEnter()
    },
    [workspace, onEnter]
  )

  // A demand whose plan advanced while it was open has to re-render from the
  // folder, not from what it looked like when it was clicked.
  const current = all.initiatives.find((entry) => entry.path === path) ?? null

  return {
    all,
    path,
    current,
    shown: workView === 'chat' ? current : null,
    show,
    createOpen,
    setCreateOpen
  }
}
