import type { SidebarView } from './ActionRail'

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
  sidebarView: 'explorer',
  /**
   * **First launch opens on the chat alone.**
   *
   * A file tree over a workspace whose files you have not asked about yet is
   * a wall of names with nothing to say; the one thing a first-time user is
   * here to do is talk to an agent. The sidebar is one keystroke (Ctrl+B) or
   * one rail click away, and the guided tour points at that button — so this
   * hides a surface, never a capability.
   */
  sidebarOpen: false,
  layout: null
}

const STORAGE_KEY = 'hive.workspaceSession'

/** Pre-`workspaceSession` keys, read once to migrate an existing install (never written again). */
const LEGACY_VIEW_KEY = 'hive.sidebarView'
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

const VIEWS: readonly SidebarView[] = ['explorer', 'scm', 'review', 'brain']

function isView(value: unknown): value is SidebarView {
  return typeof value === 'string' && (VIEWS as readonly string[]).includes(value)
}

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
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry !== ''))]
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
    sidebarView: isView(raw.sidebarView) ? raw.sidebarView : 'explorer',
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

/** One legacy key's value, or `undefined` — the reads are separate so a corrupt layout can't cost the view. */
function legacySeed(): Partial<WorkspaceSession> {
  const seed: Partial<WorkspaceSession> = {}
  try {
    const view = localStorage.getItem(LEGACY_VIEW_KEY)
    if (isView(view)) seed.sidebarView = view
  } catch {
    // ignore
  }
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
 * A workspace nobody has saved yet gets `EMPTY_SESSION` — including its closed
 * sidebar — with the pre-workspaceSession globals folded in as seeds, so an
 * existing install keeps the rail width it dragged and the view it left on
 * without ever having been asked to migrate. `sidebarOpen` is deliberately
 * NOT seeded: "first launch shows only the chat" is a rule about a workspace
 * with no session, and an old global says nothing about this workspace.
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
