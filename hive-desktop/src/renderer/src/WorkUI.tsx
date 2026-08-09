import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { SessionHistory } from './chat/SessionHistory'
import { EditorTabs } from './ui/EditorTabs'
import { useEditorTabs } from './ui/useEditorTabs'
import { ActionRail, type RoleAction, type SidebarView } from './ui/ActionRail'
import { SidebarHost } from './ui/SidebarHost'
import { useGitStore, GitProvider } from './scm/useGit'
import { useReviewStore, ReviewProvider } from './scm/useReview'
import { useSecondBrain } from './secondBrain/useSecondBrain'
import { useBrainSetup } from './secondBrain/useBrainSetup'
import { BrainLaunchToast } from './secondBrain/BrainLaunchToast'
import { SecondBrainPanel } from './secondBrain/SecondBrainPanel'
import { SecondBrainFab, type IngestMode } from './secondBrain/SecondBrainFab'
import { IngestPanel } from './secondBrain/IngestPanel'
import { AskSecondBrain } from './secondBrain/AskSecondBrain'
import { HealthNudge } from './secondBrain/HealthNudge'
import { SECOND_BRAIN_INGEST, SECOND_BRAIN_LINT } from './secondBrain/secondBrainPrompts'
import { changeCount } from './scm/gitStatus'
import { SourceControlPanel } from './scm/SourceControlPanel'
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
import { McpConsole } from './mcpLogs/McpConsole'
import { McpStatusCluster } from './mcpLogs/McpStatusCluster'
import { isLive, useMcpLogs } from './mcpLogs/useMcpLogs'
import { useTicker } from './chat/useTicker'
import { UnsavedGuardDialog } from './ui/UnsavedGuardDialog'
import { GitOpToast } from './ui/GitOpToast'
import type { RowSide } from './scm/ChangeGroups'
import type { GitFileChange } from './scm/gitStatus'
import { ProfileSheet } from './ui/ProfileSheet'
import { ShortcutCustomizer, type ShortcutScope } from './ui/ShortcutCustomizer'
import { SkillStudio, type StudioLaunchOpts } from './ui/SkillStudio'
import { McpManager } from './ui/McpManager'
import { UpdateCenter } from './ui/UpdateCenter'
import { UpdateNotice } from './ui/UpdateNotice'
import { useUpdateFlow } from './ui/useUpdateFlow'
import { FileSearchDialog } from './ui/FileSearchDialog'
import { GuidedTour } from './tour/GuidedTour'
import { useGuidedTour } from './tour/useGuidedTour'
import { PaneHeader, PaneMoveMenu } from './ui/PaneHeader'
import { PANE_DRAG_MIME } from './ui/paneDnd'
import { HiveLogo } from './ui/HiveLogo'
import { ThemePicker } from './ui/ThemePicker'
import type { Theme } from './ui/theme'
import { ChevronDownIcon, FolderIcon, FolderOpenIcon, UserIcon } from './ui/icons'

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

/** Interleaves the visible panes with resize handles (module scope — keeps the loop's branches off `WorkUI`'s complexity budget). */
function buildPanels(
  visiblePanes: readonly PaneId[],
  renderers: Record<PaneId, () => ReactNode>
): ReactNode[] {
  const panels: ReactNode[] = []
  for (const [index, pane] of visiblePanes.entries()) {
    if (index > 0) {
      panels.push(
        <ResizableHandle
          key={`handle-${index}`}
          withGrip
          aria-label={t('workUI.resizeHandleLabel')}
        />
      )
    }
    panels.push(renderers[pane]())
  }
  return panels
}

/** Last path segment of an absolute workspace path (both separators, so a Windows path renders its folder name too). */
function workspaceName(workspace: string): string {
  const segments = workspace.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? workspace
}

/** Up to two initials from the display name ("Gustavo Bruno" → "GB", "Gustavo" → "G"); `null` when unset — the avatar then falls back to a person glyph. */
function initialsOf(name: string | null): string | null {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length === 0) return null
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
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

/** localStorage key for the persisted sidebar view (git-management D-GIT-2). */
const SIDEBAR_VIEW_STORAGE_KEY = 'hive.sidebarView'

/** Reads the persisted sidebar view, defaulting to the Explorer (tolerates missing/corrupt data). */
function loadSidebarView(): SidebarView {
  try {
    const stored = localStorage.getItem(SIDEBAR_VIEW_STORAGE_KEY)
    return stored === 'scm' || stored === 'review' || stored === 'brain' ? stored : 'explorer'
  } catch {
    return 'explorer'
  }
}

/** The three movable workbench panes (customizable-layout). */
type PaneId = 'rail' | 'chat' | 'viewer'

/** localStorage key for the persisted left-to-right pane order (customizable-layout — sibling of `hive.workLayout`, which keeps per-pane widths). */
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

/** Same write-failure tolerance as `persistWorkLayout`. */
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
 * `localStorage['hive.workLayout']` via `defaultLayout`/`onLayoutChanged` so
 * a dragged rail width survives a reload.
 */
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
  const editor = useEditorTabs()
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
  // Second Brain (M12, SB-R2): vault status + raw-pending count for the rail
  // badge and the Second Brain panel.
  const secondBrain = useSecondBrain(workspace)
  // Which ingestion mode the FAB opened the sheet on — null while closed (SB-R3.1).
  const [ingestMode, setIngestMode] = useState<IngestMode | null>(null)
  // "Perguntar à base" (SB-R9.1) — reachable from Ctrl+Shift+K, the sidebar's
  // primary action and the floating button's menu.
  const [askOpen, setAskOpen] = useState(false)
  // The swappable left-sidebar view (Explorer ⇄ Source Control), persisted so
  // it survives a reload (D-GIT-2).
  const [activeView, setActiveViewState] = useState<SidebarView>(loadSidebarView)
  // git-management (GIT-R6): the branch quick-pick + a branch checkout parked
  // behind the three-way unsaved-work guard (mirrors the workspace switch).
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  const setActiveView = useCallback((view: SidebarView) => {
    setActiveViewState(view)
    try {
      localStorage.setItem(SIDEBAR_VIEW_STORAGE_KEY, view)
    } catch {
      // persistence is a nicety, not a hard requirement
    }
  }, [])

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
  const [defaultLayout] = useState(loadWorkLayout)
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
  // shortcut-customization: the "Personalizar atalhos" picker dialog — `null`
  // while closed, otherwise the scope it opened on.
  const [shortcutsScope, setShortcutsScope] = useState<ShortcutScope | null>(null)
  // skill-studio: the "Estúdio de skills" dialog (create skills/agents + evals).
  const [studioOpen, setStudioOpen] = useState(false)
  // mcp: the "Servidores MCP" module (activate/disable + test connection + logs).
  const [mcpOpen, setMcpOpen] = useState(false)
  // mcp-logs: the MCP console dock (Ctrl+Shift+M, or the status-bar cluster).
  const [mcpConsoleOpen, setMcpConsoleOpen] = useState(false)
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
    (action: RoleAction) => {
      if (action.key === SECOND_BRAIN_INGEST.key) noteIngest()
      else if (action.key === SECOND_BRAIN_LINT.key) noteLint()
      const backgrounded = activeSessionId
      chatRef.current?.launchCreation(action)
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
  }, [])

  const handleOpenSession = useCallback((id: string) => {
    void chatRef.current?.openSession(id)
  }, [])

  // skill-studio: every studio action (create briefing, eval run, test) is a
  // chat turn — the studio composes it, the chat runs it. A creation launch
  // (`newConversation`) opens a fresh conversation on the studio's chosen
  // model/effort and backgrounds anything still generating; test/eval launches
  // continue the on-screen conversation as before.
  const handleStudioLaunch = useCallback((action: RoleAction, opts?: StudioLaunchOpts) => {
    if (opts?.newConversation) {
      chatRef.current?.launchCreation(action, { model: opts.model, effort: opts.effort })
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

  // Ctrl/Cmd+Shift+G opens the Source Control view (VS Code parity, D-GIT-2).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        setActiveView('scm')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveView])

  // mcp-logs: one subscription per window, hoisted here because the status bar
  // reads it while the dock is closed — that ambient signal is the reason the
  // console docks instead of hiding in a dialog.
  const mcpLogs = useMcpLogs(workspace)
  const mcpTick = useTicker(mcpLogs.lastAt !== null)
  const mcpLive = isLive(mcpLogs.lastAt, mcpTick)
  const mcpErrorCount = useMemo(
    () => mcpLogs.entries.filter((entry) => entry.level === 'error').length,
    [mcpLogs.entries]
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
        setActiveView('brain')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveView, openAsk])

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
  // (`hive.paneOrder`); widths stay in the sibling `hive.workLayout` keyed by
  // pane id, so they survive reordering too. Two ways to move a pane: drag
  // its header onto another pane (the drop side follows the pointer's half),
  // or the ↔ menu every header carries (the keyboard path).

  /** Panes actually on screen, in order — the viewer only exists while at least one tab is open. */
  const visiblePanes = useMemo(
    () => paneOrder.filter((id) => id !== 'viewer' || editor.tabs.length > 0),
    [paneOrder, editor.tabs.length]
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
      const neighbor = visiblePanes[visiblePanes.indexOf(pane) + dir]
      if (neighbor === undefined) return
      const next = [...paneOrder]
      const a = next.indexOf(pane)
      const b = next.indexOf(neighbor)
      next[a] = neighbor
      next[b] = pane
      applyPaneOrder(next)
    },
    [visiblePanes, paneOrder, applyPaneOrder]
  )

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

  /** The ↔ move menu for a pane, bounds derived from the visible order. */
  const paneMoveMenuFor = (pane: PaneId, name: string): React.JSX.Element => {
    const index = visiblePanes.indexOf(pane)
    return (
      <PaneMoveMenu
        paneName={name}
        canMoveLeft={index > 0}
        canMoveRight={index !== -1 && index < visiblePanes.length - 1}
        onMoveLeft={() => shiftPane(pane, -1)}
        onMoveRight={() => shiftPane(pane, 1)}
      />
    )
  }

  /** Shared inner-wrapper props: the drop-target surface + drop-hint/drag styling hooks. */
  const paneWrapPropsFor = (
    pane: PaneId
  ): HTMLAttributes<HTMLDivElement> & Record<string, unknown> => ({
    className: 'wb-pane',
    'data-drop': dropHint?.pane === pane ? dropHint.side : undefined,
    'data-dragging': dragPane === pane || undefined,
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

  // customizable-layout: the three pane bodies, rendered in `visiblePanes`
  // order. Every element in the array carries a stable key (pane id) so React
  // reconciles a reorder as a *move*, never a remount — the chat session and
  // the viewer's draft survive any drag.
  const paneRenderers: Record<PaneId, () => ReactNode> = {
    rail: () => {
      const paneTitle =
        activeView === 'scm'
          ? t('git.paneTitle')
          : activeView === 'review'
            ? t('review.panelTitle')
            : activeView === 'brain'
              ? t('secondBrain.panelTitle')
              : t('explorer.paneTitle')
      return (
        <ResizablePanel
          key="rail"
          id="rail"
          className="wb-rail"
          minSize="12%"
          maxSize="40%"
          defaultSize="22%"
          aria-label={paneTitle}
        >
          <div {...paneWrapPropsFor('rail')} data-tour="files">
            <PaneHeader
              title={paneTitle}
              dragProps={dragHandlePropsFor('rail')}
              actions={paneMoveMenuFor('rail', paneTitle)}
            />
            <SidebarHost
              activeView={activeView}
              explorer={
                <FileTree
                  workspace={workspace}
                  selectedPath={editor.activePath}
                  onOpenFile={editor.openFile}
                  decorations={git.decorations}
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
                />
              }
              review={
                <AgentReviewPanel onOpenDiff={(path: string) => editor.openReviewDiff(path)} />
              }
              brain={
                <SecondBrainPanel
                  store={secondBrain}
                  onLaunch={launchBrainAction}
                  onAsk={openAsk}
                  onOpenFile={editor.openFile}
                  setup={brainSetup}
                  onIngest={() => openIngest('text')}
                />
              }
            />
          </div>
        </ResizablePanel>
      )
    },
    chat: () => (
      <ResizablePanel key="chat" id="chat" minSize="30%" defaultSize="53%">
        <div {...paneWrapPropsFor('chat')}>
          <PaneHeader
            title={t('workUI.paneChat')}
            dragProps={dragHandlePropsFor('chat')}
            primaryActions={
              <SessionHistory
                workspace={workspace}
                activeSessionId={activeSessionId}
                runningSessionIds={runningSessionIds}
                onNewConversation={handleNewConversation}
                onOpenSession={handleOpenSession}
              />
            }
            actions={paneMoveMenuFor('chat', t('workUI.paneChat'))}
          />
          <Chat
            ref={chatRef}
            workspace={workspace}
            startActions={shortcutSets.start}
            conversationActions={shortcutSets.during}
            agents={agents}
            defaultAgent={defaultAgent}
            onManageAgents={() => setProfileOpen(true)}
            userName={userName}
            onSessionChange={setActiveSessionId}
            onRunningSessionsChange={setRunningSessionIds}
            onCustomizeShortcuts={setShortcutsScope}
            onOpenFile={editor.openFile}
          />
        </div>
      </ResizablePanel>
    ),
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
              dragProps={dragHandlePropsFor('viewer')}
              trailing={paneMoveMenuFor('viewer', t('workUI.paneEditor'))}
            />
            {/* Every tab's body stays mounted (drafts survive switching);
                only the active one is visible. Diff tabs render a DiffView
                (git-management §6.5); file tabs the FileViewer. */}
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
        </ResizablePanel>
      )
  }
  const panels = buildPanels(visiblePanes, paneRenderers)

  return (
    <GitProvider store={git}>
      <ReviewProvider store={review}>
        <div className="wb-app">
          <header className="wb-topbar">
            {/* The identity itself carries the app's name — the wordmark IS
            the word — so the title bar shows the lockup instead of a mark
            plus "Hive Desktop" set in the same 13px label as everything else
            around it. `aria-label` keeps the full product name for anyone
            reading the accessibility tree, where the drawing says nothing. */}
            <HiveLogo className="wb-topbar-logo" aria-label={t('app.title')} />
            <span className="wb-topbar-sep" aria-hidden="true" />
            <DropdownMenu open={chipMenuOpen} onOpenChange={handleChipMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="wb-workspace-chip"
                  title={t('workUI.workspaceChipTitle', workspace)}
                  aria-label={t('workUI.workspaceChipAria', workspace)}
                >
                  <FolderIcon size={14} className="wb-workspace-chip-icon" />
                  <span className="wb-workspace-chip-name">{workspaceName(workspace)}</span>
                  <ChevronDownIcon size={14} className="wb-workspace-chip-caret" />
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
                </DropdownMenuContent>
              )}
            </DropdownMenu>
            <div className="wb-topbar-spacer" />
            <ThemePicker theme={theme} onSelectTheme={onSelectTheme} />
            {/* Profile avatar (top-right, the desktop-app convention): the user's
            initials open the profile sheet — who you are; the rail's gear
            below is the software's settings. */}
            <button
              type="button"
              className="wb-avatar-btn"
              data-tour="profile"
              title={t('profile.openLabel')}
              aria-label={t('profile.openLabel')}
              onClick={() => setProfileOpen(true)}
            >
              {initialsOf(userName) ?? <UserIcon size={15} />}
            </button>
          </header>
          {switchError && (
            <div className="wb-switch-error" role="alert">
              {switchError}
            </div>
          )}
          <div className="wb-shell">
            <ActionRail
              activeView={activeView}
              onSelectView={setActiveView}
              changeCount={changeCount(git.status)}
              reviewCount={review.pendingCount}
              rawPendingCount={secondBrain.rawPending}
              healthDue={brainHealthDue}
              onOpenSearch={() => setSearchOpen(true)}
              onOpenStudio={() => setStudioOpen(true)}
              onOpenMcp={() => setMcpOpen(true)}
              onOpenAppSettings={() => setAppSettingsOpen(true)}
              updatePending={updateFlow.pending}
            />
            <div className="wb-body">
              <Resizable
                orientation="horizontal"
                style={{ flex: 1, minWidth: 0, minHeight: 0 }}
                defaultLayout={defaultLayout}
                onLayoutChanged={persistWorkLayout}
              >
                {panels}
              </Resizable>
              {/* mcp-logs: the MCP console docks under the work area rather
                than opening as a dialog — the question it answers ("what is
                this MCP server doing right now") is asked while a turn runs,
                and a modal would cover the transcript being asked about. */}
              {mcpConsoleOpen && (
                <McpConsole
                  workspace={workspace}
                  store={mcpLogs}
                  catalog={mcpCatalog}
                  live={mcpLive}
                  onClose={() => setMcpConsoleOpen(false)}
                  onOpenManager={() => setMcpOpen(true)}
                />
              )}
            </div>
          </div>
          {/* Agent Change Review (ACR-R2.3): the ambient review bar sits at the
            work-surface footer, above the status bar — present only while the
            pending set is non-empty; `Revisar →` opens the sidebar panel. */}
          <ReviewBar onReview={() => setActiveView('review')} />
          {/* Second Brain (SB-R3/R9/R10): the floating button and everything it
            carries — the ask surface, the capture sheet, and the ambient
            health-check reminder. All sit OUTSIDE the resizable body so
            `hive.workLayout` is untouched. */}
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
            setup={brainSetup}
          />
          <IngestPanel
            mode={ingestMode}
            onClose={() => setIngestMode(null)}
            store={secondBrain}
            onLaunch={launchBrainAction}
            setup={brainSetup}
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
            onChanges={() => setActiveView('scm')}
            onInit={() => void git.init()}
            onBranch={() => setBranchPickerOpen(true)}
            onSync={gitRemote.sync}
            trailing={
              <McpStatusCluster
                last={mcpLogs.entries.at(-1) ?? null}
                errors={mcpErrorCount}
                live={mcpLive}
                open={mcpConsoleOpen}
                onToggle={() => setMcpConsoleOpen((current) => !current)}
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
            onCancel={editor.cancelPendingClose}
            onDiscard={editor.discardPendingClose}
            onSave={editor.savePendingClose}
          />
          <FileSearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            workspace={workspace}
            onOpenFile={editor.openFile}
          />
          <UpdateCenter open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />
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
          <SkillStudio
            open={studioOpen}
            onOpenChange={setStudioOpen}
            workspace={workspace}
            role={role}
            hasRunningConversation={runningSessionIds.length > 0}
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
            role={role}
            agents={agents}
            defaultAgent={defaultAgent}
            userName={userName}
            shortcutCounts={{
              start: shortcutSets.start.length,
              during: shortcutSets.during.length
            }}
            onOpenShortcuts={openShortcuts}
            onAgentsChange={onAgentsChange}
            onDefaultAgentChange={onDefaultAgentChange}
            onUserNameChange={onUserNameChange}
            onReplayTour={replayTour}
          />
          <GuidedTour open={tour.open} userName={userName} onClose={tour.close} />
        </div>
      </ReviewProvider>
    </GitProvider>
  )
}
