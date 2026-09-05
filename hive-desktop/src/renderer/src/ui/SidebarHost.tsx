import { useState, type ReactNode } from 'react'
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

/** The views in rail order — also the DOM order of the layers below. */
const VIEW_ORDER: readonly SidebarView[] = ['explorer', 'scm', 'review', 'brain']

/**
 * Swaps the rail pane's body between the Explorer, Source Control, "Revisão do
 * agente", and "Second Brain" views one at a time (git-management D-GIT-2;
 * +review, M11; +brain, M12). It lives *inside* the rail `ResizablePanel`,
 * which keeps `id="rail"` — so `hive.workLayout`/`paneOrder` and the
 * movable-pane machinery are untouched; only this body swaps (design.md §5.1).
 *
 * ## Why the inactive views stay mounted
 *
 * Because leaving a view has to cost nothing. This used to render only the
 * active view, which meant every trip to Source Control threw the file tree
 * away: coming back, every folder was closed again, the scroll was back at the
 * top, and the file you were three levels deep in had to be hunted down a
 * second time. That is not what any IDE does, and it is not what "switch
 * views" means — VS Code retains a view's state for the session, and so does
 * this.
 *
 * A view is created the first time it is shown and then kept, as a layer in a
 * stack: the active one is the visible layer, the rest are `visibility:
 * hidden` (see `.wb-sidebar-layer`). Not the `hidden` attribute, and not
 * `display: none` — destroying the layout box is precisely what resets a
 * scroller to the top, which is half the state this exists to keep.
 * `visibility: hidden` keeps the box, and still takes the layer out of the tab
 * order and out of the accessibility tree.
 */
export function SidebarHost({
  activeView,
  explorer,
  scm,
  review,
  brain
}: SidebarHostProps): React.JSX.Element {
  // Which views have ever been shown. A render-phase update (React's own
  // "adjusting state during render" pattern) rather than an effect: an effect
  // would paint one empty frame on the first visit to a view, which is a
  // flash on every first switch.
  const [mounted, setMounted] = useState<readonly SidebarView[]>(() => [activeView])
  if (!mounted.includes(activeView)) setMounted([...mounted, activeView])

  const bodies: Record<SidebarView, ReactNode> = { explorer, scm, review, brain }

  return (
    <div className="wb-sidebar-host">
      {VIEW_ORDER.filter((view) => mounted.includes(view)).map((view) => (
        <div
          key={view}
          className="wb-sidebar-layer"
          data-view={view}
          data-active={view === activeView || undefined}
        >
          {bodies[view]}
        </div>
      ))}
    </div>
  )
}
