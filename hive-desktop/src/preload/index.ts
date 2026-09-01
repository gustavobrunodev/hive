import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
import type { ShortcutPrefs, ShortcutScope, ShortcutSettings } from '../main/configStore'
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
  WhisperDownload,
  WhisperModelId,
  WhisperModelInfo,
  WhisperPreference,
  WhisperVariant
} from '../main/whisperTypes'

// Typed counterpart to main/index.ts's `CONFLICT:`/`STALE:` message-prefix
// convention (see the `withConflictPrefix` comment there for why a prefix
// rather than a serialized custom Error field). `withTypedConflict` wraps an
// invoke call and, on a prefixed rejection, throws this instead — giving the
// renderer a discriminable `.code` to branch on rather than parsing strings.
export class FsConflictError extends Error {
  code: 'CONFLICT' | 'STALE'

  constructor(code: 'CONFLICT' | 'STALE', message: string) {
    super(message)
    this.name = 'FsConflictError'
    this.code = code
  }
}

const CONFLICT_PREFIXES = ['CONFLICT', 'STALE'] as const

/**
 * Typed counterpart to main/index.ts's `GIT:`-prefixed error convention
 * (git-management, design.md §4). A `GitError` crossing IPC loses its custom
 * fields, so main rethrows it as `GIT:` + a JSON payload; `withTypedGit`
 * parses that back into this, giving the renderer the raw git `stderr` to show
 * behind a "Detalhes" disclosure (G3 — truthful, never swallowed).
 */
export class GitBridgeError extends Error {
  code: number | null
  stderr: string
  command: string

  constructor(code: number | null, stderr: string, command: string) {
    super(stderr.trim() || `git exited with code ${code ?? 'unknown'}`)
    this.name = 'GitBridgeError'
    this.code = code
    this.stderr = stderr
    this.command = command
  }
}

const GIT_PREFIX = 'GIT:'

function withTypedGit<Args extends unknown[], R>(
  invoke: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await invoke(...args)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(GIT_PREFIX)) {
        try {
          const payload = JSON.parse(err.message.slice(GIT_PREFIX.length)) as {
            code: number | null
            stderr: string
            command: string
          }
          throw new GitBridgeError(payload.code, payload.stderr, payload.command)
        } catch (parseErr) {
          // A GitBridgeError we just threw must propagate; only a genuine
          // JSON.parse failure (malformed payload) falls through to the raw error.
          if (parseErr instanceof GitBridgeError) throw parseErr
        }
      }
      throw err
    }
  }
}

function withTypedConflict<Args extends unknown[], R>(
  invoke: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await invoke(...args)
    } catch (err) {
      if (err instanceof Error) {
        for (const code of CONFLICT_PREFIXES) {
          const prefix = `${code}: `
          if (err.message.startsWith(prefix)) {
            throw new FsConflictError(code, err.message.slice(prefix.length))
          }
        }
      }
      throw err
    }
  }
}

// The single typed bridge for all privileged (main-process) calls the renderer
// may make. Every future IPC method (T4+) is added here, not as a separate
// contextBridge.exposeInMainWorld call — this keeps the renderer's entire
// privileged surface enumerable in one place.
const hive = {
  /**
   * The host OS, as a plain value rather than a call (explorer-os-actions).
   * The renderer needs it only to *name* things the OS names differently —
   * "Explorador de Arquivos" / "Finder" / "gerenciador de arquivos" — and a
   * label that has to await an IPC round trip renders wrong on first paint.
   * `process` is preload-only under `sandbox: true`; this exposes the one
   * string, never the object.
   */
  platform: process.platform as NodeJS.Platform,
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
  chooseWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:choose'),
  // openExternal (T3, UX-R7.3): forwards to main's 'shell:openExternal'
  // handler, which validates the URL is http(s)/mailto before calling
  // shell.openExternal — see main/index.ts for the full rationale.
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
  isProvisioned: (): Promise<boolean> => ipcRenderer.invoke('workspace:isProvisioned'),
  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching methods, same
  // invoke/response shape as the three methods above.
  provisionState: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('workspace:provisionState', path),
  getRecentWorkspaces: (): Promise<string[]> => ipcRenderer.invoke('workspace:recents'),
  openWorkspace: (path: string): Promise<OpenResult> => ipcRenderer.invoke('workspace:open', path),

  // FsService (T11), request/response — same invoke/response shape as the
  // methods above.
  listTree: (root: string, relativePath?: string): Promise<TreeNode[]> =>
    ipcRenderer.invoke('fs:listTree', root, relativePath),
  // chat-attachments: flat workspace file list for the composer's `@` mention
  // menu — same invoke/response shape as listTree.
  listFiles: (root: string): Promise<string[]> => ipcRenderer.invoke('fs:listFiles', root),
  readFile: (root: string, relativePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', root, relativePath),

  // FsService (T11), streaming — the first streaming (not single
  // request/response) method on window.hive, so it's shaped differently:
  // `onChange` is a plain callback fired for every event, and the method
  // returns an unsubscribe function instead of a Promise. Internally:
  //   1. Register `listener` for the main -> renderer 'fs:watch:event' channel.
  //   2. Tell main to start watching via a fire-and-forget 'fs:watch:start' send.
  //   3. The returned unsubscribe function removes the listener AND tells
  //      main to tear down the underlying fs.watch via 'fs:watch:stop' — so
  //      callers that stop watching don't leave a watcher (or a listener)
  //      running in the background.
  // This is the reference pattern for later streaming IPC (e.g. T9's
  // BmadService install-progress stream): one main -> renderer event channel
  // per stream, a start/stop pair of renderer -> main sends, and a
  // subscribe-function-returning-unsubscribe-function shape on the bridge —
  // no generic pub/sub framework needed for a single concrete channel.
  watchWorkspace: (root: string, onChange: (event: FsChangeEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, change: FsChangeEvent): void => onChange(change)
    ipcRenderer.on('fs:watch:event', listener)
    ipcRenderer.send('fs:watch:start', root)
    return () => {
      ipcRenderer.removeListener('fs:watch:event', listener)
      ipcRenderer.send('fs:watch:stop')
    }
  },

  // AgentService (T14). Grouped under a nested `agent` namespace (unlike the
  // flat top-level methods above) to match design.md §3's IPC surface
  // (`agent.capabilities()`, `agent.start(opts)`, `agent.send(...)`,
  // `agent.runWorkflow(key)`). `capabilities`/`start`/`send`/`runWorkflow`
  // are plain invoke/response calls — even though a session's *events*
  // stream separately via `onEvent`, starting/sending/running a workflow
  // just needs to succeed or fail. `onEvent` is the streaming half and
  // follows the exact `watchWorkspace` channel-pattern above: one
  // main -> renderer event channel ('agent:event'), a start/stop pair of
  // renderer -> main sends ('agent:event:start'/'agent:event:stop'), and a
  // subscribe-returning-unsubscribe shape.
  agent: {
    // multi-agent: capabilities are per-agent (Copilot has no effort ladder,
    // Devin has models but no effort). `agentId` omitted → the default agent.
    //
    // model-picker: `opts.workspace` scopes detection (a project's settings can
    // repoint the CLI at another provider) and `opts.refresh` re-reads the
    // machine instead of answering from the main-process cache — what the
    // picker's "re-detectar" control calls after the user changes a config
    // outside the app.
    capabilities: (
      agentId?: string,
      opts?: { workspace?: string; refresh?: boolean }
    ): Promise<AgentCapabilities> => ipcRenderer.invoke('agent:capabilities', agentId, opts),
    // chat-attachments (R6.5/T16): native multi-file picker for the attach
    // button. Resolves to [] when the user cancels the dialog. `defaultPath`
    // opens the picker inside the active workspace.
    chooseAttachments: (defaultPath?: string): Promise<AttachmentPick[]> =>
      ipcRenderer.invoke('chat:chooseAttachments', defaultPath),
    start: (opts: SessionOpts): Promise<void> => ipcRenderer.invoke('agent:start', opts),
    // `opts.resume` (session-history): the CLI-native session id this turn
    // continues — surfaced by the `session` event, persisted per stored
    // conversation, and handed back here for real conversation memory.
    // `opts.turnId` (background-turns): tags the turn's events so concurrent
    // conversations' streams stay apart.
    send: (text: string, opts?: TurnOpts): Promise<void> =>
      ipcRenderer.invoke('agent:send', text, opts),
    runWorkflow: (cmd: WorkflowCommand, opts?: TurnOpts): Promise<void> =>
      ipcRenderer.invoke('agent:runWorkflow', cmd, opts),
    // T8 (WS-R5.2): explicit teardown of the active session, called from
    // `Chat`'s unmount cleanup so a switched-away-from workspace's session
    // doesn't linger orphaned when no new session starts right after.
    stop: (): Promise<void> => ipcRenderer.invoke('agent:stop'),
    // chat-controls CC-R1 + background-turns: interrupts one in-flight turn
    // by id (or all, with none) while the session stays alive — the Stop
    // button's channel (never 'agent:stop', which would leave the chat with
    // no session to send the next message to).
    interrupt: (turnId?: string): Promise<void> => ipcRenderer.invoke('agent:interrupt', turnId),
    // agent-approvals: answers one blocked permission request. The turn's CLI
    // child is parked until this lands, so the approval card is the only thing
    // that can move it — there is no timeout the user can win by waiting.
    respondApproval: (requestId: string, decision: ApprovalDecision): Promise<void> =>
      ipcRenderer.invoke('agent:approve', requestId, decision),
    // agent-approvals (session grant): reads back whether "permitir tudo nesta
    // sessão" is armed, so a reloaded window doesn't claim the agent is still
    // asking when it isn't. Setting `false` revokes it.
    approvalSession: (): Promise<boolean> => ipcRenderer.invoke('agent:approvalSession'),
    setApprovalSession: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('agent:approvalSession:set', enabled),
    onEvent: (onEvent: (evt: AgentEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: AgentEvent): void => onEvent(evt)
      ipcRenderer.on('agent:event', listener)
      ipcRenderer.send('agent:event:start')
      return () => {
        ipcRenderer.removeListener('agent:event', listener)
        ipcRenderer.send('agent:event:stop')
      }
    }
  },

  // BmadService (T8/T9), streaming. Same channel-pattern as `watchWorkspace`
  // above: 'bmad:install:event' pushes each BmadEvent, a start/stop pair of
  // renderer -> main sends drives the underlying install, and the bridge
  // method returns an unsubscribe function. Unlike `watchWorkspace`, the
  // underlying stream naturally ends on its own (a `done`/`error` event is
  // always the last one) — `unsubscribe` is still provided for an early-exit
  // case (e.g. the onboarding screen unmounting mid-install).
  installBmad: (
    workspace: string,
    options: BmadInstallOptions,
    onEvent: (evt: BmadEvent) => void
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, evt: BmadEvent): void => onEvent(evt)
    ipcRenderer.on('bmad:install:event', listener)
    ipcRenderer.send('bmad:install:start', workspace, options)
    return () => {
      ipcRenderer.removeListener('bmad:install:event', listener)
      ipcRenderer.send('bmad:install:stop')
    }
  },

  // BmadService.update() (T10) — identical shape to installBmad above, on
  // its own channel pair.
  updateBmad: (workspace: string, onEvent: (evt: BmadEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, evt: BmadEvent): void => onEvent(evt)
    ipcRenderer.on('bmad:update:event', listener)
    ipcRenderer.send('bmad:update:start', workspace)
    return () => {
      ipcRenderer.removeListener('bmad:update:event', listener)
      ipcRenderer.send('bmad:update:stop')
    }
  },

  // WorkflowCatalog (T17), grouped under a `workflows` namespace (matching
  // design.md §3's `workflows.list()`), plain invoke/response — a one-shot
  // list, not a stream.
  workflows: {
    list: (workspace: string): Promise<WorkflowEntry[]> =>
      ipcRenderer.invoke('workflows:list', workspace)
  },

  // chat-controls (CC-R3.1): the full installed-skill list for the slash menu.
  skills: {
    list: (workspace: string): Promise<SkillEntry[]> => ipcRenderer.invoke('skills:list', workspace)
  },

  // Skill studio (skill-studio): the workspace's user-created skills for the
  // studio gallery. Plain invoke/response, same shape as skills.list.
  studio: {
    list: (workspace: string): Promise<CreatedSkill[]> =>
      ipcRenderer.invoke('studio:list', workspace)
  },

  // Design Studio (design-studio): the isolated Preview's session lifecycle.
  // `openPreview` mints an unguessable `hive-studio://` URL for one frame and
  // `closePreview` retires it — the token in that URL is also the postMessage
  // nonce (D-DS-4), which is why it never travels any other way.
  designStudio: {
    openPreview: (): Promise<string> => ipcRenderer.invoke('designStudio:openPreview'),
    closePreview: (url: string): Promise<void> =>
      ipcRenderer.invoke('designStudio:closePreview', url),
    // The Telas a UX Spec names (DS-R1). Resolves to the detection result, or
    // to an `OperationError` when the Spec cannot be read — never rejects, so
    // the tab renders the failure instead of unmounting on it.
    screens: (
      workspace: string,
      relativePath: string
    ): Promise<ScreenDetectionResult | OperationError> =>
      ipcRenderer.invoke('designStudio:screens', workspace, relativePath),
    // The document (T5.1). `key` identifies one Tela's log in main; the
    // `screenId`/`title` pair is the origin its replay starts from. `dispatch`
    // resolves to the new view **or** to a `CapabilityViolation` — a rejected
    // edit is a value the Inspector renders, not an exception (DS-R17).
    catalog: (): Promise<ComponentCatalog> => ipcRenderer.invoke('designStudio:catalog'),
    view: (key: string, screenId: string, title: string): Promise<ScreenView> =>
      ipcRenderer.invoke('designStudio:view', key, screenId, title),
    dispatch: (
      key: string,
      screenId: string,
      title: string,
      commands: Command[],
      groupId: string
    ): Promise<ScreenView | CapabilityViolation> =>
      ipcRenderer.invoke('designStudio:dispatch', key, screenId, title, commands, groupId),
    undo: (key: string, screenId: string, title: string): Promise<ScreenView> =>
      ipcRenderer.invoke('designStudio:undo', key, screenId, title),
    redo: (key: string, screenId: string, title: string): Promise<ScreenView> =>
      ipcRenderer.invoke('designStudio:redo', key, screenId, title),
    // The Bundle (T7.4, DS-R14/DS-R15). One call for one Tela or for many —
    // there is no second path for a batch, so "the failure of one does not stop
    // the others" cannot be true on one path and false on the other. Resolves
    // to the whole report, including `canceled` when the folder picker was
    // closed; it never rejects.
    export: (requests: ExportRequest[]): Promise<ExportRun> =>
      ipcRenderer.invoke('designStudio:export', requests),
    // The Skill (T6.2, DS-R2). Streamed on the `secondBrain:install` mold: the
    // returned function unsubscribes *and* tells main to stop forwarding, so a
    // Tela the user left behind stops painting into a stage that moved on.
    runSkill: (
      request: StudioSkillRequest,
      onEvent: (event: StudioSkillEvent) => void
    ): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: StudioSkillEvent): void => onEvent(evt)
      ipcRenderer.on('designStudio:skill:event', listener)
      ipcRenderer.send('designStudio:skill:start', request)
      return () => {
        ipcRenderer.removeListener('designStudio:skill:event', listener)
        ipcRenderer.send('designStudio:skill:stop')
      }
    }
  },

  // MCP module (mcp): the workspace's Model Context Protocol servers. list is
  // plain invoke/response; add/update/remove/setEnabled mutate `.mcp.json` /
  // `.claude/settings.local.json` and can reject with a user-facing
  // Error.message; probe starts the server and runs the MCP handshake to
  // report live status + tools + logs. Arg order mirrors the `mcp:*` handlers.
  mcp: {
    list: (workspace: string): Promise<McpServer[]> => ipcRenderer.invoke('mcp:list', workspace),
    add: (workspace: string, name: string, config: McpServerConfig): Promise<void> =>
      ipcRenderer.invoke('mcp:add', workspace, name, config),
    update: (
      workspace: string,
      originalName: string,
      name: string,
      config: McpServerConfig
    ): Promise<void> => ipcRenderer.invoke('mcp:update', workspace, originalName, name, config),
    remove: (workspace: string, name: string): Promise<void> =>
      ipcRenderer.invoke('mcp:remove', workspace, name),
    setEnabled: (workspace: string, name: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('mcp:setEnabled', workspace, name, enabled),
    probe: (workspace: string, name: string): Promise<McpProbeResult> =>
      ipcRenderer.invoke('mcp:probe', workspace, name)
  },

  // MCP console (mcp-logs): the CLI's own per-server log files for this
  // workspace — the record of what each MCP server did during real turns.
  // `sources`/`read`/`openDir` are plain invoke/response; `watch` is the
  // streaming half and follows the `watchWorkspace` pattern above exactly —
  // subscribe returns an unsubscribe that both drops the listener and tells
  // main to tear the watcher down, so a closed console leaves nothing running.
  mcpLogs: {
    sources: (workspace: string): Promise<McpLogSource[]> =>
      ipcRenderer.invoke('mcpLogs:sources', workspace),
    read: (workspace: string, query?: McpLogQuery): Promise<McpLogEntry[]> =>
      ipcRenderer.invoke('mcpLogs:read', workspace, query ?? {}),
    locate: (workspace: string): Promise<McpLogLocation> =>
      ipcRenderer.invoke('mcpLogs:locate', workspace),
    openDir: (workspace: string, server: string): Promise<void> =>
      ipcRenderer.invoke('mcpLogs:openDir', workspace, server),
    watch: (workspace: string, onBatch: (entries: McpLogEntry[]) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, entries: McpLogEntry[]): void => onBatch(entries)
      ipcRenderer.on('mcpLogs:watch:event', listener)
      ipcRenderer.send('mcpLogs:watch:start', workspace)
      return () => {
        ipcRenderer.removeListener('mcpLogs:watch:event', listener)
        ipcRenderer.send('mcpLogs:watch:stop')
      }
    }
  },

  // ChatHistoryStore (session-history): persisted conversations per
  // workspace. Plain invoke/response — list/get/create/append/rename/delete,
  // arg order mirroring the corresponding 'chatHistory:<name>' handlers in
  // main/index.ts exactly.
  chatHistory: {
    list: (workspace: string): Promise<ChatSessionMeta[]> =>
      ipcRenderer.invoke('chatHistory:list', workspace),
    get: (workspace: string, id: string): Promise<StoredChatSession | null> =>
      ipcRenderer.invoke('chatHistory:get', workspace, id),
    create: (workspace: string, agent: string | null): Promise<StoredChatSession> =>
      ipcRenderer.invoke('chatHistory:create', workspace, agent),
    append: (
      workspace: string,
      id: string,
      message: { role: 'user' | 'assistant'; text: string; attachments?: string[] }
    ): Promise<ChatSessionMeta | null> =>
      ipcRenderer.invoke('chatHistory:append', workspace, id, message),
    rename: (workspace: string, id: string, title: string): Promise<ChatSessionMeta | null> =>
      ipcRenderer.invoke('chatHistory:rename', workspace, id, title),
    setCliSession: (workspace: string, id: string, cliSessionId: string): Promise<void> =>
      ipcRenderer.invoke('chatHistory:setCliSession', workspace, id, cliSessionId),
    search: (workspace: string, query: string): Promise<ChatSessionMeta[]> =>
      ipcRenderer.invoke('chatHistory:search', workspace, query),
    delete: (workspace: string, id: string): Promise<void> =>
      ipcRenderer.invoke('chatHistory:delete', workspace, id)
  },

  // App self-update (app-settings): version info as plain invoke/response;
  // the update flow's state transitions stream on 'update:event' following
  // the exact watchWorkspace/agent.onEvent channel pattern above.
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
    // app-reload: main owns the reload so it hits the window rather than the
    // document — `location.reload()` here would re-run the SPA inside the same
    // renderer process and keep whatever state made a reload necessary.
    reload: (): Promise<void> => ipcRenderer.invoke('app:reload'),
    // npm-distribution T14: `explicit` widened from zero-arg to optional —
    // the `update:check` IPC channel itself already accepted this param
    // (main/index.ts's handler always has, defaulting to `true` when
    // omitted); only this bridge method was still zero-arg. Needed so
    // `useUpdateFlow`'s launch/periodic checks can pass `false` (silent,
    // ND-R2.4) while every existing explicit-check caller (UpdateCenter's
    // manual refresh, `retry`) keeps working unchanged by omitting it.
    checkForUpdates: (explicit?: boolean): Promise<void> =>
      ipcRenderer.invoke('update:check', explicit),
    downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update:download'),
    installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
    // npm-distribution (ND-R3.4/ND-R4.3/ND-R5.4): cancel an in-flight
    // download, reveal the last-downloaded installer in the OS file manager,
    // and persist a version the user explicitly chose to skip.
    cancelUpdate: (): Promise<void> => ipcRenderer.invoke('update:cancel'),
    revealInstaller: (): Promise<void> => ipcRenderer.invoke('update:reveal'),
    skipVersion: (version: string): Promise<void> => ipcRenderer.invoke('update:skip', version),
    onUpdateEvent: (onEvent: (evt: UpdateEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: UpdateEvent): void => onEvent(evt)
      ipcRenderer.on('update:event', listener)
      ipcRenderer.send('update:event:start')
      return () => {
        ipcRenderer.removeListener('update:event', listener)
        ipcRenderer.send('update:event:stop')
      }
    }
  },

  // Profile (agent-selection + role-personalization): app-wide agent + role
  // preferences and the resolved role action list. Plain invoke/response.
  profile: {
    // multi-agent: `agents()` probes availability per machine (available +
    // installHint + docsUrl). `getAgent/setAgent` are the **default** agent;
    // `getAgents/setAgents` are the **enabled** set the switcher offers.
    agents: (refresh?: boolean): Promise<AgentMeta[]> =>
      ipcRenderer.invoke('profile:agents', refresh === true),
    // agent-onboarding: install an agent's CLI from inside the app. Streaming,
    // same start/event/stop shape as `installBmad`, with the agent id echoed
    // back on every event so two cards installing at once can't cross wires.
    // The returned function cancels the install and stops delivery.
    installAgent: (agentId: string, onEvent: (event: AgentInstallEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, id: string, evt: AgentInstallEvent): void => {
        if (id === agentId) onEvent(evt)
      }
      ipcRenderer.on('agents:install:event', listener)
      ipcRenderer.send('agents:install:start', agentId)
      return () => {
        ipcRenderer.removeListener('agents:install:event', listener)
        ipcRenderer.send('agents:install:stop', agentId)
      }
    },
    getAgent: (): Promise<string | null> => ipcRenderer.invoke('profile:getAgent'),
    setAgent: (id: string): Promise<void> => ipcRenderer.invoke('profile:setAgent', id),
    getAgents: (): Promise<string[] | null> => ipcRenderer.invoke('profile:getAgents'),
    setAgents: (ids: string[]): Promise<void> => ipcRenderer.invoke('profile:setAgents', ids),
    getRole: (): Promise<string | null> => ipcRenderer.invoke('profile:getRole'),
    setRole: (id: string): Promise<void> => ipcRenderer.invoke('profile:setRole', id),
    getUserName: (): Promise<string | null> => ipcRenderer.invoke('profile:getUserName'),
    setUserName: (name: string | null): Promise<void> =>
      ipcRenderer.invoke('profile:setUserName', name),
    roleActions: (role: string | null, scope?: ShortcutScope): Promise<ResolvedRoleAction[]> =>
      ipcRenderer.invoke('profile:roleActions', role, scope)
  },

  // The terminal agent turns run inside (agent-terminal). `list` returns the
  // shells detected on this machine, the persisted choice, and each enabled
  // agent's caveat **code** (the copy lives in the renderer's i18n, never in
  // main). `select(null)` restores automatic.
  shell: {
    list: (refresh?: boolean): Promise<ShellCatalogView> =>
      ipcRenderer.invoke('shell:list', refresh === true),
    select: (id: string | null): Promise<void> => ipcRenderer.invoke('shell:select', id)
  },

  // Shortcut customization (shortcut-customization + shortcut-scopes):
  // workspace skill catalog, the persisted per-scope selection, and both
  // resolved shortcut sets. Plain invoke/response; arg order mirrors the
  // `shortcuts:*` handlers in main/index.ts exactly.
  shortcuts: {
    catalog: (workspace: string): Promise<WorkspaceSkill[]> =>
      ipcRenderer.invoke('shortcuts:catalog', workspace),
    get: (): Promise<ShortcutSettings> => ipcRenderer.invoke('shortcuts:get'),
    set: (scope: ShortcutScope, prefs: ShortcutPrefs | null): Promise<void> =>
      ipcRenderer.invoke('shortcuts:set', scope, prefs),
    actions: (role: string | null, workspace: string): Promise<ResolvedShortcutSets> =>
      ipcRenderer.invoke('shortcuts:actions', role, workspace)
  },

  // File management (T6/T7), grouped under an `fs` namespace matching
  // design.md §3. Each wrapper's arg order mirrors the corresponding
  // `fs:<name>` handler in main/index.ts exactly. `createFile`/`saveFile`/
  // `move`/`importEntry` can reject with a `CONFLICT:`/`STALE:`-prefixed
  // Error (main/index.ts's `withConflictPrefix`, since a custom `.code` on a
  // thrown Error doesn't survive the IPC structured-clone boundary) — those
  // four are wrapped with `withTypedConflict` below, which strips the prefix
  // and rejects with a `FsConflictError` carrying a discriminable `code`
  // instead. `statFile`/`createDirectory`/`exists`/`trash` can't hit a
  // conflict, so they invoke directly.
  fs: {
    statFile: (root: string, relativePath: string): Promise<EntryMeta> =>
      ipcRenderer.invoke('fs:statFile', root, relativePath),
    // Rich file viewer readers (docx/pptx/spreadsheet/pdf/image). Parsing is
    // done in main; these are plain invoke/response like statFile above.
    readBinary: (root: string, relativePath: string): Promise<BinaryFile> =>
      ipcRenderer.invoke('fs:readBinary', root, relativePath),
    readDocx: (root: string, relativePath: string): Promise<DocxDocument> =>
      ipcRenderer.invoke('fs:readDocx', root, relativePath),
    readSheet: (root: string, relativePath: string): Promise<SpreadsheetDocument> =>
      ipcRenderer.invoke('fs:readSheet', root, relativePath),
    readSlides: (root: string, relativePath: string): Promise<SlidesDocument> =>
      ipcRenderer.invoke('fs:readSlides', root, relativePath),
    createFile: withTypedConflict(
      (root: string, relativePath: string, opts?: { overwrite?: boolean }): Promise<void> =>
        ipcRenderer.invoke('fs:createFile', root, relativePath, opts)
    ),
    createDirectory: (root: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:createDirectory', root, relativePath),
    saveFile: withTypedConflict(
      (
        root: string,
        relativePath: string,
        content: string,
        opts?: { expectedMtimeMs?: number }
      ): Promise<EntryMeta> => ipcRenderer.invoke('fs:saveFile', root, relativePath, content, opts)
    ),
    move: withTypedConflict(
      (
        root: string,
        fromRel: string,
        toRel: string,
        opts?: { overwrite?: boolean }
      ): Promise<void> => ipcRenderer.invoke('fs:move', root, fromRel, toRel, opts)
    ),
    // file-clipboard: the in-workspace copy behind Ctrl+C / Ctrl+V. Same
    // conflict convention as `move`/`importEntry`, so paste can reuse the
    // Explorer's existing "Já existe um item com esse nome" dialog.
    copyEntry: withTypedConflict(
      (
        root: string,
        fromRel: string,
        toRel: string,
        opts?: { overwrite?: boolean }
      ): Promise<void> => ipcRenderer.invoke('fs:copyEntry', root, fromRel, toRel, opts)
    ),
    importEntry: withTypedConflict(
      (
        root: string,
        sourceAbs: string,
        destRel: string,
        opts?: { overwrite?: boolean }
      ): Promise<void> => ipcRenderer.invoke('fs:importEntry', root, sourceAbs, destRel, opts)
    ),
    exists: (root: string, relativePath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:exists', root, relativePath),
    trash: (root: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:trash', root, relativePath),
    // Turns a dropped renderer File into its absolute OS path. webUtils is
    // main/preload-only under sandbox:true — this is the ONLY way the
    // renderer can learn a dropped file's path (FM-R5).
    pathForFile: (file: File): string => webUtils.getPathForFile(file),
    // explorer-os-actions: opens the entry in the host's file manager.
    // `isDir` picks reveal-the-item vs open-the-folder in main.
    revealPath: (root: string, relativePath: string, isDir: boolean): Promise<void> =>
      ipcRenderer.invoke('shell:revealPath', root, relativePath, isDir),
    // The workspace-relative path resolved against the host OS, for the
    // explorer's "copy absolute path" action. Same `resolveSafe` gate as every
    // other `fs:` call — the renderer never composes an OS path itself,
    // because it has no idea whether the host separates with `/` or `\`.
    absolutePath: (root: string, relativePath: string): Promise<string> =>
      ipcRenderer.invoke('fs:absolutePath', root, relativePath)
  },

  // file-clipboard: writing text to the system clipboard. The renderer has a
  // `navigator.clipboard` too, but in this window it rejects — the session
  // permission handler only grants what the app actually needs, and even a
  // granted async clipboard write requires the document to be focused, which a
  // copy fired from a closing menu cannot promise. Main's `clipboard` has
  // neither constraint, so this is the path every in-app copy takes.
  // Deliberately write-only: there is no `readText` here.
  clipboard: {
    writeText: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:writeText', text)
  },

  // GitService (git-management M10), grouped under a `git` namespace matching
  // design.md §4. Arg order mirrors each `git:<name>` handler in main/index.ts
  // exactly, and every call is wrapped in `withTypedGit` so a git failure
  // surfaces as a `GitBridgeError` carrying the raw stderr (D-GIT-1 / G3),
  // never a stringly-typed one. `onChanged` is the streaming half, following
  // the exact `watchWorkspace` channel-pattern (start/stop sends +
  // subscribe-returning-unsubscribe).
  git: {
    detect: withTypedGit((workspace: string): Promise<GitDetectResult> =>
      ipcRenderer.invoke('git:detect', workspace)
    ),
    status: withTypedGit((workspace: string): Promise<GitStatus> =>
      ipcRenderer.invoke('git:status', workspace)
    ),
    init: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:init', workspace)
    ),
    stage: withTypedGit((workspace: string, paths: string[]): Promise<void> =>
      ipcRenderer.invoke('git:stage', workspace, paths)
    ),
    unstage: withTypedGit((workspace: string, paths: string[]): Promise<void> =>
      ipcRenderer.invoke('git:unstage', workspace, paths)
    ),
    discard: withTypedGit((workspace: string, paths: string[]): Promise<void> =>
      ipcRenderer.invoke('git:discard', workspace, paths)
    ),
    commit: withTypedGit(
      (
        workspace: string,
        message: string,
        opts?: { amend?: boolean; stageAll?: boolean }
      ): Promise<{ hash: string }> => ipcRenderer.invoke('git:commit', workspace, message, opts)
    ),
    branches: withTypedGit((workspace: string): Promise<GitBranches> =>
      ipcRenderer.invoke('git:branches', workspace)
    ),
    createBranch: withTypedGit((workspace: string, name: string, from?: string): Promise<void> =>
      ipcRenderer.invoke('git:createBranch', workspace, name, from)
    ),
    checkout: withTypedGit((workspace: string, ref: string): Promise<void> =>
      ipcRenderer.invoke('git:checkout', workspace, ref)
    ),
    renameBranch: withTypedGit((workspace: string, from: string, to: string): Promise<void> =>
      ipcRenderer.invoke('git:renameBranch', workspace, from, to)
    ),
    deleteBranch: withTypedGit((workspace: string, name: string, force?: boolean): Promise<void> =>
      ipcRenderer.invoke('git:deleteBranch', workspace, name, force)
    ),
    fetch: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:fetch', workspace)
    ),
    pull: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:pull', workspace)
    ),
    push: withTypedGit((workspace: string, opts?: { setUpstream?: boolean }): Promise<void> =>
      ipcRenderer.invoke('git:push', workspace, opts)
    ),
    sync: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:sync', workspace)
    ),
    log: withTypedGit(
      (
        workspace: string,
        opts?: { file?: string; skip?: number; limit?: number }
      ): Promise<GitCommit[]> => ipcRenderer.invoke('git:log', workspace, opts)
    ),
    diff: withTypedGit((workspace: string, path: string, side: GitDiffSide): Promise<GitDiff> =>
      ipcRenderer.invoke('git:diff', workspace, path, side)
    ),
    commitDiff: withTypedGit((workspace: string, hash: string): Promise<GitCommitDiff> =>
      ipcRenderer.invoke('git:commitDiff', workspace, hash)
    ),
    fileAtHead: withTypedGit((workspace: string, path: string): Promise<string> =>
      ipcRenderer.invoke('git:fileAtHead', workspace, path)
    ),
    conflicts: withTypedGit((workspace: string): Promise<GitConflict[]> =>
      ipcRenderer.invoke('git:conflicts', workspace)
    ),
    resolveConflict: withTypedGit(
      (workspace: string, path: string, choice: GitConflictChoice): Promise<void> =>
        ipcRenderer.invoke('git:resolveConflict', workspace, path, choice)
    ),
    mergeContinue: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:mergeContinue', workspace)
    ),
    mergeAbort: withTypedGit((workspace: string): Promise<void> =>
      ipcRenderer.invoke('git:mergeAbort', workspace)
    ),
    stash: withTypedGit(
      (workspace: string, opts?: { message?: string; untracked?: boolean }): Promise<void> =>
        ipcRenderer.invoke('git:stash', workspace, opts)
    ),
    stashList: withTypedGit((workspace: string): Promise<GitStash[]> =>
      ipcRenderer.invoke('git:stashList', workspace)
    ),
    stashApply: withTypedGit((workspace: string, index: number, pop?: boolean): Promise<void> =>
      ipcRenderer.invoke('git:stashApply', workspace, index, pop)
    ),
    stashDrop: withTypedGit((workspace: string, index: number): Promise<void> =>
      ipcRenderer.invoke('git:stashDrop', workspace, index)
    ),
    onChanged: (onChanged: (evt: { root: string }) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: { root: string }): void => onChanged(evt)
      ipcRenderer.on('git:changed', listener)
      ipcRenderer.send('git:changed:start')
      return () => {
        ipcRenderer.removeListener('git:changed', listener)
        ipcRenderer.send('git:changed:stop')
      }
    }
  },

  // Agent Change Review (M11, T7): the pending-set query + accept/reject
  // bridge, arg order mirroring each `review:<name>` handler in main/index.ts.
  // Plain invoke/response (no GitError-style wrapping — decisions return a
  // `ReviewResult`, `{stale:true}` and all). `onChanged` is the streaming half,
  // the `git.onChanged` pattern: it carries the fresh snapshot for the workspace
  // so all four review surfaces re-render from one source (ACR-R2.5).
  review: {
    get: (workspace: string): Promise<ReviewSnapshot> =>
      ipcRenderer.invoke('review:get', workspace),
    acceptFile: (workspace: string, path: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:acceptFile', workspace, path),
    rejectFile: (workspace: string, path: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:rejectFile', workspace, path),
    acceptFiles: (workspace: string, paths: string[]): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:acceptFiles', workspace, paths),
    rejectFiles: (workspace: string, paths: string[]): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:rejectFiles', workspace, paths),
    acceptHunk: (workspace: string, path: string, hunkId: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:acceptHunk', workspace, path, hunkId),
    rejectHunk: (workspace: string, path: string, hunkId: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:rejectHunk', workspace, path, hunkId),
    acceptAll: (workspace: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:acceptAll', workspace),
    rejectAll: (workspace: string): Promise<ReviewResult> =>
      ipcRenderer.invoke('review:rejectAll', workspace),
    attachTurn: (workspace: string, turnId: string, conversationId: string): Promise<void> =>
      ipcRenderer.invoke('review:attachTurn', workspace, turnId, conversationId),
    onChanged: (onChanged: (evt: { workspace: string } & ReviewSnapshot) => void): (() => void) => {
      const listener = (
        _event: IpcRendererEvent,
        evt: { workspace: string } & ReviewSnapshot
      ): void => onChanged(evt)
      ipcRenderer.on('review:changed', listener)
      ipcRenderer.send('review:changed:start')
      return () => {
        ipcRenderer.removeListener('review:changed', listener)
        ipcRenderer.send('review:changed:stop')
      }
    }
  },

  // Second Brain (second-brain). install/update stream SkillEvents on a
  // start/event/stop channel trio (the installBmad/updateBmad pattern);
  // isProvisioned/getVault/stageRaw are plain invoke/response. Arg order
  // mirrors each `secondBrain:*` handler in main/index.ts.
  secondBrain: {
    install: (workspace: string, onEvent: (evt: SkillEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: SkillEvent): void => onEvent(evt)
      ipcRenderer.on('secondBrain:install:event', listener)
      ipcRenderer.send('secondBrain:install:start', workspace)
      return () => {
        ipcRenderer.removeListener('secondBrain:install:event', listener)
        ipcRenderer.send('secondBrain:install:stop')
      }
    },
    update: (workspace: string, onEvent: (evt: SkillEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: SkillEvent): void => onEvent(evt)
      ipcRenderer.on('secondBrain:update:event', listener)
      ipcRenderer.send('secondBrain:update:start', workspace)
      return () => {
        ipcRenderer.removeListener('secondBrain:update:event', listener)
        ipcRenderer.send('secondBrain:update:stop')
      }
    },
    isProvisioned: (workspace: string): Promise<boolean> =>
      ipcRenderer.invoke('secondBrain:isProvisioned', workspace),
    getVault: (workspace: string): Promise<VaultStatus> =>
      ipcRenderer.invoke('secondBrain:getVault', workspace),
    stageRaw: (workspace: string, content: string): Promise<{ relPath: string }> =>
      ipcRenderer.invoke('secondBrain:stageRaw', workspace, content),
    getHealth: (workspace: string): Promise<VaultHealth> =>
      ipcRenderer.invoke('secondBrain:getHealth', workspace),
    noteIngest: (workspace: string): Promise<VaultHealth> =>
      ipcRenderer.invoke('secondBrain:noteIngest', workspace),
    noteLint: (workspace: string): Promise<VaultHealth> =>
      ipcRenderer.invoke('secondBrain:noteLint', workspace),
    snoozeHealth: (workspace: string): Promise<VaultHealth> =>
      ipcRenderer.invoke('secondBrain:snoozeHealth', workspace)
  },

  // Whisper model store (D-SB-4). Transcription itself is renderer-local (the
  // model bytes cross via the `hive-model:` protocol, not IPC); only model-file
  // management lives here — and, since M26, the downloads that fetch them,
  // which are owned by main rather than by whichever window asked.
  whisper: {
    listModels: (): Promise<WhisperModelInfo[]> => ipcRenderer.invoke('whisper:listModels'),
    modelStatus: (
      id: WhisperModelId
    ): Promise<{ downloaded: boolean; variant: WhisperVariant | null }> =>
      ipcRenderer.invoke('whisper:modelStatus', id),
    deleteModel: (id: WhisperModelId): Promise<void> =>
      ipcRenderer.invoke('whisper:deleteModel', id),
    recommend: (): Promise<HardwareRecommendation> => ipcRenderer.invoke('whisper:recommend'),
    /** Which model transcription uses right now, and whether the app chose it. */
    preference: (): Promise<WhisperPreference> => ipcRenderer.invoke('whisper:preference'),
    /** Pins a model, or hands the choice back to the hardware probe with `null`. */
    setPreferredModel: (id: WhisperModelId | null): Promise<WhisperPreference> =>
      ipcRenderer.invoke('whisper:setPreferredModel', id),
    /**
     * Model downloads (M26) — **request/response plus a broadcast**, never a
     * subscription that owns the transfer.
     *
     * The previous shape made the renderer the owner: `downloadModel` opened a
     * listener and its teardown sent `whisper:download:stop`, so unmounting the
     * sheet killed the download it had started. Here `startDownload` is a plain
     * call that returns once the job is registered in main, and `onDownloads`
     * is a read-only view of every job in flight. Unsubscribing stops watching;
     * it never stops downloading. Cancelling is explicit, by id, which is also
     * what lets two models download at once.
     */
    downloads: (): Promise<WhisperDownload[]> => ipcRenderer.invoke('whisper:downloads'),
    startDownload: (id: WhisperModelId, variant: WhisperVariant): Promise<WhisperDownload> =>
      ipcRenderer.invoke('whisper:download:start', id, variant),
    cancelDownload: (id: WhisperModelId): Promise<void> =>
      ipcRenderer.invoke('whisper:download:cancel', id),
    /** Clears a settled (failed) row the user has acknowledged. */
    dismissDownload: (id: WhisperModelId): Promise<void> =>
      ipcRenderer.invoke('whisper:download:dismiss', id),
    onDownloads: (onSnapshot: (downloads: WhisperDownload[]) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, downloads: WhisperDownload[]): void =>
        onSnapshot(downloads)
      ipcRenderer.on('whisper:downloads', listener)
      return () => ipcRenderer.removeListener('whisper:downloads', listener)
    },
    /**
     * Endings, on their own channel.
     *
     * A finished download *leaves* the snapshot, so a renderer watching only
     * `onDownloads` cannot tell "it completed" from "it was cancelled" from
     * "this window just opened after it ended". The announcement has to be an
     * event, not a diff.
     */
    onDownloadSettled: (onSettled: (download: WhisperDownload) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, download: WhisperDownload): void =>
        onSettled(download)
      ipcRenderer.on('whisper:download:settled', listener)
      return () => ipcRenderer.removeListener('whisper:download:settled', listener)
    }
  }
}

// Template-provided helper API (kept for the scaffold's Versions.tsx, owned by
// T3). It wraps ipcRenderer generically and exposes safe process info
// (platform/versions/env) — no fs/child_process/require surface. `window.hive`
// above is the pattern all new, purpose-built IPC methods should use.
const api = {}

// contextIsolation is enforced (see src/main/index.ts webPreferences), so
// contextBridge is always available here — no non-isolated fallback branch.
try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
  contextBridge.exposeInMainWorld('hive', hive)
} catch (error) {
  console.error(error)
}
