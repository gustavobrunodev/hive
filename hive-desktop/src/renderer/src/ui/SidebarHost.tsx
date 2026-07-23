import type { ReactNode } from 'react'
import type { SidebarView } from './ActionRail'

interface SidebarHostProps {
  /** The active sidebar view (git-management D-GIT-2, GIT-R13). */
  activeView: SidebarView
  /** The Explorer (file tree) body. */
  explorer: ReactNode
  /** The Source Control body. */
  scm: ReactNode
}

/**
 * Swaps the rail pane's body between the Explorer and Source Control views one
 * at a time (git-management D-GIT-2). It lives *inside* the rail
 * `ResizablePanel`, which keeps `id="rail"` — so `hive.workLayout`/`paneOrder`
 * and the movable-pane machinery are untouched; only this body swaps
 * (design.md §5.1). The active view is rendered (VS Code unmounts the
 * inactive one) so a heavy SCM subtree isn't kept alive under the file tree.
 */
export function SidebarHost({ activeView, explorer, scm }: SidebarHostProps): React.JSX.Element {
  return <div className="wb-sidebar-host">{activeView === 'scm' ? scm : explorer}</div>
}
