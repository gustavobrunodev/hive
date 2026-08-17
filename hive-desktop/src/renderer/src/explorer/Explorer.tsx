import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
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
import { watchWorkspaceShared } from '../workspaceWatch'
import { gitStatusColor, rollupChangedFolders, type GitDecoration } from '../scm/gitStatus'
import { hasGutterMarks } from '../scm/gutter'
import { useGutter } from '../scm/useGutter'
import { Markdown } from '../ui/markdown'
import { HtmlPreview } from './HtmlPreview'
import { DocumentViewer } from './DocumentViewer'
import { richViewerKind } from './richViewer'
import { IconButton } from '../ui/IconButton'
import { isPaneDrag } from '../ui/paneDnd'
import { setWorkspaceFileDrag } from '../ui/workspaceFileDnd'
import { FileTypeIcon } from '../ui/fileIcons'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  ExternalFolderIcon,
  EyeIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LayersIcon,
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

/**
 * FM-R5: true when the in-flight drag carries OS files (a drag from Finder /
 * Explorer / the desktop). `dataTransfer.types` exposes `'Files'` during
 * dragover — before the file list itself is readable — so it's the only
 * reliable way to distinguish an *external import* from the tree's own row
 * moves (`text/plain`) or a pane move, and to light up the import overlay.
 */
function isOsFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes('Files') ?? false
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
  /**
   * Invoked when a *file* row is activated (directories only expand/
   * collapse). A plain click opens as a VS Code-style *preview* (no `pin`);
   * a double-click passes `pin: true` so the parent keeps the tab fixed.
   */
  onOpenFile: (path: string, opts?: { pin?: boolean }) => void
  /**
   * git-management (GIT-R11): per-path git decorations for the tree rows
   * (status badge + color; ignored dimmed; folders roll up a change dot). An
   * empty map (the default) leaves the tree undecorated, so the explorer works
   * outside a git repo and in tests that don't drive git.
   */
  decorations?: Map<string, GitDecoration>
  /**
   * design-studio (DS-R1 AC-1): opens a Markdown file as a Design Studio tab.
   * Offered from the row's context menu only for `.md` — the Studio reads a UX
   * Spec, and offering it on a `.png` would be a menu item that always fails.
   */
  onOpenDesignStudio?: (path: string) => void
}

/** What the pointer was over when the tree's right-click context menu opened: a row, or the empty area (`null`). */
interface ContextTarget {
  path: string
  isDir: boolean
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

/** The tree row chevron (kept on the DS `hds-tree-chevron` class so the DS's expanded-rotation rule still applies). */
function TreeCaretGlyph(): React.JSX.Element {
  return (
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
  )
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
const EMPTY_DECORATIONS: Map<string, GitDecoration> = new Map()

/** Whether the editor gutter should run for this file (a tracked, editable text file in a repo, GIT-R11.2). */
function gutterEligible(gitEnabled: boolean, editable: boolean, isDocView: boolean): boolean {
  return gitEnabled && editable && !isDocView
}

/** A tree row's git decoration (GIT-R11): a file's status letter, or a folder's rollup dot. */
function GitTreeDecoration({
  deco,
  isDir,
  folderChanged
}: {
  deco: GitDecoration | undefined
  isDir: boolean
  folderChanged: boolean
}): React.JSX.Element | null {
  if (folderChanged) return <span className="wb-tree-git-dot" aria-hidden="true" />
  if (!deco || isDir) return null
  return (
    <span
      className="wb-tree-git-badge"
      data-staged={deco.staged || undefined}
      style={{ color: gitStatusColor(deco.kind) }}
      aria-hidden="true"
    >
      {deco.letter}
    </span>
  )
}

/**
 * design-studio (DS-R1 AC-1): "Abrir no Design Studio", offered only where it
 * can succeed — a Markdown file, with a handler wired. Its own component so
 * the three guards stay off `FileTree`'s complexity budget.
 */
function StudioContextAction({
  target,
  onOpen
}: {
  target: ContextTarget
  onOpen?: (path: string) => void
}): React.JSX.Element | null {
  if (!onOpen || target.isDir || !isMarkdownPath(target.path)) return null
  return (
    <>
      <ContextMenuItem onSelect={() => onOpen(target.path)}>
        <LayersIcon size={14} />
        {t('explorer.menuOpenDesignStudio')}
      </ContextMenuItem>
      <ContextMenuSeparator />
    </>
  )
}

export function FileTree({
  workspace,
  selectedPath,
  onOpenFile,
  decorations = EMPTY_DECORATIONS,
  onOpenDesignStudio
}: FileTreeProps): React.JSX.Element {
  // git-management (GIT-R11): folders showing a rollup dot when a descendant changed.
  const changedFolders = useMemo(() => rollupChangedFolders(decorations), [decorations])
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
  // T9: the paths a pending delete confirmation targets — >1 means the
  // dialog is confirming a bulk delete over the current `selectedIds`
  // (design.md §4 "Bulk delete (UX-R5.1)", context.md C3). A single-item
  // delete (row menu on a row that isn't part of a >1 multi-selection)
  // still lands here as a one-element array — same confirm/cancel/dialog
  // plumbing, just a different description string and a single `fs.trash`
  // call instead of iterating.
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  // VS Code-style right-click menu (whole tree area is the Radix ContextMenu
  // trigger): captured *before* Radix's own native `contextmenu` listener
  // fires (React capture phase runs earlier), so the content below knows
  // whether it's row-scoped or empty-area-scoped when it opens.
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  // The message itself rather than a boolean: the OS-parity actions
  // (explorer-os-actions) fail for a reason of their own — the host has no
  // file manager to hand the path to — and "tente novamente" is the wrong
  // advice for it.
  const [actionError, setActionError] = useState<string | null>(null)
  // explorer-os-actions: transient confirmation for a copy. The clipboard is
  // completely silent, and the menu that triggered it is already gone by the
  // time it lands, so without this the action has no observable outcome at
  // all — for anyone, but especially for a screen-reader user.
  const [flash, setFlash] = useState<string | null>(null)
  // FM-R5: true while an OS file drag hovers the rail — drives the panel-wide
  // "Solte para importar" overlay. Distinct from `dragOverPath` (which lights
  // up a single folder row for both internal moves and imports); this is only
  // ever the *external* import affordance. A dragenter/dragleave depth counter
  // (both bubble per child element) keeps it stable as the pointer crosses the
  // tree's nested rows.
  const [importActive, setImportActive] = useState(false)
  const importDepthRef = useRef(0)
  // Defined up here (not with the other DnD handlers) because the row/root
  // drop handlers below also need to tear the overlay down, and a `const`
  // referenced in their dependency arrays must already be initialized.
  const clearImportDrag = useCallback(() => {
    importDepthRef.current = 0
    setImportActive(false)
  }, [])
  // T10: the drag payload — one or more paths. Populated in
  // `handleRowDragStart` from either the whole current selection (dragging a
  // row that's part of it) or just the dragged row (dragging an unselected
  // row, which also resets `selectedIds` — see there).
  const dragSourcesRef = useRef<string[] | null>(null)
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
  // manual reload. Unsubscribes on unmount / workspace change — through the
  // shared multiplexer, since the sidebar unmounts this view whenever the user
  // switches to Source Control / Second Brain and the raw bridge call would
  // take *their* watchers down with it.
  useEffect(() => {
    const unsubscribe = watchWorkspaceShared(workspace, () => {
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
  // longer exists in the (re)loaded tree (design.md §2). The setState lives
  // inside a callback invoked from the effect, not as a direct statement in
  // the effect body (react-hooks/set-state-in-effect — same pattern as the
  // `sync()` guard effect below).
  useEffect(() => {
    const reconcile = (): void => {
      if (treeState.status !== 'ready') return
      setSelectedIds((current) => {
        const next = current.filter((id) => fileTypes.has(id))
        return next.length === current.length ? current : next
      })
    }
    reconcile()
  }, [fileTypes, treeState.status])

  // Keeps the tree's highlight in sync with whatever file the viewer has
  // open (e.g. the very first plain-click open below already sets
  // `selectedIds` itself, but this also covers `selectedPath` arriving from
  // outside the tree). Never overrides an in-progress Ctrl/Shift selection
  // that already contains the path.
  useEffect(() => {
    const sync = (): void => {
      if (!selectedPath) return
      setSelectedIds((current) => (current.includes(selectedPath) ? current : [selectedPath]))
    }
    sync()
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
    setActionError(t('explorer.actionErrorMessage'))
  }, [])

  const refresh = useCallback(() => setRefreshToken((current) => current + 1), [])

  // --- OS-parity actions (explorer-os-actions) -----------------------------

  /**
   * The paths an action invoked on `path` actually applies to: the whole
   * current selection when `path` is part of a multi-selection, otherwise just
   * `path`. Same rule `requestDelete` already uses — right-clicking one of six
   * selected rows and getting an action that ignores the other five is the
   * single most confusing thing a file manager can do.
   */
  const targetsFor = useCallback(
    (path: string): string[] =>
      selectedIds.includes(path) && selectedIds.length > 1 ? selectedIds : [path],
    [selectedIds]
  )

  /** Shows a confirmation for `ms`, replacing whatever was showing. */
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showFlash = useCallback((message: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(message)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2600)
  }, [])
  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    []
  )

  /**
   * Copies the target paths, one per line (FM copy-path parity).
   *
   * `relative` is already what the tree is keyed by — POSIX-style and
   * workspace-relative, which is the form that pastes usefully into a prompt,
   * a doc or a command. `absolute` has to round-trip to main: only main knows
   * the workspace's own absolute location and the host's separator, and
   * composing one in the renderer would produce `/`-joined paths on Windows.
   */
  const copyPaths = useCallback(
    (path: string, kind: 'relative' | 'absolute') => {
      setMenuFor(null)
      const targets = targetsFor(path)
      const resolved =
        kind === 'relative'
          ? Promise.resolve(targets)
          : Promise.all(targets.map((rel) => window.hive.fs.absolutePath(workspace, rel)))
      void resolved
        .then(async (paths) => {
          await navigator.clipboard?.writeText(paths.join('\n'))
          showFlash(t('explorer.pathCopiedFeedback', targets.length))
        })
        .catch(reportError)
    },
    [targetsFor, workspace, showFlash, reportError]
  )

  /** Hands the entry to the host's file manager. `''` is the workspace root (the empty-area menu). */
  const revealInOs = useCallback(
    (path: string, isDir: boolean) => {
      setMenuFor(null)
      void Promise.resolve(window.hive.fs.revealPath(workspace, path, isDir)).catch((err) => {
        console.error('[explorer] reveal failed', err)
        setActionError(t('explorer.revealErrorMessage'))
      })
    },
    [workspace]
  )

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

  // T9 bulk scope, shared by the kebab and the right-click context menu: a
  // row that's part of a >1 multi-selection deletes the whole selection.
  const requestDelete = useCallback(
    (path: string) => {
      setMenuFor(null)
      setDeleteTargets(selectedIds.includes(path) && selectedIds.length > 1 ? selectedIds : [path])
    },
    [selectedIds]
  )

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

  // --- Delete (FM-R3, bulk: UX-R5.1/R5.3) -----------------------------------

  const confirmDelete = useCallback(() => {
    if (!deleteTargets) return
    const targets = deleteTargets
    setDeleteTargets(null)
    if (targets.length <= 1) {
      const target = targets[0]
      if (target === undefined) return
      window.hive.fs.trash(workspace, target).then(refresh, reportError)
      return
    }
    // Bulk delete: fire every item's trash concurrently and let all of them
    // settle before reacting — `Promise.allSettled` (not `Promise.all` /
    // sequential `await`s that bail on the first rejection) is what makes
    // this non-aborting, so one bad item never blocks the rest of the
    // selection from being trashed. Each failure is individually reported
    // (per-item, via the existing `actionError` banner) rather than thrown.
    void Promise.allSettled(targets.map((target) => window.hive.fs.trash(workspace, target))).then(
      (results) => {
        for (const result of results) {
          if (result.status === 'rejected') reportError(result.reason)
        }
        refresh()
        setSelectedIds([])
      }
    )
  }, [deleteTargets, workspace, refresh, reportError])

  // --- Internal drag-and-drop move (FM-R4.2) --------------------------------

  // T10 (UX-R5.2): if the dragged row is already part of the current
  // selection, the whole selection rides along as the drag payload.
  // Otherwise only this row moves, and the selection resets to just it — a
  // drag of an unselected row must never carry along an unrelated stale
  // multi-selection.
  const handleRowDragStart = useCallback(
    (event: DragEvent, path: string) => {
      const inSelection = selectedIds.includes(path)
      const payload = inSelection ? selectedIds : [path]
      if (!inSelection) setSelectedIds([path])
      dragSourcesRef.current = payload
      event.dataTransfer.effectAllowed = 'copyMove'
      try {
        event.dataTransfer.setData('text/plain', path)
      } catch {
        // jsdom / some browsers can throw on setData in odd states — the
        // internal move still works via dragSourcesRef, so this is
        // best-effort.
      }
      // chat-attachments: the same drag is droppable on the chat composer as
      // context files — directories are filtered out (a mention needs a file).
      setWorkspaceFileDrag(
        event,
        payload.filter((entry) => fileTypes.get(entry) === 'file')
      )
    },
    [selectedIds, fileTypes]
  )

  // T10: iterates the drag payload (1 or N paths), running each through the
  // same guards/`performMove` a single-item move already used. Any item
  // whose destination is its own current parent (no-op) or is itself/a
  // descendant of itself is skipped without blocking the rest of the batch.
  // Post-move selection bookkeeping is the existing generic reconciliation
  // effect above (drops any `selectedIds` entry whose path no longer exists
  // once the tree refreshes) — nothing additional needed here.
  const moveInternal = useCallback(
    (sourcePaths: string[], destDir: string) => {
      for (const sourcePath of sourcePaths) {
        if (isSelfOrDescendant(sourcePath, destDir)) continue
        const name = basename(sourcePath)
        const toRel = joinRelative(destDir, name)
        if (toRel === sourcePath) continue
        void performMove(sourcePath, toRel, () => {})
      }
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
  // Pane drags (customizable-layout) fall through untouched — no
  // preventDefault/stopPropagation — so they bubble up to `WorkUI`'s
  // `.wb-pane` drop target instead of lighting up drop-into-folder hints.

  const handleRowDragOver = useCallback((event: DragEvent, targetPath: string, isDir: boolean) => {
    if (isPaneDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (isDir) setDragOverPath(targetPath)
  }, [])

  const handleRowDrop = useCallback(
    (event: DragEvent, targetPath: string, isDir: boolean) => {
      if (isPaneDrag(event)) return
      event.preventDefault()
      event.stopPropagation()
      setDragOverPath(null)
      clearImportDrag()
      const destDir = isDir ? targetPath : parentOf(targetPath)
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        importFiles(Array.from(files), destDir)
        dragSourcesRef.current = null
        return
      }
      const sources = dragSourcesRef.current
      dragSourcesRef.current = null
      if (sources) moveInternal(sources, destDir)
    },
    [importFiles, moveInternal, clearImportDrag]
  )

  const handleRootDragOver = useCallback((event: DragEvent) => {
    if (isPaneDrag(event)) return
    event.preventDefault()
  }, [])

  const handleRootDrop = useCallback(
    (event: DragEvent) => {
      if (isPaneDrag(event)) return
      event.preventDefault()
      clearImportDrag()
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        importFiles(Array.from(files), '')
        dragSourcesRef.current = null
        return
      }
      const sources = dragSourcesRef.current
      dragSourcesRef.current = null
      if (sources) moveInternal(sources, '')
    },
    [importFiles, moveInternal, clearImportDrag]
  )

  // --- Panel-wide OS-import overlay (FM-R5) ---------------------------------
  // These sit on the whole tree body so the "Solte para importar" affordance
  // covers the entire rail, not just individual rows. They only manage the
  // *visual* state + `preventDefault` (so the empty area below the rows still
  // accepts a drop); the actual import runs through the row/root drop handlers
  // underneath, which is why the overlay itself is `pointer-events: none`.

  const handleBodyDragEnter = useCallback((event: DragEvent) => {
    if (!isOsFileDrag(event) || isPaneDrag(event)) return
    importDepthRef.current += 1
    setImportActive(true)
  }, [])

  const handleBodyDragOver = useCallback((event: DragEvent) => {
    if (!isOsFileDrag(event) || isPaneDrag(event)) return
    // Claim the drop across the whole body (rows/root also preventDefault for
    // their own regions; this covers the gaps between and below them).
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleBodyDragLeave = useCallback((event: DragEvent) => {
    if (!isOsFileDrag(event)) return
    importDepthRef.current = Math.max(0, importDepthRef.current - 1)
    if (importDepthRef.current === 0) setImportActive(false)
  }, [])

  const handleBodyDrop = useCallback(() => {
    // Row/root handlers already ran the import (they stopPropagation, so this
    // only fires for the gaps) — here it's purely the overlay teardown.
    clearImportDrag()
    setDragOverPath(null)
  }, [clearImportDrag])

  // A drag that ends outside the rail (Esc, or dropped elsewhere) never fires
  // our drop/leave — a window-level `dragend`/`drop` guarantees the overlay
  // can't get stuck on screen.
  useEffect(() => {
    if (!importActive) return
    const reset = (): void => clearImportDrag()
    window.addEventListener('dragend', reset)
    window.addEventListener('drop', reset)
    return () => {
      window.removeEventListener('dragend', reset)
      window.removeEventListener('drop', reset)
    }
  }, [importActive, clearImportDrag])

  const handleInputKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      onCommit: (value: string) => void,
      onCancel: () => void
    ) => {
      // Every key stops here: the DS Tree's own `onKeyDown` (on the
      // `role="tree"` root) implements typeahead — a bubbled "d" or "." would
      // match a row label, move focus to it, and blur-commit the input
      // mid-typing. Editing must only end on Enter, Escape or clicking away
      // (OS file-manager behavior).
      event.stopPropagation()
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

  // Runs in React's capture phase on the tree container — before Radix's
  // native `contextmenu` listener on the same element opens the menu — so
  // the menu content renders for the right scope (the row under the pointer,
  // or the empty area when there is none).
  const handleTreeContextMenuCapture = useCallback((event: MouseEvent) => {
    const row = (event.target as HTMLElement).closest?.('[data-tree-path]')
    if (row instanceof HTMLElement && row.dataset.treePath !== undefined) {
      setContextTarget({ path: row.dataset.treePath, isDir: row.dataset.treeDir === 'true' })
    } else {
      setContextTarget(null)
    }
  }, [])

  const displayNodes = useMemo(() => {
    if (!pendingInput) return dsNodes
    return injectNode(dsNodes, pendingInput.parentPath, {
      id: CREATE_ROW_ID,
      label: ''
    })
  }, [dsNodes, pendingInput])

  // The inline "type a name" row for a create (renderRow's CREATE_ROW_ID
  // branch) — its own callback so renderRow stays a thin dispatcher.
  const renderCreateRow = useCallback(
    (input: PendingInput): React.JSX.Element => (
      <span className="wb-tree-row-content">
        <span className="wb-tree-caret" aria-hidden="true" />
        {input.kind === 'directory' ? (
          <span className="wb-tree-icon">
            <FolderIcon />
          </span>
        ) : (
          // Live icon: typing "index.html" flips the glyph to HTML as
          // you type, VS Code-style.
          <FileTypeIcon path={pendingInputValue} />
        )}
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
                void input.commit(value)
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
            void input.commit(pendingInputValue)
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </span>
    ),
    [pendingInputValue, handleInputKeyDown, closeAllInputs]
  )

  // The in-place rename row (label swapped for an input) — same dispatcher
  // split as `renderCreateRow`.
  const renderRenameRow = useCallback(
    (
      node: DsTreeNodeShape,
      state: { expanded: boolean; hasChildren: boolean }
    ): React.JSX.Element => {
      const isRenamingDir = fileTypes.get(node.id) === 'directory' || state.hasChildren
      return (
        <span className="wb-tree-row-content">
          <span className="wb-tree-caret" aria-hidden="true">
            {isRenamingDir && <TreeCaretGlyph />}
          </span>
          {isRenamingDir ? (
            <span className="wb-tree-icon">
              {state.expanded ? <FolderOpenIcon /> : <FolderIcon />}
            </span>
          ) : (
            <FileTypeIcon path={renameValue || node.id} />
          )}
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
    },
    [fileTypes, renameValue, handleInputKeyDown, closeAllInputs, submitRename]
  )

  const renderNodeRow = useCallback(
    (
      node: DsTreeNodeShape,
      state: { expanded: boolean; hasChildren: boolean }
    ): React.JSX.Element => {
      const isDir = fileTypes.get(node.id) === 'directory' || state.hasChildren
      const label = String(node.label)
      // git-management (GIT-R11): a file's own decoration; a folder's rollup dot.
      const deco = decorations.get(node.id)
      const folderChanged = isDir && !deco && changedFolders.has(node.id)
      const gitLabelStyle =
        deco && deco.kind !== 'ignored' ? { color: gitStatusColor(deco.kind) } : undefined

      return (
        <span
          className={
            dragOverPath === node.id
              ? 'wb-tree-row-content wb-tree-row-dropover'
              : 'wb-tree-row-content'
          }
          data-tree-path={node.id}
          data-tree-dir={isDir || undefined}
          draggable
          onDragStart={(event) => handleRowDragStart(event, node.id)}
          onDragOver={(event) => handleRowDragOver(event, node.id, isDir)}
          onDragLeave={() => setDragOverPath((current) => (current === node.id ? null : current))}
          onDrop={(event) => handleRowDrop(event, node.id, isDir)}
          onDoubleClick={() => {
            // VS Code: double-click pins the (preview) tab open.
            if (!isDir) onOpenFile(node.id, { pin: true })
          }}
        >
          {/* Fixed-width caret slot on EVERY row — directories show the
              chevron, files an empty spacer — so icons and names align in
              one column regardless of type (OS file-manager alignment). */}
          <span className="wb-tree-caret" aria-hidden="true">
            {isDir && <TreeCaretGlyph />}
          </span>
          {isDir ? (
            <span className="wb-tree-icon">
              {state.expanded ? <FolderOpenIcon /> : <FolderIcon />}
            </span>
          ) : (
            <FileTypeIcon path={node.id} />
          )}
          <span
            className="hds-tree-label-text"
            data-git-ignored={deco?.kind === 'ignored' || undefined}
            style={gitLabelStyle}
          >
            {node.label}
          </span>
          <GitTreeDecoration deco={deco} isDir={isDir} folderChanged={folderChanged} />
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
              // Two guards: clicks inside the (DOM-portalled but React-child)
              // content must not bubble into the DS row's own expand-toggle/
              // activate handlers (or picking "Novo arquivo" collapses the
              // folder it targets); and the menu's close must not auto-focus
              // the trigger back (or it steals focus from the just-mounted
              // inline input, blur-cancelling the edit session instantly).
              <DropdownMenuContent
                align="start"
                onClick={(event) => event.stopPropagation()}
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuItem
                  onSelect={() => startCreate(isDir ? node.id : parentOf(node.id), 'file')}
                >
                  <PlusIcon size={14} />
                  {t('explorer.menuNewFile')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => startCreate(isDir ? node.id : parentOf(node.id), 'directory')}
                >
                  <FolderPlusIcon size={14} />
                  {t('explorer.menuNewFolder')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startRename(node.id)}>
                  <PencilIcon size={14} />
                  {t('explorer.menuRename')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={() => requestDelete(node.id)}>
                  <TrashIcon size={14} />
                  {t('explorer.menuDelete')}
                </DropdownMenuItem>
                {/* Same set as the right-click menu, in the same order: this
                    kebab and that menu are one menu with two openings, and a
                    user who found an action in one must find it in the other. */}
                <DropdownMenuItem onSelect={() => copyPaths(node.id, 'relative')}>
                  <CopyIcon size={14} />
                  {t('explorer.menuCopyRelativePath')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => copyPaths(node.id, 'absolute')}>
                  <CopyIcon size={14} />
                  {t('explorer.menuCopyPath')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => revealInOs(node.id, isDir)}>
                  <ExternalFolderIcon size={14} />
                  {t('explorer.menuRevealInOs', window.hive.platform)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </span>
      )
    },
    [
      fileTypes,
      dragOverPath,
      menuFor,
      handleRowDragStart,
      handleRowDragOver,
      handleRowDrop,
      startCreate,
      startRename,
      requestDelete,
      copyPaths,
      revealInOs,
      onOpenFile,
      decorations,
      changedFolders
    ]
  )

  const renderRow = useCallback(
    (
      node: DsTreeNodeShape,
      state: { expanded: boolean; hasChildren: boolean }
    ): React.JSX.Element => {
      if (node.id === CREATE_ROW_ID && pendingInput) return renderCreateRow(pendingInput)
      if (renaming && node.id === renaming.path) return renderRenameRow(node, state)
      return renderNodeRow(node, state)
    },
    [pendingInput, renaming, renderCreateRow, renderRenameRow, renderNodeRow]
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
      {actionError && (
        <div className="wb-tree-error" role="alert">
          {actionError}
        </div>
      )}
      {/* Always mounted, empty when idle: a live region that only appears at
          the moment it has something to say is announced unreliably (the AT
          has nothing to observe until it is already too late).

          `aria-live` + `aria-atomic` rather than `role="status"`, which is
          just shorthand for the two: the shorthand would put a second
          `status` node in the tree next to the file viewer's own loading
          one, and "there are two statuses here" is a worse answer to
          "what is the state of this panel?" than one region that speaks. */}
      <div
        className="wb-tree-flash"
        aria-live="polite"
        aria-atomic="true"
        data-shown={flash || undefined}
      >
        {flash}
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* The whole tree area (rows, empty space below them, and the
              empty/error states) answers to right-click, VS Code-style, and is
              the drop target for OS file imports (FM-R5) — the drag handlers
              here only toggle the overlay; the row/root handlers below do the
              actual import. */}
          <div
            className={importActive ? 'wb-tree-body is-importing' : 'wb-tree-body'}
            onContextMenuCapture={handleTreeContextMenuCapture}
            onDragEnter={handleBodyDragEnter}
            onDragOver={handleBodyDragOver}
            onDragLeave={handleBodyDragLeave}
            onDrop={handleBodyDrop}
          >
            {treeBody}
            {importActive && (
              <div className="wb-rail-dropzone" aria-hidden="true">
                <div className="wb-rail-dropzone-card">
                  <span className="wb-rail-dropzone-icon">
                    <DownloadIcon size={24} />
                  </span>
                  <span className="wb-rail-dropzone-title">{t('explorer.importDropTitle')}</span>
                  <span className="wb-rail-dropzone-dest">
                    {dragOverPath
                      ? t('explorer.importDropToFolder', basename(dragOverPath))
                      : t('explorer.importDropToRoot', basename(workspace) || workspace)}
                  </span>
                  <span className="wb-rail-dropzone-hint">{t('explorer.importDropHint')}</span>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        {/* Same close-auto-focus guard as the row kebab menu: the inline
            input opened by a menu action must keep its focus. */}
        <ContextMenuContent
          className="wb-tree-context-menu"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {contextTarget ? (
            <>
              <StudioContextAction target={contextTarget} onOpen={onOpenDesignStudio} />
              {/* Same two glyphs the toolbar uses for these exact actions —
                  with eight items in the menu, the two that had no icon read
                  as unfinished rather than as a different kind of thing. */}
              <ContextMenuItem
                onSelect={() =>
                  startCreate(
                    contextTarget.isDir ? contextTarget.path : parentOf(contextTarget.path),
                    'file'
                  )
                }
              >
                <PlusIcon size={14} />
                {t('explorer.menuNewFile')}
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() =>
                  startCreate(
                    contextTarget.isDir ? contextTarget.path : parentOf(contextTarget.path),
                    'directory'
                  )
                }
              >
                <FolderPlusIcon size={14} />
                {t('explorer.menuNewFolder')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => startRename(contextTarget.path)}>
                <PencilIcon size={14} />
                {t('explorer.menuRename')}
              </ContextMenuItem>
              <ContextMenuItem variant="danger" onSelect={() => requestDelete(contextTarget.path)}>
                <TrashIcon size={14} />
                {t('explorer.menuDelete')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {/* Below the separator on purpose: these leave the workspace
                  untouched — they hand a path to the clipboard or to the OS —
                  so they sit apart from the group that edits it. */}
              <ContextMenuItem onSelect={() => copyPaths(contextTarget.path, 'relative')}>
                <CopyIcon size={14} />
                {t('explorer.menuCopyRelativePath')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => copyPaths(contextTarget.path, 'absolute')}>
                <CopyIcon size={14} />
                {t('explorer.menuCopyPath')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => revealInOs(contextTarget.path, contextTarget.isDir)}>
                <ExternalFolderIcon size={14} />
                {t('explorer.menuRevealInOs', window.hive.platform)}
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onSelect={() => startCreate('', 'file')}>
                <PlusIcon size={14} />
                {t('explorer.menuNewFile')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => startCreate('', 'directory')}>
                <FolderPlusIcon size={14} />
                {t('explorer.menuNewFolder')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {/* The empty area IS the workspace root, so the same two actions
                  are offered for it — right-clicking below the last row is how
                  a file manager gets at the folder you are already looking at. */}
              <ContextMenuItem onSelect={() => copyPaths('', 'absolute')}>
                <CopyIcon size={14} />
                {t('explorer.menuCopyPath')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => revealInOs('', true)}>
                <ExternalFolderIcon size={14} />
                {t('explorer.menuRevealWorkspaceInOs', window.hive.platform)}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {deleteTargets && (
        <Dialog open onOpenChange={(open: boolean) => !open && setDeleteTargets(null)}>
          <DialogContent>
            <DialogTitle>{t('explorer.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTargets.length > 1
                ? t('explorer.deleteManyDescription', deleteTargets.length)
                : t('explorer.deleteDialogDescription', basename(deleteTargets[0] ?? ''))}
            </DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={() => setDeleteTargets(null)}>
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
  /**
   * Multi-tab wiring: whether this viewer is the visible tab. Only the
   * active viewer answers Ctrl/Cmd+S — hidden-but-mounted siblings (their
   * drafts survive tab switches) must not save concurrently. Defaults to
   * `true` for single-viewer usage.
   */
  active?: boolean
  /**
   * Enablement-only hook for the workspace-switching guard (WS-R5.1,
   * design.md §5): fired whenever the local `dirty` state changes (including
   * on mount) so a parent (`WorkUI`) can observe it without owning any of
   * the in-viewer guard behavior itself, which stays exactly as-is here.
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * customizable-layout: drag-source wiring (`draggable`/`onDragStart`/
   * `onDragEnd`) spread onto the viewer's own header, so this pane is
   * movable from the same header every other pane is — without stacking a
   * second bar above the file title row. Owned by `WorkUI`.
   */
  paneDragProps?: React.HTMLAttributes<HTMLElement>
  /** customizable-layout: the pane's ↔ move menu, rendered with the header actions. */
  paneControls?: ReactNode
  /**
   * git-management (GIT-R11.2): when the workspace is a git repo, the editor
   * shows a per-line change gutter (added/modified/deleted vs HEAD). Off (the
   * default) outside a repo and in tests that don't drive git.
   */
  gitEnabled?: boolean
}

/**
 * Imperative handle (T8, WS-R5.1, design.md §5.2 "chosen approach: lift a
 * requestFlush ref"): lets a parent (`WorkUI`'s switch guard) trigger the
 * viewer's own non-force save — the exact same `performSave(false)` its
 * "Salvar" button already calls — without duplicating any save/conflict
 * logic outside the viewer. Resolves to whether the save actually landed
 * (`false` on a STALE conflict or any other failure, in which case
 * `performSave` has already surfaced its own dialog/error inline here, same
 * as the in-viewer guard's own "Salvar").
 */
export interface FileViewerHandle {
  requestSave: () => Promise<boolean>
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

/**
 * True when a file should open in the rich `DocumentViewer` (image/pdf/docx/
 * sheet/pptx, or any other binary we don't edit as text) rather than the
 * textarea editor. Kept as a free function so `FileViewer` reads it in one
 * call instead of inlining the two-part condition (and its cyclomatic weight).
 */
function isDocViewPath(path: string): boolean {
  return richViewerKind(path) !== null || !isEditablePath(path)
}

/** Label + icon for the edit⇄preview mode toggle — a free function so `FileViewer` reads it in one call. */
function modeToggleFor(mode: ViewerMode): { label: string; icon: React.JSX.Element } {
  return mode === 'edit'
    ? { label: t('explorer.viewLabel'), icon: <EyeIcon /> }
    : { label: t('explorer.editLabel'), icon: <PencilIcon /> }
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
export const FileViewer = forwardRef<FileViewerHandle, FileViewerProps>(function FileViewer(
  { workspace, path, onClose, active, onDirtyChange, paneDragProps, paneControls, gitEnabled },
  ref
): React.JSX.Element {
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
  // A file that gets a rich visual viewer (image/pdf/docx/sheet/pptx), or any
  // binary we don't edit as text, is shown through `DocumentViewer` instead of
  // the textarea editor / raw `CodeBlock` — so the editor machinery (Copy,
  // mode toggle, text read) all switches off for it.
  const isDocView = isDocViewPath(displayedPath)
  // git-management (GIT-R11.2): per-line change gutter vs HEAD, live as you
  // type. Only for editable text files inside a git repo.
  const gutterMarks = useGutter(
    workspace,
    displayedPath,
    draft,
    gutterEligible(Boolean(gitEnabled), editable, isDocView)
  )
  const gutterRef = useRef<HTMLDivElement>(null)
  // `isDocView` files never enter edit mode (draft stays empty and equal to
  // content), so `dirty` is inherently false for them — no extra guard needed.
  const dirty = editable && viewerState.status === 'ready' && draft !== viewerState.content

  // WS-R5.1 enablement (design.md §5): reports `dirty` upward whenever it
  // changes, including on mount, so a parent can lift/observe it for a
  // future switch guard — purely additive, no in-viewer guard behavior
  // changes here.
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setViewerState({ status: 'loading', path: displayedPath })
      setMode('edit')
      setStaleOpen(false)
      setActionError(false)
      // Rich/binary files: `DocumentViewer` fetches its own bytes (base64 /
      // parsed structure) — reading the file as lossy UTF-8 text here would be
      // wasted work and a large useless string over IPC. Land straight in a
      // ready state with empty text so the header isn't stuck loading.
      if (isDocViewPath(displayedPath)) {
        if (!cancelled) {
          setViewerState({ status: 'ready', path: displayedPath, content: '', baseline: null })
          setDraft('')
          setReloadKey((current) => current + 1)
        }
        return
      }
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

  // T8 (WS-R5.1): exposes `requestSave` for `WorkUI`'s switch guard — the
  // exact same non-force `performSave(false)` the "Salvar" button already
  // calls (see `FileViewerHandle`'s doc comment above).
  useImperativeHandle(ref, () => ({ requestSave: () => performSave(false) }), [performSave])

  // Ctrl/Cmd+S (UX-R1.2): scoped to the viewer's lifetime via mount/unmount
  // of this effect. `preventDefault` always fires (so the OS/browser save
  // dialog never appears), independent of whether there's anything to save —
  // `performSave` itself is only invoked while `dirty`, making the shortcut a
  // no-op on a clean file.
  useEffect(() => {
    // Multi-tab: only the visible tab's viewer owns the shortcut — a hidden
    // sibling (kept mounted so its draft survives) must not also save.
    // `undefined` (single-viewer usage) counts as active.
    if (active === false) return
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (!isSaveShortcut) return
      event.preventDefault()
      if (dirty) void performSave(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, dirty, performSave])

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
  const modeToggle = modeToggleFor(mode)

  return (
    <div className="wb-viewer">
      <header className="wb-viewer-header" {...paneDragProps}>
        <FileTypeIcon path={displayedPath} />
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
          {!isDocView && (
            <IconButton
              label={copied ? t('explorer.copiedLabel') : t('explorer.copyLabel')}
              onClick={handleCopy}
              disabled={viewerState.status !== 'ready'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
          )}
          {paneControls}
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

    // Rich visual viewer (image/pdf/docx/sheet/pptx) or a graceful fallback
    // for any other binary — replaces the old raw-bytes-in-a-CodeBlock view.
    if (isDocView) {
      return <DocumentViewer workspace={workspace} path={displayedPath} />
    }

    if (mode === 'edit') {
      // Full-bleed editing surface (no reading-measure cap, no inner card):
      // the textarea IS the pane body, VS Code-style, so the whole block is
      // writable regardless of pane width.
      const showGutter = hasGutterMarks(gutterMarks)
      return (
        <div className="wb-editor-fill" data-gutter={showGutter || undefined}>
          {showGutter && (
            <div className="wb-editor-gutter" ref={gutterRef} aria-hidden="true">
              {gutterMarks.map((mark, index) => (
                <span key={index} className="wb-editor-gutter-mark" data-mark={mark ?? undefined} />
              ))}
            </div>
          )}
          <textarea
            className="wb-editor-surface"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onScroll={(event) => {
              if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
            }}
            aria-label={t('explorer.editorAriaLabel')}
            spellCheck={false}
          />
        </div>
      )
    }

    // mode === 'preview': only reachable via the toggle above, which is only
    // rendered when `previewable` (md/html) — draft, not the last-saved
    // content, is the source of truth (UX-R1.4/R7.1).
    if (isMarkdownPath(viewerState.path)) {
      // GitHub-README-style rendered document: a centered reading measure
      // (`.wb-md-doc`) inside the scrolling pane, typeset by `.wb-md`.
      return (
        <div className="wb-viewer-scroll">
          <div className="wb-md-doc wb-md" data-testid="markdown-viewer">
            <Markdown source={draft} />
          </div>
        </div>
      )
    }

    // isHtmlPath(viewerState.path): the only other `previewable` kind. Not
    // gated behind an explicit check — `mode` can only reach 'preview' via
    // the toggle, which only renders when `previewable` (md/html), so any
    // non-markdown file here is necessarily HTML. Fills the whole pane, same
    // as the editor surface it toggles against.
    return (
      <div className="wb-editor-fill" data-testid="html-preview-pane">
        <HtmlPreview source={draft} reloadKey={reloadKey} />
      </div>
    )
  }
})
