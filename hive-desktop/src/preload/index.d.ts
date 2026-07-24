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
  AttachmentPick,
  SessionOpts,
  TurnOpts,
  WorkflowCommand
} from '../main/agentAdapter'
import type { BmadEvent, BmadInstallOptions } from '../main/bmadService'
import type { WorkflowEntry, SkillEntry, WorkspaceSkill } from '../main/workflowCatalog'
import type { CreatedSkill } from '../main/skillStudio'
import type { McpProbeResult, McpServer, McpServerConfig } from '../main/mcpService'
import type { ShortcutPrefs } from '../main/configStore'
import type { OpenResult } from '../main/workspaceService'
import type { AgentMeta } from '../main/agentRegistry'
import type { ResolvedRoleAction } from '../main/roleCatalog'
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

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    hive: {
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
      /** chat-attachments: flat workspace file list for the composer's `#` mention menu. */
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
        agents(): Promise<AgentMeta[]>
        getAgent(): Promise<string | null>
        setAgent(id: string): Promise<void>
        getAgents(): Promise<string[] | null>
        setAgents(ids: string[]): Promise<void>
        getRole(): Promise<string | null>
        setRole(id: string): Promise<void>
        getUserName(): Promise<string | null>
        setUserName(name: string | null): Promise<void>
        roleActions(role: string | null): Promise<ResolvedRoleAction[]>
      }
      /** Shortcut customization (shortcut-customization): workspace skill catalog + persisted selection + resolved shortcut set. */
      shortcuts: {
        catalog(workspace: string): Promise<WorkspaceSkill[]>
        get(): Promise<ShortcutPrefs | null>
        set(prefs: ShortcutPrefs | null): Promise<void>
        actions(role: string | null, workspace: string): Promise<ResolvedRoleAction[]>
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
    }
  }
}
