import { useCallback, useRef, useState } from 'react'
import type { FileViewerHandle } from '../explorer/Explorer'
import type { GitDiffSide } from '../scm/gitStatus'
import type { RestoredTab } from './workspaceSession'

/** What an editor tab shows (git-management §6.5; +review, Agent Change Review). */
export type EditorTabKind = 'file' | 'diff' | 'conflict' | 'commit' | 'review'

/** One open editor tab (state owned by `WorkUI`). */
export interface EditorTab {
  /**
   * The tab's identity/key. For a file it's the workspace-relative path; for a
   * diff/conflict it's a synthetic key (`⟨diff⟩path?side`) so a file and its
   * diff can be open at once without colliding.
   */
  path: string
  /**
   * VS Code preview semantics: an unpinned tab (italic title) is replaced by
   * the next single-click open; double-clicking (tree row or the tab) or
   * editing the file pins it.
   */
  pinned: boolean
  /** file (default) / diff / conflict (git-management §6.5). */
  kind: EditorTabKind
  /** For diff/conflict tabs: the real file path (+ side for a diff); for a commit tab: the commit hash. */
  git?: { path?: string; side?: GitDiffSide; hash?: string }
  /** Display name override (diff/conflict tabs show the file's basename, not the synthetic key). */
  label?: string
}

/** Basename of a POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Synthetic tab key for a diff so it never collides with the file tab. */
function diffKey(path: string, side: GitDiffSide): string {
  return `⟨diff⟩${path}?${side}`
}

/** Synthetic tab key for a commit's diff. */
function commitKey(hash: string): string {
  return `⟨commit⟩${hash}`
}

/** Synthetic tab key for a conflict view. */
function conflictKey(path: string): string {
  return `⟨conflict⟩${path}`
}

/** Synthetic tab key for an agent-review diff (never collides with the file tab). */
function reviewKey(path: string): string {
  return `⟨review⟩${path}`
}

/** Everything `WorkUI` needs to drive the multi-tab editor pane. */
export interface EditorTabsState {
  tabs: EditorTab[]
  activePath: string | null
  dirtyPaths: ReadonlySet<string>
  /** The tab whose close is blocked behind the three-way unsaved-changes dialog. */
  pendingClose: string | null
  /** How many more dirty tabs are queued behind `pendingClose` (a bulk close asks once per file, VS Code-style). */
  pendingCloseRemaining: number
  openFile: (path: string, opts?: { pin?: boolean }) => void
  /**
   * workspace-session: puts a previously-open strip back (file tabs only).
   *
   * A no-op unless the strip is still empty, because this races the user: the
   * restore needs one round trip to disk to drop tabs whose files are gone,
   * and someone who clicked a tree row inside that window has already said
   * what they want on screen. Their click wins.
   */
  restoreTabs: (tabs: readonly RestoredTab[], activePath: string | null) => void
  /** Opens (or focuses) a diff tab for `filePath` on the given side (git-management §6.5). */
  openDiff: (filePath: string, side: GitDiffSide) => void
  /** Opens (or focuses) a commit's diff tab (git-management GIT-R8.2). */
  openCommitDiff: (hash: string, label: string) => void
  /** Opens (or focuses) a merge-conflict view tab (git-management GIT-R9). */
  openConflict: (filePath: string) => void
  /** Opens (or focuses) an agent-review diff tab for `filePath` (Agent Change Review, ACR-R2.4). */
  openReviewDiff: (filePath: string) => void
  selectTab: (path: string) => void
  pinTab: (path: string) => void
  /** Closes unconditionally (callers that already guarded, e.g. the viewer's own internally-guarded close). */
  removeTab: (path: string) => void
  /** Close with the unsaved-changes guard (the tab strip's ×/middle-click path). */
  requestCloseTab: (path: string) => void
  /** Tab context menu (VS Code parity): closes every tab except `path`. */
  closeOtherTabs: (path: string) => void
  /** Tab context menu: closes everything to the right of `path`. */
  closeTabsToTheRight: (path: string) => void
  /** Tab context menu: closes every tab with no unsaved changes — never asks, because there is nothing to ask about. */
  closeSavedTabs: () => void
  /** Tab context menu: closes the whole strip. */
  closeAllTabs: () => void
  cancelPendingClose: () => void
  discardPendingClose: () => void
  savePendingClose: () => void
  handleDirtyChange: (path: string, dirty: boolean) => void
  /** Callback-ref target: keeps one imperative save handle per mounted viewer. */
  registerViewer: (path: string, handle: FileViewerHandle | null) => void
  /** Flushes every dirty viewer (workspace-switch guard's "Salvar"); resolves `true` only if all saves landed. */
  saveAllDirty: () => Promise<boolean>
}

/**
 * Owns the VS Code-style tab model: single-click opens as a *preview* tab
 * (replaces the previous preview), double-click/editing pins, closing a
 * dirty tab parks behind `pendingClose` for the three-way guard dialog.
 * Viewers stay mounted per tab (their drafts survive switching), so dirty
 * state and save handles are tracked per path here.
 */
export function useEditorTabs(): EditorTabsState {
  const [tabs, setTabs] = useState<EditorTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [dirtyPaths, setDirtyPaths] = useState<ReadonlySet<string>>(new Set())
  /**
   * The dirty tabs a close is still waiting on, oldest first.
   *
   * A queue and not a single path because "Fechar as outras" over four
   * edited files is four questions, not one — VS Code asks about each in
   * turn, and answering for one file must not silently answer for the rest.
   * The head is what the guard dialog is showing; a `Cancelar` abandons the
   * whole run, which is the only reading of "cancel" that is not a trap.
   */
  const [closeQueue, setCloseQueue] = useState<readonly string[]>([])
  const viewerRefs = useRef(new Map<string, FileViewerHandle>())

  const openTab = useCallback((next: EditorTab) => {
    setTabs((current) => {
      const existing = current.find((tab) => tab.path === next.path)
      if (existing) {
        if (next.pinned && !existing.pinned) {
          return current.map((tab) => (tab.path === next.path ? { ...tab, pinned: true } : tab))
        }
        return current
      }
      // A plain-click open reuses the preview slot in place (VS Code): the
      // unpinned tab, if any, is swapped for the new one.
      const previewIndex = current.findIndex((tab) => !tab.pinned)
      if (!next.pinned && previewIndex !== -1) {
        return current.map((tab, index) => (index === previewIndex ? next : tab))
      }
      return [...current, next]
    })
    setActivePath(next.path)
  }, [])

  const openFile = useCallback(
    (path: string, opts?: { pin?: boolean }) => {
      openTab({ path, pinned: opts?.pin ?? false, kind: 'file' })
    },
    [openTab]
  )

  const restoreTabs = useCallback((restored: readonly RestoredTab[], active: string | null) => {
    if (restored.length === 0) return
    setTabs((current) => {
      if (current.length > 0) return current
      return restored.map((tab) => ({ path: tab.path, pinned: tab.pinned, kind: 'file' as const }))
    })
    setActivePath((current) => {
      if (current !== null) return current
      const wanted = restored.find((tab) => tab.path === active) ?? restored[0]
      return wanted.path
    })
  }, [])

  const openDiff = useCallback(
    (filePath: string, side: GitDiffSide) => {
      openTab({
        path: diffKey(filePath, side),
        pinned: false,
        kind: 'diff',
        git: { path: filePath, side },
        label: baseName(filePath)
      })
    },
    [openTab]
  )

  const openCommitDiff = useCallback(
    (hash: string, label: string) => {
      openTab({ path: commitKey(hash), pinned: false, kind: 'commit', git: { hash }, label })
    },
    [openTab]
  )

  const openConflict = useCallback(
    (filePath: string) => {
      openTab({
        path: conflictKey(filePath),
        pinned: false,
        kind: 'conflict',
        git: { path: filePath },
        label: baseName(filePath)
      })
    },
    [openTab]
  )

  const openReviewDiff = useCallback(
    (filePath: string) => {
      openTab({
        path: reviewKey(filePath),
        pinned: false,
        kind: 'review',
        git: { path: filePath },
        label: baseName(filePath)
      })
    },
    [openTab]
  )

  const pinTab = useCallback((path: string) => {
    setTabs((current) =>
      current.map((tab) => (tab.path === path && !tab.pinned ? { ...tab, pinned: true } : tab))
    )
  }, [])

  /**
   * Closes a whole set of tabs in one state update.
   *
   * One call rather than a loop over a single-tab close: each of those reads
   * `tabs` from its own closure, so five of them in a tick would all start
   * from the same list and only the last would survive — a "Fechar todas" that
   * closes one tab.
   */
  /** The file the guard dialog is currently asking about. */
  const pendingClose = closeQueue[0] ?? null

  const removeTabs = useCallback(
    (paths: readonly string[]) => {
      const doomed = new Set(paths.filter((path) => tabs.some((tab) => tab.path === path)))
      if (doomed.size === 0) return
      for (const path of doomed) viewerRefs.current.delete(path)
      setDirtyPaths((current) => {
        const next = new Set([...current].filter((path) => !doomed.has(path)))
        return next.size === current.size ? current : next
      })
      setCloseQueue((current) => current.filter((path) => !doomed.has(path)))
      const next = tabs.filter((tab) => !doomed.has(tab.path))
      setTabs(next)
      if (activePath !== null && doomed.has(activePath)) {
        // VS Code: closing the active tab activates the nearest surviving tab
        // to its right, falling back to the new last one.
        const index = tabs.findIndex((tab) => tab.path === activePath)
        const successor =
          tabs.slice(index + 1).find((tab) => !doomed.has(tab.path)) ?? next[next.length - 1]
        setActivePath(successor ? successor.path : null)
      }
    },
    [tabs, activePath]
  )

  const removeTab = useCallback((path: string) => removeTabs([path]), [removeTabs])

  /**
   * Closes `paths`, asking about the unsaved ones.
   *
   * Everything clean goes at once; the dirty ones queue up behind the guard
   * dialog. Splitting them matters for a bulk close: the user gets one
   * question per file that actually has something to lose, and none for the
   * dozen that do not.
   */
  const requestClose = useCallback(
    (paths: readonly string[]) => {
      const clean = paths.filter((path) => !dirtyPaths.has(path))
      const dirty = paths.filter((path) => dirtyPaths.has(path))
      if (clean.length > 0) removeTabs(clean)
      if (dirty.length > 0) setCloseQueue((current) => [...current, ...dirty])
    },
    [dirtyPaths, removeTabs]
  )

  const requestCloseTab = useCallback((path: string) => requestClose([path]), [requestClose])

  /** Every tab but `path` (VS Code's "Fechar as outras"). */
  const closeOtherTabs = useCallback(
    (path: string) => requestClose(tabs.filter((tab) => tab.path !== path).map((tab) => tab.path)),
    [tabs, requestClose]
  )

  /** Everything after `path` in the strip. */
  const closeTabsToTheRight = useCallback(
    (path: string) => {
      const index = tabs.findIndex((tab) => tab.path === path)
      if (index === -1) return
      requestClose(tabs.slice(index + 1).map((tab) => tab.path))
    },
    [tabs, requestClose]
  )

  /** The tabs with nothing to lose — closed without a single question. */
  const closeSavedTabs = useCallback(
    () => removeTabs(tabs.filter((tab) => !dirtyPaths.has(tab.path)).map((tab) => tab.path)),
    [tabs, dirtyPaths, removeTabs]
  )

  const closeAllTabs = useCallback(
    () => requestClose(tabs.map((tab) => tab.path)),
    [tabs, requestClose]
  )

  /** `Cancelar` abandons the whole run, not just the file being asked about. */
  const cancelPendingClose = useCallback(() => setCloseQueue([]), [])

  // Only ever wired to dialog buttons that are mounted while `pendingClose`
  // is set, so the non-null assertion-by-cast mirrors the viewer's own
  // guard-dialog pattern (see FileViewer's `readyState` comment).
  const discardPendingClose = useCallback(() => {
    removeTab(pendingClose as string)
  }, [pendingClose, removeTab])

  const savePendingClose = useCallback(() => {
    const path = pendingClose as string
    // Off the queue first, whatever happens: a save that fails has already
    // surfaced its own STALE/error state in the viewer, and re-asking the same
    // question on top of it would be a dialog the user cannot get out of.
    setCloseQueue((current) => current.filter((queued) => queued !== path))
    void (viewerRefs.current.get(path)?.requestSave() ?? Promise.resolve(false)).then((ok) => {
      if (ok) removeTab(path)
    })
  }, [pendingClose, removeTab])

  const handleDirtyChange = useCallback(
    (path: string, dirty: boolean) => {
      setDirtyPaths((current) => {
        if (current.has(path) === dirty) return current
        const next = new Set(current)
        if (dirty) next.add(path)
        else next.delete(path)
        return next
      })
      // Editing pins a preview tab (VS Code) — a dirty tab is never
      // silently replaced by the next single-click open.
      if (dirty) pinTab(path)
    },
    [pinTab]
  )

  const registerViewer = useCallback((path: string, handle: FileViewerHandle | null) => {
    if (handle) viewerRefs.current.set(path, handle)
    else viewerRefs.current.delete(path)
  }, [])

  const saveAllDirty = useCallback(async (): Promise<boolean> => {
    const results = await Promise.all(
      [...dirtyPaths].map((path) => viewerRefs.current.get(path)?.requestSave() ?? false)
    )
    return results.every(Boolean)
  }, [dirtyPaths])

  return {
    tabs,
    activePath,
    dirtyPaths,
    pendingClose,
    pendingCloseRemaining: Math.max(closeQueue.length - 1, 0),
    openFile,
    restoreTabs,
    openDiff,
    openCommitDiff,
    openConflict,
    openReviewDiff,
    selectTab: setActivePath,
    pinTab,
    removeTab,
    requestCloseTab,
    closeOtherTabs,
    closeTabsToTheRight,
    closeSavedTabs,
    closeAllTabs,
    cancelPendingClose,
    discardPendingClose,
    savePendingClose,
    handleDirtyChange,
    registerViewer,
    saveAllDirty
  }
}
