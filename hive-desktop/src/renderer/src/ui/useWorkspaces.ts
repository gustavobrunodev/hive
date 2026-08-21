import { useCallback, useEffect, useMemo, useState } from 'react'

/** Renderer-side mirror of `main/workspaceService.ts`'s `WorkspaceInfo`, derived from the bridge. */
export type WorkspaceInfo = Awaited<ReturnType<Window['hive']['workspaces']['list']>>[number]

/** What `openWorkspace`/`preview` answer with — derived from the bridge, same as above. */
export type OpenResult = Awaited<ReturnType<Window['hive']['openWorkspace']>>

/**
 * The step the app owes a workspace next (install / update / ask / open).
 * Carried on a successful open so the caller doesn't need a second round trip
 * to find out what to render.
 */
export type WorkspaceRoute = Extract<OpenResult, { ok: true }>['route']

/**
 * The order the switcher shows and the `Ctrl+1…9` jump resolves against:
 * primary first, then everything else by recency (the order the registry
 * already arrives in).
 *
 * Shared rather than computed in each place on purpose. The panel groups the
 * primary above the rest, so a primary that isn't the most recently opened
 * moves to the top of the *display* while staying mid-list in the registry —
 * and the row advertising "Ctrl+2" would then not be the workspace Ctrl+2
 * opened. One function, one truth.
 */
export function panelOrder(list: WorkspaceInfo[]): WorkspaceInfo[] {
  return [...list.filter((entry) => entry.primary), ...list.filter((entry) => !entry.primary)]
}

/** Case- and accent-insensitive haystack for the switcher's filter field. */
function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** A workspace matches when the query appears in its name or anywhere in its path. */
export function matchesQuery(entry: WorkspaceInfo, query: string): boolean {
  const needle = foldForSearch(query.trim())
  if (needle === '') return true
  return foldForSearch(`${entry.displayName} ${entry.path}`).includes(needle)
}

export interface WorkspacesStore {
  /** The registry joined with disk state, most-recently-opened first. */
  list: WorkspaceInfo[]
  /** Re-reads it — after any edit, and whenever the panel opens. */
  reload: () => void
}

/**
 * The workspace registry, loaded once per active workspace and re-read on
 * demand (multi-workspace).
 *
 * Hoisted into a hook rather than living inside the switcher because two
 * surfaces need the same list and must not disagree about it: the panel
 * renders it, and the `Ctrl+1…9` jump resolves positions against it. One
 * store, one order.
 *
 * `activeWorkspace` is a dependency, not a filter — switching workspaces
 * changes the MRU order, so the list is re-read rather than reused.
 */
export function useWorkspaces(activeWorkspace: string): WorkspacesStore {
  const [list, setList] = useState<WorkspaceInfo[]>([])
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.hive.workspaces
      .list()
      .then((entries) => {
        if (!cancelled) setList(entries)
      })
      .catch(() => {
        // A registry we can't read renders as an empty panel with its
        // "adicionar workspace" action — degraded, never broken.
        if (!cancelled) setList([])
      })
    return () => {
      cancelled = true
    }
  }, [activeWorkspace, token])

  const reload = useCallback(() => setToken((current) => current + 1), [])

  // Memoized: consumers put the store in `useCallback` dependency arrays, and
  // a fresh object every render makes those arrays lie — which the React
  // compiler reports as memoization it cannot preserve.
  return useMemo(() => ({ list, reload }), [list, reload])
}
