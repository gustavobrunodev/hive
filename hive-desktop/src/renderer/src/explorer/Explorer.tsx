import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import {
  Button,
  CodeBlock,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  Spinner,
  Tree
} from '@hive/design-system'
import { t } from '../i18n'
import { Markdown } from '../ui/markdown'
import { HtmlPreview } from './HtmlPreview'
import { IconButton } from '../ui/IconButton'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EyeIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon
} from '../ui/icons'

/**
 * Duck-typed guard for preload's `FsConflictError` (see preload/index.ts).
 * Deliberately NOT `instanceof FsConflictError` — importing the class value
 * across the preload/renderer worlds would require bundling `preload/
 * index.ts` (which imports `electron` at module scope) into the renderer,
 * and even if it built, contextBridge's structured-clone boundary
 * reconstructs thrown errors as plain `Error`s in the receiving world
 * (identity/prototype is not preserved across isolated-world postMessage-
 * style cloning) — only the enumerable `.code`/`.message` own properties
 * reliably survive. Checking those directly is the robust cross-boundary
 * pattern; `code` narrows the same way an `instanceof` check would.
 */
function isFsConflictError(err: unknown): err is { code: 'CONFLICT' | 'STALE'; message: string } {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  const code = (err as { code?: unknown }).code
  return code === 'CONFLICT' || code === 'STALE'
}

/** Joins a workspace-relative parent dir ('' = root) with a leaf name. */
function joinRelative(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name
}

/** Last path segment. */
function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Everything before the last path segment ('' if the path is top-level). */
function parentOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/** True if `path` is `ancestorPath` itself or nested under it — the FM-R4.2 self/descendant drop guard. */
function isSelfOrDescendant(ancestorPath: string, path: string): boolean {
  return path === ancestorPath || path.startsWith(`${ancestorPath}/`)
}

const INVALID_NAME_RE = /[/\\]/

/** FM-R1.3 name validation: non-empty, no path separators, not `.`/`..`. Returns the trimmed name, or `null` if invalid. */
function validateEntryName(raw: string): string | null {
  const name = raw.trim()
  if (!name || name === '.' || name === '..' || INVALID_NAME_RE.test(name)) return null
  return name
}

/** A synthetic tree-row id for the currently-open "new item" inline input (never a real workspace path). */
const CREATE_ROW_ID = '\u0001__creating__'

/**
 * Structural mirror of `main/fsService.ts`'s `TreeNode` (design.md §2). Kept
 * local — rather than importing across the main/renderer boundary — so this
 * component stays self-contained inside `explorer/**`, per T12's touch
 * scope. `window.hive.listTree()`'s resolved value is structurally
 * identical (same field names/shapes), so nothing here needs a cast.
 */
interface FsTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FsTreeNode[]
}

type TreeState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; nodes: FsTreeNode[] }

type ViewerState =
  | { status: 'loading'; path: string }
  | { status: 'error'; path: string }
  | { status: 'ready'; path: string; content: string; baseline: EntryMeta | null }

interface DsTreeNodeShape {
  id: string
  label: ReactNode
  children?: DsTreeNodeShape[]
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

/** `.html` files get the sandboxed live preview (T4/T5, design.md §3/§6). */
function isHtmlPath(path: string): boolean {
  return path.toLowerCase().endsWith('.html')
}

/** Preview is only ever *offered* for these kinds (design.md §3) — factored out so `FileViewer`'s own branching stays low. */
function isPreviewableKind(path: string): boolean {
  return isMarkdownPath(path) || isHtmlPath(path)
}

/** `editable && isPreviewableKind(path)`, factored out (same reason as `isPreviewableKind`: keeps `FileViewer`'s own cyclomatic complexity down). */
function isPreviewable(editable: boolean, path: string): boolean {
  return editable && isPreviewableKind(path)
}

const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|yaml|yml|toml|css|html|sh|py|rb|go|rs)$/i

function fileIconFor(path: string): React.JSX.Element {
  if (isMarkdownPath(path)) return <FileTextIcon />
  if (CODE_EXTENSIONS.test(path)) return <FileCodeIcon />
  return <FileIcon />
}

/** Flattens the tree into a `path -> type` lookup so selecting a tree row can tell files from directories. */
function collectFileTypes(nodes: FsTreeNode[], into: Map<string, FsTreeNode['type']>): void {
  for (const node of nodes) {
    into.set(node.path, node.type)
    if (node.children) collectFileTypes(node.children, into)
  }
}

/** Maps `FsTreeNode`s onto the shape the DS `Tree` component expects (`id`/`label`/`children`). */
function toDsNodes(nodes: FsTreeNode[]): DsTreeNodeShape[] {
  return nodes.map((node) => ({
    id: node.path,
    label: node.name,
    children: node.type === 'directory' ? toDsNodes(node.children ?? []) : undefined
  }))
}

export interface FileTreeProps {
  /** Absolute path to the workspace root to browse (design.md §4 "File explorer", R5.1–R5.3). */
  workspace: string
  /** Path of the file currently open in the viewer — kept highlighted in the tree. */
  selectedPath: string | null
  /** Invoked when a *file* row is activated (directories only expand/collapse). */
  onOpenFile: (path: string) => void
}

/** An inline "type a name" row injected into the tree — used for both new-item create and the conflict-driven rename retry (create/move/import all funnel through this one input). */
interface PendingInput {
  /** Workspace-relative dir this item will land in ('' = root). */
  parentPath: string
  /** Controls which icon the inline row shows. */
  kind: 'file' | 'directory'
  initialValue: string
  /** Performs the operation for the (already-validated) final name; the caller has already conflict-checked or is retrying after Overwrite/Rename. */
  commit: (name: string) => Promise<void>
}

/** In-place rename of an existing row (label swapped for a text input). */
interface RenamingState {
  path: string
  parentPath: string
  initialValue: string
}

/** The delete/overwrite/rename confirmation surfaces (FM-R3.1/FM-R7), unified into one dialog shape. */
interface ConflictState {
  itemLabel: string
  /** `createDirectory` has no `{ overwrite }` option, so a directory-create conflict can only Rename/Cancel. */
  supportsOverwrite: boolean
  onOverwrite: () => Promise<void>
  onRename: () => void
  onCancel: () => void
}

/** Recursively injects a synthetic node as the last child of `parentPath` ('' = append at the top level). */
function injectNode(
  nodes: DsTreeNodeShape[],
  parentPath: string,
  node: DsTreeNodeShape
): DsTreeNodeShape[] {
  if (parentPath === '') return [...nodes, node]
  return nodes.map((existing) => {
    if (existing.id === parentPath) {
      return { ...existing, children: [...(existing.children ?? []), node] }
    }
    if (existing.children) {
      return { ...existing, children: injectNode(existing.children, parentPath, node) }
    }
    return existing
  })
}

/**
 * Workspace file tree (task T12's tree half, restyled as the app's left
 * rail; task T8 adds create/rename/delete/move/import). Lists the workspace
 * in a DS `Tree` with file-type icons, keeps itself live via
 * `watchWorkspace` (R5.3), and reports file activations up — the viewer
 * itself is a sibling pane (`FileViewer`) so the chat column never has to
 * share width with an empty placeholder.
 */
export function FileTree({
  workspace,
  selectedPath,
  onOpenFile
}: FileTreeProps): React.JSX.Element {
  const [treeState, setTreeState] = useState<TreeState>({ status: 'loading' })
  const [refreshToken, setRefreshToken] = useState(0)
  // Which directory a bare "New file"/"New folder" toolbar action targets —
  // the last directory row the user clicked, or '' (root) until then.
  const [activeDirPath, setActiveDirPath] = useState('')
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  // T8: the tree's own multi-select set (Ctrl toggles membership, Shift
  // selects a range — both handled inside the DS `Tree` itself, design.md
  // §2). Seeded from `selectedPath` so the file already open in the viewer
  // stays highlighted; reconciled below whenever the tree refreshes so a
  // deleted path never lingers in the set.
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedPath ? [selectedPath] : [])
  // Set synchronously (capture phase, ahead of the DS Tree's own bubble-phase
  // `onClick` → `onActivate` → `onSelectedIdsChange` chain) so
  // `handleSelectedIdsChange` below can tell *how* the resulting selection
  // came about. The DS Tree's public API only reports the resulting ids
  // (design.md §2), not the triggering modifiers, so this is the only place
  // the app can observe them — Ctrl/Shift must never open the viewer, even
  // when they happen to leave exactly one file selected (UX-R3.2).
  const lastClickModsRef = useRef<{ toggle: boolean; range: boolean }>({
    toggle: false,
    range: false
  })
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null)
  const [pendingInputValue, setPendingInputValue] = useState('')
  const [renaming, setRenaming] = useState<RenamingState | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState(false)
  const dragSourceRef = useRef<string | null>(null)
  // T7 blur-commit double-commit guard: set the instant a commit is actually
  // attempted (Enter or blur), so a blur that follows an Enter-commit (or
  // fires as the conflict dialog steals focus mid-commit) is a no-op instead
  // of firing a second create/rename. Reset when the input session closes.
  const committedRef = useRef(false)

  // Initial load + re-fetch whenever `refreshToken` bumps (from the watcher
  // below) or the workspace changes. The loading-state reset lives inside
  // `load()` (a callback), not as a direct statement in the effect body, per
  // react-hooks/set-state-in-effect — calling setState synchronously at the
  // top of an effect can trigger cascading renders.
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setTreeState({ status: 'loading' })
      try {
        const nodes = await window.hive.listTree(workspace)
        if (!cancelled) setTreeState({ status: 'ready', nodes })
      } catch {
        if (!cancelled) setTreeState({ status: 'error' })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, refreshToken])

  // Live updates (R5.3): a change anywhere under the workspace re-fetches
  // the tree so files created by an agent workflow (T19) show up without a
  // manual reload. Unsubscribes on unmount / workspace change.
  useEffect(() => {
    const unsubscribe = window.hive.watchWorkspace(workspace, () => {
      setRefreshToken((current) => current + 1)
    })
    return unsubscribe
  }, [workspace])

  const fileTypes = useMemo(() => {
    const map = new Map<string, FsTreeNode['type']>()
    if (treeState.status === 'ready') collectFileTypes(treeState.nodes, map)
    return map
  }, [treeState])

  const dsNodes = useMemo(
    () => (treeState.status === 'ready' ? toDsNodes(treeState.nodes) : []),
    [treeState]
  )

  // T8: reconcile the selection on every refresh — drop any id whose path no
  // longer exists in the (re)loaded tree (design.md §2).
  useEffect(() => {
    if (treeState.status !== 'ready') return
    setSelectedIds((current) => {
      const next = current.filter((id) => fileTypes.has(id))
      return next.length === current.length ? current : next
    })
  }, [fileTypes, treeState.status])

  // Keeps the tree's highlight in sync with whatever file the viewer has
  // open (e.g. the very first plain-click open below already sets
  // `selectedIds` itself, but this also covers `selectedPath` arriving from
  // outside the tree). Never overrides an in-progress Ctrl/Shift selection
  // that already contains the path.
  useEffect(() => {
    if (!selectedPath) return
    setSelectedIds((current) => (current.includes(selectedPath) ? current : [selectedPath]))
  }, [selectedPath])

  const handleSelectedIdsChange = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids)
      // Ctrl/Shift changes only ever adjust the selection set — never open
      // the viewer or touch `activeDirPath`, no matter what the resulting
      // selection ends up looking like (UX-R3.2, e.g. Ctrl-click deselecting
      // down to exactly one file must not pop the viewer open).
      const mods = lastClickModsRef.current
      if (mods.toggle || mods.range) return
      if (ids.length !== 1) return
      const path = ids[0]
      if (path === undefined) return
      const type = fileTypes.get(path)
      if (type === 'directory') {
        setActiveDirPath(path)
        return
      }
      if (type === 'file') onOpenFile(path)
    },
    [fileTypes, onOpenFile]
  )

  // Captured ahead of the Tree row's own `onClick` (see `lastClickModsRef`
  // above) — attached on the scroll container so it fires for every row
  // regardless of which inner element the click actually lands on.
  const handleTreeClickCapture = useCallback((event: MouseEvent) => {
    lastClickModsRef.current = {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey
    }
  }, [])

  const ensureExpanded = useCallback((dirPath: string) => {
    if (dirPath === '') return
    setExpandedIds((current) => (current.includes(dirPath) ? current : [...current, dirPath]))
  }, [])

  const reportError = useCallback((err: unknown) => {
    console.error('[explorer] file operation failed', err)
    setActionError(true)
  }, [])

  const refresh = useCallback(() => setRefreshToken((current) => current + 1), [])

  const closeAllInputs = useCallback(() => {
    committedRef.current = false
    setPendingInput(null)
    setPendingInputValue('')
    setRenaming(null)
    setRenameValue('')
    setConflict(null)
  }, [])

  // --- Create (FM-R1) ------------------------------------------------------

  const doCreate = useCallback(
    async (targetRel: string, kind: 'file' | 'directory', opts?: { overwrite?: boolean }) => {
      if (kind === 'file') await window.hive.fs.createFile(workspace, targetRel, opts)
      else await window.hive.fs.createDirectory(workspace, targetRel)
      refresh()
    },
    [workspace, refresh]
  )

  const submitCreate = useCallback(
    async (parentPath: string, kind: 'file' | 'directory', rawName: string) => {
      const name = validateEntryName(rawName)
      if (!name) return
      const targetRel = joinRelative(parentPath, name)
      try {
        const exists = await window.hive.fs.exists(workspace, targetRel)
        if (exists) {
          setConflict({
            itemLabel: name,
            supportsOverwrite: kind === 'file',
            onOverwrite: async () => {
              try {
                await doCreate(targetRel, kind, { overwrite: true })
                closeAllInputs()
              } catch (err) {
                reportError(err)
                closeAllInputs()
              }
            },
            onRename: () => {
              committedRef.current = false
              setConflict(null)
            },
            onCancel: () => closeAllInputs()
          })
          return
        }
        await doCreate(targetRel, kind)
        closeAllInputs()
      } catch (err) {
        if (isFsConflictError(err)) {
          setConflict({
            itemLabel: name,
            supportsOverwrite: kind === 'file',
            onOverwrite: async () => {
              try {
                await doCreate(targetRel, kind, { overwrite: true })
                closeAllInputs()
              } catch (retryErr) {
                reportError(retryErr)
                closeAllInputs()
              }
            },
            onRename: () => {
              committedRef.current = false
              setConflict(null)
            },
            onCancel: () => closeAllInputs()
          })
          return
        }
        reportError(err)
        closeAllInputs()
      }
    },
    [workspace, doCreate, closeAllInputs, reportError]
  )

  const startCreate = useCallback(
    (parentPath: string, kind: 'file' | 'directory') => {
      setMenuFor(null)
      ensureExpanded(parentPath)
      setPendingInput({
        parentPath,
        kind,
        initialValue: '',
        commit: (name) => submitCreate(parentPath, kind, name)
      })
      setPendingInputValue('')
    },
    [ensureExpanded, submitCreate]
  )

  // --- Rename / internal move (FM-R4) --------------------------------------

  const performMove = useCallback(
    async (fromRel: string, toRel: string, onDone: () => void) => {
      try {
        const exists = await window.hive.fs.exists(workspace, toRel)
        if (exists) {
          setConflict({
            itemLabel: basename(toRel),
            supportsOverwrite: true,
            onOverwrite: async () => {
              try {
                await window.hive.fs.move(workspace, fromRel, toRel, { overwrite: true })
                refresh()
                onDone()
              } catch (err) {
                reportError(err)
                onDone()
              }
            },
            onRename: () => {
              committedRef.current = false
              setConflict(null)
            },
            onCancel: () => onDone()
          })
          return
        }
        await window.hive.fs.move(workspace, fromRel, toRel)
        refresh()
        onDone()
      } catch (err) {
        if (isFsConflictError(err)) {
          setConflict({
            itemLabel: basename(toRel),
            supportsOverwrite: true,
            onOverwrite: async () => {
              try {
                await window.hive.fs.move(workspace, fromRel, toRel, { overwrite: true })
                refresh()
                onDone()
              } catch (retryErr) {
                reportError(retryErr)
                onDone()
              }
            },
            onRename: () => {
              committedRef.current = false
              setConflict(null)
            },
            onCancel: () => onDone()
          })
          return
        }
        reportError(err)
        onDone()
      }
    },
    [workspace, refresh, reportError]
  )

  const startRename = useCallback((path: string) => {
    setMenuFor(null)
    const parentPath = parentOf(path)
    setRenaming({ path, parentPath, initialValue: basename(path) })
    setRenameValue(basename(path))
  }, [])

  const submitRename = useCallback(
    (rawName: string) => {
      if (!renaming) return
      const name = validateEntryName(rawName)
      if (!name) return
      const toRel = joinRelative(renaming.parentPath, name)
      if (toRel === renaming.path) {
        closeAllInputs()
        return
      }
      void performMove(renaming.path, toRel, closeAllInputs)
    },
    [renaming, performMove, closeAllInputs]
  )

  // --- Delete (FM-R3) -------------------------------------------------------

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    window.hive.fs.trash(workspace, target).then(refresh, reportError)
  }, [deleteTarget, workspace, refresh, reportError])

  // --- Internal drag-and-drop move (FM-R4.2) --------------------------------

  const handleRowDragStart = useCallback((event: DragEvent, path: string) => {
    dragSourceRef.current = path
    event.dataTransfer.effectAllowed = 'move'
    try {
      event.dataTransfer.setData('text/plain', path)
    } catch {
      // jsdom / some browsers can throw on setData in odd states — the
      // internal move still works via dragSourceRef, so this is best-effort.
    }
  }, [])

  const moveInternal = useCallback(
    (sourcePath: string, destDir: string) => {
      if (isSelfOrDescendant(sourcePath, destDir)) return
      const name = basename(sourcePath)
      const toRel = joinRelative(destDir, name)
      if (toRel === sourcePath) return
      void performMove(sourcePath, toRel, () => {})
    },
    [performMove]
  )

  // --- External OS import (FM-R5) -------------------------------------------

  const importQueueRef = useRef<{ absPath: string; name: string }[]>([])
  const importDestRef = useRef('')

  const doImport = useCallback(
    async (absPath: string, destRel: string, opts?: { overwrite?: boolean }) => {
      await window.hive.fs.importEntry(workspace, absPath, destRel, opts)
      refresh()
    },
    [workspace, refresh]
  )

  // `processNextImport` recurses to advance the batch queue (FM-R5.3). A
  // `const fn = useCallback(() => { ...fn()... })` self-reference is a TDZ
  // hazard (the binding isn't assigned until `useCallback` returns, even
  // though by call-time — always after a render commit — it safely is) — an
  // indirection ref sidesteps it: the recursive calls below go through
  // `processNextImportRef.current`, which is kept pointed at the latest
  // `processNextImport` just after it's (re)created.
  const processNextImportRef = useRef<() => void>(() => {})

  const processNextImport = useCallback(() => {
    const next = importQueueRef.current.shift()
    if (!next) return
    const destDir = importDestRef.current
    const targetRel = joinRelative(destDir, next.name)
    window.hive.fs
      .exists(workspace, targetRel)
      .then((exists) => {
        if (exists) {
          setConflict({
            itemLabel: next.name,
            supportsOverwrite: true,
            onOverwrite: async () => {
              try {
                await doImport(next.absPath, targetRel, { overwrite: true })
              } catch (err) {
                reportError(err)
              }
              setConflict(null)
              processNextImportRef.current()
            },
            onRename: () => {
              setConflict(null)
              ensureExpanded(destDir)
              setPendingInput({
                parentPath: destDir,
                kind: 'file',
                initialValue: next.name,
                commit: async (name) => {
                  try {
                    await doImport(next.absPath, joinRelative(destDir, name))
                  } catch (err) {
                    reportError(err)
                  }
                  closeAllInputs()
                  processNextImportRef.current()
                }
              })
              setPendingInputValue(next.name)
            },
            onCancel: () => {
              setConflict(null)
              processNextImportRef.current()
            }
          })
          return
        }
        return doImport(next.absPath, targetRel).then(
          () => processNextImportRef.current(),
          (err: unknown) => {
            if (isFsConflictError(err)) {
              setConflict({
                itemLabel: next.name,
                supportsOverwrite: true,
                onOverwrite: async () => {
                  try {
                    await doImport(next.absPath, targetRel, { overwrite: true })
                  } catch (retryErr) {
                    reportError(retryErr)
                  }
                  setConflict(null)
                  processNextImportRef.current()
                },
                onRename: () => {
                  setConflict(null)
                  processNextImportRef.current()
                },
                onCancel: () => {
                  setConflict(null)
                  processNextImportRef.current()
                }
              })
              return
            }
            reportError(err)
            processNextImportRef.current()
          }
        )
      })
      .catch((err) => {
        reportError(err)
        processNextImportRef.current()
      })
  }, [workspace, doImport, ensureExpanded, closeAllInputs, reportError])

  // Ref assignment must happen post-render (react-hooks/refs) — an effect,
  // not a plain statement in the render body, keeps it pointed at the latest
  // `processNextImport` for the recursive calls above.
  useEffect(() => {
    processNextImportRef.current = processNextImport
  }, [processNextImport])

  const importFiles = useCallback(
    (files: File[], destDir: string) => {
      if (files.length === 0) return
      importDestRef.current = destDir
      importQueueRef.current = files.map((file) => ({
        absPath: window.hive.fs.pathForFile(file),
        name: file.name
      }))
      processNextImport()
    },
    [processNextImport]
  )

  // --- Shared row drag-over/drop handler (internal move + OS import) -------

  const handleRowDragOver = useCallback((event: DragEvent, targetPath: string, isDir: boolean) => {
    event.preventDefault()
    event.stopPropagation()
    if (isDir) setDragOverPath(targetPath)
  }, [])

  const handleRowDrop = useCallback(
    (event: DragEvent, targetPath: string, isDir: boolean) => {
      event.preventDefault()
      event.stopPropagation()
      setDragOverPath(null)
      const destDir = isDir ? targetPath : parentOf(targetPath)
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        importFiles(Array.from(files), destDir)
        dragSourceRef.current = null
        return
      }
      const source = dragSourceRef.current
      dragSourceRef.current = null
      if (source) moveInternal(source, destDir)
    },
    [importFiles, moveInternal]
  )

  const handleRootDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
  }, [])

  const handleRootDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        importFiles(Array.from(files), '')
        dragSourceRef.current = null
        return
      }
      const source = dragSourceRef.current
      dragSourceRef.current = null
      if (source) moveInternal(source, '')
    },
    [importFiles, moveInternal]
  )

  const handleInputKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      onCommit: (value: string) => void,
      onCancel: () => void
    ) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onCommit((event.target as HTMLInputElement).value)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    },
    []
  )

  const displayNodes = useMemo(() => {
    if (!pendingInput) return dsNodes
    return injectNode(dsNodes, pendingInput.parentPath, {
      id: CREATE_ROW_ID,
      label: ''
    })
  }, [dsNodes, pendingInput])

  const renderRow = useCallback(
    (
      node: DsTreeNodeShape,
      state: { expanded: boolean; hasChildren: boolean }
    ): React.JSX.Element => {
      if (node.id === CREATE_ROW_ID && pendingInput) {
        return (
          <span className="wb-tree-row-content">
            <span className="wb-tree-icon">
              {pendingInput.kind === 'directory' ? <FolderIcon /> : <FileIcon />}
            </span>
            <input
              autoFocus
              className="wb-tree-inline-input"
              placeholder={t('explorer.newItemPlaceholder')}
              value={pendingInputValue}
              aria-label={t('explorer.newItemPlaceholder')}
              onChange={(event) => setPendingInputValue(event.target.value)}
              onKeyDown={(event) =>
                handleInputKeyDown(
                  event,
                  (value) => {
                    // Same double-commit guard as onBlur below — Enter and
                    // blur can both fire for one input session (e.g. Enter
                    // naturally shifting focus), and only the first valid
                    // attempt should go through.
                    if (committedRef.current || !validateEntryName(value)) return
                    committedRef.current = true
                    void pendingInput.commit(value)
                  },
                  closeAllInputs
                )
              }
              onBlur={() => {
                // T7: blur commits (same path as Enter) instead of
                // cancelling. `committedRef` blocks a second commit when
                // Enter already fired, or when this blur is really the
                // conflict-dialog-mid-commit teardown (pendingInput/renaming
                // stay mounted while the conflict dialog is up, so the input
                // can still blur once more before the dialog resolves).
                if (committedRef.current) return
                if (!validateEntryName(pendingInputValue)) {
                  closeAllInputs()
                  return
                }
                committedRef.current = true
                void pendingInput.commit(pendingInputValue)
              }}
              onClick={(event) => event.stopPropagation()}
            />
          </span>
        )
      }

      if (renaming && node.id === renaming.path) {
        return (
          <span className="wb-tree-row-content">
            <span className="wb-tree-icon">{fileIconFor(node.id)}</span>
            <input
              autoFocus
              className="wb-tree-inline-input"
              placeholder={t('explorer.renamePlaceholder')}
              value={renameValue}
              aria-label={t('explorer.renamePlaceholder')}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) =>
                handleInputKeyDown(
                  event,
                  (value) => {
                    if (committedRef.current || !validateEntryName(value)) return
                    committedRef.current = true
                    submitRename(value)
                  },
                  closeAllInputs
                )
              }
              onBlur={() => {
                if (committedRef.current) return
                if (!validateEntryName(renameValue)) {
                  closeAllInputs()
                  return
                }
                committedRef.current = true
                submitRename(renameValue)
              }}
              onClick={(event) => event.stopPropagation()}
            />
          </span>
        )
      }

      const isDir = fileTypes.get(node.id) === 'directory' || state.hasChildren
      const label = String(node.label)

      return (
        <span
          className={
            dragOverPath === node.id
              ? 'wb-tree-row-content wb-tree-row-dropover'
              : 'wb-tree-row-content'
          }
          draggable
          onDragStart={(event) => handleRowDragStart(event, node.id)}
          onDragOver={(event) => handleRowDragOver(event, node.id, isDir)}
          onDragLeave={() => setDragOverPath((current) => (current === node.id ? null : current))}
          onDrop={(event) => handleRowDrop(event, node.id, isDir)}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setMenuFor(node.id)
          }}
        >
          {state.hasChildren ? (
            <>
              <svg
                className="hds-tree-chevron"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="wb-tree-icon">
                {state.expanded ? <FolderOpenIcon /> : <FolderIcon />}
              </span>
            </>
          ) : (
            <span className="wb-tree-icon">{fileIconFor(node.id)}</span>
          )}
          <span className="hds-tree-label-text">{node.label}</span>
          <DropdownMenu
            open={menuFor === node.id}
            onOpenChange={(open) => setMenuFor(open ? node.id : null)}
          >
            <DropdownMenuTrigger asChild>
              <IconButton
                label={t('explorer.rowMenuLabel', label)}
                className="wb-tree-row-menu-btn"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreIcon />
              </IconButton>
            </DropdownMenuTrigger>
            {menuFor === node.id && (
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => startCreate(isDir ? node.id : parentOf(node.id), 'file')}
                >
                  {t('explorer.menuNewFile')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => startCreate(isDir ? node.id : parentOf(node.id), 'directory')}
                >
                  {t('explorer.menuNewFolder')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startRename(node.id)}>
                  <PencilIcon size={14} />
                  {t('explorer.menuRename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="danger"
                  onSelect={() => {
                    setMenuFor(null)
                    setDeleteTarget(node.id)
                  }}
                >
                  <TrashIcon size={14} />
                  {t('explorer.menuDelete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </span>
      )
    },
    [
      pendingInput,
      pendingInputValue,
      renaming,
      renameValue,
      fileTypes,
      dragOverPath,
      menuFor,
      handleInputKeyDown,
      closeAllInputs,
      submitRename,
      handleRowDragStart,
      handleRowDragOver,
      handleRowDrop,
      startCreate,
      startRename
    ]
  )

  const treeBody = ((): React.JSX.Element => {
    if (treeState.status === 'loading') {
      return (
        <div className="wb-pane-center">
          <Spinner label={t('explorer.treeLoading')} />
        </div>
      )
    }

    if (treeState.status === 'error') {
      return (
        <div className="wb-pane-center">
          <Empty
            title={t('explorer.treeErrorTitle')}
            description={t('explorer.treeErrorDescription')}
          />
        </div>
      )
    }

    if (displayNodes.length === 0) {
      return (
        <div className="wb-pane-center">
          <Empty
            title={t('explorer.treeEmptyTitle')}
            description={t('explorer.treeEmptyDescription')}
          />
        </div>
      )
    }

    return (
      <div
        className="wb-rail-scroll"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onClickCapture={handleTreeClickCapture}
      >
        <Tree
          nodes={displayNodes}
          selection="multiple"
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onExpandedIdsChange={setExpandedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          renderLabel={renderRow}
          aria-label={t('explorer.treeAriaLabel')}
        />
      </div>
    )
  })()

  return (
    <>
      <div className="wb-tree-toolbar">
        <IconButton
          label={t('explorer.newFileLabel')}
          onClick={() => startCreate(activeDirPath, 'file')}
        >
          <PlusIcon />
        </IconButton>
        <IconButton
          label={t('explorer.newFolderLabel')}
          onClick={() => startCreate(activeDirPath, 'directory')}
        >
          <FolderPlusIcon />
        </IconButton>
      </div>
      {actionError && <div className="wb-tree-error">{t('explorer.actionErrorMessage')}</div>}
      {treeBody}
      {deleteTarget && (
        <Dialog open onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogTitle>{t('explorer.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('explorer.deleteDialogDescription', basename(deleteTarget))}
            </DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={() => setDeleteTarget(null)}>
                {t('explorer.deleteCancelCta')}
              </Button>
              <Button className="wb-btn hds-btn-primary" onClick={confirmDelete}>
                {t('explorer.deleteConfirmCta')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {conflict && (
        <Dialog open onOpenChange={(open: boolean) => !open && conflict.onCancel()}>
          <DialogContent>
            <DialogTitle>{t('explorer.conflictDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('explorer.conflictDialogDescription', conflict.itemLabel)}
            </DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={conflict.onCancel}>
                {t('explorer.conflictCancelCta')}
              </Button>
              <Button className="wb-btn" onClick={conflict.onRename}>
                {t('explorer.conflictRenameCta')}
              </Button>
              {conflict.supportsOverwrite && (
                <Button
                  className="wb-btn hds-btn-primary"
                  onClick={() => void conflict.onOverwrite()}
                >
                  {t('explorer.conflictOverwriteCta')}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export interface FileViewerProps {
  /** Absolute path to the active workspace (readFile roots itself here). */
  workspace: string
  /** Workspace-relative path of the file to show (design.md §4 "File viewer", R5.2/R5.4). */
  path: string
  /** Invoked by the header's close control — the pane only exists while a file is open. */
  onClose: () => void
}

/**
 * Structural mirror of `main/fsService.ts`'s `EntryMeta` (design.md §1) — the
 * edit baseline (FM-R2.3). Kept local for the same reason `FsTreeNode`
 * above is: this component stays self-contained inside `explorer/**`
 * rather than importing across the main/renderer boundary.
 */
interface EntryMeta {
  mtimeMs: number
  size: number
}

/**
 * Extensions the editor refuses to open as text (T9/FM-R2.1 "binary/unknown
 * files stay read-only"). Everything else — including files with no
 * recognized extension — is treated as editable text, matching the viewer's
 * existing default of rendering any non-markdown file as a `CodeBlock`.
 */
const BINARY_EXTENSIONS =
  /\.(png|jpe?g|gif|bmp|ico|webp|avif|pdf|zip|tar|gz|7z|rar|exe|dll|so|dylib|bin|woff2?|ttf|otf|eot|mp3|mp4|wav|mov|avi|db|sqlite3?)$/i

function isEditablePath(path: string): boolean {
  return !BINARY_EXTENSIONS.test(path)
}

/** Shape of the confirm-before-discard prompt (FM-R2.1's unsaved-changes guard): either a pending file switch, or the pane's own close action. */
type PendingDiscard = { target: string } | { target: 'close' }

/**
 * `edit` vs `preview` (T5, design.md §3, UX-R1.1/R1.4/R7/R8). Replaces the
 * old `editing` boolean: editable files always default to `edit` on open (no
 * pencil-click needed); `preview` is only ever reachable via the toggle, and
 * only offered for `.md`/`.html` (see `previewable` below) — renders the
 * live `draft`, not the last-loaded/saved content, so it reflects unsaved
 * edits.
 */
type ViewerMode = 'edit' | 'preview'

/**
 * File viewer pane (task T12's viewer half; task T9 promotes it to an
 * editor, T5 makes edit the default — design.md §5/§3, FM-R2/UX-R1): a
 * titled pane — file icon, name, parent path, mode-toggle/copy/close
 * actions — over either the editable `<textarea>` (the default for any
 * editable file) or, once toggled, a preview render (`.md` via `Markdown`
 * (T1), `.html` via `HtmlPreview` (T4)) of the current draft. Binary files
 * skip the mode concept entirely and stay in the old read-only `CodeBlock`
 * view.
 *
 * `path` is the pane's *requested* file; `displayedPath` is what's actually
 * loaded/shown. They're kept separate so an unsaved-changes guard can
 * intercept a `path` change from the tree (FileTree calls `onOpenFile`
 * directly, updating the parent's state immediately — there's no other
 * interception point) without touching `FileTree` itself: while dirty, an
 * incoming `path` is parked in `pendingDiscard` and a confirm dialog shown;
 * `displayedPath` (and thus the fetch effect below) only advances once the
 * user confirms discarding.
 */
export function FileViewer({ workspace, path, onClose }: FileViewerProps): React.JSX.Element {
  const [displayedPath, setDisplayedPath] = useState(path)
  const [viewerState, setViewerState] = useState<ViewerState>({
    status: 'loading',
    path: displayedPath
  })
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<ViewerMode>('edit')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [staleOpen, setStaleOpen] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard | null>(null)
  // Bumped on every (re)load from disk (initial open + STALE "Recarregar") —
  // remounts `HtmlPreview`'s iframe so its internal script state resets
  // instead of surviving under a stale `srcDoc` (T4/T5 wiring).
  const [reloadKey, setReloadKey] = useState(0)

  const editable = isEditablePath(displayedPath)
  const dirty = editable && viewerState.status === 'ready' && draft !== viewerState.content

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setViewerState({ status: 'loading', path: displayedPath })
      setMode('edit')
      setStaleOpen(false)
      setActionError(false)
      try {
        const [content, baseline] = await Promise.all([
          window.hive.readFile(workspace, displayedPath),
          window.hive.fs.statFile(workspace, displayedPath).then(
            (meta) => meta,
            () => null
          )
        ])
        if (cancelled) return
        setViewerState({ status: 'ready', path: displayedPath, content, baseline })
        setDraft(content)
        setReloadKey((current) => current + 1)
      } catch {
        if (!cancelled) setViewerState({ status: 'error', path: displayedPath })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, displayedPath])

  // Unsaved-changes guard (FM-R2.1): a `path` prop change is the tree
  // opening a different file. If dirty, park it in `pendingDiscard` instead
  // of adopting it immediately — the fetch effect above only reacts to
  // `displayedPath`, so the currently-open file stays on screen until the
  // user confirms or cancels. The reset-state statement lives inside a
  // callback invoked from the effect (react-hooks/set-state-in-effect),
  // not as a direct statement in the effect body.
  useEffect(() => {
    const sync = (): void => {
      if (path === displayedPath) return
      if (dirty) {
        setPendingDiscard({ target: path })
      } else {
        setDisplayedPath(path)
      }
    }
    sync()
  }, [path, displayedPath, dirty])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const separatorIndex = displayedPath.lastIndexOf('/')
  const fileName = separatorIndex === -1 ? displayedPath : displayedPath.slice(separatorIndex + 1)
  const parentPath = separatorIndex === -1 ? '' : displayedPath.slice(0, separatorIndex)

  // Copy/Edit/Discard/Save/Sobrescrever are all only wired to controls that
  // are `disabled` (Copy/Edit — React's DOM event system itself refuses to
  // dispatch click/etc. to a disabled native form control, so these can
  // never actually run while not ready) or conditionally unmounted
  // (Discard/Save only render while `dirty`, Sobrescrever only while
  // `staleOpen` — both imply `viewerState` already reached 'ready'). Rather
  // than a defensive (and, per those invariants, dead) `if (status !==
  // 'ready') return` branch in each one, narrow once with a cast — the
  // invariant is enforced by disabled/conditional-mount, not a runtime
  // check here.
  const readyState = viewerState as Extract<ViewerState, { status: 'ready' }>

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(readyState.content).then(() => setCopied(true))
  }, [readyState])

  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'edit' ? 'preview' : 'edit'))
  }, [])

  const handleDiscard = useCallback(() => {
    setDraft(readyState.content)
  }, [readyState])

  // Returns whether the save actually landed — callers that need to chain a
  // close/switch after saving (Ctrl+S's caller doesn't, but the 3-way
  // unsaved-guard's "Salvar" does) use this to decide whether to proceed or
  // abort in favor of the STALE dialog (design.md §3: "on STALE, surface the
  // existing stale dialog and abort the close").
  const performSave = useCallback(
    async (force: boolean): Promise<boolean> => {
      setSaving(true)
      setActionError(false)
      try {
        const meta = force
          ? await window.hive.fs.saveFile(workspace, readyState.path, draft)
          : await window.hive.fs.saveFile(workspace, readyState.path, draft, {
              expectedMtimeMs: readyState.baseline?.mtimeMs
            })
        setViewerState({ status: 'ready', path: readyState.path, content: draft, baseline: meta })
        setStaleOpen(false)
        return true
      } catch (err) {
        if (isFsConflictError(err) && err.code === 'STALE') {
          setStaleOpen(true)
        } else {
          setActionError(true)
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [workspace, readyState, draft]
  )

  // Ctrl/Cmd+S (UX-R1.2): scoped to the viewer's lifetime via mount/unmount
  // of this effect. `preventDefault` always fires (so the OS/browser save
  // dialog never appears), independent of whether there's anything to save —
  // `performSave` itself is only invoked while `dirty`, making the shortcut a
  // no-op on a clean file.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (!isSaveShortcut) return
      event.preventDefault()
      if (dirty) void performSave(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dirty, performSave])

  const handleSave = useCallback(() => void performSave(false), [performSave])
  const handleOverwrite = useCallback(() => void performSave(true), [performSave])

  const handleReload = useCallback(() => {
    setStaleOpen(false)
    Promise.all([
      window.hive.readFile(workspace, displayedPath),
      window.hive.fs.statFile(workspace, displayedPath).then(
        (meta) => meta,
        () => null
      )
    ]).then(
      ([content, baseline]) => {
        setViewerState({ status: 'ready', path: displayedPath, content, baseline })
        setDraft(content)
        setReloadKey((current) => current + 1)
      },
      () => setActionError(true)
    )
  }, [workspace, displayedPath])

  const handleCloseClick = useCallback(() => {
    if (dirty) {
      setPendingDiscard({ target: 'close' })
    } else {
      onClose()
    }
  }, [dirty, onClose])

  // "Descartar" (UX-R1.3): drops the draft and proceeds with whatever
  // triggered the guard — the pane's own close button or the tree's
  // path-switch. Only ever wired to the dialog's own button, which is itself
  // only mounted while `pendingDiscard` is set — see the `readyState`
  // comment above for why this skips a defensive null-check branch.
  const handleDiscardChoice = useCallback(() => {
    const { target } = pendingDiscard as PendingDiscard
    setPendingDiscard(null)
    if (target === 'close') {
      onClose()
    } else {
      setDisplayedPath(target)
    }
  }, [pendingDiscard, onClose])

  // "Salvar" (UX-R1.3): saves the draft first, then continues the same
  // pending close/switch on success. On STALE (or any other save failure),
  // aborts the close/switch instead of silently losing it or silently
  // overwriting — `performSave` has already surfaced the STALE dialog (or
  // `actionError`) as a side effect, so this just dismisses the unsaved
  // guard and leaves the viewer open, still dirty, on `target`.
  const handleSaveChoice = useCallback(() => {
    const { target } = pendingDiscard as PendingDiscard
    void performSave(false).then((ok) => {
      setPendingDiscard(null)
      if (ok) {
        if (target === 'close') {
          onClose()
        } else {
          setDisplayedPath(target)
        }
      }
    })
  }, [pendingDiscard, performSave, onClose])

  // "Cancelar": dismiss the dialog, stay open with the draft still dirty —
  // no state change beyond closing the prompt itself.
  const cancelDiscard = useCallback(() => setPendingDiscard(null), [])

  // Preview is only *offered* for `.md`/`.html` (design.md §3) — other
  // editable text files are edit-only, no toggle at all.
  const previewable = isPreviewable(editable, displayedPath)
  const modeToggle =
    mode === 'edit'
      ? { label: t('explorer.viewLabel'), icon: <EyeIcon /> }
      : { label: t('explorer.editLabel'), icon: <PencilIcon /> }

  return (
    <div className="wb-viewer">
      <header className="wb-viewer-header">
        {fileIconFor(displayedPath)}
        <span className="wb-viewer-name">
          {fileName}
          {dirty && <span className="wb-dirty-dot" aria-label={t('explorer.dirtyLabel')} />}
        </span>
        {parentPath && <span className="wb-viewer-path">{parentPath}</span>}
        <div className="wb-viewer-actions">
          {dirty && (
            <>
              <Button className="wb-btn" onClick={handleDiscard} disabled={saving}>
                {t('explorer.discardCta')}
              </Button>
              <Button className="wb-btn hds-btn-primary" onClick={handleSave} disabled={saving}>
                {t('explorer.saveCta')}
              </Button>
            </>
          )}
          {previewable && (
            <IconButton
              label={modeToggle.label}
              onClick={toggleMode}
              disabled={viewerState.status !== 'ready'}
              aria-pressed={mode === 'preview'}
            >
              {modeToggle.icon}
            </IconButton>
          )}
          <IconButton
            label={copied ? t('explorer.copiedLabel') : t('explorer.copyLabel')}
            onClick={handleCopy}
            disabled={viewerState.status !== 'ready'}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </IconButton>
          <IconButton label={t('explorer.viewerCloseLabel')} onClick={handleCloseClick}>
            <CloseIcon />
          </IconButton>
        </div>
      </header>
      {actionError && <div className="wb-viewer-error">{t('explorer.actionErrorMessage')}</div>}
      {renderViewerBody()}
      {staleOpen && (
        <Dialog open onOpenChange={(open: boolean) => !open && setStaleOpen(false)}>
          <DialogContent>
            <DialogTitle>{t('explorer.staleDialogTitle')}</DialogTitle>
            <DialogDescription>{t('explorer.staleDialogDescription')}</DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={handleReload}>
                {t('explorer.staleReloadCta')}
              </Button>
              <Button className="wb-btn hds-btn-primary" onClick={handleOverwrite}>
                {t('explorer.staleOverwriteCta')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {pendingDiscard && (
        <Dialog open onOpenChange={(open: boolean) => !open && cancelDiscard()}>
          <DialogContent>
            <DialogTitle>{t('explorer.unsavedGuardTitle')}</DialogTitle>
            <DialogDescription>{t('explorer.unsavedGuardDescription')}</DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={cancelDiscard} disabled={saving}>
                {t('explorer.unsavedGuardCancelCta')}
              </Button>
              <Button className="wb-btn" onClick={handleDiscardChoice} disabled={saving}>
                {t('explorer.unsavedGuardConfirmCta')}
              </Button>
              <Button
                className="wb-btn hds-btn-primary"
                onClick={handleSaveChoice}
                disabled={saving}
              >
                {t('explorer.unsavedGuardSaveCta')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )

  function renderViewerBody(): React.JSX.Element {
    if (viewerState.status === 'loading') {
      return (
        <div className="wb-pane-center">
          <Spinner label={t('explorer.viewerLoading')} />
        </div>
      )
    }

    if (viewerState.status === 'error') {
      return (
        <div className="wb-pane-center">
          <Empty
            title={t('explorer.viewerErrorTitle')}
            description={t('explorer.viewerErrorDescription')}
          />
        </div>
      )
    }

    if (!editable) {
      return (
        <div className="wb-viewer-scroll">
          <div className="wb-viewer-content">
            <CodeBlock
              copyText={viewerState.content}
              copyLabel={t('explorer.copyLabel')}
              copiedLabel={t('explorer.copiedLabel')}
            >
              {viewerState.content}
            </CodeBlock>
          </div>
        </div>
      )
    }

    if (mode === 'edit') {
      return (
        <div className="wb-viewer-scroll">
          <div className="wb-viewer-content">
            <textarea
              className="wb-editor-surface"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={t('explorer.editorAriaLabel')}
              spellCheck={false}
            />
          </div>
        </div>
      )
    }

    // mode === 'preview': only reachable via the toggle above, which is only
    // rendered when `previewable` (md/html) — draft, not the last-saved
    // content, is the source of truth (UX-R1.4/R7.1).
    if (isMarkdownPath(viewerState.path)) {
      return (
        <div className="wb-viewer-scroll">
          <div className="wb-viewer-content wb-md" data-testid="markdown-viewer">
            <Markdown source={draft} />
          </div>
        </div>
      )
    }

    // isHtmlPath(viewerState.path): the only other `previewable` kind. Not
    // gated behind an explicit check — `mode` can only reach 'preview' via
    // the toggle, which only renders when `previewable` (md/html), so any
    // non-markdown file here is necessarily HTML.
    return (
      <div className="wb-viewer-scroll">
        <div className="wb-viewer-content" data-testid="html-preview-pane">
          <HtmlPreview source={draft} reloadKey={reloadKey} />
        </div>
      </div>
    )
  }
}
