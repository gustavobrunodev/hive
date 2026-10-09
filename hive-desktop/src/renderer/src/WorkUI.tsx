import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, HTMLAttributes, ReactNode } from 'react'
import {
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
import { FileTree, FileViewer } from './explorer/Explorer'
import { Chat, type ChatHandle } from './chat/Chat'
import { ChatSidebar, NewConversationButton } from './chat/ChatSidebar'
import { AllConversationsDialog } from './chat/AllConversationsDialog'
import { useChatSessions } from './chat/useChatSessions'
import {
  DEFAULT_SORT,
  DEFAULT_WINDOW,
  type ActivityWindow,
  type ConversationSort
} from './chat/conversationFilters'
import { EditorTabs, type EditorTabActions } from './ui/EditorTabs'
import { useEditorTabs } from './ui/useEditorTabs'
import {
  SIDEBAR_REGION_ID,
  WORK_REGION_ID,
  WORK_VIEWS,
  defaultViewOfTab,
  tabOfView,
  type RoleAction,
  type SidebarTab,
  type SidebarView,
  type WorkView
} from './ui/sidebarNav'
import { AppNavbar } from './ui/AppNavbar'
import { useNavbarBounds } from './ui/useNavbarBounds'
import { SidebarNavItem, SidebarTabs } from './ui/SidebarNav'
import { UserMenu } from './ui/UserMenu'
import { SidebarHost } from './ui/SidebarHost'
import { useMountedLayers } from './ui/useMountedLayers'
import { useGitStore, GitProvider } from './scm/useGit'
import { useReviewStore, ReviewProvider } from './scm/useReview'
import { pendingByConversation } from './scm/reviewScope'
import { useSecondBrain } from './secondBrain/useSecondBrain'
import { useBrainSetup } from './secondBrain/useBrainSetup'
import { BrainLaunchToast } from './secondBrain/BrainLaunchToast'
import { SecondBrainPanel } from './secondBrain/SecondBrainPanel'
import { SecondBrainFab, type IngestMode } from './secondBrain/SecondBrainFab'
import { IngestPanel } from './secondBrain/IngestPanel'
import { AskSecondBrain } from './secondBrain/AskSecondBrain'
import { HealthNudge } from './secondBrain/HealthNudge'
import { SECOND_BRAIN_INGEST, SECOND_BRAIN_LINT } from './secondBrain/secondBrainPrompts'
import { InitiativesPanel } from './initiatives/InitiativesPanel'
import { InitiativeContext } from './initiatives/InitiativeContext'
import { InitiativeSash } from './initiatives/InitiativeSash'
import { InitiativeSettingsDialog } from './initiatives/InitiativeSettingsDialog'
import { NewInitiativeDialog } from './initiatives/NewInitiativeDialog'
import { useOpenInitiative } from './initiatives/useOpenInitiative'
import type { Initiative } from './initiatives/initiatives'
import { changeCount } from './scm/gitStatus'
import { SourceControlPanel } from './scm/SourceControlPanel'
import { GitLogConsole } from './scm/GitLogConsole'
import { AgentReviewPanel } from './scm/AgentReviewPanel'
import { ReviewDiffTab } from './scm/ReviewDiffTab'
import { ReviewBar } from './ui/ReviewBar'
import { StaleGuardDialog } from './ui/StaleGuardDialog'
import { ReviewSwitchDialog } from './ui/ReviewSwitchDialog'
import { DiffTab } from './scm/DiffTab'
import { CommitDiffTab } from './scm/CommitDiffTab'
import { ConflictView } from './ui/ConflictView'
import { BranchPicker } from './scm/BranchPicker'
import { useCheckoutGuard } from './scm/useCheckoutGuard'
import { useGitRemote } from './scm/useGitRemote'
import { StatusBar } from './ui/StatusBar'
import { McpConsole, type McpConsoleProps } from './mcpLogs/McpConsole'
import { McpStatusCluster } from './mcpLogs/McpStatusCluster'
import { isLive, useMcpLogs } from './mcpLogs/useMcpLogs'
import { buildRoster } from './mcpLogs/mcpRoster'
import { serverStats } from './mcpLogs/logConsole'
import type { McpServerReport } from './chat/turnTimeline'
import { useTicker } from './chat/useTicker'
import { UnsavedGuardDialog } from './ui/UnsavedGuardDialog'
import { GitOpToast } from './ui/GitOpToast'
import type { RowSide } from './scm/ChangeGroups'
import type { GitFileChange } from './scm/gitStatus'
import { ProfileSheet } from './profile/ProfileSheet'
import { AwsLoginBeacon } from './aws/AwsLoginBeacon'
import { useAwsSession } from './aws/useAwsSession'
import { ClaudeSignInBeacon } from './claudeAuth/ClaudeSignInBeacon'
import type { ConnectionLane } from './profile/ConnectionScope'
import { useClaudeAuth } from './claudeAuth/useClaudeAuth'
import { accountReady, isLoginLive } from './claudeAuth/claudeSession'
import type { ProfileScope } from './profile/scopes'
import { ShortcutCustomizer, type ShortcutScope } from './ui/ShortcutCustomizer'
import { SkillStudio, type StudioLaunchOpts } from './ui/SkillStudio'
import type { RunLaunchOpts } from './chat/useRunConfig'
import { McpManager } from './ui/McpManager'
import { UpdateCenter } from './ui/UpdateCenter'
import { UpdateNotice } from './ui/UpdateNotice'
import { VoiceDownloadNotices } from './voice/VoiceDownloadNotices'
import { useUpdateFlow } from './ui/useUpdateFlow'
import { FileSearchDialog } from './ui/FileSearchDialog'
import { GuidedTour } from './tour/GuidedTour'
import { useGuidedTour } from './tour/useGuidedTour'
import { PaneHeader, PaneMoveMenu } from './ui/PaneHeader'
import { PANE_DRAG_MIME } from './ui/paneDnd'
import { IconButton } from './ui/IconButton'
import type { Theme } from './ui/theme'
import {
  BrainIcon,
  ChevronDownIcon,
  CloseIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshIcon,
  ReviewIcon,
  SourceControlIcon,
  SparkleIcon
} from './ui/icons'
import { copyText } from './ui/clipboard'
import {
  loadWorkspaceSession,
  mergeLayout,
  saveWorkspaceSession,
  type WorkspaceSession
} from './ui/workspaceSession'
import { ChatTabBody } from './designStudio/ChatTabBody'
import { DesignStudioNav } from './designStudio/DesignStudioNav'
import { DesignStudioShell } from './designStudio/DesignStudioShell'
import { DesignStudioIcon } from './designStudio/icons'
import { useDesignStudio } from './designStudio/useDesignStudio'

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
  theme: Theme
  onSelectTheme: (theme: Theme) => void
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
  /**
   * Active app-wide role (role-personalization) — seeds both shortcut sets.
   * Chosen once at first access (shortcut-scopes): read here, never written,
   * so no `onRoleChange` counterpart exists.
   */
  role?: string | null
  /** Enabled agent ids (multi-agent) — the composer switcher's pool + the profile picker. */
  agents?: string[]
  /** Default agent id (multi-agent) — a new conversation starts on it. */
  defaultAgent?: string | null
  /** Display name (install form / profile sheet) — feeds the hero greeting. */
  userName?: string | null
  /** Live profile changes from the profile sheet — persisted + lifted in App. */
  onAgentsChange?: (ids: string[]) => void
  onDefaultAgentChange?: (agentId: string) => void
  onUserNameChange?: (name: string) => void
}

/**
 * Interleaves the panes with resize handles (module scope — keeps the loop's
 * branches off `WorkUI`'s complexity budget).
 *
 * A sash pinned against the window's left edge with nothing on its far side is
 * a control that promises a boundary where there is none, so the one beside a
 * hidden sidebar is *marked* (`data-offscreen`) and taken out of the layout by
 * the stylesheet — not removed from the tree. Removing it is what the first
 * version did, and `react-resizable-panels` re-normalised the whole group when
 * its children changed shape, snapping the panel that had just been expanded
 * straight back to zero. The group's children stay constant; only their
 * painting changes.
 */
function buildPanels(
  renderedPanes: readonly PaneId[],
  renderers: Record<PaneId, () => ReactNode>,
  /**
   * Which panes a user can actually see — a rendered pane is not the same as a
   * visible one (the rail stays mounted while the sidebar is away). Required,
   * not defaulted: the one caller always knows, and an `() => true` fallback is
   * a branch nothing exercises and a claim nobody checked.
   */
  isOnScreen: (pane: PaneId) => boolean
): ReactNode[] {
  const panels: ReactNode[] = []
  for (const [index, pane] of renderedPanes.entries()) {
    if (index > 0) {
      const dead = !isOnScreen(pane) || !isOnScreen(renderedPanes[index - 1])
      panels.push(
        <ResizableHandle
          key={`handle-${pane}`}
          withGrip
          data-offscreen={dead ? '' : undefined}
          aria-label={t('workUI.resizeHandleLabel')}
        />
      )
    }
    panels.push(renderers[pane]())
  }
  return panels
}

/** Last path segment of an absolute workspace path (both separators, so a Windows path renders its folder name too). */
/** What the unsaved-changes guard calls a tab: the file's own name, not the synthetic diff key. */
function tabLabel(tabPath: string): string {
  const withoutMarker = tabPath.replace(/^⟨[a-z]+⟩/, '').split('?')[0] ?? tabPath
  const slash = withoutMarker.lastIndexOf('/')
  return slash === -1 ? withoutMarker : withoutMarker.slice(slash + 1)
}

function workspaceName(workspace: string): string {
  const segments = workspace.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? workspace
}

/**
 * The sidebar panel's accessible name — whichever surface is showing inside it.
 *
 * The panel is one landmark whose content swaps, so its name has to swap too:
 * "Arquivos" announced over the conversation list is the pane-header defect
 * `docs/visual-validation.md` records, one level up.
 */
function sidebarPaneTitle(view: SidebarView): string {
  switch (view) {
    case 'chat':
      return t('nav.conversationsLabel')
    case 'scm':
      return t('git.paneTitle')
    case 'explorer':
      return t('explorer.paneTitle')
  }
}

/**
 * The first work pane's title — it names whichever surface is in front.
 *
 * The pane used to be called "Conversa" unconditionally, because a transcript
 * was the only thing it could hold. Now that the agent's tools open here, the
 * header is the one place that says which of them you are looking at, and the
 * one place that offers the way back.
 */
function workPaneTitle(view: WorkView): string {
  switch (view) {
    case 'chat':
      return t('workUI.paneChat')
    case 'review':
      return t('review.panelTitle')
    case 'brain':
      return t('secondBrain.panelTitle')
    case 'design':
      return t('designStudio.name')
  }
}

/**
 * The Design Studio's navigation is on screen — the sidebar showing, on the
 * Chat & Cowork tab whose body it takes over. While it is not, each module page
 * carries the "Dados de exemplo" seal the navigation would have shown.
 *
 * Module scope for the same reason as the helpers above: a condition written in
 * `WorkUI`'s body is a point off a complexity budget that is already spent.
 */
function designNavVisible(sidebarOpen: boolean, tab: SidebarTab): boolean {
  return sidebarOpen && tab === 'chat'
}

/**
 * The way back out of a chat tool that opened in the transcript's place.
 *
 * `null` on the transcript itself: there is nothing to close, and a disabled or
 * no-op ✕ in a pane header is worse than no ✕ at all.
 */
function workCloseButton(
  view: WorkView,
  title: string,
  onClose: (view: WorkView) => void
): ReactNode {
  if (view === 'chat') return null
  return (
    <IconButton label={t('workUI.closeWorkView', title)} onClick={() => onClose('chat')}>
      <CloseIcon size={14} />
    </IconButton>
  )
}

/**
 * The chat pane's header.
 *
 * An open initiative used to rename this strip after itself and take its ✕.
 * That put the demand's only close control on the **pane's** background while
 * the panel it closed sits on `--bg-2` — one strip, two surfaces, with the
 * seam running straight through the button. The initiative now carries its own
 * bar inside `InitiativeContext`, so this header is back to describing the one
 * thing it spans: whatever is showing in place of the transcript.
 *
 * A module-level function rather than `? :` inside the component: every branch
 * written in `WorkUI`'s own body counts against a `complexity` ceiling this
 * file is already at.
 */
function chatPaneHeader(
  workView: WorkView,
  showWorkView: (view: WorkView) => void
): { title: string; primaryActions: ReactNode } {
  const title = workPaneTitle(workView)
  return { title, primaryActions: workCloseButton(workView, title, showWorkView) }
}

/** Map of Resizable panel id -> flex-grow percentage (mirrors react-resizable-panels' `Layout` type). */
type WorkLayout = Record<string, number>

/** How long the sidebar takes to slide away and back — the low end of this app's 150–250ms band (PRODUCT.md §5), because it is chrome moving, not content arriving. Must match `--wb-sidebar-anim` in workbench.css. */
const SIDEBAR_ANIMATION_MS = 180

/** When the slide is considered over. A little past the transition: dropping the animating class on its exact last frame can clip the final pixels. */
const SIDEBAR_SETTLE_MS = SIDEBAR_ANIMATION_MS + 60

/** How long a sash has to stop moving before its width is written down. */
const LAYOUT_WRITE_DELAY_MS = 200

/**
 * The pane widths the group mounts with.
 *
 * A hidden sidebar mounts at zero rather than opening wide and snapping shut a
 * frame later — the flash of a panel you closed last week is the least
 * trustworthy thing a restore can do.
 */
function initialLayout(session: WorkspaceSession): WorkLayout | undefined {
  if (!session.layout) return undefined
  return { ...session.layout, rail: session.sidebarOpen ? session.layout.rail : 0 }
}

/**
 * The rail's stored width, or the default the panel would have picked.
 *
 * A stored width below 1% is not a width — it is a collapse that leaked into
 * the record — and reopening at it would put the sidebar back as a sliver.
 */
function initialRailSize(session: WorkspaceSession): number {
  const stored = session.layout?.rail
  return stored !== undefined && stored >= 1 ? stored : DEFAULT_RAIL_SIZE
}

/** Rail width, in group percent, before anyone has dragged one. Mirrors the panel's own `defaultSize`. */
const DEFAULT_RAIL_SIZE = 22

/**
 * Everything the shell renders differently because the sidebar is (or isn't)
 * showing.
 *
 * At module scope so `WorkUI`'s own branch budget goes on decisions rather
 * than on how three attributes are spelled.
 */
function sidebarChrome(
  open: boolean,
  animating: boolean
): { bodyState: 'open' | 'closed'; groupClass: string | undefined; collapsedFlag: '' | undefined } {
  return {
    bodyState: open ? 'open' : 'closed',
    groupClass: animating ? 'wb-panes-animating' : undefined,
    collapsedFlag: open ? undefined : ''
  }
}

/**
 * The panel handle `ResizablePanel` hands back through `panelRef`.
 *
 * Declared here rather than imported: `react-resizable-panels` is the design
 * system's dependency, not this app's, and the DS does not re-export the type.
 * Nothing drifts silently — `panelRef={railPanel}` only compiles while this
 * still matches the real handle, so the assignment at the call site is the
 * check.
 */
interface PanelHandle {
  collapse: () => void
  expand: () => void
  getSize: () => { asPercentage: number; inPixels: number }
  isCollapsed: () => boolean
  resize: (size: number | string) => void
}

/**
 * The panes that get *rendered*: the viewer only exists while at least one tab
 * is open.
 *
 * The rail is always in here, even with the sidebar hidden — it is a
 * `collapsible` panel collapsed to zero, not an unmounted one. Unmounting it
 * would throw the file tree away on every Ctrl+B: every folder shut, the
 * scroller back at the top, and a walk of the whole workspace (spinner and
 * all) on the way back. That is the same reason `SidebarHost` keeps its
 * inactive views mounted, one level down; hiding a panel must cost nothing.
 */
function renderedPanesFor(order: PaneId[], hasTabs: boolean): PaneId[] {
  return order.filter((id) => id !== 'viewer' || hasTabs)
}

/** The three movable workbench panes (customizable-layout). */
type PaneId = 'rail' | 'chat' | 'viewer'

/** localStorage key for the persisted left-to-right pane order (customizable-layout). Global, unlike the per-workspace `hive.workspaceSession` that keeps the widths: where a pane sits is a personal habit, not a fact about a folder. */
const PANE_ORDER_STORAGE_KEY = 'hive.paneOrder'

const DEFAULT_PANE_ORDER: readonly PaneId[] = ['rail', 'chat', 'viewer']

/** Where an in-flight pane drag would land: before/after the hovered pane. */
interface PaneDropHint {
  pane: PaneId
  side: 'before' | 'after'
}

/** Reads the persisted pane order, tolerating missing/corrupt data — anything that isn't a permutation of the three pane ids falls back to the default. */
function loadPaneOrder(): PaneId[] {
  try {
    const raw = localStorage.getItem(PANE_ORDER_STORAGE_KEY)
    if (!raw) return [...DEFAULT_PANE_ORDER]
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_PANE_ORDER.length &&
      DEFAULT_PANE_ORDER.every((id) => parsed.includes(id))
    ) {
      return parsed as PaneId[]
    }
    return [...DEFAULT_PANE_ORDER]
  } catch {
    return [...DEFAULT_PANE_ORDER]
  }
}

/** Same write-failure tolerance as the workspace session: persistence is a nicety, not a hard requirement. */
function persistPaneOrder(order: PaneId[]): void {
  try {
    localStorage.setItem(PANE_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

/**
 * The app's main work surface (task T19, design.md §4 layout — "File Tree |
 * Chat | File Viewer"): a slim top bar (brand mark, active-workspace chip,
 * theme picker) over three zones, all resizable panes of one group. The
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
 * the workspace's session record (`hive.workspaceSession`) via
 * `defaultLayout`/`onLayoutChanged` so a dragged rail width survives a reload
 * — per workspace, the way VS Code keeps a folder's layout.
 */
/** Shared empty roster, so a workspace with no handshake yet re-renders against a stable value. */
const NO_SERVERS: McpServerReport[] = []

/**
 * The bottom dock: whichever console is open, or nothing.
 *
 * The two are mutually exclusive because they share one slot — the question
 * each answers ("what is this MCP server doing", "what did git actually run")
 * is asked *while* looking at the work area, and two docks stacked would leave
 * none of it to look at.
 *
 * A component of its own rather than a branch in `WorkUI`'s JSX: that file is
 * already at the lint's complexity ceiling, and a nested render function there
 * is worse than either — the React compiler refuses to memoize a component
 * that defines one, which is a measured cost on this file specifically.
 */
function WorkDock({
  gitLogOpen,
  onCloseGitLog,
  mcpOpen,
  mcp
}: {
  gitLogOpen: boolean
  onCloseGitLog: () => void
  mcpOpen: boolean
  mcp: McpConsoleProps
}): React.JSX.Element | null {
  if (gitLogOpen) return <GitLogConsole onClose={onCloseGitLog} />
  if (!mcpOpen) return null
  return <McpConsole {...mcp} />
}

/**
 * mcp-visibility: the handshake roster, but only when it belongs to the
 * workspace on screen. A stale tag reads as "no servers reported yet", which is
 * the truth for a workspace whose CLI has not run — never the previous
 * workspace's list under a new name.
 */
function reportedFor(
  reported: { workspace: string; servers: McpServerReport[] } | null,
  workspace: string
): McpServerReport[] {
  return reported !== null && reported.workspace === workspace ? reported.servers : NO_SERVERS
}

function brainNavigationDetail(rawPending: number, healthDue: boolean): string | null {
  return (
    [
      rawPending > 0 ? t('secondBrain.railPending', rawPending) : null,
      healthDue ? t('secondBrain.railHealthDue') : null
    ]
      .filter(Boolean)
      .join(' · ') || null
  )
}

export function WorkUI({
  workspace,
  theme,
  onSelectTheme,
  onCandidateWorkspace,
  role = null,
  agents = [],
  defaultAgent = null,
  userName = null,
  onAgentsChange,
  onDefaultAgentChange,
  onUserNameChange = () => {}
}: WorkUIProps): React.JSX.Element {
  // Multi-tab editor pane (VS Code preview/pin semantics live in the hook).
  // The workspace is handed over so the strip can close a tab whose file was
  // deleted — by the explorer, by the initiative's Contexto tree, by the agent,
  // or by anything else that touches the folder.
  const editor = useEditorTabs(workspace)
  // git-management (M10): the single git store for this workspace, shared via
  // GitProvider to the rail's Source Control view, the status bar, the
  // explorer decorations and the editor gutter. Mounted once here (like
  // useUpdateFlow) so all consumers see one coherent state.
  const git = useGitStore(workspace)

  // Agent Change Review (M11): the single pending-set store for this workspace,
  // shared via ReviewProvider to all four surfaces — the review bar, the
  // "Revisão do agente" panel, the in-chat card, and the inline editor diff —
  // so they never drift (ACR-R2.5).
  const review = useReviewStore(workspace)
  // A turn's change card lives in the conversation it was asked from, so a
  // pending review in a conversation the user isn't reading would otherwise be
  // silent. The history list carries the marker that points back to it.
  const reviewPendingBySession = useMemo(
    () => pendingByConversation(review.turns, review.changes),
    [review.turns, review.changes]
  )
  // Second Brain (M12, SB-R2): vault status + raw-pending count for the rail
  // badge and the Second Brain panel.
  const secondBrain = useSecondBrain(workspace)
  // Which ingestion mode the FAB opened the sheet on — null while closed (SB-R3.1).
  const [ingestMode, setIngestMode] = useState<IngestMode | null>(null)
  // "Perguntar à base" (SB-R9.1) — reachable from Ctrl+Shift+K, the sidebar's
  // primary action and the floating button's menu.
  const [askOpen, setAskOpen] = useState(false)
  /**
   * workspace-session: everything this workspace was left in the middle of —
   * open files, the conversation on screen, the folders that were open, the
   * sidebar's view and whether it was showing at all, and the pane widths.
   *
   * Read once, in a state initializer, because `WorkUI` is keyed on the
   * workspace path in `App` (WS-R4.4): a switch is a remount, so "restore
   * this workspace" and "mount" are the same moment and no effect has to
   * watch for the path changing.
   */
  const [session] = useState(() => loadWorkspaceSession(workspace))
  // The swappable left-sidebar view (Explorer ⇄ Source Control ⇄ Revisão ⇄
  // Second Brain), persisted per workspace so it survives a reload (D-GIT-2).
  const [activeView, setActiveViewState] = useState<SidebarView>(session.sidebarView)
  /**
   * What the first work pane is showing: the transcript, or one of the two chat
   * tools opened in its place.
   *
   * These two used to be sidebar layers, and opening one **replaced the
   * conversation history** — the user gave up the list they navigate by, and
   * got a diff review squeezed into a 280px column, in exchange. They are work,
   * so they live in the work area: full pane width, history untouched, and one
   * click on the same row (or the pane's own ✕) to come back.
   */
  const [workView, setWorkViewState] = useState<WorkView>(session.workView)
  /**
   * Which work views have ever been shown. `chat` is always in — the transcript
   * holds the live session, so it is mounted from the first frame whether or not
   * a tool is covering it.
   */
  const mountedWorkViews = useMountedLayers<WorkView>(workView, ['chat'])
  /**
   * Design Studio: the module's own state (its page, what each page was last
   * opened on, its conversations), held up here because both halves read it —
   * the navigation in the sidebar and the pages in the work pane — and because
   * being above the layer is what keeps it while the person is away.
   */
  const designStudio = useDesignStudio(workView === 'design')
  /**
   * Whether the sidebar panel itself is on screen.
   *
   * Its own state rather than a "null view", because the view outlives the
   * hiding: closing the sidebar over Source Control and pressing Ctrl+B must
   * bring Source Control back, not send you to the Explorer.
   */
  const [sidebarOpen, setSidebarOpen] = useState(session.sidebarOpen)
  // git-management (GIT-R6): the branch quick-pick + a branch checkout parked
  // behind the three-way unsaved-work guard (mirrors the workspace switch).
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  /**
   * The view each tab returns to (nav-redesign).
   *
   * Leaving `Arquivos` on the diff list and coming back to the file tree is the
   * same broken promise `sidebarOpen` exists to avoid one level up: a tab is a
   * place you were, not a reset. Seeded from the restored view so a reload lands
   * on it, with the other tab on its default.
   */
  const [lastViewByTab, setLastViewByTab] = useState<Record<SidebarTab, SidebarView>>(() => ({
    chat:
      tabOfView(session.sidebarView) === 'chat' ? session.sidebarView : defaultViewOfTab('chat'),
    files:
      tabOfView(session.sidebarView) === 'files' ? session.sidebarView : defaultViewOfTab('files')
  }))
  /**
   * Shows a view — and the sidebar with it.
   *
   * Every *programmatic* caller means "put this in front of me": the review
   * bar's "Revisar →", the status bar's change count, a reveal-in-tree from
   * the Ctrl+P palette. None of them can be allowed to select a view behind a
   * hidden panel and call it done, which is the one bug a plain setter would
   * have shipped everywhere at once.
   */
  const showView = useCallback(
    (view: SidebarView) => {
      setActiveViewState(view)
      setLastViewByTab((current) => ({ ...current, [tabOfView(view)]: view }))
      setSidebarOpen(true)
      saveWorkspaceSession(workspace, { sidebarView: view, sidebarOpen: true })
    },
    [workspace]
  )
  /**
   * A nav row's own click: the row already on screen puts the sidebar away
   * (VS Code parity), anything else brings that view forward.
   */
  const toggleView = useCallback(
    (view: SidebarView) => {
      if (view === activeView && sidebarOpen) {
        setSidebarOpen(false)
        saveWorkspaceSession(workspace, { sidebarOpen: false })
        return
      }
      showView(view)
    },
    [activeView, sidebarOpen, showView, workspace]
  )
  /**
   * Brings a work surface forward. Unlike `showView` it says nothing about the
   * sidebar: these tools open *beside* the history, never instead of it.
   */
  const showWorkView = useCallback(
    (view: WorkView) => {
      setWorkViewState(view)
      saveWorkspaceSession(workspace, { workView: view })
    },
    [workspace]
  )
  /** A chat tool's own row: pressing the one already in front returns to the transcript. */
  const toggleWorkView = useCallback(
    (view: WorkView) => showWorkView(view === workView ? 'chat' : view),
    [workView, showWorkView]
  )
  /** The transcript, uncovered — what entering an initiative asks for. */
  const showChat = useCallback(() => showWorkView('chat'), [showWorkView])
  /** Initiatives: the workspace's demands, and whichever one the work area is opened on. */
  const initiative = useOpenInitiative(workspace, session.initiativePath, workView, showChat)
  /** The tab currently in front — derived, never stored, so the two can't disagree. */
  const activeTab = tabOfView(activeView)
  /**
   * A tab click.
   *
   * Tabs select; they do not toggle. Clicking the tab you are already on with
   * the sidebar showing is a no-op — the *toggle* is the navbar's own button and
   * the row that is already active, both of which say so in their names. What a
   * tab click does do is bring the panel back if it was away, which is the one
   * case where "select the tab I am on" is a real request.
   */
  const selectTab = useCallback(
    (tab: SidebarTab) => {
      showView(tab === activeTab ? defaultViewOfTab(tab) : lastViewByTab[tab])
    },
    [activeTab, lastViewByTab, showView]
  )
  /** Ctrl+B: hide/show whatever view the rail is resting on. */
  const toggleSidebar = useCallback(() => {
    const next = !sidebarOpen
    setSidebarOpen(next)
    saveWorkspaceSession(workspace, { sidebarOpen: next })
  }, [sidebarOpen, workspace])
  // The file the tree has been asked to point at. `nonce` and not just a path,
  // so revealing the same file twice in a row is two requests (see
  // `FileTreeProps.revealRequest`).
  const [revealRequest, setRevealRequest] = useState<{ path: string; nonce: number } | null>(null)

  /**
   * Open a file AND show where it lives — what every IDE does when a file
   * arrives from somewhere other than the tree.
   *
   * The sidebar is a single slot in this app, so "reveal" also means bringing
   * the Explorer back if the user was in Source Control: the request would
   * otherwise land on a tree nobody can see. Deliberately scoped to the
   * Ctrl+P palette, where the user has just gone looking for a file by name
   * and "where is it?" is the next question — not to every open, which would
   * yank the sidebar away from someone reading a diff.
   */
  const openAndReveal = useCallback(
    (path: string) => {
      editor.openFile(path)
      showView('explorer')
      setRevealRequest((current) => ({ path, nonce: (current?.nonce ?? 0) + 1 }))
    },
    [editor, showView]
  )

  /**
   * The editor tab menu's actions (VS Code parity).
   *
   * The close family is the tab model's own; the bottom group is the same
   * three things the file tree's row menu offers for a path, wired to the same
   * bridge calls — one vocabulary, whether you right-click a row or the tab it
   * opened into.
   */
  const tabActions = useMemo<EditorTabActions>(
    () => ({
      closeOthers: editor.closeOtherTabs,
      closeToTheRight: editor.closeTabsToTheRight,
      closeSaved: editor.closeSavedTabs,
      closeAll: editor.closeAllTabs,
      keepOpen: editor.pinTab,
      copyPath: (filePath, kind) => {
        const resolved =
          kind === 'relative'
            ? Promise.resolve(filePath)
            : window.hive.fs.absolutePath(workspace, filePath)
        void Promise.resolve(resolved)
          .then((text) => copyText(text))
          .catch(() => {})
      },
      revealInTree: (filePath) => {
        showView('explorer')
        setRevealRequest((current) => ({ path: filePath, nonce: (current?.nonce ?? 0) + 1 }))
      },
      revealInOs: (filePath) => {
        void Promise.resolve(window.hive.fs.revealPath(workspace, filePath, false)).catch(() => {})
      }
    }),
    [editor, workspace, showView]
  )

  // Branch checkout (GIT-R6.3): dirty editor drafts park behind the same
  // three-way guard the workspace switch uses (logic in useCheckoutGuard).
  const runCheckout = useCallback((ref: string) => void git.checkout(ref), [git])
  const checkoutGuard = useCheckoutGuard(editor, runCheckout)
  // git-management (GIT-R7): remote ops with success/error toasts (raw stderr
  // behind "Detalhes", D-GIT-1) — shared by the status-bar pill + SCM overflow.
  const gitRemote = useGitRemote(git)
  // npm-distribution T14: the shared update-flow state — launch + periodic
  // silent checks, the Tier 2 notice's props, and the rail's ambient dot
  // (T12) all read from this one hook. Mounted here (not App.tsx) so its own
  // effects fire only once the real work UI is already showing, never inside
  // or ahead of App.tsx's onboarding gate chain (ND-R2.5).
  const updateFlow = useUpdateFlow()
  const [defaultLayout] = useState<WorkLayout | undefined>(() => initialLayout(session))
  /**
   * The rail panel's imperative handle (`react-resizable-panels`) — how the
   * sidebar is hidden and brought back without unmounting the tree inside it.
   */
  const railPanel = useRef<PanelHandle | null>(null)
  /**
   * The width the sidebar reopens at, in group percent.
   *
   * Kept here rather than read back from the panel because a collapsed panel
   * measures zero: by the time you need the number, the thing that knew it is
   * the one that has been put away.
   */
  const railSize = useRef(initialRailSize(session))
  /**
   * True only while a *programmatic* sidebar toggle is in flight — the one
   * moment the pane group animates its widths.
   *
   * Not a permanent transition on the panels: a sash follows the pointer, and
   * a width easing 200ms behind the cursor is the difference between dragging
   * a boundary and watching one catch up. The toggle is the opposite case —
   * nothing is under the hand, and the slide is what says the panel went
   * somewhere rather than blinked out of existence.
   */
  const [sidebarAnimating, setSidebarAnimating] = useState(false)
  /**
   * The live pane layout, mirrored so a drag doesn't have to re-read (and
   * re-parse) the stored session on every animation frame.
   */
  const layoutRef = useRef<WorkLayout | null>(session.layout)
  const layoutWriteRef = useRef(0)

  /**
   * Drives the panel from `sidebarOpen`.
   *
   * A layout effect, not a plain one: on the very first launch the panel
   * mounts at its default width and the sidebar has to be closed *before* the
   * first paint, or every new user watches a file tree appear and vanish.
   * The same reason keeps the mount pass silent — `didToggle` is what
   * separates "restore this state" from "the user just asked for this".
   */
  const didToggle = useRef(false)
  /**
   * True while a toggle we started is still sliding.
   *
   * The panel reports its width every frame of that slide, and every frame of
   * a *close* is a width above the collapse threshold until the last one — read
   * as gestures they would each say "the user just opened the sidebar" and undo
   * the close in progress. A toggle is not a gesture; only a hand on the sash
   * is.
   */
  const toggling = useRef(false)
  useLayoutEffect(() => {
    const panel = railPanel.current
    if (!panel) return
    const alreadyRight = sidebarOpen !== panel.isCollapsed()
    const animate = didToggle.current
    didToggle.current = true
    if (alreadyRight) return
    toggling.current = true
    if (sidebarOpen) {
      panel.expand()
      // `expand()` restores "the most recent size", which after a reload is a
      // size nothing in this process ever saw. The width we persisted is the
      // one the user chose, so say it outright.
      panel.resize(`${railSize.current}%`)
    } else {
      panel.collapse()
    }
    if (animate) setSidebarAnimating(true)
    const timer = window.setTimeout(() => {
      toggling.current = false
      setSidebarAnimating(false)
    }, SIDEBAR_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [sidebarOpen])

  /** Ends a slide early — the pointer-down path, so a hand on the sash is never fighting a transition. */
  const endSidebarAnimation = useCallback(() => {
    toggling.current = false
    setSidebarAnimating((animating) => (animating ? false : animating))
  }, [])

  /**
   * The panel reporting its own width — which is also how a *drag* to the edge
   * reaches this state.
   *
   * `react-resizable-panels` collapses a `collapsible` panel dragged below its
   * minimum, so the sash and Ctrl+B are two gestures for one state; without
   * this they would disagree, and the rail would still be showing an accent
   * bar over a sidebar the user just dragged shut.
   */
  const handleRailResize = useCallback(
    (size: { asPercentage: number }, _id: unknown, previous: unknown) => {
      // The mount report is the layout being applied, and the frames of a
      // toggle are the app moving its own furniture. Neither is a gesture.
      if (previous === undefined || toggling.current) return
      const percentage = size.asPercentage
      if (percentage >= 1) railSize.current = percentage
      const open = percentage >= 1
      if (open === sidebarOpen) return
      setSidebarOpen(open)
      saveWorkspaceSession(workspace, { sidebarOpen: open })
    },
    [sidebarOpen, workspace]
  )

  /**
   * Persists the pane widths, coalesced: `onLayoutChanged` fires per frame
   * while a sash is moving, and a JSON round trip per frame is a drag that
   * stutters on a slow disk.
   */
  const handleLayoutChanged = useCallback(
    (layout: WorkLayout) => {
      // Same rule as `handleRailResize`: the frames of a toggle are not widths
      // anyone chose. Recording them means a *close* leaves whatever the slide
      // happened to be passing through — the last frame above the collapse
      // threshold — as "how wide the sidebar was", and the next launch reopens
      // at a sliver.
      if (toggling.current) return
      layoutRef.current = mergeLayout(layoutRef.current, layout)
      window.clearTimeout(layoutWriteRef.current)
      layoutWriteRef.current = window.setTimeout(() => {
        saveWorkspaceSession(workspace, { layout: layoutRef.current })
      }, LAYOUT_WRITE_DELAY_MS)
    },
    [workspace]
  )
  useEffect(() => () => window.clearTimeout(layoutWriteRef.current), [])

  /** workspace-session: the Explorer's open folders, as the tree reports them. */
  const persistExpanded = useCallback(
    (paths: string[]) => {
      saveWorkspaceSession(workspace, { expanded: paths })
    },
    [workspace]
  )

  /**
   * Puts the previously-open files back.
   *
   * Every path is checked against disk first: a workspace is a folder other
   * tools also write to, and reopening a tab whose file was deleted, renamed
   * or moved by a git checkout between launches would greet the user with a
   * strip of errors describing work they already finished. What survives the
   * check is restored; what doesn't is dropped without a word, because there
   * is nothing to decide.
   */
  const [tabsRestored, setTabsRestored] = useState(session.tabs.length === 0)
  const restoreTabs = editor.restoreTabs
  useEffect(() => {
    if (session.tabs.length === 0) return
    let cancelled = false
    void Promise.all(
      session.tabs.map((tab) =>
        Promise.resolve(window.hive.fs.exists(workspace, tab.path)).catch(() => false)
      )
    ).then((present) => {
      if (cancelled) return
      restoreTabs(
        session.tabs.filter((_tab, index) => present[index]),
        session.activeTab
      )
      setTabsRestored(true)
    })
    return () => {
      cancelled = true
    }
  }, [restoreTabs, session, workspace])

  // ...and keeps them current. Gated on the restore having landed, so the
  // empty strip of the first two frames never overwrites the strip being
  // restored into it.
  const editorTabs = editor.tabs
  const editorActivePath = editor.activePath
  useEffect(() => {
    if (!tabsRestored) return
    saveWorkspaceSession(workspace, {
      // File tabs only — see `RestoredTab`.
      tabs: editorTabs
        .filter((tab) => tab.kind === 'file')
        .map((tab) => ({ path: tab.path, pinned: tab.pinned })),
      activeTab: editorActivePath
    })
  }, [tabsRestored, editorTabs, editorActivePath, workspace])
  // customizable-layout: persisted left-to-right pane order + live drag state.
  const [paneOrder, setPaneOrder] = useState<PaneId[]>(loadPaneOrder)
  const [dragPane, setDragPane] = useState<PaneId | null>(null)
  const [dropHint, setDropHint] = useState<PaneDropHint | null>(null)
  const [chipMenuOpen, setChipMenuOpen] = useState(false)
  const [recents, setRecents] = useState<string[]>([])
  // role-personalization + shortcut-scopes: the two resolved shortcut sets
  // (role defaults, or the user's custom selection per scope) — `start` for
  // the chat hero, `during` for the composer strip. Loaded once here so both
  // stay in sync, and re-resolved on role change AND on every customizer edit
  // (live preview).
  const [shortcutSets, setShortcutSets] = useState<Record<ShortcutScope, RoleAction[]>>({
    start: [],
    during: []
  })
  const [profileOpen, setProfileOpen] = useState(false)
  // voice-settings: a deep link into one scope of the profile sheet (the
  // ingestion sheet's "Alterar" points at `voice`). `null` opens the index.
  const [profileScope, setProfileScope] = useState<ProfileScope | null>(null)
  /** Which lane of Perfil › Conexão do Claude a deep link asked for (claude-account). */
  const [connectionLane, setConnectionLane] = useState<ConnectionLane | null>(null)
  // aws-bedrock: the app-level subscription. The beacon has to be able to
  // appear with no AWS surface open at all, so the subscription lives here
  // rather than inside the panel that usually shows it.
  const aws = useAwsSession(true, workspace)
  // claude-account: the first-party session. Read once per window (main caches
  // it — the probe costs a spawn) and subscribed for the live sign-in, which
  // can be started from a failed turn or from the connection panel.
  const claudeAuth = useClaudeAuth(true, workspace)
  // Which profile detail is open *right now* — not the one that was deep-linked
  // to. The beacon steps aside only for the scope that draws the same login.
  const [openProfileScope, setOpenProfileScope] = useState<ProfileScope | null>(null)
  // shortcut-customization: the "Personalizar atalhos" picker dialog — `null`
  // while closed, otherwise the scope it opened on.
  const [shortcutsScope, setShortcutsScope] = useState<ShortcutScope | null>(null)
  // skill-studio: the "Estúdio de skills" dialog (create skills/agents + evals).
  const [studioOpen, setStudioOpen] = useState(false)
  // mcp: the "Servidores MCP" module (activate/disable + test connection + logs).
  const [mcpOpen, setMcpOpen] = useState(false)
  // mcp-logs: the MCP console dock (Ctrl+Shift+M, or the status-bar cluster).
  const [mcpConsoleOpen, setMcpConsoleOpen] = useState(false)
  // git-logs: the git command console, docked under the work area like the MCP
  // one. Two docks at once would leave nothing of the work area, so opening
  // either closes the other — the parent owns both flags for exactly that.
  const [gitLogOpen, setGitLogOpen] = useState(false)
  const openGitLog = useCallback(() => {
    setMcpConsoleOpen(false)
    setGitLogOpen(true)
  }, [])
  const closeGitLog = useCallback(() => setGitLogOpen(false), [])
  const toggleMcpConsole = useCallback(() => {
    setGitLogOpen(false)
    setMcpConsoleOpen((current) => !current)
  }, [])

  // The workspace's configured server names, so the console can flag the ones
  // logging here that aren't in this workspace's `.mcp.json` (user-scoped
  // servers the CLI also runs). Refreshed when the manager closes.
  const [mcpCatalog, setMcpCatalog] = useState<string[]>([])
  // App settings (version + updates) — the rail's bottom gear.
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  // Workspace file search (Ctrl+P palette) — the rail's top action.
  const [searchOpen, setSearchOpen] = useState(false)
  // Guided tour (first access): opens once the role actions land (so the
  // shortcut pills exist to spotlight); skip/finish persist "seen" and the
  // profile sheet can replay it any time (all inside useGuidedTour).
  const tour = useGuidedTour(shortcutSets.start.length > 0)
  // Handle to the chat, so the action rail (which lives outside the Chat
  // subtree) can launch a role action as a chat turn (RP-R5.1), and the
  // session-history header controls can start/restore conversations.
  const chatRef = useRef<ChatHandle>(null)
  // session-history: the stored conversation currently on screen — reported
  // up by Chat, consumed by the history panel (highlight + delete coupling).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  /**
   * workspace-session: reopen the conversation that was on screen.
   *
   * `false` until the restore has been attempted, because `Chat` reports its
   * (empty) session on mount and writing that through would erase the very id
   * this is about to reopen. A conversation that no longer exists — deleted
   * from the history panel on another launch — resolves to nothing and leaves
   * the pane on its hero, which is the right answer and needs no apology.
   */
  const [chatRestored, setChatRestored] = useState(session.chatSessionId === null)
  useEffect(() => {
    const restoring = session.chatSessionId
    if (restoring === null) return
    let cancelled = false
    void Promise.resolve(chatRef.current?.openSession(restoring))
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [session.chatSessionId])
  const handleSessionChange = useCallback(
    (id: string | null) => {
      setActiveSessionId(id)
      if (chatRestored) saveWorkspaceSession(workspace, { chatSessionId: id })
    },
    [chatRestored, workspace]
  )
  // background-turns: conversations whose reply is still being generated —
  // reported up by Chat, shown as "Em andamento" in the history panel.
  const [runningSessionIds, setRunningSessionIds] = useState<string[]>([])
  // Second Brain: the "opened in a new conversation" hand-off — which command
  // ran, and the conversation it moved to the background (so the toast can
  // bring it back).
  const [brainToast, setBrainToast] = useState<{ key: string; resumeId: string } | null>(null)

  // Second Brain (SB-R10.2/10.3): every Second Brain command the app launches
  // funnels through here, so the health-check cadence is recorded at the one
  // point where an ingest or a check actually starts — the panel's buttons, the
  // ingestion sheet, the health card and the floating reminder all share it,
  // and none of them has to remember to keep the ledger.
  const { noteIngest, noteLint } = secondBrain
  // SB-R10.4: one derivation feeding both ambient surfaces — the rail's dot and
  // the floating reminder — so they can never disagree.
  const brainHealthDue = secondBrain.health?.due === true
  // SB-R2.4 / D-SB-5: a Second Brain command is a *task of its own*, not a
  // reply in whatever conversation happens to be on screen. Launching one
  // therefore opens a fresh conversation (the skill-studio `launchCreation`
  // path) and leaves the previous one running in the background — a
  // `/second-brain` setup interview landing in the middle of someone's PRD
  // discussion is exactly the surprise this app avoids. The toast below names
  // what happened and offers the way back, so "in the background" never means
  // "gone".
  const launchBrainAction = useCallback(
    (action: RoleAction, opts?: RunLaunchOpts) => {
      if (action.key === SECOND_BRAIN_INGEST.key) noteIngest()
      else if (action.key === SECOND_BRAIN_LINT.key) noteLint()
      const backgrounded = activeSessionId
      // The agent/model the capture surface picked travels with the launch —
      // the conversation that opens *is* the one the user configured, badge,
      // lock and all (`launchCreation` adopts `agentId` as its agent).
      chatRef.current?.launchCreation(action, opts)
      // Nothing to announce when the pane held no stored conversation: the
      // "new conversation" was an empty one, and a toast for that is noise.
      if (backgrounded !== null) setBrainToast({ key: action.key, resumeId: backgrounded })
    },
    [noteIngest, noteLint, activeSessionId]
  )

  // The vault-setup flow, shared by the three surfaces that gate on a vault
  // (panel, ingestion sheet, ask dialog) so a setup in flight reads the same
  // everywhere instead of each one insisting the base doesn't exist.
  const brainSetup = useBrainSetup(secondBrain, launchBrainAction)

  // Opening a capture/ask surface is the moment a stale vault probe would be
  // most visible ("configure a base primeiro" over a base that exists), so both
  // re-probe on the way in — cheap insurance on top of the store's watcher.
  const refreshBrain = secondBrain.refresh
  const openIngest = useCallback(
    (mode: IngestMode | null) => {
      if (mode !== null) refreshBrain()
      setIngestMode(mode)
    },
    [refreshBrain]
  )
  const openAsk = useCallback(() => {
    refreshBrain()
    setAskOpen(true)
  }, [refreshBrain])

  const handleNewConversation = useCallback(() => {
    chatRef.current?.newConversation()
    showView('chat')
    // Starting a conversation has to show it. Without this the fresh transcript
    // opens behind whichever tool is covering the pane, and "+ Novo" looks like
    // it did nothing at all.
    showWorkView('chat')
  }, [showView, showWorkView])

  const handleOpenSession = useCallback(
    (id: string) => {
      void chatRef.current?.openSession(id)
      // Same rule as "+ Novo": picking a conversation out of the history is a
      // request to *see* it, so it comes to the front of the pane.
      showWorkView('chat')
    },
    [showWorkView]
  )

  // --- nav-redesign: the sidebar's conversation list ------------------------
  // The lens (window + order) is lifted here rather than kept inside the
  // sidebar, because the wide "Todas as conversas" surface opens on the same
  // one — arriving there to a different list than the one you clicked from is
  // the fastest way to make a "ver todas" button feel like a different app.
  const [convWindow, setConvWindow] = useState<ActivityWindow>(DEFAULT_WINDOW)
  const [convSort, setConvSort] = useState<ConversationSort>(DEFAULT_SORT)
  const [allConvOpen, setAllConvOpen] = useState(false)
  const chatSessions = useChatSessions({
    workspace,
    activeSessionId,
    onNewConversation: handleNewConversation
  })
  // The list is on screen permanently now, so it has to answer for what the
  // rest of the app did: a fresh conversation, a rename from the transcript, a
  // turn that just retitled itself. `activeSessionId` changing is the one
  // signal every one of those shares.
  const reloadSessions = chatSessions.reload
  useEffect(() => {
    if (activeSessionId !== null) reloadSessions()
  }, [activeSessionId, runningSessionIds, reloadSessions])

  // skill-studio: every studio action (create briefing, eval run, test) is a
  // chat turn — the studio composes it, the chat runs it. A creation launch
  // (`newConversation`) opens a fresh conversation on the studio's chosen
  // model/effort and backgrounds anything still generating; test/eval launches
  // continue the on-screen conversation as before.
  const handleStudioLaunch = useCallback((action: RoleAction, opts?: StudioLaunchOpts) => {
    if (opts?.newConversation) {
      chatRef.current?.launchCreation(action, {
        model: opts.model,
        effort: opts.effort,
        agentId: opts.agentId
      })
    } else {
      chatRef.current?.launchAction(action)
    }
  }, [])

  // Re-resolves both shortcut sets (role change, workspace change, customizer
  // edits). Stable per role+workspace, so the customizer's `onChanged` can
  // reuse it directly.
  const refreshShortcuts = useCallback(() => {
    void window.hive.shortcuts.actions(role, workspace).then(setShortcutSets)
  }, [role, workspace])

  useEffect(() => {
    let cancelled = false
    window.hive.shortcuts.actions(role, workspace).then((sets) => {
      if (!cancelled) setShortcutSets(sets)
    })
    return () => {
      cancelled = true
    }
  }, [role, workspace])

  /**
   * Opens the profile sheet, optionally straight on one scope.
   *
   * The scope is set *before* `open` so the sheet's first render is already on
   * the right detail — flipping it afterwards would show the index for a frame
   * and then slide, which reads as the sheet correcting itself.
   */
  const openProfile = useCallback((scope: ProfileScope | null, lane?: ConnectionLane) => {
    setProfileScope(scope)
    // claude-account: the connection screen has two lanes, and a deep link
    // always comes from one of them — a turn that died on an AWS session must
    // not land on the account lane just because this machine reads as
    // first-party. `undefined` leaves the choice to detection.
    setConnectionLane(lane ?? null)
    setProfileOpen(true)
  }, [])

  // shortcut-scopes: opening the picker from the profile sheet closes the
  // sheet first — a dialog stacked on a sheet traps focus twice, and the
  // picker's live preview is only readable with the real hero/strip behind it.
  const openShortcuts = useCallback((scope: ShortcutScope) => {
    setProfileOpen(false)
    setShortcutsScope(scope)
  }, [])

  // Ctrl/Cmd+P opens the workspace file search from anywhere in the work UI
  // (the VS Code quick-open muscle memory).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // app-reload: "Recarregar janela", the VS Code affordance for when the
  // renderer is wedged (a stuck stream, a panel that stopped repainting) and
  // the honest fix is a fresh window rather than a restart of the whole app.
  // Main owns the reload — see `app:reload` in main/index.ts.
  const reloadWindow = useCallback(() => {
    setChipMenuOpen(false)
    void window.hive.app.reload()
  }, [])

  // Ctrl/Cmd+R, the same chord VS Code binds to `workbench.action.reloadWindow`.
  // Nothing else in the app claims it, and in a packaged build Electron's own
  // menu accelerator is gone (`optimizer.watchWindowShortcuts`), so without
  // this the muscle memory does nothing at all.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void window.hive.app.reload()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Ctrl/Cmd+Shift+G opens the Source Control view (VS Code parity, D-GIT-2).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        showView('scm')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showView])

  // workspace-session: Ctrl/Cmd+B hides and shows the sidebar; Ctrl+Shift+E
  // brings the Explorer forward. Both are the VS Code chords, because the
  // hands that will reach for them learned them there — this app's whole
  // familiarity argument (PRODUCT.md) is that muscle memory transfers.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey)) return
      if (!event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleSidebar()
        return
      }
      if (event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        showView('explorer')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar, showView])

  // mcp-logs: one subscription per window, hoisted here because the status bar
  // reads it while the dock is closed — that ambient signal is the reason the
  // console docks instead of hiding in a dialog.
  const mcpLogs = useMcpLogs(workspace)
  const mcpTick = useTicker(mcpLogs.lastAt !== null)
  const mcpLive = isLive(mcpLogs.lastAt, mcpTick)
  // mcp-visibility: what the CLI's handshake reported for the most recent turn,
  // tagged with the workspace it was reported for. Tagged rather than reset in
  // an effect: a roster is a fact about one workspace's CLI, and clearing it
  // after the fact would show the previous workspace's servers for one frame
  // under the new workspace's name (the shape `useMcpLogs` uses, same reason).
  const [mcpReported, setMcpReported] = useState<{
    workspace: string
    servers: McpServerReport[]
  } | null>(null)
  const reportedServers = reportedFor(mcpReported, workspace)
  // The three sources, merged once, so the status bar, the console strip and
  // the transcript can never disagree about what exists or how it is.
  const mcpRoster = useMemo(
    () =>
      buildRoster({
        reported: reportedServers,
        stats: serverStats(mcpLogs.entries),
        catalog: mcpCatalog
      }),
    [reportedServers, mcpLogs.entries, mcpCatalog]
  )

  useEffect(() => {
    let cancelled = false
    void window.hive.mcp
      .list(workspace)
      .then((servers) => {
        if (!cancelled) setMcpCatalog(servers.map((server) => server.name))
      })
      .catch(() => {
        // A catalog we can't read just means nothing gets flagged as foreign.
      })
    return () => {
      cancelled = true
    }
  }, [workspace, mcpOpen])

  // mcp-logs: Ctrl/Cmd+Shift+M toggles the MCP console, next to the other
  // panel shortcuts. Chosen for "MCP"; nothing else in the app claims it.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault()
        setMcpConsoleOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Second Brain keyboard reach (SB-R9.1): Ctrl/Cmd+Shift+K asks the base
  // anything from anywhere — the whole point of a knowledge base is that
  // consulting it costs nothing. Ctrl/Cmd+Shift+B opens its sidebar view,
  // the shortcut the activity-bar entry has always advertised
  // (`aria-keyshortcuts`).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        openAsk()
      } else if (key === 'b') {
        event.preventDefault()
        showWorkView('brain')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showWorkView, openAsk])

  const replayTour = useCallback(() => {
    setProfileOpen(false)
    tour.replay()
  }, [tour])
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

  // The candidate parked behind the agent-review pending-set switch guard
  // (ACR-R4.3), separate from the editor-dirty guard below.
  const [pendingReviewSwitch, setPendingReviewSwitch] = useState<string | null>(null)

  // T8 (WS-R5.1/R5.3): the editor-dirty half of the switch guard — dirty parks
  // the candidate behind the three-way unsaved dialog; clean proceeds.
  const continueSwitch = useCallback(
    (path: string) => {
      if (editor.dirtyPaths.size > 0) {
        setPendingSwitch(path)
      } else {
        void proceedSwitch(path)
      }
    },
    [editor.dirtyPaths, proceedSwitch]
  )

  // The switch guard's entry point, shared by "Abrir pasta…" and Recentes. A
  // non-empty pending review set (ACR-R4.3) is guarded first; then the
  // editor-dirty guard runs.
  const requestSwitch = useCallback(
    (path: string) => {
      if (review.pendingCount > 0) {
        setPendingReviewSwitch(path)
      } else {
        continueSwitch(path)
      }
    },
    [review.pendingCount, continueSwitch]
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

  // --- customizable-layout: movable panes ----------------------------------
  // The pane order is a persisted permutation of rail/chat/viewer
  // (`hive.paneOrder`); widths stay in the workspace's session record keyed by
  // pane id, so they survive reordering too. Two ways to move a pane: drag
  // its header onto another pane (the drop side follows the pointer's half),
  // or the ↔ menu every header carries (the keyboard path).

  /** Panes that get rendered, in order — the viewer only exists while at least one tab is open. */
  const renderedPanes = useMemo(
    () => renderedPanesFor(paneOrder, editor.tabs.length > 0),
    [paneOrder, editor.tabs.length]
  )
  /**
   * Panes a user can actually see — `renderedPanes` minus the rail while the
   * sidebar is hidden.
   *
   * The distinction is what keeps the move controls honest: "mover para a
   * esquerda" offered on the chat, with only a collapsed rail to its left,
   * is a menu item that runs and changes nothing anybody can see.
   */
  const onScreenPanes = useMemo(
    () => renderedPanes.filter((pane) => pane !== 'rail' || sidebarOpen),
    [renderedPanes, sidebarOpen]
  )

  const applyPaneOrder = useCallback((next: PaneId[]) => {
    setPaneOrder(next)
    persistPaneOrder(next)
  }, [])

  /** Drop `source` before/after `target` in the full order (drag-and-drop path). */
  const dropPane = useCallback(
    (source: PaneId, target: PaneId, side: 'before' | 'after') => {
      if (source === target) return
      const without = paneOrder.filter((id) => id !== source)
      const insertAt = without.indexOf(target) + (side === 'after' ? 1 : 0)
      applyPaneOrder([...without.slice(0, insertAt), source, ...without.slice(insertAt)])
    },
    [paneOrder, applyPaneOrder]
  )

  /** Swap `pane` with its visible neighbor (↔ menu path). */
  const shiftPane = useCallback(
    (pane: PaneId, dir: -1 | 1) => {
      const neighbor = onScreenPanes[onScreenPanes.indexOf(pane) + dir]
      if (neighbor === undefined) return
      const next = [...paneOrder]
      const a = next.indexOf(pane)
      const b = next.indexOf(neighbor)
      next[a] = neighbor
      next[b] = pane
      applyPaneOrder(next)
    },
    [onScreenPanes, paneOrder, applyPaneOrder]
  )

  /**
   * There is exactly one pane on screen, so there is nowhere to move it to.
   *
   * Every layout affordance a pane header carries — the grip, the ↔ menu, and
   * the uppercase name that exists to tell one pane from another — is an answer
   * to "which of these am I dragging where?". With one pane that question has
   * no referents: the menu's two items are both disabled, the drag has no
   * target, and "CONVERSA" labels the only thing on screen while occupying the
   * top-left corner. So the whole strip goes, and the conversation gets the
   * height back. It returns the instant a second pane does (Ctrl+B, or opening
   * a file).
   */
  const soloPane = onScreenPanes.length === 1

  /** Drag-source props for a pane's header. */
  const dragHandlePropsFor = useCallback(
    (pane: PaneId): HTMLAttributes<HTMLElement> => ({
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = 'move'
        try {
          event.dataTransfer.setData(PANE_DRAG_MIME, pane)
        } catch {
          // jsdom/edge cases — the move still works via `dragPane` state.
        }
        setDragPane(pane)
      },
      onDragEnd: () => {
        setDragPane(null)
        setDropHint(null)
      }
    }),
    []
  )

  /** Computes which half of the hovered pane the pointer is in — the drop side. */
  const dropSideOf = (event: DragEvent<HTMLDivElement>): 'before' | 'after' => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  /** Drop-target props for a pane's whole body (any pane accepts any other pane). */
  const dropTargetPropsFor = useCallback(
    (pane: PaneId): HTMLAttributes<HTMLDivElement> => ({
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (!dragPane || dragPane === pane) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const side = dropSideOf(event)
        setDropHint((current) =>
          current && current.pane === pane && current.side === side ? current : { pane, side }
        )
      },
      onDragLeave: (event: DragEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropHint((current) => (current?.pane === pane ? null : current))
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        if (!dragPane || dragPane === pane) return
        event.preventDefault()
        dropPane(dragPane, pane, dropSideOf(event))
        setDragPane(null)
        setDropHint(null)
      }
    }),
    [dragPane, dropPane]
  )

  /** Drag-source props, or `undefined` while this pane is the only one on screen (`soloPane`). */
  const paneDragPropsFor = (pane: PaneId): HTMLAttributes<HTMLElement> | undefined =>
    soloPane ? undefined : dragHandlePropsFor(pane)

  /** The ↔ move menu for a pane, bounds derived from the visible order — `null` while this pane is the only one on screen. */
  const paneMoveMenuFor = (pane: PaneId, name: string): React.JSX.Element | null => {
    if (soloPane) return null
    const index = onScreenPanes.indexOf(pane)
    return (
      <PaneMoveMenu
        paneName={name}
        canMoveLeft={index > 0}
        canMoveRight={index !== -1 && index < onScreenPanes.length - 1}
        onMoveLeft={() => shiftPane(pane, -1)}
        onMoveRight={() => shiftPane(pane, 1)}
      />
    )
  }

  /**
   * The pane the floating navbar sits over — the leftmost one a user can see.
   *
   * It is derived rather than hardcoded to `rail` because both facts it depends
   * on can change: the sidebar can be away (the chat becomes the leftmost thing
   * on screen), and the panes are re-orderable (the chat can be genuinely first).
   * Whichever pane it is takes the top inset, which is what keeps the navbar
   * from ever covering content.
   */
  const navOffsetPane = onScreenPanes[0]
  const shellRef = useNavbarBounds(navOffsetPane, sidebarOpen)

  /** Shared inner-wrapper props: the drop-target surface + drop-hint/drag styling hooks. */
  const paneWrapPropsFor = (
    pane: PaneId
  ): HTMLAttributes<HTMLDivElement> & Record<string, unknown> => ({
    className: 'wb-pane',
    'data-drop': dropHint?.pane === pane ? dropHint.side : undefined,
    'data-dragging': dragPane === pane || undefined,
    'data-navtop': navOffsetPane === pane ? '' : undefined,
    ...dropTargetPropsFor(pane)
  })

  // "Descartar" (only ever wired to the dialog's own button, itself only
  // mounted while `pendingSwitch` is set — see `FileViewer`'s `readyState`
  // comment for why this skips a defensive null-check branch): proceed with
  // the switch, dropping the viewer's unsaved edits.
  const handleDiscardSwitch = useCallback(() => {
    const path = pendingSwitch as string
    setPendingSwitch(null)
    void proceedSwitch(path)
  }, [pendingSwitch, proceedSwitch])

  // "Salvar": flush every dirty tab's draft first (each viewer's own
  // non-force `performSave(false)` via its `requestSave` handle), and only
  // proceed with the switch if all saves actually landed. On any failure
  // (e.g. a STALE conflict), that viewer has already surfaced its own
  // dialog/error inline — this just dismisses the switch guard and aborts
  // the switch, same as the in-viewer guard's own "Salvar" choice.
  const handleSaveSwitch = useCallback(() => {
    const path = pendingSwitch as string
    setPendingSwitch(null)
    void editor.saveAllDirty().then((ok) => {
      if (ok) void proceedSwitch(path)
    })
  }, [pendingSwitch, editor, proceedSwitch])

  // Declared ahead of `paneRenderers` on purpose: those closures read it, and
  // `buildPanels` calls them during this very render.
  const chrome = sidebarChrome(sidebarOpen, sidebarAnimating)
  // customizable-layout: the three pane bodies, rendered in `renderedPanes`
  // order. Every element in the array carries a stable key (pane id) so React
  // reconciles a reorder as a *move*, never a remount — the chat session and
  // the viewer's draft survive any drag.
  const brainNavDetail = brainNavigationDetail(secondBrain.rawPending, brainHealthDue)
  const [pendingExit, setPendingExit] = useState(false)
  const closeApp = (): void => {
    saveWorkspaceSession(workspace, { layout: layoutRef.current })
    window.close()
  }
  const userMenu = (
    <UserMenu
      userName={userName}
      role={role}
      onOpenSettings={() => openProfile(null)}
      onOpenApp={() => setAppSettingsOpen(true)}
      onSignOut={() => (editor.dirtyPaths.size > 0 ? setPendingExit(true) : closeApp())}
      updatePending={updateFlow.pending}
    />
  )
  const paneRenderers: Record<PaneId, () => ReactNode> = {
    rail: () => {
      const paneTitle = sidebarPaneTitle(activeView)
      return (
        <ResizablePanel
          key="rail"
          id="rail"
          className="wb-rail"
          minSize="260px"
          maxSize="45%"
          defaultSize="280px"
          /* KNOWN ISSUE (2026-09-10): a rail width the user drags does not
             survive a restart. `e2e/explorer-editor-ux.spec.ts:315` fails on
             it and passes at `36a34fe`, so it arrived with this redesign.
             Measured while chasing it: the group's `defaultLayout` is not being
             applied at all any more, in ANY unit — seeding `{rail: 35, chat:
             65}` and reloading gives the panel's own `defaultSize` (set it to
             20% and you get 20%), and deleting `defaultSize` gives `maxSize`
             (45%), never the stored 35%. So the cause is the Group renormalising
             around the new pane shape, not these three numbers, and changing
             them does not fix it — they are the values the UI was reviewed on.
             `initialLayout`, `mergeLayout` and `handleLayoutChanged` are all
             byte-identical to the baseline; the write half still works (the
             dragged number does reach the session record). */
          /* workspace-session: hiding the sidebar collapses this panel to zero
             instead of unmounting it, so the tree inside keeps its expansion,
             its selection and its scroll across a Ctrl+B. `collapsible` also
             buys the VS Code drag gesture for free — pull the sash past the
             minimum and the sidebar puts itself away. */
          collapsible
          collapsedSize="0%"
          panelRef={railPanel}
          onResize={handleRailResize}
          aria-label={paneTitle}
        >
          <div
            {...paneWrapPropsFor('rail')}
            id={SIDEBAR_REGION_ID}
            /* Not `hidden`, not `display: none`: destroying the layout box is
               exactly what resets a scroller to the top. `visibility: hidden`
               (in the stylesheet) keeps the box while taking the panel out of
               the tab order, the a11y tree and the hit-testing — the same
               trick `SidebarHost` uses one level down. */
            data-collapsed={chrome.collapsedFlag}
            role="tabpanel"
            aria-labelledby={`wb-sidebar-tab-${activeTab}`}
          >
            {/* The tab bar doubles as this pane's header: it keeps the drag
                surface and the ↔ move menu the movable-pane feature needs,
                without stacking a second 40px strip of chrome above it. */}
            <SidebarTabs
              active={activeTab}
              onSelect={selectTab}
              dragProps={paneDragPropsFor('rail')}
              /* Workspace search used to sit here too, on the Arquivos tab
                 only. It moved to the navbar, where it is on screen from both
                 tabs and with the sidebar away — so a second copy 40px below
                 would be the duplicated affordance, not a convenience. */
              trailing={paneMoveMenuFor('rail', paneTitle)}
            />
            {/* Fixed above the swapping body: the tab's own controls stay put
                while the region below them changes, so the tools that opened a
                panel are still there to leave it by. */}
            <div className="wb-sidebar-fixed">
              {activeTab === 'chat' ? (
                <>
                  <NewConversationButton onClick={handleNewConversation} />
                  <nav className="wb-sidebar-nav" aria-label={t('nav.toolsLabel')}>
                    {/* The Design Studio, right under "+ Novo" (criterion 1).
                        It opens in the work pane like the tools below it, and
                        while it is in front the body under this block becomes
                        its navigation (decision 1). */}
                    <SidebarNavItem
                      view="design"
                      controls={WORK_REGION_ID}
                      label={t('designStudio.name')}
                      icon={<DesignStudioIcon size={15} />}
                      active={workView === 'design'}
                      togglesOff={workView === 'design'}
                      onSelect={() => toggleWorkView('design')}
                    />
                    {/* These two disclose the WORK pane, not the sidebar —
                        `controls` is what says so to a screen reader, and the
                        history below them stays put either way. */}
                    <SidebarNavItem
                      view="review"
                      controls={WORK_REGION_ID}
                      label={t('review.railLabel')}
                      icon={<ReviewIcon size={15} />}
                      active={workView === 'review'}
                      togglesOff={workView === 'review'}
                      count={review.pendingCount}
                      detail={
                        review.pendingCount > 0 ? t('review.barPending', review.pendingCount) : null
                      }
                      onSelect={() => toggleWorkView('review')}
                      data-tour="review"
                    />
                    <SidebarNavItem
                      label={t('studio.openLabel')}
                      active={studioOpen}
                      icon={<SparkleIcon size={15} />}
                      onSelect={() => setStudioOpen(true)}
                      data-tour="studio"
                    />
                    <SidebarNavItem
                      view="brain"
                      controls={WORK_REGION_ID}
                      label={t('secondBrain.railLabel')}
                      icon={<BrainIcon size={15} />}
                      active={workView === 'brain'}
                      togglesOff={workView === 'brain'}
                      count={secondBrain.rawPending}
                      dot={brainHealthDue}
                      detail={brainNavDetail}
                      onSelect={() => toggleWorkView('brain')}
                      aria-keyshortcuts="Control+Shift+B"
                      data-tour="brain"
                    />
                  </nav>
                </>
              ) : (
                <nav className="wb-sidebar-nav" aria-label={t('nav.filesLabel')}>
                  <SidebarNavItem
                    view="explorer"
                    label={t('nav.explorerView')}
                    icon={<FolderIcon size={15} />}
                    active={activeView === 'explorer' && sidebarOpen}
                    togglesOff={activeView === 'explorer' && sidebarOpen}
                    onSelect={() => toggleView('explorer')}
                    aria-keyshortcuts="Control+Shift+E"
                    data-tour="explorer"
                  />
                  <SidebarNavItem
                    view="scm"
                    label={t('nav.scmView')}
                    icon={<SourceControlIcon size={15} />}
                    active={activeView === 'scm' && sidebarOpen}
                    togglesOff={activeView === 'scm' && sidebarOpen}
                    count={changeCount(git.status)}
                    detail={
                      changeCount(git.status) > 0
                        ? t('nav.scmChangeCount', changeCount(git.status))
                        : null
                    }
                    onSelect={() => toggleView('scm')}
                    aria-keyshortcuts="Control+Shift+G"
                    data-tour="scm"
                  />
                </nav>
              )}
            </div>
            <SidebarHost
              activeView={activeView}
              chat={
                <ChatTabBody
                  designActive={workView === 'design'}
                  design={<DesignStudioNav store={designStudio} />}
                  hive={
                    <ChatSidebar
                      initiatives={
                        <InitiativesPanel
                          store={initiative.all}
                          activePath={initiative.path}
                          onOpen={(entry: Initiative) => initiative.show(entry.path)}
                          onCreate={() => initiative.setCreateOpen(true)}
                        />
                      }
                      store={chatSessions}
                      window={convWindow}
                      sort={convSort}
                      onWindowChange={setConvWindow}
                      onSortChange={setConvSort}
                      activeSessionId={activeSessionId}
                      runningSessionIds={runningSessionIds}
                      reviewPendingBySession={reviewPendingBySession}
                      onOpenSession={handleOpenSession}
                      onOpenAll={() => setAllConvOpen(true)}
                      initiativeMarks={initiative.marks}
                      initiativeOptions={initiative.filterOptions}
                      initiativeFilter={initiative.filter}
                      onInitiativeFilterChange={initiative.setFilter}
                    />
                  }
                />
              }
              explorer={
                <FileTree
                  workspace={workspace}
                  selectedPath={editor.activePath}
                  onOpenFile={editor.openFile}
                  decorations={git.decorations}
                  revealRequest={revealRequest ?? undefined}
                  initialExpandedPaths={session.expanded}
                  onExpandedPathsChange={persistExpanded}
                />
              }
              scm={
                <SourceControlPanel
                  onOpenDiff={(change: GitFileChange, side: RowSide) =>
                    side === 'conflict'
                      ? editor.openConflict(change.path)
                      : editor.openDiff(change.path, side === 'staged' ? 'staged' : 'working')
                  }
                  onOpenCommit={editor.openCommitDiff}
                  remote={gitRemote}
                  onCheckout={() => setBranchPickerOpen(true)}
                  onShowLogs={openGitLog}
                />
              }
              /* The column's bottom edge: who you are, and the two settings
                 surfaces. It anchors the sidebar the way a scrolling list
                 cannot, and it is where a desktop user's hand already goes. */
              foot={sidebarOpen && userMenu}
            />
          </div>
        </ResizablePanel>
      )
    },
    chat: () => {
      const header = chatPaneHeader(workView, showWorkView)
      const title = header.title
      /* The two chat tools open HERE, in place of the transcript — not in the
         sidebar, where they used to evict the conversation history and then
         squeeze a diff review into a 280px column.

         Every layer stays mounted, exactly as the sidebar's own host does it
         and for the same reason: `Chat` holds the live session (a turn may be
         streaming), and the review list holds its expansion and its scroll.
         Only visibility changes, so leaving a tool and coming back costs
         nothing. */
      const bodies: Record<WorkView, ReactNode> = {
        chat: (
          <Chat
            ref={chatRef}
            workspace={workspace}
            startActions={shortcutSets.start}
            conversationActions={shortcutSets.during}
            agents={agents}
            defaultAgent={defaultAgent}
            onManageAgents={() => openProfile('agents')}
            onOpenVoiceSettings={() => openProfile('voice')}
            userName={userName}
            // initiatives: a conversation started inside a demand belongs to it.
            initiativePath={initiative.path}
            // ...and a conversation opened out of the history brings its own —
            // which may be none, and that closes whatever demand was open. The
            // rail must never stand beside a transcript from another subject
            // offering to run stages into a folder it never mentions.
            onConversationInitiative={initiative.show}
            onSessionChange={handleSessionChange}
            onRunningSessionsChange={setRunningSessionIds}
            onCustomizeShortcuts={setShortcutsScope}
            onOpenFile={editor.openFile}
            onMcpRoster={(servers) => setMcpReported({ workspace, servers })}
            onOpenMcpConsole={() => setMcpConsoleOpen(true)}
            onOpenAwsPanel={() => openProfile('connection', 'aws')}
            onAwsReconnect={() => aws.connect()}
            // claude-account: the first-party repair, from the turn that
            // failed — same shape as the AWS one directly above.
            onClaudeConnect={() => claudeAuth.connect()}
            // ...and the two facts that let the transcript finish that repair
            // no matter WHERE the sign-in happened — this banner, the beacon,
            // Perfil › Conexão, or the user's own terminal. Without them the
            // banner could only ever be withdrawn by the return value of its
            // own button's promise, which is how a landed sign-in left the
            // failure on screen and the question unasked.
            claudeAccountReady={accountReady(claudeAuth.status?.state)}
            claudeSigningIn={isLoginLive(claudeAuth.login.phase)}
          />
        ),
        review: <AgentReviewPanel onOpenDiff={(path: string) => editor.openReviewDiff(path)} />,
        brain: (
          <SecondBrainPanel
            store={secondBrain}
            onLaunch={launchBrainAction}
            onAsk={openAsk}
            onOpenFile={editor.openFile}
            selectedPath={editor.activePath}
            setup={brainSetup}
            onIngest={() => openIngest('text')}
          />
        ),
        design: (
          <DesignStudioShell
            store={designStudio}
            userName={userName}
            navVisible={designNavVisible(sidebarOpen, activeTab)}
            claudeAuth={claudeAuth}
          />
        )
      }
      return (
        <ResizablePanel key="chat" id="chat" minSize="30%">
          <div {...paneWrapPropsFor('chat')} id={WORK_REGION_ID}>
            {/* nav-redesign: the pane header no longer carries "Nova conversa"
                and the history popover. Both moved into the sidebar's Chat tab,
                where they are on screen permanently instead of behind a click —
                and where "+ Novo" can be a real primary button rather than a
                16px glyph competing with the pane's ↔ menu. Keeping a second copy
                here would be the duplicated affordance the redesign set out to
                remove. */}
            {/* With the conversation alone on screen the strip has nothing left
                to say: no grip (nowhere to drag to), no ↔ (both directions
                disabled), and a name that labels the only pane there is. It is
                kept only while something is *covering* the transcript — a chat
                tool or an initiative — because then the title names what you
                are looking at and the ✕ is the way back. See `soloPane`. */}
            {/* The initiative's rail sits BESIDE the transcript, sharing the
                pane — not in place of it. Embedding the chat is the whole
                point: the demand's plan is something you act on by talking to
                the agent, and a surface that replaced the conversation would
                have put the two a click apart. One `Chat` either way, so the
                live session is never torn down by opening a demand.

                The split is the pane's WHOLE height, and the conversation's
                header sits inside the left column rather than above both. It
                used to span the panel's column too, which left a strip of the
                pane's own background directly above a panel painted `--bg-2` —
                the seam the demand's ✕ used to sit in the middle of. */}
            <div
              className="wb-work-split"
              data-railed={initiative.shown !== null || undefined}
              // The expanded flag lives on the SPLIT, not on the panel: the
              // transcript is the panel's earlier sibling, so no selector
              // rooted at the panel can reach back and collapse it — and
              // leaving it at `flex: 1` meant "expanded" split the pane in
              // half instead of taking it (measured: 340px → 576px of a
              // 1120px pane).
              data-expanded={(initiative.shown !== null && initiative.expanded) || undefined}
            >
              <div className="wb-work-col">
                {(!soloPane || header.primaryActions !== null) && (
                  <PaneHeader
                    title={title}
                    dragProps={paneDragPropsFor('chat')}
                    /* `primaryActions`, not `actions`: the move menu is layout
                       plumbing and is right to stay quiet until the pane is
                       hovered, but the way out of a panel that is covering your
                       conversation cannot be invisible until you go looking. */
                    primaryActions={header.primaryActions}
                    actions={paneMoveMenuFor('chat', title)}
                  />
                )}
                <div className="wb-work-host">
                  {WORK_VIEWS.filter((view) => mountedWorkViews.includes(view)).map((view) => (
                    <div
                      key={view}
                      className="wb-work-layer"
                      data-view={view}
                      data-active={view === workView || undefined}
                    >
                      {bodies[view]}
                    </div>
                  ))}
                </div>
              </div>
              {/* The sash. Only while a demand is open — a handle between a
                  pane and nothing is furniture. Plain CSS rather than another
                  `Resizable` group: this split lives *inside* one of that
                  group's panels, and nesting a second group re-normalises the
                  outer layout every time the inner one's children change shape
                  (the panel that had just been expanded snaps back). The rail's
                  width is one custom property, so a drag is one number. */}
              {initiative.shown !== null && !initiative.expanded && <InitiativeSash />}
              <InitiativeContext
                workspace={workspace}
                initiative={initiative.shown}
                selectedPath={editor.activePath}
                onOpenFile={editor.openFile}
                expanded={initiative.expanded}
                onToggleExpanded={initiative.toggleExpanded}
                onEdit={() => initiative.setEditing(initiative.shown)}
                onClose={() => initiative.show(null)}
                // A stage is a whole BMAD workflow, not a follow-up: appending
                // one to whatever is on screen made it inherit that
                // conversation's context and its history, and the transcript of
                // the run got buried under it. `launchCreation` opens a fresh
                // conversation instead and backgrounds any turn still running,
                // so every stage is its own readable thread.
                onRunStage={(action) => chatRef.current?.launchCreation(action)}
              />
            </div>
          </div>
        </ResizablePanel>
      )
    },
    // The viewer opens wide enough to actually read a document (~40% of the
    // body) — its flex-grow ratio sits above chat's leftover so the rail/chat
    // home split is untouched when no file is open. A 30% floor keeps
    // docx/pdf/sheets legible even after a manual resize.
    viewer: () =>
      editor.tabs.length === 0 ? null : (
        <ResizablePanel key="viewer" id="viewer" minSize="30%" defaultSize="44%">
          <div {...paneWrapPropsFor('viewer')}>
            <EditorTabs
              tabs={editor.tabs}
              activePath={editor.activePath}
              dirtyPaths={editor.dirtyPaths}
              onSelect={editor.selectTab}
              onPin={editor.pinTab}
              onClose={editor.requestCloseTab}
              actions={tabActions}
              dragProps={paneDragPropsFor('viewer')}
              trailing={paneMoveMenuFor('viewer', t('workUI.paneEditor'))}
            />
            {/* Every tab's body stays mounted and stays the same size (drafts
                — and scroll positions — survive switching); only the active
                one is visible. Diff tabs render a DiffView (git-management
                §6.5); file tabs the FileViewer. */}
            <div className="wb-tab-bodies">
              {editor.tabs.map((tab) => (
                <div key={tab.path} className="wb-tab-body" hidden={tab.path !== editor.activePath}>
                  {tab.kind === 'diff' && tab.git?.path ? (
                    <DiffTab path={tab.git.path} side={tab.git.side ?? 'working'} />
                  ) : tab.kind === 'commit' && tab.git?.hash ? (
                    <CommitDiffTab hash={tab.git.hash} />
                  ) : tab.kind === 'conflict' && tab.git?.path ? (
                    <ConflictView path={tab.git.path} />
                  ) : tab.kind === 'review' && tab.git?.path ? (
                    <ReviewDiffTab path={tab.git.path} />
                  ) : (
                    <FileViewer
                      ref={(handle) => editor.registerViewer(tab.path, handle)}
                      workspace={workspace}
                      path={tab.path}
                      active={tab.path === editor.activePath}
                      onClose={() => editor.removeTab(tab.path)}
                      onDirtyChange={(dirty) => editor.handleDirtyChange(tab.path, dirty)}
                      gitEnabled={git.repo.isRepo}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </ResizablePanel>
      )
  }
  const panels = buildPanels(renderedPanes, paneRenderers, (pane) => onScreenPanes.includes(pane))

  return (
    <GitProvider store={git}>
      <ReviewProvider store={review}>
        <div className="wb-app">
          {switchError && (
            <div className="wb-switch-error" role="alert">
              {switchError}
            </div>
          )}
          <div className="wb-shell" ref={shellRef} data-sidebar={chrome.bodyState}>
            {/* nav-redesign: the navbar floats at the top-left of the shell —
                positioned against it, not parented into the collapsible rail —
                so it keeps working with the sidebar away. The pane underneath
                it makes room via `data-navtop` (see `paneWrapPropsFor`), which
                is why nothing is ever covered. */}
            <AppNavbar
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
              onOpenSearch={() => setSearchOpen(true)}
              searchOpen={searchOpen}
              theme={theme}
              onSelectTheme={onSelectTheme}
              workspaceChip={
                <DropdownMenu open={chipMenuOpen} onOpenChange={handleChipMenuOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="wb-workspace-chip"
                      title={t('workUI.workspaceChipTitle', workspace)}
                      aria-label={t('workUI.workspaceChipAria', workspace)}
                    >
                      <FolderIcon size={13} className="wb-workspace-chip-icon" />
                      <span className="wb-workspace-chip-name">{workspaceName(workspace)}</span>
                      <ChevronDownIcon size={13} className="wb-workspace-chip-caret" />
                    </button>
                  </DropdownMenuTrigger>
                  {chipMenuOpen && (
                    <DropdownMenuContent align="start" className="wb-workspace-menu">
                      <DropdownMenuLabel>{t('workUI.switchWorkspace')}</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={handleChooseFolder}>
                        <span className="wb-menu-item-icon" aria-hidden="true">
                          <FolderOpenIcon size={15} />
                        </span>
                        <span className="wb-menu-item-text">
                          <span className="wb-menu-item-title">{t('workUI.openFolder')}</span>
                        </span>
                      </DropdownMenuItem>
                      {recents.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>{t('workUI.recents')}</DropdownMenuLabel>
                          {recents.map((path) => (
                            <DropdownMenuItem
                              key={path}
                              title={path}
                              onSelect={() => requestSwitch(path)}
                            >
                              <span className="wb-menu-item-icon" aria-hidden="true">
                                <FolderIcon size={15} />
                              </span>
                              <span className="wb-menu-item-text">
                                <span className="wb-menu-item-title">{workspaceName(path)}</span>
                                <span className="wb-menu-item-sub">{path}</span>
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      {/* app-reload: window-scoped, so it sits under its own
                          heading rather than reading as a fourth way to change
                          workspace. This chip menu is the app's only title-bar
                          menu — the same place VS Code keeps "Reload Window". */}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t('workUI.windowSection')}</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={reloadWindow}
                        /* Canonical key names for the a11y tree (the handler
                           takes `metaKey` wherever it takes `ctrlKey`), while
                           the visible hint below uses the platform's own
                           notation. */
                        aria-keyshortcuts={window.hive.platform === 'darwin' ? 'Meta+R' : 'Ctrl+R'}
                      >
                        <span className="wb-menu-item-icon" aria-hidden="true">
                          <RefreshIcon size={15} />
                        </span>
                        <span className="wb-menu-item-text">
                          <span className="wb-menu-item-title">{t('workUI.reloadWindow')}</span>
                        </span>
                        <span className="wb-menu-item-kbd" aria-hidden="true">
                          {t('workUI.reloadWindowKey', window.hive.platform)}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              }
            />
            {/* The work area is the app's one `main` landmark: everything a
                user came here to do (the panes and, under them, the MCP
                console) lives inside it. Before this the page had no `main` at
                all, so "skip to content" had nothing to skip to. */}
            <main className="wb-body" data-sidebar={chrome.bodyState}>
              <Resizable
                orientation="horizontal"
                className={chrome.groupClass}
                /* A hand on a sash outranks an animation in flight. Without
                   this, grabbing the divider during the 180ms slide means
                   dragging against a transition that is still easing toward
                   its own target — the pane fights back for a fifth of a
                   second and then snaps. Pointer down ends the slide. */
                onPointerDownCapture={endSidebarAnimation}
                style={{ flex: 1, minWidth: 0, minHeight: 0 }}
                defaultLayout={defaultLayout}
                onLayoutChanged={handleLayoutChanged}
              >
                {panels}
              </Resizable>
              {/* mcp-logs: the MCP console docks under the work area rather
                than opening as a dialog — the question it answers ("what is
                this MCP server doing right now") is asked while a turn runs,
                and a modal would cover the transcript being asked about. */}
              <WorkDock
                gitLogOpen={gitLogOpen}
                onCloseGitLog={closeGitLog}
                mcpOpen={mcpConsoleOpen}
                mcp={{
                  workspace,
                  store: mcpLogs,
                  catalog: mcpCatalog,
                  roster: mcpRoster,
                  live: mcpLive,
                  onClose: () => setMcpConsoleOpen(false),
                  onOpenManager: () => setMcpOpen(true)
                }}
              />
            </main>
            {!sidebarOpen && <div className="wb-collapsed-user">{userMenu}</div>}
          </div>
          {/* Agent Change Review (ACR-R2.3): the ambient review bar sits at the
            work-surface footer, above the status bar — present only while the
            pending set is non-empty; `Revisar →` opens the sidebar panel. */}
          <ReviewBar onReview={() => showWorkView('review')} />
          {/* Second Brain (SB-R3/R9/R10): the floating button and everything it
            carries — the ask surface, the capture sheet, and the ambient
            health-check reminder. All sit OUTSIDE the resizable body so
            the persisted pane layout is untouched. */}
          <SecondBrainFab
            onSelectMode={openIngest}
            onAsk={openAsk}
            nudge={
              <HealthNudge
                health={secondBrain.health}
                onLint={() => launchBrainAction(SECOND_BRAIN_LINT)}
                onSnooze={secondBrain.snoozeHealth}
              />
            }
          />
          <AskSecondBrain
            open={askOpen}
            onOpenChange={setAskOpen}
            store={secondBrain}
            onLaunch={launchBrainAction}
            agents={agents}
            defaultAgent={defaultAgent}
            setup={brainSetup}
            onOpenVoiceSettings={() => {
              setAskOpen(false)
              openProfile('voice')
            }}
          />
          <IngestPanel
            mode={ingestMode}
            onClose={() => setIngestMode(null)}
            store={secondBrain}
            onLaunch={launchBrainAction}
            agents={agents}
            defaultAgent={defaultAgent}
            setup={brainSetup}
            onOpenVoiceSettings={() => {
              setIngestMode(null)
              openProfile('voice')
            }}
          />
          {/* The "your conversation is safe, here's the way back" hand-off for
              every Second Brain command that opened its own conversation. */}
          <BrainLaunchToast
            launch={brainToast}
            onResume={handleOpenSession}
            onClose={() => setBrainToast(null)}
          />
          <StaleGuardDialog />
          {pendingReviewSwitch !== null && (
            <ReviewSwitchDialog
              count={review.pendingCount}
              onCancel={() => setPendingReviewSwitch(null)}
              onKeep={() => {
                const path = pendingReviewSwitch
                setPendingReviewSwitch(null)
                continueSwitch(path)
              }}
              onAcceptAll={() => {
                const path = pendingReviewSwitch
                setPendingReviewSwitch(null)
                void review.acceptAll().then(() => continueSwitch(path))
              }}
              onRejectAll={() => {
                const path = pendingReviewSwitch
                setPendingReviewSwitch(null)
                void review.rejectAll().then(() => continueSwitch(path))
              }}
            />
          )}
          <StatusBar
            onChanges={() => showView('scm')}
            onInit={() => void git.init()}
            onBranch={() => setBranchPickerOpen(true)}
            onSync={gitRemote.sync}
            trailing={
              <McpStatusCluster
                roster={mcpRoster}
                live={mcpLive}
                open={mcpConsoleOpen}
                onToggle={toggleMcpConsole}
              />
            }
          />
          <BranchPicker
            open={branchPickerOpen}
            onOpenChange={setBranchPickerOpen}
            workspace={workspace}
            onCheckout={checkoutGuard.request}
            onCreate={(name) => void git.createBranch(name)}
            onDelete={(name) => void git.deleteBranch(name, true)}
          />
          <GitOpToast result={gitRemote.result} onClose={gitRemote.clear} />
          <UnsavedGuardDialog
            open={pendingExit}
            onCancel={() => setPendingExit(false)}
            onDiscard={closeApp}
            onSave={() => {
              void editor.saveAllDirty().then((ok) => {
                if (ok) closeApp()
              })
            }}
          />
          <UnsavedGuardDialog
            open={pendingSwitch !== null}
            onCancel={cancelSwitch}
            onDiscard={handleDiscardSwitch}
            onSave={handleSaveSwitch}
          />
          <UnsavedGuardDialog
            open={checkoutGuard.pending !== null}
            onCancel={checkoutGuard.cancel}
            onDiscard={checkoutGuard.discard}
            onSave={checkoutGuard.save}
          />
          <UnsavedGuardDialog
            open={editor.pendingClose !== null}
            fileName={editor.pendingClose === null ? undefined : tabLabel(editor.pendingClose)}
            remaining={editor.pendingCloseRemaining}
            onCancel={editor.cancelPendingClose}
            onDiscard={editor.discardPendingClose}
            onSave={editor.savePendingClose}
          />
          <FileSearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            workspace={workspace}
            onOpenFile={openAndReveal}
          />
          {/* nav-redesign: the archive behind "Ver todas as conversas" — the
              same rows, the same rename and delete, at a width where searching
              and re-sorting a year of history is actually pleasant. */}
          <AllConversationsDialog
            open={allConvOpen}
            onOpenChange={setAllConvOpen}
            store={chatSessions}
            activeSessionId={activeSessionId}
            runningSessionIds={runningSessionIds}
            reviewPendingBySession={reviewPendingBySession}
            window={convWindow}
            sort={convSort}
            onWindowChange={setConvWindow}
            onSortChange={setConvSort}
            onOpenSession={handleOpenSession}
            initiativeMarks={initiative.marks}
            initiativeOptions={initiative.filterOptions}
            initiativeFilter={initiative.filter}
            onInitiativeFilterChange={initiative.setFilter}
          />
          <UpdateCenter open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />
          {/* One notification column, bottom-left, above the rail's gear. Both
              notices are fixed-positioned cards that would otherwise land on
              the same coordinates; stacking them in one flex column is what
              keeps a finished model download from covering an update prompt. */}
          <div className="wb-notice-column">
            <UpdateNotice
              state={updateFlow.state}
              currentVersion={updateFlow.currentVersion}
              canApply={updateFlow.canApply}
              onUpdateNow={updateFlow.updateNow}
              onNotNow={updateFlow.notNow}
              onSkip={updateFlow.skip}
              onCancel={updateFlow.cancel}
              onRetry={updateFlow.retry}
              onOpenInstaller={updateFlow.openInstaller}
              onViewNotes={() => setAppSettingsOpen(true)}
            />
            {/* M26: a model download outlives every surface that could show it,
                so its ending is announced here — app-wide, whatever is open. */}
            <VoiceDownloadNotices
              onRetry={() => void window.hive.asr.startDownload()}
              onOpenSettings={() => openProfile('voice')}
            />
          </div>
          <ShortcutCustomizer
            open={shortcutsScope !== null}
            onOpenChange={(next) => setShortcutsScope(next ? 'start' : null)}
            workspace={workspace}
            role={role}
            initialScope={shortcutsScope ?? 'start'}
            onChanged={refreshShortcuts}
            onOpenStudio={() => {
              setShortcutsScope(null)
              setStudioOpen(true)
            }}
          />
          <NewInitiativeDialog
            open={initiative.createOpen}
            onOpenChange={initiative.setCreateOpen}
            onCreate={initiative.all.create}
            // Creating one and then having to find it in the tree would be the
            // repair left half-done: the folder was made *in order to* work in it.
            onCreated={initiative.show}
          />
          <InitiativeSettingsDialog
            initiative={initiative.editing}
            onOpenChange={(next) => !next && initiative.setEditing(null)}
            onSave={initiative.all.update}
            // A release change moves the folder, so the demand that is open has
            // to follow it — otherwise the panel would keep pointing at a path
            // that no longer exists.
            onSaved={initiative.show}
            onDelete={initiative.all.remove}
            onDeleted={() => initiative.show(null)}
          />
          <SkillStudio
            open={studioOpen}
            onOpenChange={setStudioOpen}
            workspace={workspace}
            role={role}
            hasRunningConversation={runningSessionIds.length > 0}
            agents={agents}
            defaultAgent={defaultAgent}
            onLaunch={handleStudioLaunch}
            onShortcutsChanged={refreshShortcuts}
            onOpenFile={editor.openFile}
          />
          <McpManager
            open={mcpOpen}
            onOpenChange={setMcpOpen}
            workspace={workspace}
            onOpenConsole={() => {
              setMcpOpen(false)
              setMcpConsoleOpen(true)
            }}
          />
          <ProfileSheet
            open={profileOpen}
            onOpenChange={setProfileOpen}
            workspace={workspace}
            initialScope={profileScope}
            initialConnectionLane={connectionLane}
            role={role}
            agents={agents}
            defaultAgent={defaultAgent}
            userName={userName}
            shortcutCounts={{
              start: shortcutSets.start.length,
              during: shortcutSets.during.length
            }}
            onOpenShortcuts={openShortcuts}
            // nav-redesign: MCP is a settings row now. The sheet steps aside
            // rather than stacking the manager's dialog inside its own.
            mcpCount={mcpCatalog.length}
            onOpenMcp={() => {
              setProfileOpen(false)
              setMcpOpen(true)
            }}
            onAgentsChange={onAgentsChange}
            onDefaultAgentChange={onDefaultAgentChange}
            onUserNameChange={onUserNameChange}
            onReplayTour={replayTour}
            onScopeChange={setOpenProfileScope}
          />
          {/* aws-bedrock: the live sign-in, above the work and outside every
              panel — a login can be triggered by a background turn while the
              user is reading a file, and it has to be findable from wherever
              they are. Suppressed while the AWS panel is open, which draws the
              same flow inline: two copies of one login, twenty pixels apart,
              is the duplication that makes a user wonder which is real. */}
          {/* claude-account: the first-party sign-in, on the same shelf and
              for the same reasons as the AWS one below — it can be started by
              a turn that failed while the user is somewhere else entirely,
              and it ends with a code that has to be pasted *somewhere*. */}
          <ClaudeSignInBeacon
            state={claudeAuth.login}
            suppressed={openProfileScope === 'connection'}
            onOpenUrl={(url) => void window.hive.openExternal(url)}
            onCopyUrl={(text) => void window.hive.clipboard.writeText(text)}
            onSubmitCode={claudeAuth.submitCode}
            onReadClipboard={() => window.hive.clipboard.readText()}
            onCancel={claudeAuth.cancel}
            onRetry={() => claudeAuth.connect()}
          />
          <AwsLoginBeacon
            state={aws.login}
            suppressed={openProfileScope === 'connection'}
            onOpenUrl={(url) => void window.hive.openExternal(url)}
            onCopyUrl={(text) => void window.hive.clipboard.writeText(text)}
            onCancel={aws.cancel}
            onRetry={() => aws.connect()}
          />
          <GuidedTour open={tour.open} userName={userName} onClose={tour.close} />
        </div>
      </ReviewProvider>
    </GitProvider>
  )
}
