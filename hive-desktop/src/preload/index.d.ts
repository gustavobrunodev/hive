import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BinaryFile,
  DocxDocument,
  EntryMeta,
  FsChangeEvent,
  SlidesDocument,
  SpreadsheetDocument,
  TreeNode
} from '../main/fsService'
import type {
  AgentCapabilities,
  AgentEvent,
  ApprovalDecision,
  AttachmentPick,
  SessionOpts,
  TurnOpts,
  WorkflowCommand
} from '../main/agentAdapter'
import type { BmadEvent, BmadInstallOptions } from '../main/bmadService'
import type { WorkflowEntry, SkillEntry, WorkspaceSkill } from '../main/workflowCatalog'
import type { CreatedSkill } from '../main/skillStudio'
import type { McpProbeResult, McpServer, McpServerConfig } from '../main/mcpService'
import type { McpLogLocation, McpLogQuery, McpLogSource } from '../main/mcpLogService'
import type { McpLogEntry } from '../main/mcpLogParse'
import type { ShortcutPrefs, ShortcutScope, ShortcutSettings } from '../main/configStore'
import type { OpenResult } from '../main/workspaceService'
import type { AgentMeta } from '../main/agentRegistry'
import type { ShellCatalogView } from '../main/shellService'
import type { ScreenDetectionResult } from '../main/designStudio/screenDetection'
import type {
  CapabilityViolation,
  Command,
  ComponentCatalog,
  OperationError
} from '../main/designStudio/types'
import type { ScreenView } from '../main/designStudio/designStudioService'
import type { StudioSkillEvent } from '../main/designStudio/skillDesignSystem'
import type { StudioSkillRequest } from '../main/designStudio/studioSkillRuns'
import type { ExportRequest, ExportRun } from '../main/designStudio/exportBundle'
import type { AgentInstallEvent } from '../main/agentInstaller'
import type { ResolvedRoleAction, ResolvedShortcutSets } from '../main/roleCatalog'
import type { ChatSessionMeta, StoredChatSession } from '../main/chatHistoryStore'
import type { AppInfo, UpdateEvent } from '../main/updateService'
import type {
  GitBranches,
  GitCommit,
  GitCommitDiff,
  GitConflict,
  GitConflictChoice,
  GitDetectResult,
  GitDiff,
  GitDiffSide,
  GitStash,
  GitStatus
} from '../main/gitService'
import type { ReviewResult, ReviewSnapshot } from '../main/reviewTypes'
import type { SkillEvent, VaultHealth, VaultStatus } from '../main/secondBrainTypes'
import type {
  HardwareRecommendation,
  WhisperDownloadEvent,
  WhisperModelId,
  WhisperModelInfo,
  WhisperVariant
} from '../main/whisperTypes'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    hive: {
      /** explorer-os-actions: the host OS, for labels the OS itself names differently (Explorador/Finder/…). */
      platform: NodeJS.Platform
      ping(): Promise<string>
      chooseWorkspace(): Promise<string | null>
      /** T3 (UX-R7.3): opens an http(s)/mailto URL in the OS default handler; see preload/index.ts for the full channel design. */
      openExternal(url: string): Promise<void>
      getWorkspace(): Promise<string | null>
      isProvisioned(): Promise<boolean>
      /** T3 (WS-R3.2): disk-based provisioning check for an arbitrary path — see preload/index.ts for the full channel design. */
      provisionState(path: string): Promise<boolean>
      /** T3 (WS-R2): the persisted MRU workspace list, newest-first — see preload/index.ts for the full channel design. */
      getRecentWorkspaces(): Promise<string[]>
      /** T3 (WS-R6.3): validates and opens `path` as the active workspace, persisting it as the MRU head — see preload/index.ts for the full channel design. */
      openWorkspace(path: string): Promise<OpenResult>
      listTree(root: string, relativePath?: string): Promise<TreeNode[]>
      /** chat-attachments: flat workspace file list for the composer's `@` mention menu. */
      listFiles(root: string): Promise<string[]>
      readFile(root: string, relativePath: string): Promise<string>
      /** Starts watching `root`; returns an unsubscribe function (see preload/index.ts for the full channel design). */
      watchWorkspace(root: string, onChange: (event: FsChangeEvent) => void): () => void
      /** AgentService (T14) surface — see preload/index.ts for the full channel design. */
      agent: {
        capabilities(agentId?: string): Promise<AgentCapabilities>
        /** chat-attachments (R6.5/T16): native multi-file picker; [] when canceled. `defaultPath` opens it inside the active workspace. */
        chooseAttachments(defaultPath?: string): Promise<AttachmentPick[]>
        start(opts: SessionOpts): Promise<void>
        /** `opts.resume` (session-history): conversation memory; `opts.turnId` (background-turns): event routing for concurrent turns. */
        send(text: string, opts?: TurnOpts): Promise<void>
        runWorkflow(cmd: WorkflowCommand, opts?: TurnOpts): Promise<void>
        /** T8 (WS-R5.2): explicit teardown of the active session — see preload/index.ts for the full channel design. */
        stop(): Promise<void>
        /** chat-controls CC-R1 + background-turns: interrupts one turn by id (or all), keeping the session alive. */
        interrupt(turnId?: string): Promise<void>
        /** agent-approvals: answers one blocked permission request — the only thing that unblocks the turn's CLI child. */
        respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>
        /** Subscribes to the active session's events; returns an unsubscribe function. */
        onEvent(onEvent: (evt: AgentEvent) => void): () => void
      }
      /** BmadService (T8/T9) install stream — see preload/index.ts for the full channel design. */
      installBmad(
        workspace: string,
        options: BmadInstallOptions,
        onEvent: (evt: BmadEvent) => void
      ): () => void
      /** BmadService.update() (T10) stream — see preload/index.ts for the full channel design. */
      updateBmad(workspace: string, onEvent: (evt: BmadEvent) => void): () => void
      /** WorkflowCatalog (T17) surface — see preload/index.ts for the full channel design. */
      workflows: {
        list(workspace: string): Promise<WorkflowEntry[]>
      }
      /** chat-controls (CC-R3): full installed-skill list for the slash menu. */
      skills: {
        list(workspace: string): Promise<SkillEntry[]>
      }
      /** Skill studio (skill-studio): the workspace's user-created skills. */
      studio: {
        list(workspace: string): Promise<CreatedSkill[]>
      }
      /** Design Studio (design-studio): the isolated Preview's per-session URL, whose token is also the postMessage nonce (D-DS-4). */
      designStudio: {
        openPreview(): Promise<string>
        closePreview(url: string): Promise<void>
        /** The Telas a UX Spec names (DS-R1); an `OperationError` when it cannot be read. */
        screens(
          workspace: string,
          relativePath: string
        ): Promise<ScreenDetectionResult | OperationError>
        /** The active DS catalog — the only source of truth for what exists (DS-R13). */
        catalog(): Promise<ComponentCatalog>
        /** One Tela as its log leaves it, creating an empty one on first ask. */
        view(key: string, screenId: string, title: string): Promise<ScreenView>
        /** Validates the batch, then pushes it as ONE undoable step; a rejected edit resolves to the violation. */
        dispatch(
          key: string,
          screenId: string,
          title: string,
          commands: Command[],
          groupId: string
        ): Promise<ScreenView | CapabilityViolation>
        undo(key: string, screenId: string, title: string): Promise<ScreenView>
        redo(key: string, screenId: string, title: string): Promise<ScreenView>
        /** Exports one or many Telas as self-contained Bundles (DS-R14/DS-R15); failure is isolated per Tela. */
        export(requests: ExportRequest[]): Promise<ExportRun>
        /** Runs the Skill for one Tela (DS-R2), streaming status → result/failed. Returns an unsubscribe-and-stop. */
        runSkill(
          request: StudioSkillRequest,
          onEvent: (event: StudioSkillEvent) => void
        ): () => void
      }
      /** MCP module (mcp): the workspace's Model Context Protocol servers — catalog, enabled state, and live connection probe. */
      mcp: {
        list(workspace: string): Promise<McpServer[]>
        add(workspace: string, name: string, config: McpServerConfig): Promise<void>
        update(
          workspace: string,
          originalName: string,
          name: string,
          config: McpServerConfig
        ): Promise<void>
        remove(workspace: string, name: string): Promise<void>
        setEnabled(workspace: string, name: string, enabled: boolean): Promise<void>
        probe(workspace: string, name: string): Promise<McpProbeResult>
      }
      /** MCP console (mcp-logs): the CLI's own per-server logs for this workspace — history, live tail, and the log folder. */
      mcpLogs: {
        sources(workspace: string): Promise<McpLogSource[]>
        read(workspace: string, query?: McpLogQuery): Promise<McpLogEntry[]>
        /** Where the console reads this workspace's logs from, and whether it's there. */
        locate(workspace: string): Promise<McpLogLocation>
        openDir(workspace: string, server: string): Promise<void>
        /** Streams entries appended after the call; the returned function stops the tail. */
        watch(workspace: string, onBatch: (entries: McpLogEntry[]) => void): () => void
      }
      /** ChatHistoryStore (session-history): persisted conversations per workspace — see preload/index.ts for the channel design. */
      chatHistory: {
        list(workspace: string): Promise<ChatSessionMeta[]>
        get(workspace: string, id: string): Promise<StoredChatSession | null>
        create(workspace: string, agent: string | null): Promise<StoredChatSession>
        append(
          workspace: string,
          id: string,
          message: { role: 'user' | 'assistant'; text: string; attachments?: string[] }
        ): Promise<ChatSessionMeta | null>
        rename(workspace: string, id: string, title: string): Promise<ChatSessionMeta | null>
        setCliSession(workspace: string, id: string, cliSessionId: string): Promise<void>
        search(workspace: string, query: string): Promise<ChatSessionMeta[]>
        delete(workspace: string, id: string): Promise<void>
      }
      /** App self-update (app-settings): version info + user-driven update flow — see preload/index.ts for the channel design. */
      app: {
        info(): Promise<AppInfo>
        /** `explicit` (T14): omit/`true` for a user-requested check (reports errors); `false` for the silent launch/periodic check (ND-R2.4 — failures produce nothing visible). */
        checkForUpdates(explicit?: boolean): Promise<void>
        downloadUpdate(): Promise<void>
        installUpdate(): Promise<void>
        /** npm-distribution (ND-R3.4): aborts an in-flight download; a no-op if nothing is downloading. */
        cancelUpdate(): Promise<void>
        /** npm-distribution (ND-R4.3): reveals the last-downloaded installer in the OS file manager. */
        revealInstaller(): Promise<void>
        /** npm-distribution (ND-R5.4): persists a version as skipped — never re-announced, still reachable on demand. */
        skipVersion(version: string): Promise<void>
        /** Subscribes to update-flow state transitions; returns an unsubscribe function. */
        onUpdateEvent(onEvent: (evt: UpdateEvent) => void): () => void
      }
      /** Profile (agent-selection + role-personalization): app-wide agent + role. */
      profile: {
        /** Detected agents. `refresh` re-probes instead of answering from the cache (AO-R2). */
        agents(refresh?: boolean): Promise<AgentMeta[]>
        /** Installs an agent's CLI (`npm i -g`), streaming progress; returns a cancel function (AO-R3). */
        installAgent(agentId: string, onEvent: (evt: AgentInstallEvent) => void): () => void
        getAgent(): Promise<string | null>
        setAgent(id: string): Promise<void>
        getAgents(): Promise<string[] | null>
        setAgents(ids: string[]): Promise<void>
        getRole(): Promise<string | null>
        setRole(id: string): Promise<void>
        getUserName(): Promise<string | null>
        setUserName(name: string | null): Promise<void>
        /** A role's *default* shortcuts for one scope (`start` when omitted). */
        roleActions(role: string | null, scope?: ShortcutScope): Promise<ResolvedRoleAction[]>
      }
      /**
       * The terminal agent turns run inside (agent-terminal). Detected shells +
       * the persisted choice + each enabled agent's caveat code; `select(null)`
       * restores automatic (`cmd` on Windows, `$SHELL` in POSIX).
       */
      shell: {
        list(refresh?: boolean): Promise<ShellCatalogView>
        select(id: string | null): Promise<void>
      }
      /** Shortcut customization (shortcut-customization): workspace skill catalog + persisted selection + resolved shortcut set. */
      shortcuts: {
        catalog(workspace: string): Promise<WorkspaceSkill[]>
        /** Both scopes' persisted selections (`null` in a scope = role default). */
        get(): Promise<ShortcutSettings>
        /** Persists one scope's selection; `null` restores that scope's role default. */
        set(scope: ShortcutScope, prefs: ShortcutPrefs | null): Promise<void>
        /** Both scopes resolved for render — `start` (hero) and `during` (strip). */
        actions(role: string | null, workspace: string): Promise<ResolvedShortcutSets>
      }
      /**
       * File management (T6/T7) surface — see preload/index.ts for the full
       * channel design. `createFile`/`saveFile`/`move`/`importEntry` reject
       * with a `FsConflictError` (exported from preload/index.ts) on a
       * `CONFLICT`/`STALE` outcome instead of a plain Error.
       */
      fs: {
        statFile(root: string, relativePath: string): Promise<EntryMeta>
        readBinary(root: string, relativePath: string): Promise<BinaryFile>
        readDocx(root: string, relativePath: string): Promise<DocxDocument>
        readSheet(root: string, relativePath: string): Promise<SpreadsheetDocument>
        readSlides(root: string, relativePath: string): Promise<SlidesDocument>
        createFile(
          root: string,
          relativePath: string,
          opts?: { overwrite?: boolean }
        ): Promise<void>
        createDirectory(root: string, relativePath: string): Promise<void>
        saveFile(
          root: string,
          relativePath: string,
          content: string,
          opts?: { expectedMtimeMs?: number }
        ): Promise<EntryMeta>
        move(
          root: string,
          fromRel: string,
          toRel: string,
          opts?: { overwrite?: boolean }
        ): Promise<void>
        importEntry(
          root: string,
          sourceAbs: string,
          destRel: string,
          opts?: { overwrite?: boolean }
        ): Promise<void>
        exists(root: string, relativePath: string): Promise<boolean>
        trash(root: string, relativePath: string): Promise<void>
        /** Turns a dropped renderer File into its absolute OS path via webUtils. */
        pathForFile(file: File): string
        /**
         * explorer-os-actions: opens the entry in the host's file manager.
         * `isDir` picks the verb — a directory is opened as the window's
         * target, a file is revealed highlighted inside its parent. `''` means
         * the workspace root. Rejects if the path escapes the workspace.
         */
        revealPath(root: string, relativePath: string, isDir: boolean): Promise<string | void>
        /** explorer-os-actions: the host-OS absolute path for a workspace-relative one. */
        absolutePath(root: string, relativePath: string): Promise<string>
      }
      /**
       * GitService (git-management M10) surface — see preload/index.ts for the
       * channel design. Every call rejects with a `GitBridgeError` (exported
       * from preload/index.ts) carrying the raw git stderr on failure (D-GIT-1).
       * `onChanged` streams a `{ root }` ping after every mutation.
       */
      git: {
        detect(workspace: string): Promise<GitDetectResult>
        status(workspace: string): Promise<GitStatus>
        init(workspace: string): Promise<void>
        stage(workspace: string, paths: string[]): Promise<void>
        unstage(workspace: string, paths: string[]): Promise<void>
        discard(workspace: string, paths: string[]): Promise<void>
        commit(
          workspace: string,
          message: string,
          opts?: { amend?: boolean; stageAll?: boolean }
        ): Promise<{ hash: string }>
        branches(workspace: string): Promise<GitBranches>
        createBranch(workspace: string, name: string, from?: string): Promise<void>
        checkout(workspace: string, ref: string): Promise<void>
        renameBranch(workspace: string, from: string, to: string): Promise<void>
        deleteBranch(workspace: string, name: string, force?: boolean): Promise<void>
        fetch(workspace: string): Promise<void>
        pull(workspace: string): Promise<void>
        push(workspace: string, opts?: { setUpstream?: boolean }): Promise<void>
        sync(workspace: string): Promise<void>
        log(
          workspace: string,
          opts?: { file?: string; skip?: number; limit?: number }
        ): Promise<GitCommit[]>
        diff(workspace: string, path: string, side: GitDiffSide): Promise<GitDiff>
        commitDiff(workspace: string, hash: string): Promise<GitCommitDiff>
        fileAtHead(workspace: string, path: string): Promise<string>
        conflicts(workspace: string): Promise<GitConflict[]>
        resolveConflict(workspace: string, path: string, choice: GitConflictChoice): Promise<void>
        mergeContinue(workspace: string): Promise<void>
        mergeAbort(workspace: string): Promise<void>
        stash(workspace: string, opts?: { message?: string; untracked?: boolean }): Promise<void>
        stashList(workspace: string): Promise<GitStash[]>
        stashApply(workspace: string, index: number, pop?: boolean): Promise<void>
        stashDrop(workspace: string, index: number): Promise<void>
        /** Subscribes to post-mutation change pings; returns an unsubscribe function. */
        onChanged(onChanged: (evt: { root: string }) => void): () => void
      }
      /**
       * Agent Change Review (M11) surface — the single pending set + accept/
       * reject at hunk/file/set granularity. `onChanged` streams the fresh
       * snapshot for a workspace after every recompute/decision so all four
       * review surfaces read one source (ACR-R2.5). Decisions resolve to a
       * `ReviewResult` (`{stale:true}` when a hand-edit would be clobbered).
       */
      review: {
        get(workspace: string): Promise<ReviewSnapshot>
        acceptFile(workspace: string, path: string): Promise<ReviewResult>
        rejectFile(workspace: string, path: string): Promise<ReviewResult>
        /** One turn's whole set in a single pass — the change card's "Aceitar tudo" / "Rejeitar tudo". */
        acceptFiles(workspace: string, paths: string[]): Promise<ReviewResult>
        rejectFiles(workspace: string, paths: string[]): Promise<ReviewResult>
        acceptHunk(workspace: string, path: string, hunkId: string): Promise<ReviewResult>
        rejectHunk(workspace: string, path: string, hunkId: string): Promise<ReviewResult>
        acceptAll(workspace: string): Promise<ReviewResult>
        rejectAll(workspace: string): Promise<ReviewResult>
        /**
         * Names the conversation a turn belongs to after the fact — the chat
         * pane's first turn in a brand-new conversation is sent before that
         * conversation's id exists (`TurnMark.conversationId`).
         */
        attachTurn(workspace: string, turnId: string, conversationId: string): Promise<void>
        /** Subscribes to snapshot pushes; returns an unsubscribe function. */
        onChanged(onChanged: (evt: { workspace: string } & ReviewSnapshot) => void): () => void
      }
      /**
       * Second Brain (SB-R1/R2/R3): skill provisioning (streamed, like
       * install/updateBmad), vault status, and raw staging. See
       * preload/index.ts for the channel design.
       */
      secondBrain: {
        /** SB-R1.1: install the four second-brain skills; streams SkillEvents, returns unsubscribe. */
        install(workspace: string, onEvent: (evt: SkillEvent) => void): () => void
        /** SB-R1.2: update the installed skills; streams SkillEvents, returns unsubscribe. */
        update(workspace: string, onEvent: (evt: SkillEvent) => void): () => void
        /** SB-R1.1: is the second-brain skill installed in this workspace? */
        isProvisioned(workspace: string): Promise<boolean>
        /** SB-R2: the vault path/name + count of raw files awaiting ingestion. */
        getVault(workspace: string): Promise<VaultStatus>
        /** SB-R3.2: stage raw content into the vault's raw/ inbox; returns the workspace-relative path. */
        stageRaw(workspace: string, content: string): Promise<{ relPath: string }>
        /** SB-R10.1: the derived health-check cadence for this workspace. */
        getHealth(workspace: string): Promise<VaultHealth>
        /** SB-R10.2: records one ingest launched from Hive; returns the new health. */
        noteIngest(workspace: string): Promise<VaultHealth>
        /** SB-R10.3: records a health-check run (resets the count + clocks). */
        noteLint(workspace: string): Promise<VaultHealth>
        /** SB-R10.5: postpones the ambient reminder ("Depois") without faking a run. */
        snoozeHealth(workspace: string): Promise<VaultHealth>
      }
      /**
       * Whisper model store (SB-R4.2/R7.2). Transcription runs in the renderer;
       * only model-file management crosses IPC (bytes reach the renderer over
       * the `hive-model:` protocol, not here).
       */
      whisper: {
        /** The catalog, each entry flagged with whether it's downloaded. */
        listModels(): Promise<WhisperModelInfo[]>
        modelStatus(
          id: WhisperModelId
        ): Promise<{ downloaded: boolean; variant: WhisperVariant | null }>
        /** Downloads a model; streams byte progress, returns an unsubscribe. */
        downloadModel(
          id: WhisperModelId,
          variant: WhisperVariant,
          onEvent: (evt: WhisperDownloadEvent) => void
        ): () => void
        deleteModel(id: WhisperModelId): Promise<void>
        /** SB-R7.1: advisory best-model-for-this-machine; falls back to `base`. */
        recommend(): Promise<HardwareRecommendation>
      }
    }
  }
}
