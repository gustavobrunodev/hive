import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn } from 'child_process'
import { statSync } from 'fs'
import { basename, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import packageJson from '../../package.json'
import { createConfigStore } from './configStore'
import { createChatHistoryStore } from './chatHistoryStore'
import { createWorkspaceService } from './workspaceService'
import { createFsService, ConflictError, type FsChangeEvent } from './fsService'
import { createProcessRunner } from './processRunner'
import { createAgentRegistry } from './agentRegistry'
import { createAgentService } from './agentService'
import type {
  AgentEvent,
  AttachmentPick,
  SessionOpts,
  TurnOpts,
  WorkflowCommand
} from './agentAdapter'
import { createBmadService, type BmadInstallOptions } from './bmadService'
import { listWithDiscovery } from './workflowCatalog'
import { listCatalogWithCreated, listCreatedSkills, listSkillsWithCreated } from './skillStudio'
import { createMcpService, type McpServerConfig } from './mcpService'
import { mcpProbe } from './mcpProbe'
import { resolveRoleActions, resolveShortcuts } from './roleCatalog'
import { sanitizeShortcutPrefs } from './configStore'
import {
  createRegistryClient,
  createDownloader,
  createUpdateService,
  type AppInfo
} from './updateService'

// T3 (UX-R7.3): protocols window.hive.openExternal is allowed to hand to
// shell.openExternal — see the ipcMain.handle('shell:openExternal', ...)
// registration below for the full rationale.
const OPEN_EXTERNAL_ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: request/response round trip for window.hive.ping()
  ipcMain.handle('ping', async () => 'pong')

  // openExternal (T3, UX-R7.3): the only way the renderer can hand the OS a
  // link to open (e.g. a link inside markdown/HTML preview, T4/T5) — it's a
  // sandboxed BrowserWindow with nodeIntegration off, so it has no direct
  // route to shell.openExternal without this bridge. Only `http:`/`https:`/
  // `mailto:` URLs are forwarded; anything else (`file:`, `javascript:`, or
  // an unparseable string) throws instead of reaching shell.openExternal, so
  // the renderer can never use this as a way to open local files or run
  // script URLs. Exposed to the renderer as window.hive.openExternal.
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error(`openExternal: invalid URL: ${url}`)
    }
    if (!OPEN_EXTERNAL_ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`openExternal: unsupported protocol: ${parsed.protocol}`)
    }
    await shell.openExternal(url)
  })

  // WorkspaceService (T5): a single ConfigStore instance backed by the
  // per-user data dir, wrapped for workspace-picker/read operations and
  // exposed to the renderer as window.hive.{chooseWorkspace,getWorkspace,isProvisioned}.
  const configStore = createConfigStore(app.getPath('userData'))
  // Adapter closure (rather than passing `dialog` straight through): Electron's
  // `dialog.showOpenDialog` is overloaded (an optional BrowserWindow first
  // arg), which doesn't structurally match the single-argument `DialogLike`
  // workspaceService.ts declares to stay Electron-import-free. This one-line
  // wrapper calls the options-only overload, satisfying `DialogLike` without
  // loosening its type or importing Electron's types into workspaceService.ts.
  const workspaceService = createWorkspaceService(configStore, {
    showOpenDialog: (options) =>
      dialog.showOpenDialog(options as Parameters<typeof dialog.showOpenDialog>[0])
  })

  ipcMain.handle('workspace:choose', async () => workspaceService.chooseWorkspace())
  ipcMain.handle('workspace:get', async () => workspaceService.getWorkspace())
  ipcMain.handle('workspace:isProvisioned', async () => workspaceService.isProvisioned())
  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching methods, following the
  // exact synchronous-delegate-wrapped-in-async-handle pattern above.
  ipcMain.handle('workspace:provisionState', async (_event, path: string) =>
    workspaceService.provisionState(path)
  )
  ipcMain.handle('workspace:recents', async () => workspaceService.getRecentWorkspaces())
  ipcMain.handle('workspace:open', async (_event, path: string) =>
    workspaceService.openWorkspace(path)
  )

  // FsService (T11/T6): a single stateless instance (it takes `root` per
  // call, see fsService.ts) exposed as
  // window.hive.{listTree,readFile,watchWorkspace,statFile,createFile,
  // createDirectory,saveFile,move,importEntry,exists,trash}. `trashItem` is
  // injected here (rather than fsService.ts importing `electron` directly)
  // so fsService.ts stays Electron-free and testable with a fake — see its
  // FsServiceDeps doc comment.
  const fsService = createFsService({ trashItem: (abs) => shell.trashItem(abs) })

  ipcMain.handle('fs:listTree', async (_event, root: string, relativePath?: string) =>
    fsService.listTree(root, relativePath)
  )
  // chat-attachments: flat file list feeding the composer's `#` mention menu.
  ipcMain.handle('fs:listFiles', async (_event, root: string) => fsService.listFiles(root))
  ipcMain.handle('fs:readFile', async (_event, root: string, relativePath: string) =>
    fsService.readFile(root, relativePath)
  )
  // Rich file viewer (docx/pptx/spreadsheet/pdf/image): parsing happens here
  // in the main process — full Node access, no renderer CSP/worker limits —
  // and only the already-shaped result crosses the IPC boundary.
  ipcMain.handle('fs:readBinary', async (_event, root: string, relativePath: string) =>
    fsService.readBinary(root, relativePath)
  )
  ipcMain.handle('fs:readDocx', async (_event, root: string, relativePath: string) =>
    fsService.readDocx(root, relativePath)
  )
  ipcMain.handle('fs:readSheet', async (_event, root: string, relativePath: string) =>
    fsService.readSheet(root, relativePath)
  )
  ipcMain.handle('fs:readSlides', async (_event, root: string, relativePath: string) =>
    fsService.readSlides(root, relativePath)
  )

  // Design §2's "prefix approach": `ipcMain.handle` only preserves an Error's
  // `message`/`name` across the structured-clone boundary to the renderer —
  // custom properties like `ConflictError.code` are dropped. Rather than
  // JSON-encoding the error (more ceremony, and this codebase has no
  // precedent for that), a handler that can throw `ConflictError` is wrapped
  // so it rethrows a plain `Error` whose message is prefixed with
  // `CONFLICT:`/`STALE:` (matching `ConflictError.code`) — the preload bridge
  // (T7) parses that prefix back into a typed rejection for the renderer.
  function withConflictPrefix<Args extends unknown[], R>(
    handler: (...args: Args) => R | Promise<R>
  ): (...args: Args) => Promise<R> {
    return async (...args: Args) => {
      try {
        return await handler(...args)
      } catch (err) {
        if (err instanceof ConflictError) {
          throw new Error(`${err.code}: ${err.message}`)
        }
        throw err
      }
    }
  }

  ipcMain.handle('fs:statFile', async (_event, root: string, relativePath: string) =>
    fsService.statFile(root, relativePath)
  )
  ipcMain.handle(
    'fs:createFile',
    withConflictPrefix(
      async (_event: unknown, root: string, relativePath: string, opts?: { overwrite?: boolean }) =>
        fsService.createFile(root, relativePath, opts)
    )
  )
  ipcMain.handle('fs:createDirectory', async (_event, root: string, relativePath: string) =>
    fsService.createDirectory(root, relativePath)
  )
  ipcMain.handle(
    'fs:saveFile',
    withConflictPrefix(
      async (
        _event: unknown,
        root: string,
        relativePath: string,
        content: string,
        opts?: { expectedMtimeMs?: number }
      ) => fsService.saveFile(root, relativePath, content, opts)
    )
  )
  ipcMain.handle(
    'fs:move',
    withConflictPrefix(
      async (
        _event: unknown,
        root: string,
        fromRel: string,
        toRel: string,
        opts?: { overwrite?: boolean }
      ) => fsService.move(root, fromRel, toRel, opts)
    )
  )
  ipcMain.handle(
    'fs:importEntry',
    withConflictPrefix(
      async (
        _event: unknown,
        root: string,
        sourceAbs: string,
        destRel: string,
        opts?: { overwrite?: boolean }
      ) => fsService.importEntry(root, sourceAbs, destRel, opts)
    )
  )
  ipcMain.handle('fs:exists', async (_event, root: string, relativePath: string) =>
    fsService.exists(root, relativePath)
  )
  ipcMain.handle('fs:trash', async (_event, root: string, relativePath: string) =>
    fsService.trash(root, relativePath)
  )

  // Streaming IPC for watchWorkspace — the first of its kind in this
  // codebase (ongoing change events rather than one request/response), so
  // documented in more detail than the request/response handlers above.
  // Channels:
  //   'fs:watch:start' (renderer -> main, fire-and-forget): begin watching `root`.
  //   'fs:watch:event'  (main -> renderer, fire-and-forget, repeated): one FsChangeEvent per fs change.
  //   'fs:watch:stop'  (renderer -> main, fire-and-forget): tear down the watcher.
  // Keyed by `event.sender.id` (the requesting WebContents) rather than a
  // single module-level variable, so each renderer window gets its own
  // watcher lifecycle and a stray stop/start from one window can't affect
  // another. Starting a new watch for a sender that already has one first
  // tears down the old one, so repeated starts (e.g. workspace switches)
  // can't leak watchers.
  const activeWatchStops = new Map<number, () => void>()

  ipcMain.on('fs:watch:start', (event, root: string) => {
    activeWatchStops.get(event.sender.id)?.()
    const stop = fsService.watchWorkspace(root, (change: FsChangeEvent) => {
      event.sender.send('fs:watch:event', change)
    })
    activeWatchStops.set(event.sender.id, stop)
  })

  ipcMain.on('fs:watch:stop', (event) => {
    activeWatchStops.get(event.sender.id)?.()
    activeWatchStops.delete(event.sender.id)
  })

  // AgentService (T14): a single ClaudeCliAdapter (the MVP's sole
  // AgentAdapter, C1) backed by a real (spawn-based) ProcessRunner, wrapped
  // by AgentService to own the active session. Exposed to the renderer as
  // window.hive.agent.{capabilities,start,send,runWorkflow,onEvent}.
  const processRunner = createProcessRunner()
  // multi-agent: the registry holds every real adapter (Claude, Copilot,
  // Devin); availability is detected per machine by `registry.detect()` (queried
  // by the `profile.agents` picker below). `AgentService` runs a pool of
  // sessions — one per agent — so several agents can drive different
  // conversations concurrently. Each turn names its `agentId`; the service
  // routes it (and lazily starts that agent's session).
  const agentRegistry = createAgentRegistry(processRunner)
  const agentService = createAgentService(agentRegistry)

  // chat-attachments (R6.5/T16): native multi-file picker for the composer's
  // attach button. Name/size are resolved here (not in the renderer) because
  // the sandboxed renderer only ever sees the returned metadata — it can't
  // stat arbitrary host paths. A canceled dialog resolves to []. The picker
  // opens inside the active workspace (`defaultPath`) — that's where the
  // files a user attaches as context almost always live.
  ipcMain.handle(
    'chat:chooseAttachments',
    async (_event, defaultPath?: string): Promise<AttachmentPick[]> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        ...(defaultPath ? { defaultPath } : {})
      })
      if (result.canceled) return []
      return result.filePaths.map((filePath) => {
        let size = 0
        try {
          size = statSync(filePath).size
        } catch {
          // File vanished between pick and stat — keep it listed; the agent
          // will surface the read failure if it's truly gone.
        }
        return { path: filePath, name: basename(filePath), size }
      })
    }
  )

  ipcMain.handle('agent:capabilities', async (_event, agentId?: string) =>
    agentService.capabilities(agentId)
  )
  ipcMain.handle('agent:start', async (_event, opts: SessionOpts) => {
    agentService.startSession(opts)
  })
  ipcMain.handle('agent:send', async (_event, text: string, opts?: TurnOpts) => {
    agentService.send(text, opts)
  })
  ipcMain.handle('agent:runWorkflow', async (_event, cmd: WorkflowCommand, opts?: TurnOpts) => {
    agentService.runWorkflow(cmd, opts)
  })
  // T8 (WS-R5.2): explicit session teardown, called by Chat's unmount
  // cleanup so a switched-away-from workspace's session doesn't keep
  // running orphaned when no new session immediately replaces it.
  ipcMain.handle('agent:stop', async () => {
    agentService.stop()
  })
  // chat-controls CC-R1 via session-history: the Stop button interrupts one
  // in-flight turn — background-turns keep streaming — and the session stays
  // alive (see AgentService.interrupt's doc for why this must not be
  // 'agent:stop').
  ipcMain.handle('agent:interrupt', async (_event, turnId?: string) => {
    agentService.interrupt(turnId)
  })

  // Streaming IPC for agent events — same channel-pattern as fs:watch:* above
  // (see its comment for the full rationale): a start/stop pair of
  // renderer -> main fire-and-forget sends, one main -> renderer event
  // channel repeated per event, keyed by `event.sender.id` so each window
  // gets its own subscription and a stray start/stop from one window can't
  // affect another. Starting a new subscription for a sender that already
  // has one first tears down the old one, so repeated starts (e.g. the
  // renderer resubscribing after starting a new session) can't leak
  // subscriptions.
  //   'agent:event:start' (renderer -> main, fire-and-forget): subscribe to the active session's events.
  //   'agent:event'        (main -> renderer, fire-and-forget, repeated): one AgentEvent per stream event.
  //   'agent:event:stop'  (renderer -> main, fire-and-forget): unsubscribe.
  const activeAgentEventUnsubs = new Map<number, () => void>()

  ipcMain.on('agent:event:start', (event) => {
    activeAgentEventUnsubs.get(event.sender.id)?.()
    const unsubscribe = agentService.onEvent((agentEvent: AgentEvent) => {
      event.sender.send('agent:event', agentEvent)
    })
    activeAgentEventUnsubs.set(event.sender.id, unsubscribe)
  })

  ipcMain.on('agent:event:stop', (event) => {
    activeAgentEventUnsubs.get(event.sender.id)?.()
    activeAgentEventUnsubs.delete(event.sender.id)
  })

  // BmadService (T8/T9): reuses the same ProcessRunner as AgentService above
  // (both are just uniform spawn/stream/kill — no shared state between
  // calls). install() is an async generator, so this follows the same
  // streaming pattern as fs:watch:*/agent:event:* — except cancellation
  // needs an explicit `stopped` flag checked inside the loop (there's no
  // underlying subscription to tear down like the other two, just an
  // in-flight `for await`).
  //   'bmad:install:start' (renderer -> main, fire-and-forget): begin installing into `workspace`.
  //   'bmad:install:event' (main -> renderer, fire-and-forget, repeated): one BmadEvent per install-progress event.
  //   'bmad:install:stop'  (renderer -> main, fire-and-forget): stop forwarding further events.
  const bmadService = createBmadService(processRunner, configStore)
  const activeInstallStops = new Map<number, () => void>()

  ipcMain.on('bmad:install:start', (event, workspace: string, options: BmadInstallOptions) => {
    activeInstallStops.get(event.sender.id)?.()
    // The install form's "what should the agents call you?" answer doubles as
    // the app-wide display name (greetings, profile) — persist it here so the
    // setup name and the profile name are one and the same field.
    if (typeof options?.userName === 'string' && options.userName.trim() !== '') {
      configStore.setUserName(options.userName)
    }
    let stopped = false
    void (async () => {
      for await (const bmadEvent of bmadService.install(workspace, options)) {
        if (stopped) return
        event.sender.send('bmad:install:event', bmadEvent)
      }
    })()
    activeInstallStops.set(event.sender.id, () => {
      stopped = true
    })
  })

  ipcMain.on('bmad:install:stop', (event) => {
    activeInstallStops.get(event.sender.id)?.()
    activeInstallStops.delete(event.sender.id)
  })

  // BmadService.update() (T10): identical streaming shape to bmad:install:*
  // above, on separate channels since a renderer could (in principle) have
  // both an install and an update in flight for different reasons — kept
  // fully independent rather than trying to unify into one parameterized
  // channel.
  const activeUpdateStops = new Map<number, () => void>()

  ipcMain.on('bmad:update:start', (event, workspace: string) => {
    activeUpdateStops.get(event.sender.id)?.()
    let stopped = false
    void (async () => {
      for await (const bmadEvent of bmadService.update(workspace)) {
        if (stopped) return
        event.sender.send('bmad:update:event', bmadEvent)
      }
    })()
    activeUpdateStops.set(event.sender.id, () => {
      stopped = true
    })
  })

  ipcMain.on('bmad:update:stop', (event) => {
    activeUpdateStops.get(event.sender.id)?.()
    activeUpdateStops.delete(event.sender.id)
  })

  // ChatHistoryStore (session-history): request/response, same
  // synchronous-delegate-wrapped-in-async-handle shape as the workspace
  // handlers above. Persists conversations in the per-user data dir keyed by
  // workspace — exposed as window.hive.chatHistory.*.
  const chatHistoryStore = createChatHistoryStore(app.getPath('userData'))

  ipcMain.handle('chatHistory:list', async (_event, workspace: string) =>
    chatHistoryStore.list(workspace)
  )
  ipcMain.handle('chatHistory:get', async (_event, workspace: string, id: string) =>
    chatHistoryStore.get(workspace, id)
  )
  ipcMain.handle('chatHistory:create', async (_event, workspace: string, agent: string | null) =>
    chatHistoryStore.create(workspace, agent)
  )
  ipcMain.handle(
    'chatHistory:append',
    async (
      _event,
      workspace: string,
      id: string,
      message: { role: 'user' | 'assistant'; text: string; attachments?: string[] }
    ) => chatHistoryStore.appendMessage(workspace, id, message)
  )
  ipcMain.handle(
    'chatHistory:rename',
    async (_event, workspace: string, id: string, title: string) =>
      chatHistoryStore.rename(workspace, id, title)
  )
  ipcMain.handle(
    'chatHistory:setCliSession',
    async (_event, workspace: string, id: string, cliSessionId: string) =>
      chatHistoryStore.setCliSession(workspace, id, cliSessionId)
  )
  ipcMain.handle('chatHistory:search', async (_event, workspace: string, query: string) =>
    chatHistoryStore.search(workspace, query)
  )
  ipcMain.handle('chatHistory:delete', async (_event, workspace: string, id: string) =>
    chatHistoryStore.remove(workspace, id)
  )

  // WorkflowCatalog (T17): request/response, same shape as fs:listTree/
  // fs:readFile above — a one-shot list, not a stream. Exposed as
  // window.hive.workflows.list(workspace).
  ipcMain.handle('workflows:list', async (_event, workspace: string) =>
    listWithDiscovery(workspace)
  )

  // chat-controls (CC-R3.1): the full installed-skill list for the slash menu,
  // request/response like workflows:list. Exposed as window.hive.skills.list.
  // skill-studio: user-created skills are appended, so `/minha-skill`
  // autocompletes as soon as the builder finishes it.
  ipcMain.handle('skills:list', async (_event, workspace: string) =>
    listSkillsWithCreated(workspace)
  )

  // Skill studio (skill-studio): the user-created skills of a workspace —
  // request/response like skills:list. Exposed as window.hive.studio.list.
  ipcMain.handle('studio:list', async (_event, workspace: string) => listCreatedSkills(workspace))

  // MCP module (mcp): the workspace's Model Context Protocol servers —
  // catalog (`.mcp.json`), enabled state (`.claude/settings.local.json`), and
  // a live connection probe (status + tools + logs). Grouped under
  // window.hive.mcp.* in the preload bridge. Writes/probe surface their
  // Error.message to the renderer (the DS §2 prefix rule keeps it intact).
  const mcpService = createMcpService({ probe: mcpProbe })
  ipcMain.handle('mcp:list', async (_event, workspace: string) => mcpService.list(workspace))
  ipcMain.handle(
    'mcp:add',
    async (_event, workspace: string, name: string, config: McpServerConfig) =>
      mcpService.add(workspace, name, config)
  )
  ipcMain.handle(
    'mcp:update',
    async (
      _event,
      workspace: string,
      originalName: string,
      name: string,
      config: McpServerConfig
    ) => mcpService.update(workspace, originalName, name, config)
  )
  ipcMain.handle('mcp:remove', async (_event, workspace: string, name: string) =>
    mcpService.remove(workspace, name)
  )
  ipcMain.handle(
    'mcp:setEnabled',
    async (_event, workspace: string, name: string, enabled: boolean) =>
      mcpService.setEnabled(workspace, name, enabled)
  )
  ipcMain.handle('mcp:probe', async (_event, workspace: string, name: string) =>
    mcpService.probe(workspace, name)
  )

  // Profile IPC (agent-selection + role-personalization) — the app-wide agent
  // and role preferences plus the resolved role action list. Grouped under
  // window.hive.profile.* in the preload bridge.
  // multi-agent: the picker's source of truth — probes each CLI on this machine
  // and returns availability + install hints for the disabled ("como instalar")
  // cards. Detection is cached in the registry after the first probe.
  ipcMain.handle('profile:agents', async () => agentRegistry.detect())
  // The user's **default** agent (new conversations start on it); nullable — the
  // onboarding gate routes new users through the required agent step when null.
  ipcMain.handle('profile:getAgent', async () => configStore.getAgent())
  ipcMain.handle('profile:setAgent', async (_event, id: string) => {
    // Only a registered agent may become the default (a bad id is a no-op).
    if (!agentRegistry.get(id)) return
    configStore.setAgent(id)
  })
  // The **enabled** set (multi-agent): which agents the composer switcher offers.
  ipcMain.handle('profile:getAgents', async () => configStore.getEnabledAgents())
  ipcMain.handle('profile:setAgents', async (_event, ids: string[]) => {
    // Keep only registered ids; setEnabledAgents also keeps the default coherent.
    const valid = Array.isArray(ids) ? ids.filter((id) => agentRegistry.get(id)) : []
    configStore.setEnabledAgents(valid)
  })
  ipcMain.handle('profile:getRole', async () => configStore.getRole())
  ipcMain.handle('profile:setRole', async (_event, id: string) => {
    configStore.setRole(id)
  })
  // Display name (set in the install form, editable in the profile sheet).
  ipcMain.handle('profile:getUserName', async () => configStore.getUserName())
  ipcMain.handle('profile:setUserName', async (_event, name: string | null) => {
    configStore.setUserName(name)
  })
  ipcMain.handle('profile:roleActions', async (_event, role: string | null) =>
    resolveRoleActions(role)
  )

  // Shortcut customization (shortcut-customization): the full workspace skill
  // catalog (workflows + specialist agents), the persisted custom selection,
  // and the resolved shortcut set the hero/strip actually render. Grouped
  // under window.hive.shortcuts.* in the preload bridge.
  // skill-studio: the catalog includes user-created skills (`custom: true`),
  // so creations are pinnable the moment they land on disk.
  ipcMain.handle('shortcuts:catalog', async (_event, workspace: string) =>
    listCatalogWithCreated(workspace)
  )
  ipcMain.handle('shortcuts:get', async () => configStore.getShortcuts())
  // Renderer input crosses the IPC boundary sanitized (`null` restores the
  // role defaults) — the store re-applies the same rule defensively.
  ipcMain.handle('shortcuts:set', async (_event, prefs: unknown) =>
    configStore.setShortcuts(sanitizeShortcutPrefs(prefs))
  )
  ipcMain.handle('shortcuts:actions', async (_event, role: string | null, workspace: string) =>
    resolveShortcuts(role, configStore.getShortcuts(), await listCatalogWithCreated(workspace))
  )

  // UpdateService (npm-distribution, ND-C5): the app's own version +
  // self-update flow, driven from the renderer's app-settings sheet — backed
  // by the public npm registry (npmRegistry.ts/updateDownload.ts/
  // updateApply.ts). `updatesSupported` still mirrors `app.isPackaged`
  // (dev/unpacked builds can't self-update) and the renderer explains
  // instead of failing. The event stream follows the exact agent:event:*
  // channel pattern above.
  //   'update:event:start' (renderer -> main, fire-and-forget): subscribe.
  //   'update:event'        (main -> renderer, fire-and-forget, repeated): one UpdateEvent per transition.
  //   'update:event:stop'  (renderer -> main, fire-and-forget): unsubscribe.
  const updateService = createUpdateService({
    registryClient: createRegistryClient(),
    downloader: createDownloader(),
    // `spawn` needs no `this` and is passed as-is; `app.quit` is a real
    // Electron object method (needs `app` as `this`), so `.bind(app)` gives a
    // correctly-bound reference without introducing a new function literal
    // here that only a real Windows apply run would ever invoke.
    applyDeps: { spawn, quit: app.quit.bind(app) },
    // The npm package to query for the `latest` release — this app's own
    // published name (package.json's `name`, still the ND-B1 placeholder
    // until the real npm scope is known). Deliberately NOT `app.getName()`:
    // `electron-builder.yml` sets `productName: hive-desktop`, and Electron
    // prefers `productName` over `name` for `app.getName()` once packaged —
    // that's the friendly display name electron-builder bakes in for
    // window/installer branding, unrelated to (and not equal to) the scoped
    // npm registry identity this needs.
    packageName: packageJson.name,
    currentVersion: app.getVersion(),
    platform: process.platform,
    stagingRoot: join(app.getPath('userData'), 'updates'),
    supported: app.isPackaged
  })

  ipcMain.handle('app:info', async (): Promise<AppInfo> => ({
    name: app.getName(),
    version: app.getVersion(),
    updatesSupported: app.isPackaged,
    canApply: updateService.getCanApply(),
    lastCheckedAt: updateService.getLastCheckedAt()
  }))
  // `explicit` defaults to true: today's only caller is the settings sheet's
  // manual "Verificar" button (ND-R2.3's explicit-request path). The
  // parameter already exists on this channel (rather than adding a second
  // channel later) so a future silent launch/periodic check (T14) can invoke
  // this exact same handler with `false` once the renderer grows that timer
  // — no new IPC surface needed for it.
  ipcMain.handle('update:check', async (_event, explicit?: boolean) =>
    updateService.check(explicit ?? true)
  )
  ipcMain.handle('update:download', async () => updateService.download())
  ipcMain.handle('update:install', async () => updateService.install())
  // ND-R3.4: cancels an in-flight download; a no-op if nothing is downloading.
  ipcMain.handle('update:cancel', async () => updateService.cancel())
  // ND-R4.3: reveals the last-downloaded installer in the OS file manager —
  // the manual path on platforms without an apply strategy (and a fallback
  // even on Windows, e.g. "Abrir instalador" after an apply failure keeps the
  // installer around, ND-R4.4). A no-op if nothing has been downloaded yet.
  ipcMain.handle('update:reveal', async () => {
    const installerPath = updateService.getInstallerPath()
    if (installerPath !== null) shell.showItemInFolder(installerPath)
  })
  // ND-R5.4: persists a version the user explicitly chose to skip — checked
  // by the renderer (T14) before announcing, never re-nagged, but still
  // reachable from the update surface ("Instalar mesmo assim", ND-R5.5).
  ipcMain.handle('update:skip', async (_event, version: string) => {
    configStore.setSkippedUpdateVersion(version)
  })

  const activeUpdateEventUnsubs = new Map<number, () => void>()

  ipcMain.on('update:event:start', (event) => {
    activeUpdateEventUnsubs.get(event.sender.id)?.()
    const unsubscribe = updateService.onEvent((updateEvent) => {
      event.sender.send('update:event', updateEvent)
    })
    activeUpdateEventUnsubs.set(event.sender.id, unsubscribe)
  })

  ipcMain.on('update:event:stop', (event) => {
    activeUpdateEventUnsubs.get(event.sender.id)?.()
    activeUpdateEventUnsubs.delete(event.sender.id)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
