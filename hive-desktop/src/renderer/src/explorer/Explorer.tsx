import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
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
import { renderMarkdown } from '../ui/markdown'
import { IconButton } from '../ui/IconButton'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
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
  | { status: 'ready'; path: string; content: string }

interface DsTreeNodeShape {
  id: string
  label: ReactNode
  children?: DsTreeNodeShape[]
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
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

  const handleSelectedIdsChange = useCallback(
    (ids: string[]) => {
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
            onRename: () => setConflict(null),
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
            onRename: () => setConflict(null),
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
            onRename: () => setConflict(null),
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
            onRename: () => setConflict(null),
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
                  (value) => void pendingInput.commit(value),
                  closeAllInputs
                )
              }
              onBlur={() => closeAllInputs()}
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
              onKeyDown={(event) => handleInputKeyDown(event, submitRename, closeAllInputs)}
              onBlur={() => closeAllInputs()}
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
      <div className="wb-rail-scroll" onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
        <Tree
          nodes={displayNodes}
          selectedIds={selectedPath ? [selectedPath] : []}
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
 * File viewer pane (task T12's viewer half): a titled pane — file icon,
 * name, parent path, copy + close actions — over a readable render (`.md`
 * via `renderMarkdown`, everything else in a DS `CodeBlock`). Re-fetches
 * whenever `path` changes.
 */
export function FileViewer({ workspace, path, onClose }: FileViewerProps): React.JSX.Element {
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading', path })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      setViewerState({ status: 'loading', path })
      window.hive.readFile(workspace, path).then(
        (content: string) => {
          if (!cancelled) setViewerState({ status: 'ready', path, content })
        },
        () => {
          if (!cancelled) setViewerState({ status: 'error', path })
        }
      )
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workspace, path])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const separatorIndex = path.lastIndexOf('/')
  const fileName = separatorIndex === -1 ? path : path.slice(separatorIndex + 1)
  const parentPath = separatorIndex === -1 ? '' : path.slice(0, separatorIndex)

  const handleCopy = useCallback(() => {
    if (viewerState.status !== 'ready') return
    void navigator.clipboard.writeText(viewerState.content).then(() => setCopied(true))
  }, [viewerState])

  return (
    <div className="wb-viewer">
      <header className="wb-viewer-header">
        {fileIconFor(path)}
        <span className="wb-viewer-name">{fileName}</span>
        {parentPath && <span className="wb-viewer-path">{parentPath}</span>}
        <div className="wb-viewer-actions">
          <IconButton
            label={copied ? t('explorer.copiedLabel') : t('explorer.copyLabel')}
            onClick={handleCopy}
            disabled={viewerState.status !== 'ready'}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </IconButton>
          <IconButton label={t('explorer.viewerCloseLabel')} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
      </header>
      {renderViewerBody()}
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

    if (isMarkdownPath(viewerState.path)) {
      return (
        <div className="wb-viewer-scroll">
          <div className="wb-viewer-content wb-md hds-markdown" data-testid="markdown-viewer">
            {renderMarkdown(viewerState.content)}
          </div>
        </div>
      )
    }

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
}
