import { useCallback, useRef, useState } from 'react'
import type { FileViewerHandle } from '../explorer/Explorer'

/** One open editor tab (state owned by `WorkUI`). */
export interface EditorTab {
  /** Workspace-relative file path — the tab's identity. */
  path: string
  /**
   * VS Code preview semantics: an unpinned tab (italic title) is replaced by
   * the next single-click open; double-clicking (tree row or the tab) or
   * editing the file pins it.
   */
  pinned: boolean
}

/** Everything `WorkUI` needs to drive the multi-tab editor pane. */
export interface EditorTabsState {
  tabs: EditorTab[]
  activePath: string | null
  dirtyPaths: ReadonlySet<string>
  /** A tab close blocked behind the three-way unsaved-changes dialog. */
  pendingClose: string | null
  openFile: (path: string, opts?: { pin?: boolean }) => void
  selectTab: (path: string) => void
  pinTab: (path: string) => void
  /** Closes unconditionally (callers that already guarded, e.g. the viewer's own internally-guarded close). */
  removeTab: (path: string) => void
  /** Close with the unsaved-changes guard (the tab strip's ×/middle-click path). */
  requestCloseTab: (path: string) => void
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
  const [pendingClose, setPendingClose] = useState<string | null>(null)
  const viewerRefs = useRef(new Map<string, FileViewerHandle>())

  const openFile = useCallback((path: string, opts?: { pin?: boolean }) => {
    setTabs((current) => {
      const existing = current.find((tab) => tab.path === path)
      if (existing) {
        if (opts?.pin && !existing.pinned) {
          return current.map((tab) => (tab.path === path ? { ...tab, pinned: true } : tab))
        }
        return current
      }
      const next: EditorTab = { path, pinned: opts?.pin ?? false }
      // A plain-click open reuses the preview slot in place (VS Code): the
      // unpinned tab, if any, is swapped for the new file.
      const previewIndex = current.findIndex((tab) => !tab.pinned)
      if (!next.pinned && previewIndex !== -1) {
        return current.map((tab, index) => (index === previewIndex ? next : tab))
      }
      return [...current, next]
    })
    setActivePath(path)
  }, [])

  const pinTab = useCallback((path: string) => {
    setTabs((current) =>
      current.map((tab) => (tab.path === path && !tab.pinned ? { ...tab, pinned: true } : tab))
    )
  }, [])

  const clearDirty = useCallback((path: string) => {
    setDirtyPaths((current) => {
      if (!current.has(path)) return current
      const next = new Set(current)
      next.delete(path)
      return next
    })
  }, [])

  const removeTab = useCallback(
    (path: string) => {
      viewerRefs.current.delete(path)
      clearDirty(path)
      setPendingClose((current) => (current === path ? null : current))
      const index = tabs.findIndex((tab) => tab.path === path)
      if (index === -1) return
      const next = tabs.filter((tab) => tab.path !== path)
      setTabs(next)
      if (activePath === path) {
        // VS Code: closing the active tab activates its right neighbor,
        // falling back to the new last tab.
        const neighbor = next[Math.min(index, next.length - 1)]
        setActivePath(neighbor ? neighbor.path : null)
      }
    },
    [tabs, activePath, clearDirty]
  )

  const requestCloseTab = useCallback(
    (path: string) => {
      if (dirtyPaths.has(path)) setPendingClose(path)
      else removeTab(path)
    },
    [dirtyPaths, removeTab]
  )

  const cancelPendingClose = useCallback(() => setPendingClose(null), [])

  // Only ever wired to dialog buttons that are mounted while `pendingClose`
  // is set, so the non-null assertion-by-cast mirrors the viewer's own
  // guard-dialog pattern (see FileViewer's `readyState` comment).
  const discardPendingClose = useCallback(() => {
    removeTab(pendingClose as string)
  }, [pendingClose, removeTab])

  const savePendingClose = useCallback(() => {
    const path = pendingClose as string
    setPendingClose(null)
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
    openFile,
    selectTab: setActivePath,
    pinTab,
    removeTab,
    requestCloseTab,
    cancelPendingClose,
    discardPendingClose,
    savePendingClose,
    handleDirtyChange,
    registerViewer,
    saveAllDirty
  }
}
