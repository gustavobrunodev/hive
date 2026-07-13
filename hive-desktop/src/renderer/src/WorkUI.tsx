import { useCallback, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Resizable,
  ResizableHandle,
  ResizablePanel
} from '@hive/design-system'
import { t } from './i18n'
import { FileTree, FileViewer, type FileViewerHandle } from './explorer/Explorer'
import { Chat } from './chat/Chat'
import { IconButton } from './ui/IconButton'
import { HiveLogo } from './ui/HiveLogo'
import { FolderIcon, MoonIcon, SunIcon } from './ui/icons'

/** Maps `OpenResult`'s failure reasons (WS-R6.3) to a user-facing i18n key — kept close to the guard/pipeline logic that's the only caller. */
function switchErrorMessage(reason: 'missing' | 'not-a-directory' | 'unreadable'): string {
  switch (reason) {
    case 'missing':
      return t('workUI.switchErrorMissing')
    case 'not-a-directory':
      return t('workUI.switchErrorNotADirectory')
    case 'unreadable':
      return t('workUI.switchErrorUnreadable')
  }
}

interface WorkUIProps {
  /** Absolute path to the provisioned, up-to-date workspace. */
  workspace: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  /**
   * T7 (WS-R1/R7): reports a resolved candidate workspace path once the user
   * picks "Abrir pasta…" or a Recentes entry from the workspace chip menu.
   * `WorkUI` only resolves the candidate here — it does NOT itself switch to
   * it (no guard, no re-provisioning). That's T8's job (WS-R4/R5): the
   * unsaved-work guard and the actual `checkingProvisioned` re-entry belong
   * to the caller.
   *
   * TODO(T8): `App.tsx` does not yet pass this prop when instantiating
   * `WorkUI` — wire `onCandidateWorkspace` there to the switch-guard +
   * `checkingProvisioned` re-entry handler described in design.md §4/§5.
   * Left unwired here deliberately: T7 must not touch `App.tsx` (owned by a
   * concurrent task).
   */
  onCandidateWorkspace?: (path: string) => void
}

/** Last path segment of an absolute workspace path (both separators, so a Windows path renders its folder name too). */
function workspaceName(workspace: string): string {
  const segments = workspace.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? workspace
}

/** Map of Resizable panel id -> flex-grow percentage (mirrors react-resizable-panels' `Layout` type). */
type WorkLayout = Record<string, number>

/** localStorage key for the persisted rail/chat/viewer split (T11, design.md §7, UX-R6.2). */
const WORK_LAYOUT_STORAGE_KEY = 'hive.workLayout'

/** Reads a previously-persisted layout back out of `localStorage`, tolerating missing/corrupt data (private mode, manual edits, older schema). */
function loadWorkLayout(): WorkLayout | undefined {
  try {
    const raw = localStorage.getItem(WORK_LAYOUT_STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Object.values(parsed as Record<string, unknown>).every((value) => typeof value === 'number')
    ) {
      return parsed as WorkLayout
    }
    return undefined
  } catch {
    return undefined
  }
}

/** Persists the group's current layout so the rail width survives a reload. Write failures (quota, private mode) are swallowed — persistence is a nicety, not a hard requirement. */
function persistWorkLayout(layout: WorkLayout): void {
  try {
    localStorage.setItem(WORK_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // ignore
  }
}

/**
 * The app's main work surface (task T19, design.md §4 layout — "File Tree |
 * Chat | File Viewer"): a slim top bar (brand mark, active-workspace chip,
 * theme toggle) over three zones, all resizable panes of one group. The
 * file tree is the left rail; chat owns the remaining width; the file
 * viewer is a right pane that *only exists while a file is open* (no
 * permanently empty middle column).
 *
 * The open-file state lives here — not inside the explorer — because the
 * viewer pane and the tree's selection highlight both depend on it across
 * the pane boundary. `Chat` is mounted once and never remounts when the
 * viewer opens/closes (its panel keeps the same child position and `id`,
 * so React reconciles it in place), so the agent session and conversation
 * survive file browsing; react-resizable-panels v4 supports panels
 * conditionally joining/leaving a group, reconciled by `id`.
 *
 * T11 (design.md §7, UX-R6): the whole body — rail, chat, and the optional
 * viewer — is one horizontal `Resizable` group (rail/chat/viewer keyed by
 * stable `id`s), and the group's layout is persisted to/restored from
 * `localStorage['hive.workLayout']` via `defaultLayout`/`onLayoutChanged` so
 * a dragged rail width survives a reload.
 */
export function WorkUI({
  workspace,
  theme,
  onToggleTheme,
  onCandidateWorkspace
}: WorkUIProps): React.JSX.Element {
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [defaultLayout] = useState(loadWorkLayout)
  const [chipMenuOpen, setChipMenuOpen] = useState(false)
  const [recents, setRecents] = useState<string[]>([])
  // T8 (WS-R5.1, design.md §5.2): lifted from the active `FileViewer`'s own
  // `dirty` state via its `onDirtyChange` callback — purely observational,
  // the in-viewer guard itself is untouched.
  const [viewerDirty, setViewerDirty] = useState(false)
  const viewerRef = useRef<FileViewerHandle>(null)
  // The candidate path currently blocked behind the three-way unsaved-work
  // dialog (WS-R5.1/R5.3); `null` means no guard dialog is open.
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  // WS-R6.3: a non-fatal message when the last switch attempt's
  // `openWorkspace` call failed — the current workspace stays active.
  const [switchError, setSwitchError] = useState<string | null>(null)

  /** WS-R1.2/R1.4: loads the MRU list fresh each time the chip menu opens, excluding the currently-active workspace so the user never "switches" to where they already are. */
  const handleChipMenuOpenChange = useCallback(
    (open: boolean) => {
      setChipMenuOpen(open)
      if (!open) return
      window.hive
        .getRecentWorkspaces()
        .then((paths) => setRecents(paths.filter((path) => path !== workspace)))
        .catch(() => setRecents([]))
    },
    [workspace]
  )

  // T8 (WS-R4.5 extended to this entry point, WS-R6.3): the actual "proceed"
  // step of the switch pipeline — validates + persists `path` as the active
  // workspace via `openWorkspace`, then, only on success, hands it off to
  // `onCandidateWorkspace` (App's `handleSwitchWorkspace`, T5), which is
  // what actually re-enters the onboarding gate / remounts `WorkUI`. A
  // failure surfaces a clear, non-fatal error and leaves the current
  // workspace untouched — `onCandidateWorkspace` is never called.
  const proceedSwitch = useCallback(
    async (path: string): Promise<void> => {
      setSwitchError(null)
      const result = await window.hive.openWorkspace(path)
      if (result.ok) {
        onCandidateWorkspace?.(path)
      } else {
        setSwitchError(switchErrorMessage(result.reason))
      }
    },
    [onCandidateWorkspace]
  )

  // T8 (WS-R5.1/R5.3): the switch guard's entry point, shared by both the
  // chip menu's "Abrir pasta…" and its Recentes entries. Dirty parks the
  // candidate behind the three-way dialog; clean proceeds straight to
  // `proceedSwitch`.
  const requestSwitch = useCallback(
    (path: string) => {
      if (viewerDirty) {
        setPendingSwitch(path)
      } else {
        void proceedSwitch(path)
      }
    },
    [viewerDirty, proceedSwitch]
  )

  /** WS-R1.2: "Abrir pasta…" resolves a candidate via the native picker; a cancelled picker (null) is a no-op (WS-R4.5). */
  const handleChooseFolder = useCallback(() => {
    window.hive
      .chooseWorkspace()
      .then((path) => {
        if (path) requestSwitch(path)
      })
      .catch(() => {
        // Picker failure is a no-op here — no partial candidate to report.
      })
  }, [requestSwitch])

  // "Cancelar" (WS-R4.5 extended to the switch guard): dismiss the dialog,
  // no state change beyond that — the switch never happened.
  const cancelSwitch = useCallback(() => setPendingSwitch(null), [])

  // "Descartar" (only ever wired to the dialog's own button, itself only
  // mounted while `pendingSwitch` is set — see `FileViewer`'s `readyState`
  // comment for why this skips a defensive null-check branch): proceed with
  // the switch, dropping the viewer's unsaved edits.
  const handleDiscardSwitch = useCallback(() => {
    const path = pendingSwitch as string
    setPendingSwitch(null)
    void proceedSwitch(path)
  }, [pendingSwitch, proceedSwitch])

  // "Salvar": flush the viewer's draft first (mirrors its own "Salvar" —
  // same `performSave(false)` via the `requestSave` imperative handle), and
  // only proceed with the switch if the save actually landed. On failure
  // (e.g. a STALE conflict), `performSave` has already surfaced its own
  // dialog/error inline in the viewer — this just dismisses the switch
  // guard and aborts the switch, same as the in-viewer guard's own
  // "Salvar" choice.
  const handleSaveSwitch = useCallback(() => {
    const path = pendingSwitch as string
    setPendingSwitch(null)
    void (viewerRef.current?.requestSave() ?? Promise.resolve(false)).then((ok) => {
      if (ok) void proceedSwitch(path)
    })
  }, [pendingSwitch, proceedSwitch])

  return (
    <div className="wb-app">
      <header className="wb-topbar">
        <HiveLogo mark="brain" className="wb-topbar-logo" />
        <span className="wb-topbar-title">{t('app.title')}</span>
        <span className="wb-topbar-sep" aria-hidden="true" />
        <DropdownMenu open={chipMenuOpen} onOpenChange={handleChipMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="wb-workspace-chip"
              title={t('workUI.workspaceChipTitle', workspace)}
              aria-label={t('workUI.workspaceChipTitle', workspace)}
            >
              <FolderIcon size={14} />
              <span className="wb-workspace-chip-name">{workspaceName(workspace)}</span>
            </button>
          </DropdownMenuTrigger>
          {chipMenuOpen && (
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={handleChooseFolder}>
                {t('workUI.openFolder')}
              </DropdownMenuItem>
              {recents.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('workUI.recents')}</DropdownMenuLabel>
                  {recents.map((path) => (
                    <DropdownMenuItem key={path} title={path} onSelect={() => requestSwitch(path)}>
                      {workspaceName(path)}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        <div className="wb-topbar-spacer" />
        <IconButton
          label={t('theme.toggle', theme === 'dark' ? t('theme.dark') : t('theme.light'))}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>
      </header>
      {switchError && (
        <div className="wb-switch-error" role="alert">
          {switchError}
        </div>
      )}
      <div className="wb-body">
        <Resizable
          orientation="horizontal"
          style={{ flex: 1, minWidth: 0, minHeight: 0 }}
          defaultLayout={defaultLayout}
          onLayoutChanged={persistWorkLayout}
        >
          <ResizablePanel
            id="rail"
            className="wb-rail"
            minSize="12%"
            maxSize="40%"
            defaultSize="22%"
            aria-label={t('explorer.treeAriaLabel')}
          >
            <div className="wb-pane-header">
              <span className="wb-pane-header-label">{t('explorer.paneTitle')}</span>
            </div>
            <FileTree workspace={workspace} selectedPath={openPath} onOpenFile={setOpenPath} />
          </ResizablePanel>
          <ResizableHandle withGrip aria-label={t('workUI.resizeHandleLabel')} />
          <ResizablePanel id="chat" minSize="30%" defaultSize="53%">
            <Chat workspace={workspace} />
          </ResizablePanel>
          {openPath !== null && (
            <>
              <ResizableHandle withGrip aria-label={t('workUI.resizeHandleLabel')} />
              <ResizablePanel id="viewer" minSize="24%" defaultSize="25%">
                <FileViewer
                  ref={viewerRef}
                  workspace={workspace}
                  path={openPath}
                  onClose={() => setOpenPath(null)}
                  onDirtyChange={setViewerDirty}
                />
              </ResizablePanel>
            </>
          )}
        </Resizable>
      </div>
      {pendingSwitch !== null && (
        <Dialog open onOpenChange={(open: boolean) => !open && cancelSwitch()}>
          <DialogContent>
            <DialogTitle>{t('explorer.unsavedGuardTitle')}</DialogTitle>
            <DialogDescription>{t('explorer.unsavedGuardDescription')}</DialogDescription>
            <div className="wb-dialog-actions">
              <Button className="wb-btn" onClick={cancelSwitch}>
                {t('explorer.unsavedGuardCancelCta')}
              </Button>
              <Button className="wb-btn" onClick={handleDiscardSwitch}>
                {t('explorer.unsavedGuardConfirmCta')}
              </Button>
              <Button className="wb-btn hds-btn-primary" onClick={handleSaveSwitch}>
                {t('explorer.unsavedGuardSaveCta')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
