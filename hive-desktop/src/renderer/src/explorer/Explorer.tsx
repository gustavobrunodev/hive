import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  CodeEditor,
  Empty,
  SegmentedControl,
  Spinner,
  Tree,
  type SegmentedOption
} from '@hive/design-system'
import { t } from '../i18n'
import { watchWorkspaceShared } from '../workspaceWatch'
import { gitStatusColor, rollupChangedFolders, type GitDecoration } from '../scm/gitStatus'
import { useGutter } from '../scm/useGutter'
import { Markdown } from '../ui/markdown'
import {
  collectAnchors,
  lineAtOffset,
  lineAtTop,
  measureLineTops,
  offsetOfLine,
  offsetOfLineStart,
  topForLine
} from './scrollSync'
import { HtmlPreview } from './HtmlPreview'
import { DocumentViewer } from './DocumentViewer'
import { richViewerKind } from './richViewer'
import { IconButton } from '../ui/IconButton'
import { isPaneDrag } from '../ui/paneDnd'
import { setWorkspaceFileDrag } from '../ui/workspaceFileDnd'
import { FileTypeIcon } from '../ui/fileIcons'
import { copyText } from '../ui/clipboard'
import {
  namesIn,
  nextCopyName,
  pasteableSources,
  pasteDestination,
  type FileClipboard
} from './fileClipboard'
import {
  CheckIcon,
  ClipboardIcon,
  CloseIcon,
  CollapseAllIcon,
  CopyIcon,
  DownloadIcon,
  ExternalFolderIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  ScissorsIcon,
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

/**
 * Keys that are only ever a modifier. They fire their own `keydown` before the
 * key they modify does — which is exactly long enough to eat the second stroke
 * of a two-key chord if the handler treats every event as "the next key".
 */
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS'])

/** One keystroke, already sorted into the modifier families the shortcuts care about. */
interface Stroke {
  /** The key as pressed — `F2`, `Delete`, `Escape`. */
  key: string
  /** Single characters lower-cased, so `C` and `c` are one binding. */
  letter: string
  /** Exactly Ctrl/Cmd and nothing else. */
  modOnly: boolean
  /** Exactly Shift+Alt and nothing else. */
  shiftAlt: boolean
  /** No modifier at all. */
  bare: boolean
}

/**
 * Sorts a keydown into those families, or returns `null` for a key that is
 * only ever a modifier.
 *
 * Those fire their own `keydown` before the key they modify does — long
 * enough to be mistaken for the second stroke of a two-key chord, which is
 * how `Ctrl+K Ctrl+Shift+C` silently became `Ctrl+K` followed by nothing.
 *
 * Cmd counts wherever Ctrl does: the same physical shortcut on a Mac, and the
 * menus label it that way.
 */
function classifyStroke(event: KeyboardEvent<HTMLDivElement>): Stroke | null {
  const key = event.key
  if (MODIFIER_KEYS.has(key)) return null
  const mod = event.ctrlKey || event.metaKey
  return {
    key,
    letter: key.length === 1 ? key.toLowerCase() : key,
    modOnly: mod && !event.shiftKey && !event.altKey,
    shiftAlt: !mod && event.shiftKey && event.altKey,
    bare: !mod && !event.shiftKey && !event.altKey
  }
}

/**
 * The `aria-keyshortcuts` value for a chord written with `Ctrl`.
 *
 * Separate from the menu's visible hint on purpose: the attribute takes
 * canonical key names ("Meta+X"), the hint takes whatever the platform's
 * users read ("⌘X"). The visible hint is `aria-hidden` in the design system,
 * so this is what actually announces the binding.
 */
function ariaKeyshortcuts(chord: string, platform: string): string {
  return platform === 'darwin' ? chord.replace('Ctrl', 'Meta') : chord
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

/**
 * How long a burst of filesystem events is allowed to settle before the tree is
 * re-walked. Matches the git store's own `REFRESH_DEBOUNCE_MS` — the two react
 * to the same events and there is no reason for them to disagree.
 */
const TREE_REFRESH_DEBOUNCE_MS = 250

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

/**
 * The row ids currently on screen, in the order they are painted — a
 * directory's children only when it is expanded. This is what Ctrl+A selects:
 * "everything" in a tree means everything you can see, not every path in the
 * workspace (selecting a thousand collapsed descendants is never the intent).
 */
function collectVisiblePaths(
  nodes: DsTreeNodeShape[],
  expanded: ReadonlySet<string>,
  into: string[]
): void {
  for (const node of nodes) {
    if (node.id === CREATE_ROW_ID) continue
    into.push(node.id)
    if (node.children && expanded.has(node.id)) {
      collectVisiblePaths(node.children, expanded, into)
    }
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

/**
 * One entry queued to be written into a destination directory — the unit the
 * Explorer's sequential transfer queue walks.
 *
 * `run` rather than a source path, because the two things that feed the queue
 * write through different bridges: an OS drop copies from an absolute path
 * outside the workspace (`fs.importEntry`), a paste copies from one workspace
 * path to another (`fs.copyEntry`). Everything downstream of that difference
 * — the conflict pre-check, the dialog, overwrite/rename/cancel — is shared.
 */
interface TransferItem {
  /** The leaf name it wants inside the destination (already de-duplicated for a paste). */
  name: string
  /** Writes the entry at `destRel`. Rejects with a `CONFLICT` when the target exists and `overwrite` isn't set. */
  run: (destRel: string, opts?: { overwrite?: boolean }) => Promise<void>
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
 * The callbacks a file menu needs, gathered so the two menus can take one
 * prop instead of eight.
 */
interface FileActionHandlers {
  startCreate: (parentPath: string, kind: 'file' | 'directory') => void
  stageClipboard: (path: string, mode: 'cut' | 'copy') => void
  pasteInto: (destDir: string) => void
  startRename: (path: string) => void
  requestDelete: (path: string) => void
  copyPaths: (path: string, kind: 'relative' | 'absolute') => void
  revealInOs: (path: string, isDir: boolean) => void
}

/**
 * The file actions, rendered into whichever menu asked for them.
 *
 * The row's `…` kebab and the right-click menu are one menu with two
 * openings: the same actions, in the same order, with the same separators and
 * the same shortcut hints. That used to be a comment above two copies of the
 * same eighty lines, which is exactly how the two drift apart — a user who
 * learns an action in one has to find it in the other. Radix gives the two
 * menus different item components, so the components come in as props;
 * everything below them is written once.
 */
function FileActionItems({
  Item,
  Separator,
  path,
  isDir,
  canPaste,
  on
}: {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  path: string
  isDir: boolean
  canPaste: boolean
  on: FileActionHandlers
}): React.JSX.Element {
  // A file's "new file here" and "paste here" mean its folder; a folder's
  // mean itself. Resolved once rather than at five call sites.
  const container = isDir ? path : parentOf(path)
  const platform = window.hive.platform
  return (
    <>
      <Item onSelect={() => on.startCreate(container, 'file')}>
        <PlusIcon size={14} />
        {t('explorer.menuNewFile')}
      </Item>
      <Item onSelect={() => on.startCreate(container, 'directory')}>
        <FolderPlusIcon size={14} />
        {t('explorer.menuNewFolder')}
      </Item>
      <Separator />
      {/* The clipboard group sits between "make something" and "change this
          one thing", which is where every file manager puts it — and where
          the muscle memory reaches for it. */}
      <Item
        aria-keyshortcuts={ariaKeyshortcuts('Ctrl+X', platform)}
        shortcut={t('explorer.keyCut', platform)}
        onSelect={() => on.stageClipboard(path, 'cut')}
      >
        <ScissorsIcon size={14} />
        {t('explorer.menuCut')}
      </Item>
      <Item
        aria-keyshortcuts={ariaKeyshortcuts('Ctrl+C', platform)}
        shortcut={t('explorer.keyCopy', platform)}
        onSelect={() => on.stageClipboard(path, 'copy')}
      >
        <CopyIcon size={14} />
        {t('explorer.menuCopy')}
      </Item>
      <Item
        disabled={!canPaste}
        aria-keyshortcuts={ariaKeyshortcuts('Ctrl+V', platform)}
        shortcut={t('explorer.keyPaste', platform)}
        onSelect={() => on.pasteInto(container)}
      >
        <ClipboardIcon size={14} />
        {t('explorer.menuPaste')}
      </Item>
      <Separator />
      <Item
        aria-keyshortcuts="F2"
        shortcut={t('explorer.keyRename')}
        onSelect={() => on.startRename(path)}
      >
        <PencilIcon size={14} />
        {t('explorer.menuRename')}
      </Item>
      <Item
        variant="danger"
        aria-keyshortcuts={ariaKeyshortcuts('Delete', platform)}
        shortcut={t('explorer.keyDelete', platform)}
        onSelect={() => on.requestDelete(path)}
      >
        <TrashIcon size={14} />
        {t('explorer.menuDelete')}
      </Item>
      <Separator />
      {/* Below the separator on purpose: these leave the workspace untouched
          — they hand a path to the clipboard or to the OS — so they sit apart
          from the group that edits it. */}
      <Item
        aria-keyshortcuts={ariaKeyshortcuts('Ctrl+K Ctrl+Shift+C', platform)}
        shortcut={t('explorer.keyCopyRelativePath', platform)}
        onSelect={() => on.copyPaths(path, 'relative')}
      >
        <CopyIcon size={14} />
        {t('explorer.menuCopyRelativePath')}
      </Item>
      <Item
        aria-keyshortcuts={ariaKeyshortcuts('Shift+Alt+C', platform)}
        shortcut={t('explorer.keyCopyPath', platform)}
        onSelect={() => on.copyPaths(path, 'absolute')}
      >
        <CopyIcon size={14} />
        {t('explorer.menuCopyPath')}
      </Item>
      <Item onSelect={() => on.revealInOs(path, isDir)}>
        <ExternalFolderIcon size={14} />
        {t('explorer.menuRevealInOs', platform)}
      </Item>
    </>
  )
}

/**
 * The pending cut/copy, given a place to live.
 *
 * Dimmed rows say "something is staged" but not what, how many, or where it
 * would land — and Escape is not a discoverable way out of a state you cannot
 * see. This strip answers all four, and it is the only chrome in the rail
 * that appears because the user asked for it.
 */
function ClipboardTray({
  clipboard,
  destinationLabel,
  onPaste,
  onClear
}: {
  clipboard: FileClipboard
  destinationLabel: string
  onPaste: () => void
  onClear: () => void
}): React.JSX.Element {
  const isCut = clipboard.mode === 'cut'
  return (
    <div
      className="wb-tree-clipboard"
      aria-label={t('explorer.clipboardTrayLabel', clipboard.mode, clipboard.paths.length)}
    >
      <span className="wb-tree-clipboard-icon" aria-hidden="true">
        {isCut ? <ScissorsIcon size={13} /> : <CopyIcon size={13} />}
      </span>
      <span className="wb-tree-clipboard-label" aria-hidden="true">
        {t(
          'explorer.clipboardTrayCount',
          basename(clipboard.paths[0] ?? ''),
          clipboard.paths.length
        )}
      </span>
      <button type="button" className="wb-tree-clipboard-paste" onClick={onPaste}>
        {t('explorer.clipboardPasteInto', destinationLabel)}
      </button>
      <IconButton
        className="wb-tree-clipboard-dismiss"
        label={t('explorer.clipboardClearLabel')}
        onClick={onClear}
      >
        <CloseIcon size={12} />
      </IconButton>
    </div>
  )
}

/**
 * The panel-wide "Solte para importar" affordance (FM-R5), shown while an OS
 * file drag hovers the rail. Purely visual — `pointer-events: none`, so the
 * drop lands on the row/root handlers underneath and goes into the right
 * folder; this only names where that will be.
 */
function ImportDropzone({
  dragOverPath,
  workspace
}: {
  dragOverPath: string | null
  workspace: string
}): React.JSX.Element {
  return (
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
  )
}

/** The trash confirmation (FM-R3.1), for one row or a whole selection. */
function DeleteDialog({
  targets,
  onCancel,
  onConfirm
}: {
  targets: string[]
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onCancel()}>
      <DialogContent>
        <DialogTitle>{t('explorer.deleteDialogTitle')}</DialogTitle>
        <DialogDescription>
          {targets.length > 1
            ? t('explorer.deleteManyDescription', targets.length)
            : t('explorer.deleteDialogDescription', basename(targets[0] ?? ''))}
        </DialogDescription>
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onCancel}>
            {t('explorer.deleteCancelCta')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={onConfirm}>
            {t('explorer.deleteConfirmCta')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The name-collision prompt (FM-R7) every write path funnels into. */
function ConflictDialog({ conflict }: { conflict: ConflictState }): React.JSX.Element {
  return (
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
            <Button className="wb-btn hds-btn-primary" onClick={() => void conflict.onOverwrite()}>
              {t('explorer.conflictOverwriteCta')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FileTree({
  workspace,
  selectedPath,
  onOpenFile,
  decorations = EMPTY_DECORATIONS
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
  // file-clipboard: the pending cut/copy. Renderer state on purpose, not the
  // system clipboard — the OS clipboard has no cross-platform way to say "I
  // am *moving* these", and a Ctrl+X that silently became a copy is worse
  // than one that only works inside the app. The absolute paths still go out
  // as text on Ctrl+C, so a copy is pasteable into a terminal or a prompt.
  const [clipboard, setClipboard] = useState<FileClipboard | null>(null)
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
  //
  // A *re-fetch* keeps the tree it already has on screen. The spinner is for
  // the first load of a workspace and nothing else: a refresh is triggered by
  // any write under the root, and blanking a tree the user is pointing at —
  // several times a second, while an agent or a git command writes — is the
  // "flashes its spinner forever" defect, not a loading state. The rows are
  // still there, still correct, and the swap when the walk returns is
  // invisible; that is what a refresh should look like.
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setTreeState((current) => (current.status === 'ready' ? current : { status: 'loading' }))
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

  // The workspace changing is the one case that *must* drop the old rows: they
  // belong to a different root, and showing them under the new one while the
  // walk runs is a lie the spinner exists to avoid.
  useEffect(() => {
    const reset = (): void => setTreeState({ status: 'loading' })
    reset()
  }, [workspace])

  // Live updates (R5.3): a change anywhere under the workspace re-fetches
  // the tree so files created by an agent workflow (T19) show up without a
  // manual reload. Unsubscribes on unmount / workspace change — through the
  // shared multiplexer, since the sidebar unmounts this view whenever the user
  // switches to Source Control / Second Brain and the raw bridge call would
  // take *their* watchers down with it.
  //
  // Coalesced, because writes arrive in bursts and the walk they trigger is
  // recursive over the whole workspace: `npm install`, a checkout, an agent
  // rewriting a dozen files are each one useful refresh and dozens of events.
  // One re-walk after the burst settles is the same answer for a fraction of
  // the work.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = watchWorkspaceShared(workspace, () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        setRefreshToken((current) => current + 1)
      }, TREE_REFRESH_DEBOUNCE_MS)
    })
    return () => {
      if (timer !== null) clearTimeout(timer)
      unsubscribe()
    }
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

  /** The workspace's own leaf name — what the tray calls the root destination. */
  const workspaceName = useMemo(() => {
    const parts = workspace.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] ?? workspace
  }, [workspace])

  /** The on-screen row order — Ctrl+A's scope. */
  const visiblePaths = useMemo(() => {
    const out: string[] = []
    collectVisiblePaths(dsNodes, new Set(expandedIds), out)
    return out
  }, [dsNodes, expandedIds])

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
   * Folds the whole tree back to its roots (FM: "recolher todas as pastas").
   *
   * Selection is deliberately left alone — VS Code and Finder both keep it, and
   * a fold that also clears what you had highlighted turns one tidy-up into two
   * undos. The open file stays open and stays selected; expanding its folder
   * again shows it still highlighted, because `selectedIds` never moved.
   *
   * It also announces itself through the same live region the copy-path
   * confirmation uses. The tree is the one thing that changed and it changed by
   * *shrinking* — the row a screen-reader user was sitting on may simply have
   * stopped existing, and nothing else on screen would say so.
   */
  const collapseAll = useCallback(() => {
    if (expandedIds.length === 0) return
    setExpandedIds([])
    showFlash(t('explorer.collapseAllFlash'))
  }, [expandedIds.length, showFlash])

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
          await copyText(paths.join('\n'))
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

  // The queue is generic over *how* an entry gets written, because two very
  // different sources now feed it: an OS drop (`fs.importEntry`, from an
  // absolute path outside the workspace) and a paste (`fs.copyEntry`, from
  // one workspace path to another). Everything they share — the sequential
  // walk, the exists() pre-check, the conflict dialog and its
  // overwrite/rename/cancel branches — is the part worth having exactly once.
  const importQueueRef = useRef<TransferItem[]>([])
  const importDestRef = useRef('')
  // What to say in the live region once the queue drains, and how many items
  // actually landed. `null` means "say nothing" — an OS import already has
  // the drop overlay plus the tree updating under the pointer, so announcing
  // it again would be noise; a paste has neither.
  const transferReportRef = useRef<{ done: number; message: ((n: number) => string) | null }>({
    done: 0,
    message: null
  })

  const doImport = useCallback(
    async (item: TransferItem, destRel: string, opts?: { overwrite?: boolean }) => {
      await item.run(destRel, opts)
      transferReportRef.current.done += 1
      refresh()
    },
    [refresh]
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
    if (!next) {
      // Drained: report once for the whole batch rather than per item, so
      // pasting six files says "6 itens colados" instead of six times "1".
      const report = transferReportRef.current
      if (report.message && report.done > 0) showFlash(report.message(report.done))
      transferReportRef.current = { done: 0, message: null }
      return
    }
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
                await doImport(next, targetRel, { overwrite: true })
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
                    await doImport(next, joinRelative(destDir, name))
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
        return doImport(next, targetRel).then(
          () => processNextImportRef.current(),
          (err: unknown) => {
            if (isFsConflictError(err)) {
              setConflict({
                itemLabel: next.name,
                supportsOverwrite: true,
                onOverwrite: async () => {
                  try {
                    await doImport(next, targetRel, { overwrite: true })
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
  }, [workspace, doImport, ensureExpanded, closeAllInputs, reportError, showFlash])

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
      transferReportRef.current = { done: 0, message: null }
      importQueueRef.current = files.map((file) => {
        const absPath = window.hive.fs.pathForFile(file)
        return {
          name: file.name,
          run: (destRel, opts) => window.hive.fs.importEntry(workspace, absPath, destRel, opts)
        }
      })
      processNextImport()
    },
    [workspace, processNextImport]
  )

  // --- File clipboard: cut / copy / paste (VS Code parity) -----------------

  /** Where a paste lands right now — a selected folder, a selected file's folder, or the active dir. */
  const pasteDest = useMemo(
    () => pasteDestination(selectedIds, fileTypes, activeDirPath),
    [selectedIds, fileTypes, activeDirPath]
  )

  const clearClipboard = useCallback(() => setClipboard(null), [])

  /** The rows a pending *cut* ghosts. Empty for a copy — nothing is leaving. */
  const cutPaths = useMemo(
    () => new Set(clipboard?.mode === 'cut' ? clipboard.paths : []),
    [clipboard]
  )

  /**
   * Ctrl+C / Ctrl+X. Both stage the same in-app payload; copy additionally
   * puts the absolute paths on the *system* clipboard as text, because that
   * is what someone who presses Ctrl+C over a file and then clicks into a
   * terminal, a prompt or a document expects to get. Cut deliberately does
   * not: putting the paths there would leave a "copy" of something the next
   * paste is about to move.
   */
  const stageClipboard = useCallback(
    (path: string, mode: 'cut' | 'copy') => {
      setMenuFor(null)
      const paths = targetsFor(path).filter((entry) => fileTypes.has(entry))
      if (paths.length === 0) return
      setClipboard({ mode, paths })
      if (mode === 'cut') {
        showFlash(t('explorer.cutFeedback', paths.length))
        return
      }
      void Promise.all(paths.map((rel) => window.hive.fs.absolutePath(workspace, rel)))
        .then((abs) => copyText(abs.join('\n')))
        .catch((err) => console.error('[explorer] copy to system clipboard failed', err))
      showFlash(t('explorer.copyFeedback', paths.length))
    },
    [targetsFor, fileTypes, workspace, showFlash]
  )

  /**
   * Ctrl+V. A cut reuses the drag-and-drop move (same guards, same conflict
   * dialog) and then empties the clipboard, because the staged paths no
   * longer exist. A copy goes through the transfer queue, but with the
   * destination's existing names checked *first*: pasting into the folder
   * something already lives in is how every file manager duplicates, and
   * answering that with a conflict dialog instead of `nota cópia.md` would
   * turn the most common paste into a question.
   */
  const pasteInto = useCallback(
    (destDir: string) => {
      setMenuFor(null)
      if (!clipboard) return
      const sources = pasteableSources(clipboard.paths, destDir)
      if (sources.length === 0) return

      if (clipboard.mode === 'cut') {
        const moving = sources.filter((path) => parentOf(path) !== destDir)
        setClipboard(null)
        if (moving.length === 0) return
        moveInternal(moving, destDir)
        showFlash(t('explorer.pasteFeedback', moving.length))
        return
      }

      const taken = namesIn(destDir, fileTypes)
      importDestRef.current = destDir
      transferReportRef.current = { done: 0, message: (n) => t('explorer.pasteFeedback', n) }
      importQueueRef.current = sources.map((fromRel) => {
        // Reserve each chosen name as we go: pasting two `nota.md`s from
        // different folders into one destination has to produce `nota
        // cópia.md` and `nota cópia 2.md`, not the same name twice.
        const name = nextCopyName(basename(fromRel), taken)
        taken.add(name)
        return {
          name,
          run: (destRel, opts) => window.hive.fs.copyEntry(workspace, fromRel, destRel, opts)
        }
      })
      ensureExpanded(destDir)
      processNextImport()
    },
    [clipboard, fileTypes, workspace, moveInternal, ensureExpanded, processNextImport, showFlash]
  )

  // A staged path that no longer exists (deleted, renamed, moved by an agent)
  // must not sit in the clipboard waiting to fail on paste. The tree already
  // reconciles `selectedIds` against every refresh; the clipboard gets the
  // same treatment, and empties itself when nothing it holds survives.
  useEffect(() => {
    const reconcile = (): void => {
      if (treeState.status !== 'ready') return
      setClipboard((current) => {
        if (!current) return current
        const alive = current.paths.filter((path) => fileTypes.has(path))
        if (alive.length === current.paths.length) return current
        return alive.length === 0 ? null : { ...current, paths: alive }
      })
    }
    reconcile()
  }, [fileTypes, treeState.status])

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

  // --- Keyboard: the file-manager shortcut set (VS Code parity) ------------

  /**
   * The pending first stroke of a two-key chord (only `Ctrl+K` today, the
   * prefix VS Code uses for "Copy Relative Path"). Held in a ref rather than
   * state because nothing renders from it except the hint, which is pushed
   * through the existing live region — and because the timeout that clears it
   * must not be able to re-render the tree mid-typing.
   */
  const chordRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chordPendingRef = useRef(false)
  const endChord = useCallback(() => {
    if (chordRef.current) clearTimeout(chordRef.current)
    chordRef.current = null
    chordPendingRef.current = false
  }, [])
  useEffect(() => endChord, [endChord])

  /** The row a keyboard action applies to: the focused treeitem, else the lone selection. */
  const keyboardTarget = useCallback((): string | null => {
    const focused = document.activeElement
    if (focused instanceof HTMLElement) {
      const row = focused.closest?.('[role="treeitem"]')?.querySelector?.('[data-tree-path]')
      if (row instanceof HTMLElement && row.dataset.treePath !== undefined) {
        return row.dataset.treePath
      }
    }
    // Any selection at all is a valid target: `targetsFor` expands a member
    // of a >1 selection back into the whole set, so Ctrl+C over three
    // selected rows copies three. Bailing out on "more than one" would make
    // every shortcut silently dead for exactly the case they matter most.
    return selectedIds[0] ?? null
  }, [selectedIds])

  /**
   * Every file-management shortcut a user already has in their fingers, bound
   * on the tree container so they only fire while the Explorer has focus —
   * Ctrl+C in the chat must still copy the chat.
   *
   * Deliberately NOT a `window` listener (the way the editor's Ctrl+S is):
   * these verbs are about the selected rows, and a global binding would make
   * Delete destructive from anywhere in the app. The inline create/rename
   * inputs stop their own keydowns before they reach here, so typing a name
   * containing "v" while holding nothing is never a paste.
   */
  /**
   * True while an inline input or a dialog owns the keyboard. Every shortcut
   * below defers to it: Delete must not trash the row behind a confirmation
   * that is already asking about it, and typing a file name is just typing.
   */
  const isEditing = Boolean(pendingInput || renaming || conflict || deleteTargets)

  /** The second stroke of `Ctrl+K …`, consumed whatever it turns out to be. */
  const handleChordStroke = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, stroke: Stroke) => {
      endChord()
      event.preventDefault()
      event.stopPropagation()
      // A chord that silently falls through to its own single-key meaning is
      // how you end up deleting a file you meant to copy the path of, so
      // anything that is not the chord is swallowed rather than re-dispatched.
      const isChord = (event.ctrlKey || event.metaKey) && event.shiftKey && stroke.letter === 'c'
      const target = isChord ? keyboardTarget() : null
      if (target !== null) copyPaths(target, 'relative')
    },
    [endChord, keyboardTarget, copyPaths]
  )

  /**
   * `Ctrl`/`Cmd` + a letter. Split out of the dispatcher below so each half
   * stays readable (and inside the project's complexity budget) — the
   * dispatcher decides *which* family a keystroke belongs to, these decide
   * what it means. Returns whether the key was handled.
   */
  const handleModifierKey = useCallback(
    (letter: string): boolean => {
      if (letter === 'c' || letter === 'x') {
        const target = keyboardTarget()
        if (target === null) return false
        stageClipboard(target, letter === 'c' ? 'copy' : 'cut')
        return true
      }
      if (letter === 'v') {
        if (!clipboard) return false
        pasteInto(pasteDest)
        return true
      }
      if (letter === 'a') {
        setSelectedIds(visiblePaths)
        return true
      }
      if (letter === 'k') {
        chordPendingRef.current = true
        showFlash(t('explorer.chordPendingHint', window.hive.platform))
        // VS Code waits indefinitely; a desktop app that silently swallows
        // the next keystroke forever is worse than one that gives up.
        chordRef.current = setTimeout(endChord, 3000)
        return true
      }
      return false
    },
    [
      keyboardTarget,
      stageClipboard,
      clipboard,
      pasteInto,
      pasteDest,
      visiblePaths,
      showFlash,
      endChord
    ]
  )

  /**
   * `Shift+Alt+C` — copy the absolute path (VS Code's binding). Its own
   * branch, checked ahead of the plain `Ctrl` family, because on Windows and
   * Linux AltGr reports as Ctrl+Alt and would otherwise shadow it.
   */
  const handleCopyPathKey = useCallback((): boolean => {
    const target = keyboardTarget()
    if (target === null) return false
    copyPaths(target, 'absolute')
    return true
  }, [keyboardTarget, copyPaths])

  /** An unmodified key: the three that act on the row, plus Escape. */
  const handleBareKey = useCallback(
    (key: string): boolean => {
      if (key === 'F2' || key === 'Delete') {
        const target = keyboardTarget()
        if (target === null) return false
        if (key === 'F2') startRename(target)
        else requestDelete(target)
        return true
      }
      if (key !== 'Escape') return false
      // Escape unwinds one level at a time, the way it does everywhere else:
      // the pending cut first (it is the state with a visible consequence),
      // the selection only once there is no clipboard left.
      if (clipboard) {
        clearClipboard()
        return true
      }
      if (selectedIds.length === 0) return false
      setSelectedIds([])
      return true
    },
    [keyboardTarget, startRename, requestDelete, clipboard, clearClipboard, selectedIds]
  )

  /**
   * Every file-management shortcut a user already has in their fingers, bound
   * on the tree container so they only fire while the Explorer has focus —
   * Ctrl+C in the chat must still copy the chat.
   *
   * Deliberately NOT a `window` listener (the way the editor's Ctrl+S is):
   * these verbs are about the selected rows, and a global binding would make
   * Delete destructive from anywhere in the app. The inline create/rename
   * inputs stop their own keydowns before they reach here, so typing a name
   * containing "v" while holding nothing is never a paste.
   */
  const handleTreeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) return
      const stroke = classifyStroke(event)
      if (stroke === null) return

      if (chordPendingRef.current) {
        handleChordStroke(event, stroke)
        return
      }
      if (stroke.shiftAlt && stroke.letter === 'c') {
        if (handleCopyPathKey()) event.preventDefault()
        return
      }
      if (stroke.modOnly) {
        if (handleModifierKey(stroke.letter)) event.preventDefault()
        return
      }
      if (stroke.bare && handleBareKey(stroke.key)) event.preventDefault()
    },
    [isEditing, handleChordStroke, handleCopyPathKey, handleModifierKey, handleBareKey]
  )

  /**
   * Ctrl+V with files on the *system* clipboard — copied in Finder / Windows
   * Explorer / Nautilus, pasted here. The keydown handler above cannot see
   * them (only a real `paste` event carries `clipboardData`), so this is a
   * separate listener, and it only acts when the in-app clipboard is empty:
   * a pending cut is the more specific intent and must win.
   */
  const handleTreePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (clipboard || isEditing) return
      const files = event.clipboardData?.files
      if (!files || files.length === 0) return
      event.preventDefault()
      importFiles(Array.from(files), pasteDest)
    },
    [clipboard, isEditing, importFiles, pasteDest]
  )

  /** The handler bundle both menus render from. */
  const actions = useMemo<FileActionHandlers>(
    () => ({
      startCreate,
      stageClipboard,
      pasteInto,
      startRename,
      requestDelete,
      copyPaths,
      revealInOs
    }),
    [startCreate, stageClipboard, pasteInto, startRename, requestDelete, copyPaths, revealInOs]
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
          /* A row staged for a cut dims, the way it does in every file
             manager — the only on-screen trace of a pending Ctrl+X, and the
             reason the clipboard tray below spells the rest out. */
          data-tree-cut={cutPaths.has(node.id) || undefined}
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
                <FileActionItems
                  Item={DropdownMenuItem}
                  Separator={DropdownMenuSeparator}
                  path={node.id}
                  isDir={isDir}
                  canPaste={Boolean(clipboard)}
                  on={actions}
                />
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
      actions,
      onOpenFile,
      decorations,
      changedFolders,
      clipboard,
      cutPaths
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
        {/* Pushed to the far edge (`.wb-tree-toolbar` gives it `margin-left:
            auto`), away from the two create actions: it acts on the *whole*
            tree, while those act on wherever you are in it. Grouping it with
            them would read as a third way to add something.

            Disabled when nothing is open, because the alternative — a live
            control that provably does nothing — is the worse of the two. */}
        <IconButton
          label={t('explorer.collapseAllLabel')}
          className="wb-tree-toolbar-end"
          disabled={expandedIds.length === 0}
          onClick={collapseAll}
        >
          <CollapseAllIcon />
        </IconButton>
      </div>
      {actionError && (
        <div className="wb-tree-error" role="alert">
          {actionError}
        </div>
      )}
      {clipboard && (
        <ClipboardTray
          clipboard={clipboard}
          destinationLabel={basename(pasteDest) || workspaceName}
          onPaste={() => pasteInto(pasteDest)}
          onClear={clearClipboard}
        />
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
            onKeyDown={handleTreeKeyDown}
            onPaste={handleTreePaste}
            onDragEnter={handleBodyDragEnter}
            onDragOver={handleBodyDragOver}
            onDragLeave={handleBodyDragLeave}
            onDrop={handleBodyDrop}
          >
            {treeBody}
            {importActive && <ImportDropzone dragOverPath={dragOverPath} workspace={workspace} />}
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
              <FileActionItems
                Item={ContextMenuItem}
                Separator={ContextMenuSeparator}
                path={contextTarget.path}
                isDir={contextTarget.isDir}
                canPaste={Boolean(clipboard)}
                on={actions}
              />
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
              {/* The empty area is the workspace root, so it takes a paste
                  like any other folder row. */}
              <ContextMenuItem
                disabled={!clipboard}
                aria-keyshortcuts={ariaKeyshortcuts('Ctrl+V', window.hive.platform)}
                shortcut={t('explorer.keyPaste', window.hive.platform)}
                onSelect={() => pasteInto('')}
              >
                <ClipboardIcon size={14} />
                {t('explorer.menuPaste')}
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
        <DeleteDialog
          targets={deleteTargets}
          onCancel={() => setDeleteTargets(null)}
          onConfirm={confirmDelete}
        />
      )}
      {conflict && <ConflictDialog conflict={conflict} />}
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

/**
 * The two ways to look at the same artifact, as one control.
 *
 * It used to be a single icon button that swapped its own glyph — which asks
 * the reader to know both that the pane has two modes and which one the
 * current glyph means. A two-segment switch shows the whole choice at once and
 * says, in the product's own words, which half you are in; for a PM opening a
 * PRD, that is the difference between finding the rendered document and never
 * learning it exists.
 */
const MODE_OPTIONS: SegmentedOption[] = [
  { id: 'edit', label: t('explorer.editLabel') },
  { id: 'preview', label: t('explorer.viewLabel') }
]

/**
 * The same choice, for a pane too narrow to spell it out.
 *
 * Both are always rendered and one is hidden by a container query on the pane
 * (`.wb-viewer-mode` / `-compact` in workbench.css), which is why this is a
 * glyph and not a shortened label: below that width the header is carrying
 * "Descartar" and "Salvar" too, and a switch abbreviated to fit would be a
 * third piece of text competing with the two that must stay legible.
 */
function compactModeToggle(mode: ViewerMode): { label: string; icon: React.JSX.Element } {
  return mode === 'edit'
    ? { label: t('explorer.viewLabel'), icon: <EyeIcon /> }
    : { label: t('explorer.editLabel'), icon: <PencilIcon /> }
}

/**
 * Both forms of the switch. A component of its own rather than two blocks
 * inline in the header, because the header is already the busiest branch in
 * this file and every ternary here would be one more path through it.
 */
function ModeSwitch({
  mode,
  disabled,
  onSelect
}: {
  mode: ViewerMode
  disabled: boolean
  onSelect: (next: string) => void
}): React.JSX.Element {
  // Inert until the file is actually here: switching to a preview of nothing
  // renders an empty document and reads as a broken control.
  const options = useMemo(() => MODE_OPTIONS.map((option) => ({ ...option, disabled })), [disabled])
  const compact = compactModeToggle(mode)
  const other = mode === 'edit' ? 'preview' : 'edit'
  return (
    <>
      <SegmentedControl
        className="wb-viewer-mode"
        options={options}
        value={mode}
        onChange={onSelect}
        ariaLabel={t('explorer.modeSwitchLabel')}
      />
      <IconButton
        className="wb-viewer-mode-compact"
        label={compact.label}
        onClick={() => onSelect(other)}
        disabled={disabled}
        aria-pressed={mode === 'preview'}
      >
        {compact.icon}
      </IconButton>
    </>
  )
}

/** "Copiar conteúdo", or the acknowledgement that replaces it for a moment after a copy. */
function copyLabel(copied: boolean): string {
  return copied ? t('explorer.copiedLabel') : t('explorer.copyLabel')
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

  /**
   * The source line to land on after the surface swaps, and the two scrollers
   * that can be asked for it or told it. A ref and not state: nothing about
   * this needs to re-render, and the restore has to happen in the same frame
   * the new surface lays out in, before it can be seen at the wrong place.
   */
  const carriedLine = useRef<number | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  /** Which source line is at the top of whichever surface is showing now. */
  const topLineOfCurrentMode = useCallback((): number | null => {
    if (mode === 'edit') {
      const field = editorRef.current
      if (field === null) return null
      const tops = measureLineTops(field, draft)
      return tops === null ? null : lineAtOffset(tops, field.scrollTop)
    }
    const scroller = previewRef.current
    if (scroller === null) return null
    return lineAtTop(collectAnchors(scroller), scroller.scrollTop)
  }, [mode, draft])

  // The other half: put the carried line at the top of the surface that just
  // arrived. `useLayoutEffect` so the jump happens before paint — a restore one
  // frame late is a visible lurch from the top of the document.
  useLayoutEffect(() => {
    const line = carriedLine.current
    carriedLine.current = null
    if (line === null || viewerState.status !== 'ready') return
    if (mode === 'edit') {
      const field = editorRef.current
      if (field === null) return
      // The caret lands on the line you were reading, before the scroll is
      // set: `setSelectionRange` scrolls the field to the caret itself, so
      // doing it the other way round would undo the restore. Landing it there
      // is what makes the carry *visible* — the editor's current-line wash
      // marks the paragraph you left, and typing starts where you were
      // looking instead of wherever the caret happened to be.
      const at = offsetOfLineStart(draft, Math.round(line))
      field.focus({ preventScroll: true })
      field.setSelectionRange(at, at)
      const tops = measureLineTops(field, draft)
      if (tops !== null) field.scrollTop = offsetOfLine(tops, Math.round(line))
      return
    }
    const scroller = previewRef.current
    if (scroller === null) return
    const top = topForLine(collectAnchors(scroller), line)
    if (top !== null) scroller.scrollTop = top
    // `draft` is read, never watched: it changes on every keystroke and this
    // only ever runs for a mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, viewerState.status])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(readyState.content).then(() => setCopied(true))
  }, [readyState])

  /**
   * The toggle, plus the reader's place.
   *
   * Reading and editing the same artifact is one activity, not two: you read
   * until something is wrong, fix it, and read on. A toggle that dumps you at
   * the top of a forty-page PRD each way makes that loop cost a scroll hunt
   * every time, which is enough friction to stop people from using preview at
   * all. So the *source line* at the top of the surface you are leaving is
   * captured here, and `scrollSync.ts` puts it back at the top of the one you
   * are arriving at. See that module for why a line, and not a ratio.
   */
  const selectMode = useCallback(
    (next: string) => {
      setMode((current) => {
        if (current === next) return current
        carriedLine.current = topLineOfCurrentMode()
        return next as ViewerMode
      })
    },
    [topLineOfCurrentMode]
  )

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
  const notReady = viewerState.status !== 'ready'

  return (
    // `data-dirty` is read by the header's container queries, not by script:
    // an unsaved file adds two more text buttons to the same row, so the width
    // at which the labelled mode switch stops fitting depends on it.
    <div className="wb-viewer" data-dirty={dirty || undefined}>
      <header className="wb-viewer-header" {...paneDragProps}>
        <FileTypeIcon path={displayedPath} />
        <span className="wb-viewer-name">
          <span className="wb-viewer-name-text">{fileName}</span>
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
          {previewable && <ModeSwitch mode={mode} disabled={notReady} onSelect={selectMode} />}
          {!isDocView && (
            <IconButton
              className="wb-viewer-copy"
              label={copyLabel(copied)}
              onClick={handleCopy}
              disabled={notReady}
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
      // the field IS the pane body, VS Code-style, so the whole block is
      // writable regardless of pane width — coloured by the file's own
      // grammar, numbered down the left, with the caret's row washed and the
      // git change marks (vs HEAD) beside the lines they belong to. All of
      // that is the `CodeEditor`'s, including the alignment: it draws one
      // block per source line, so a line that soft-wraps carries its number
      // and its mark down with it. The pane no longer has to choose between
      // showing the marks and wrapping prose, which is what used to leave a
      // PRD running off the right edge of a narrow pane.
      return (
        <CodeEditor
          className="wb-editor-fill"
          ref={editorRef}
          value={draft}
          onChange={setDraft}
          filename={displayedPath}
          ariaLabel={t('explorer.editorAriaLabel')}
          marks={gutterMarks}
        />
      )
    }

    // mode === 'preview': only reachable via the toggle above, which is only
    // rendered when `previewable` (md/html) — draft, not the last-saved
    // content, is the source of truth (UX-R1.4/R7.1).
    if (isMarkdownPath(viewerState.path)) {
      // The rendered document, spanning the pane the same way the editor does
      // — see `.wb-md-doc` in workbench.css for why the reading measure that
      // used to cap it here was the wrong call for this particular column.
      return (
        <div className="wb-viewer-scroll" ref={previewRef}>
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
