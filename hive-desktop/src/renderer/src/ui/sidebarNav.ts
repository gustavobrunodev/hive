/**
 * The sidebar's navigation model.
 *
 * Two tabs — `Chat` and `Arquivos` — and, under each, the views that tab can
 * show. This used to be a flat list of four activity-bar entries with no
 * grouping, which meant "the file tree", "the diff list", "what the agent
 * changed" and "the knowledge vault" were four peers competing for the same
 * glance. They are not peers: two of them are about the conversation, two are
 * about the workspace's files.
 *
 * `SidebarView` is still the unit of state (one view on screen at a time,
 * persisted per workspace in `workspaceSession`); the tab is **derived** from
 * it rather than stored beside it, so the two can never disagree.
 */

/**
 * The swappable sidebar bodies. `chat` is the Chat tab's home — the
 * conversation list.
 *
 * `review` and `brain` used to be in here, and taking them out is the point of
 * the split below: they are **work**, not navigation, and putting them in the
 * rail meant opening one *replaced the conversation history* with a panel the
 * width of a sidebar. The user lost the list they navigate by in order to look
 * at something that wanted more room than the column had.
 */
export type SidebarView = 'chat' | 'explorer' | 'scm'

/**
 * What the work area's first pane is showing.
 *
 * `chat` is the transcript. `review` and `brain` are the agent's tools, opened
 * **in place of** it — full pane width, with the sidebar's history left alone
 * so you can still see where you were and get back to it in one click.
 *
 * `design` is the Design Studio module (decision 1 of its task A). It opens in
 * the same place, but it is a place of its own rather than a tool: while it is
 * in front, the Chat tab's body under the tools becomes the module's own
 * navigation, with the history kept mounted underneath for the way back.
 */
export type WorkView = 'chat' | 'review' | 'brain' | 'design'

/** The two top-level sidebar tabs. */
export type SidebarTab = 'chat' | 'files'

/** DOM id of the sidebar panel the nav's entries show and hide — the target of their `aria-controls`. */
export const SIDEBAR_REGION_ID = 'wb-sidebar-region'

/** DOM id of the work pane the chat tools open into — the target of their `aria-controls`. */
export const WORK_REGION_ID = 'wb-work-region'

/** Every view, in the DOM order the host stacks them in. */
export const SIDEBAR_VIEWS: readonly SidebarView[] = ['chat', 'explorer', 'scm']

/** Which tab a view belongs to — a total map, so a new view cannot forget to declare its home. */
const TAB_OF_VIEW: Record<SidebarView, SidebarTab> = {
  chat: 'chat',
  explorer: 'files',
  scm: 'files'
}

/** The work views, in the DOM order the pane stacks them in. */
export const WORK_VIEWS: readonly WorkView[] = ['chat', 'review', 'brain', 'design']

export function isWorkView(value: unknown): value is WorkView {
  return typeof value === 'string' && (WORK_VIEWS as readonly string[]).includes(value)
}

/** The tab that owns this view. */
export function tabOfView(view: SidebarView): SidebarTab {
  return TAB_OF_VIEW[view]
}

/** The view a tab opens on when it has never been visited. */
export function defaultViewOfTab(tab: SidebarTab): SidebarView {
  return tab === 'chat' ? 'chat' : 'explorer'
}

export function isSidebarView(value: unknown): value is SidebarView {
  return typeof value === 'string' && (SIDEBAR_VIEWS as readonly string[]).includes(value)
}

/**
 * Structural mirror of `main/roleCatalog.ts`'s `ResolvedRoleAction`.
 *
 * It lives here (rather than in a component file) because half the app imports
 * it and none of those imports want a component: it travelled with the old
 * activity bar purely because that was the first surface to render one.
 *
 * `label` (shortcut-customization): catalog display name carried by
 * custom-selected shortcuts — the pt-BR maps win when they know the key.
 */
export interface RoleAction {
  key: string
  kind: 'workflow' | 'persona'
  command: { key: string; prompt?: string }
  label?: string
  /** skill-studio: `true` on shortcuts backed by a user-created skill (spark icon). */
  custom?: boolean
}
