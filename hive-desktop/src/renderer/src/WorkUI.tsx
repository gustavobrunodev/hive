import { useState } from 'react'
import { Resizable, ResizableHandle, ResizablePanel } from '@hive/design-system'
import { t } from './i18n'
import { FileTree, FileViewer } from './explorer/Explorer'
import { Chat } from './chat/Chat'
import { IconButton } from './ui/IconButton'
import { HiveLogo } from './ui/HiveLogo'
import { FolderIcon, MoonIcon, SunIcon } from './ui/icons'

interface WorkUIProps {
  /** Absolute path to the provisioned, up-to-date workspace. */
  workspace: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
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
export function WorkUI({ workspace, theme, onToggleTheme }: WorkUIProps): React.JSX.Element {
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [defaultLayout] = useState(loadWorkLayout)

  return (
    <div className="wb-app">
      <header className="wb-topbar">
        <HiveLogo mark="brain" className="wb-topbar-logo" />
        <span className="wb-topbar-title">{t('app.title')}</span>
        <span className="wb-topbar-sep" aria-hidden="true" />
        <span className="wb-workspace-chip" title={t('workUI.workspaceChipTitle', workspace)}>
          <FolderIcon size={14} />
          <span className="wb-workspace-chip-name">{workspaceName(workspace)}</span>
        </span>
        <div className="wb-topbar-spacer" />
        <IconButton
          label={t('theme.toggle', theme === 'dark' ? t('theme.dark') : t('theme.light'))}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>
      </header>
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
            minSize={12}
            maxSize={40}
            defaultSize={22}
            aria-label={t('explorer.treeAriaLabel')}
          >
            <div className="wb-pane-header">
              <span className="wb-pane-header-label">{t('explorer.paneTitle')}</span>
            </div>
            <FileTree workspace={workspace} selectedPath={openPath} onOpenFile={setOpenPath} />
          </ResizablePanel>
          <ResizableHandle withGrip aria-label={t('workUI.resizeHandleLabel')} />
          <ResizablePanel id="chat" minSize={30} defaultSize={53}>
            <Chat workspace={workspace} />
          </ResizablePanel>
          {openPath !== null && (
            <>
              <ResizableHandle withGrip aria-label={t('workUI.resizeHandleLabel')} />
              <ResizablePanel id="viewer" minSize={24} defaultSize={25}>
                <FileViewer
                  workspace={workspace}
                  path={openPath}
                  onClose={() => setOpenPath(null)}
                />
              </ResizablePanel>
            </>
          )}
        </Resizable>
      </div>
    </div>
  )
}
