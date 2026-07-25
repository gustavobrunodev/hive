import type { ReactNode } from 'react'
import type { SidebarView } from './ActionRail'

interface SidebarHostProps {
  /** The active sidebar view (git-management D-GIT-2, GIT-R13; +review, M11). */
  activeView: SidebarView
  /** The Explorer (file tree) body. */
  explorer: ReactNode
  /** The Source Control body. */
  scm: ReactNode
  /** The "Revisão do agente" body (Agent Change Review, ACR-R2.4). Optional until WorkUI wires it (T12). */
  review?: ReactNode
  /** The "Second Brain" body (M12, SB-R2.1). Optional until WorkUI wires it (T6). */
  brain?: ReactNode
}

/**
 * Swaps the rail pane's body between the Explorer, Source Control, "Revisão do
 * agente", and "Second Brain" views one at a time (git-management D-GIT-2;
 * +review, M11; +brain, M12). It lives *inside* the rail `ResizablePanel`, which keeps `id="rail"` —
 * so `hive.workLayout`/`paneOrder` and the movable-pane machinery are
 * untouched; only this body swaps (design.md §5.1). Only the active view is
 * rendered (VS Code unmounts the inactive ones) so heavy subtrees aren't kept
 * alive under the file tree.
 */
export function SidebarHost({
  activeView,
  explorer,
  scm,
  review,
  brain
}: SidebarHostProps): React.JSX.Element {
  const body =
    activeView === 'scm'
      ? scm
      : activeView === 'review'
        ? review
        : activeView === 'brain'
          ? brain
          : explorer
  return <div className="wb-sidebar-host">{body}</div>
}
