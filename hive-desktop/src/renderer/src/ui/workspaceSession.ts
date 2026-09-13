import { isSidebarView, isWorkView, type SidebarView, type WorkView } from './sidebarNav'

/**
 * One restored editor tab (workspace-session).
 *
 * **File tabs only.** A diff, a commit diff, an agent-review diff or a
 * conflict view is a window onto a state that has almost certainly moved on
 * by the next launch — the working tree was committed, the review accepted,
 * the merge finished. Reopening those would restore a tab whose content is
 * gone or, worse, silently different from the one that was closed. A file is
 * the one tab whose subject survives the app being shut down, so it is the
 * one kind this restores.
 */
export interface RestoredTab {
  /** Workspace-relative path. */
  path: string
  /** VS Code preview semantics — an unpinned (italic) tab comes back unpinned. */
  pinned: boolean
}

/** Everything the workbench puts back when a workspace is reopened. */
export interface WorkspaceSession {
  /** Open file tabs, left to right. */
  tabs: RestoredTab[]
  /** Which of them was in front. */
  activeTab: string | null
  /** Explorer folders that were open (node ids = workspace-relative paths). */
  expanded: string[]
  /** The stored conversation that was on screen. */
  chatSessionId: string | null
  /** Which sidebar view the rail was showing (or would show, if hidden). */
  sidebarView: SidebarView
  /** Which surface the work area's first pane was showing — the transcript, or one of the chat tools. */
  workView: WorkView
  /**
   * The initiative the work area was opened on, as its workspace-relative
   * folder — `null` for a plain conversation.
   *
   * A path rather than the initiative itself: the folder is the identity, and
   * anything else about it (its title, its artifacts, how far along its plan
   * is) has to be re-read from disk on the way back in anyway. Restoring a
   * *copy* of that would mean restoring an initiative as it was when the app
   * closed, which is exactly the state the agent has been changing since.
   */
  initiativePath: string | null
  /** Whether the sidebar panel itself was on screen. */
  sidebarOpen: boolean
  /**
   * The pane group's flex-grow map (`{ rail, chat, viewer }`).
   *
   * `rail` here is always the *expanded* width, never the collapsed 0 — a
   * hidden sidebar must reopen at the width it was dragged to, not at a
   * default, and not at nothing. `mergeLayout` is what enforces that.
   */
  layout: Record<string, number> | null
}

/** The workbench's own starting point — and the first-run answer. */
export const EMPTY_SESSION: WorkspaceSession = {
  tabs: [],
  activeTab: null,
  expanded: [],
  chatSessionId: null,
  /**
   * **First launch opens on the Chat tab, with the sidebar showing.**
   *
   * It used to open on the Explorer, hidden — for a good reason at the time: a
   * file tree over a workspace whose files you have not asked about yet is a
   * wall of names with nothing to say, so the app hid the whole panel rather
   * than lead with it (nav-redesign supersedes that).
   *
   * The sidebar's first face is no longer a file tree. It is "+ Novo", the
   * agent's tools and the conversations you had yesterday — which is exactly
   * what a returning user came for, and the one screen a first-time user should
   * be looking at. Hiding it now would hide the app's own table of contents.
   * Ctrl+B still puts it away, and the choice is remembered per workspace.
   */
  sidebarView: 'chat',
  workView: 'chat',
  initiativePath: null,
  sidebarOpen: true,
  layout: null
}

const STORAGE_KEY = 'hive.workspaceSession'

/** Pre-`workspaceSession` key, read once to migrate an existing install (never written again). See `legacySeed` for why `hive.sidebarView` is no longer one of them. */
const LEGACY_LAYOUT_KEY = 'hive.workLayout'

/**
 * How many workspaces keep a session.
 *
 * Sessions are small (a handful of paths), but the record is unbounded
 * otherwise — someone who opens a folder once should not cost the next
 * hundred launches a parse. Evicted least-recently-saved first.
 */
const MAX_WORKSPACES = 12

interface StoredEntry extends WorkspaceSession {
  savedAt: number
}

type Store = Record<string, StoredEntry>

/** The view vocabulary lives with the nav model, so a new view cannot be storable without being navigable. */
const isView = isSidebarView

/** A flex-grow map is a plain object of finite numbers — anything else is corrupt and is dropped whole. */
function readLayout(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return null
  const out: Record<string, number> = {}
  for (const [key, size] of entries) {
    if (typeof size !== 'number' || !Number.isFinite(size)) return null
    out[key] = size
  }
  return out
}

/** Tolerates hand-edited/older payloads field by field: one bad field costs that field, never the whole session. */
function readTabs(value: unknown): RestoredTab[] {
  if (!Array.isArray(value)) return []
  const tabs: RestoredTab[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const { path, pinned } = entry as { path?: unknown; pinned?: unknown }
    if (typeof path !== 'string' || path === '') continue
    if (tabs.some((tab) => tab.path === path)) continue
    tabs.push({ path, pinned: pinned === true })
  }
  return tabs
}

function readStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry !== ''))
  ]
}

function readEntry(value: unknown): WorkspaceSession | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const tabs = readTabs(raw.tabs)
  const activeTab = typeof raw.activeTab === 'string' ? raw.activeTab : null
  return {
    tabs,
    // An active tab that isn't in the strip is a torn write, not a state.
    activeTab: tabs.some((tab) => tab.path === activeTab) ? activeTab : (tabs[0]?.path ?? null),
    expanded: readStrings(raw.expanded),
    chatSessionId: typeof raw.chatSessionId === 'string' ? raw.chatSessionId : null,
    sidebarView: isView(raw.sidebarView) ? raw.sidebarView : EMPTY_SESSION.sidebarView,
    // `review` and `brain` were sidebar views before they became work-area
    // panes. A session saved then still names one here, and `isView` now says
    // no to both — so the field above falls back to `chat` (the right rail) and
    // this carries the intent across to where that surface actually lives now.
    workView: isWorkView(raw.workView)
      ? raw.workView
      : isWorkView(raw.sidebarView)
        ? raw.sidebarView
        : EMPTY_SESSION.workView,
    initiativePath: typeof raw.initiativePath === 'string' ? raw.initiativePath : null,
    sidebarOpen: raw.sidebarOpen === true,
    layout: readLayout(raw.layout)
  }
}

/** The whole record, or an empty one for every failure mode (private mode, quota, hand edits, older schema). */
function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const store: Store = {}
    for (const [workspace, value] of Object.entries(parsed as Record<string, unknown>)) {
      const session = readEntry(value)
      if (!session) continue
      const savedAt = (value as { savedAt?: unknown }).savedAt
      store[workspace] = {
        ...session,
        savedAt: typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : 0
      }
    }
    return store
  } catch {
    return {}
  }
}

/** Same write-failure tolerance as the layout keys this replaces: persistence is a nicety, not a hard requirement. */
function writeStore(store: Store): void {
  const workspaces = Object.keys(store)
  if (workspaces.length > MAX_WORKSPACES) {
    const doomed = workspaces
      .sort((a, b) => store[b].savedAt - store[a].savedAt)
      .slice(MAX_WORKSPACES)
    for (const workspace of doomed) delete store[workspace]
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}

/**
 * What a workspace with no session of its own inherits from the
 * pre-`workspaceSession` globals: **the rail's width, and nothing else.**
 *
 * The view used to be seeded from `hive.sidebarView` too, and that turned a
 * one-off migration into a permanent rule: the key is global and was last
 * written by a build that predates the Chat tab, so *every* folder opened for
 * the first time since then landed on whatever surface that install happened to
 * quit on — the Explorer, or the diff list, or (worse) a work view that opened
 * over the conversation. A first-run default that varies with an old machine's
 * leftovers is not a default; opening a new workspace on Chat & Cowork with the
 * transcript in front is (`EMPTY_SESSION`).
 *
 * A width is different in kind, and is kept: it is a fact about this user's
 * monitor and their hand, it is the same answer in every folder, and getting it
 * wrong costs one drag rather than a wrong screen.
 */
function legacySeed(): Partial<WorkspaceSession> {
  const seed: Partial<WorkspaceSession> = {}
  try {
    const raw = localStorage.getItem(LEGACY_LAYOUT_KEY)
    const layout = raw ? readLayout(JSON.parse(raw)) : null
    if (layout) seed.layout = layout
  } catch {
    // ignore
  }
  return seed
}

/**
 * The state to open this workspace in.
 *
 * A workspace nobody has saved yet gets `EMPTY_SESSION` — Chat & Cowork, with
 * the transcript in front — plus the one pre-`workspaceSession` global still
 * worth folding in (the rail's width; see `legacySeed`). Nothing an old install
 * left behind is allowed to choose the *screen* a new workspace opens on:
 * "first launch lands on the conversation" is a rule about a workspace with no
 * session, and a global written by a build that predates the Chat tab says
 * nothing about this one.
 */
export function loadWorkspaceSession(workspace: string): WorkspaceSession {
  const stored = readStore()[workspace]
  if (stored) {
    // Named field by field rather than spread-minus-`savedAt`: the bookkeeping
    // timestamp is this module's, and nothing outside it should see one.
    return {
      tabs: stored.tabs,
      activeTab: stored.activeTab,
      expanded: stored.expanded,
      chatSessionId: stored.chatSessionId,
      sidebarView: stored.sidebarView,
      workView: stored.workView,
      initiativePath: stored.initiativePath,
      sidebarOpen: stored.sidebarOpen,
      layout: stored.layout
    }
  }
  return { ...EMPTY_SESSION, ...legacySeed() }
}

/** Merges `patch` into this workspace's session (fields left out keep their stored value). */
export function saveWorkspaceSession(workspace: string, patch: Partial<WorkspaceSession>): void {
  const store = readStore()
  const current = store[workspace] ?? { ...EMPTY_SESSION, ...legacySeed(), savedAt: 0 }
  store[workspace] = { ...current, ...patch, savedAt: Date.now() }
  writeStore(store)
}

/**
 * Folds a live pane layout into the stored one, keeping the rail's *expanded*
 * width whenever the reported one is a collapse.
 *
 * `react-resizable-panels` reports a collapsed panel as ~0, and writing that
 * through would mean a sidebar that reopens at nothing — the user would have
 * to re-drag their width every single time they used Ctrl+B. What the layout
 * is for is "how wide was it", and a hidden panel has no answer to that; the
 * last one it gave still does.
 */
export function mergeLayout(
  stored: Record<string, number> | null,
  live: Record<string, number>
): Record<string, number> {
  const next = { ...(stored ?? {}) }
  for (const [pane, size] of Object.entries(live)) {
    if (size < 1 && next[pane] !== undefined) continue
    next[pane] = size
  }
  return next
}
