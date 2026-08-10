import { useCallback, useRef, useState } from 'react'
import type { FileViewerHandle } from '../explorer/Explorer'
import type { GitDiffSide } from '../scm/gitStatus'

/** What an editor tab shows (git-management §6.5; +review, Agent Change Review; +design-studio, M18). */
export type EditorTabKind = 'file' | 'diff' | 'conflict' | 'commit' | 'review' | 'design-studio'

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
  /** For a `design-studio` tab: the workspace-relative path of the UX Spec it reads (design-studio DS-R1). */
  spec?: { path: string }
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

/**
 * Synthetic tab key for a Design Studio session (design-studio DS-R1 AC-1/4).
 *
 * The brackets are what keep it out of the plain file tab's namespace: tab
 * identity *is* the key, so a Studio tab keyed by the Spec's own path would be
 * the same tab as the Spec open for reading — opening one would silently
 * replace the other, and closing either would close both. Prefixing makes the
 * two coexist, and makes "open the same Spec twice" resolve to the one Studio
 * tab that already exists rather than to a second session over the same JSON
 * (spec.md Edge Cases: two tabs on one Spec).
 */
function studioKey(specPath: string): string {
  return `⟨studio⟩${specPath}`
}

/** Everything `WorkUI` needs to drive the multi-tab editor pane. */
export interface EditorTabsState {
  tabs: EditorTab[]
  activePath: string | null
  dirtyPaths: ReadonlySet<string>
  /** A tab close blocked behind the three-way unsaved-changes dialog. */
  pendingClose: string | null
  openFile: (path: string, opts?: { pin?: boolean }) => void
  /** Opens (or focuses) a diff tab for `filePath` on the given side (git-management §6.5). */
  openDiff: (filePath: string, side: GitDiffSide) => void
  /** Opens (or focuses) a commit's diff tab (git-management GIT-R8.2). */
  openCommitDiff: (hash: string, label: string) => void
  /** Opens (or focuses) a merge-conflict view tab (git-management GIT-R9). */
  openConflict: (filePath: string) => void
  /** Opens (or focuses) an agent-review diff tab for `filePath` (Agent Change Review, ACR-R2.4). */
  openReviewDiff: (filePath: string) => void
  /** Opens (or focuses) the Design Studio tab for a UX Spec (design-studio DS-R1 AC-1/4). */
  openDesignStudio: (specPath: string) => void
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

  // Opens pinned, unlike every other tab here: a Studio tab owns an editing
  // session (tree, transcript, undo cursor), and the VS Code preview slot is
  // *replaced* by the next single click. A session that can be thrown away by
  // clicking a file in the tree is a session the user cannot trust.
  const openDesignStudio = useCallback(
    (specPath: string) => {
      openTab({
        path: studioKey(specPath),
        pinned: true,
        kind: 'design-studio',
        spec: { path: specPath },
        label: baseName(specPath)
      })
    },
    [openTab]
  )

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
    openDiff,
    openCommitDiff,
    openConflict,
    openReviewDiff,
    openDesignStudio,
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
