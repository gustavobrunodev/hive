import type { ReactNode } from 'react'
import { SIDEBAR_VIEWS, type SidebarView } from './sidebarNav'
import { useMountedLayers } from './useMountedLayers'

interface SidebarHostProps {
  /**
   * The active sidebar view (git-management D-GIT-2, GIT-R13; +chat, nav-redesign).
   *
   * "Revisão do agente" and "Bases de conhecimento" used to be layers in here.
   * They are work-area panes now (`WorkView`): opening one no longer costs the
   * user the conversation history they navigate by.
   */
  activeView: SidebarView
  /** The Chat tab's home — the conversation list (nav-redesign). Optional so older callers keep compiling. */
  chat?: ReactNode
  /** The Explorer (file tree) body. */
  explorer: ReactNode
  /** The Source Control body. */
  scm: ReactNode
}

/** The views in nav order — also the DOM order of the layers below. */
const VIEW_ORDER = SIDEBAR_VIEWS

/**
 * Swaps the rail pane's body between the conversation list, the Explorer and
 * Source Control, one at a time (git-management D-GIT-2). It lives *inside*
 * the rail `ResizablePanel`,
 * which keeps `id="rail"` — so the persisted layout/`paneOrder` and the
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
  chat,
  explorer,
  scm
}: SidebarHostProps): React.JSX.Element {
  const mounted = useMountedLayers<SidebarView>(activeView)

  const bodies: Record<SidebarView, ReactNode> = { chat, explorer, scm }

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
