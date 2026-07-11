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

/**
 * The app's main work surface (task T19, design.md §4 layout — "File Tree |
 * Chat | File Viewer"): a slim top bar (brand mark, active-workspace chip,
 * theme toggle) over three zones. The file tree is a fixed left rail; chat
 * owns the remaining width; the file viewer is a resizable right pane that
 * *only exists while a file is open* (no permanently empty middle column).
 *
 * The open-file state lives here — not inside the explorer — because the
 * viewer pane and the tree's selection highlight both depend on it across
 * the pane boundary. `Chat` is mounted once and never remounts when the
 * viewer opens/closes (its panel keeps the same child position and `id`,
 * so React reconciles it in place), so the agent session and conversation
 * survive file browsing; react-resizable-panels v4 supports panels
 * conditionally joining/leaving a group, reconciled by `id`.
 */
export function WorkUI({ workspace, theme, onToggleTheme }: WorkUIProps): React.JSX.Element {
  const [openPath, setOpenPath] = useState<string | null>(null)

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
        <aside className="wb-rail" aria-label={t('explorer.treeAriaLabel')}>
          <div className="wb-pane-header">
            <span className="wb-pane-header-label">{t('explorer.paneTitle')}</span>
          </div>
          <FileTree workspace={workspace} selectedPath={openPath} onOpenFile={setOpenPath} />
        </aside>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <Resizable orientation="horizontal" style={{ height: '100%' }}>
            <ResizablePanel id="chat" defaultSize={55} minSize={30}>
              <Chat workspace={workspace} />
            </ResizablePanel>
            {openPath !== null && (
              <>
                <ResizableHandle aria-label={t('workUI.resizeHandleLabel')} />
                <ResizablePanel id="viewer" defaultSize={45} minSize={24}>
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
    </div>
  )
}
