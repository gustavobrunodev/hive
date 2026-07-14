import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createConfigStore } from './configStore'
import { createWorkspaceService } from './workspaceService'
import { createFsService, ConflictError, type FsChangeEvent } from './fsService'
import { createProcessRunner } from './processRunner'
import { createAgentRegistry } from './agentRegistry'
import { createAgentService } from './agentService'
import type { AgentEvent, SessionOpts, WorkflowCommand } from './agentAdapter'
import { createBmadService, type BmadInstallOptions } from './bmadService'
import { listWithDiscovery, listSkills } from './workflowCatalog'
import { resolveRoleActions } from './roleCatalog'

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
  ipcMain.handle('fs:readFile', async (_event, root: string, relativePath: string) =>
    fsService.readFile(root, relativePath)
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
  // agent-selection (AG-R1/R2): the adapter is chosen from a registry by the
  // globally-persisted selection (falling back to the default available adapter
  // for an unknown/unset id), instead of hardwiring the Claude adapter. The
  // registry is also queried by the `profile.agents` picker below.
  const agentRegistry = createAgentRegistry(processRunner)
  const agentService = createAgentService(
    agentRegistry,
    configStore.getAgent() ?? agentRegistry.defaultId()
  )

  ipcMain.handle('agent:capabilities', async () => agentService.capabilities())
  ipcMain.handle('agent:start', async (_event, opts: SessionOpts) => {
    agentService.startSession(opts)
  })
  ipcMain.handle('agent:send', async (_event, text: string) => {
    agentService.send(text)
  })
  ipcMain.handle('agent:runWorkflow', async (_event, cmd: WorkflowCommand) => {
    agentService.runWorkflow(cmd)
  })
  // T8 (WS-R5.2): explicit session teardown, called by Chat's unmount
  // cleanup so a switched-away-from workspace's session doesn't keep
  // running orphaned when no new session immediately replaces it.
  ipcMain.handle('agent:stop', async () => {
    agentService.stop()
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

  // WorkflowCatalog (T17): request/response, same shape as fs:listTree/
  // fs:readFile above — a one-shot list, not a stream. Exposed as
  // window.hive.workflows.list(workspace).
  ipcMain.handle('workflows:list', async (_event, workspace: string) =>
    listWithDiscovery(workspace)
  )

  // chat-controls (CC-R3.1): the full installed-skill list for the slash menu,
  // request/response like workflows:list. Exposed as window.hive.skills.list.
  ipcMain.handle('skills:list', async (_event, workspace: string) => listSkills(workspace))

  // Profile IPC (agent-selection + role-personalization) — the app-wide agent
  // and role preferences plus the resolved role action list. Grouped under
  // window.hive.profile.* in the preload bridge.
  ipcMain.handle('profile:agents', async () => agentRegistry.list())
  // Raw persisted selection (nullable) — the onboarding gate routes new users
  // through the required agent step precisely when this is null. The active
  // adapter still defaults safely (agentService resolves the id at construction).
  ipcMain.handle('profile:getAgent', async () => configStore.getAgent())
  ipcMain.handle('profile:setAgent', async (_event, id: string) => {
    // Only an available registered adapter may become active; the picker gates
    // on `available`, and setAdapter/registry.get are safe no-ops otherwise, so
    // a bad id neither persists nor re-binds (AG-R3.1 honesty).
    if (!agentRegistry.get(id)) return
    configStore.setAgent(id)
    agentService.setAdapter(id)
  })
  ipcMain.handle('profile:getRole', async () => configStore.getRole())
  ipcMain.handle('profile:setRole', async (_event, id: string) => {
    configStore.setRole(id)
  })
  ipcMain.handle('profile:roleActions', async (_event, role: string | null) =>
    resolveRoleActions(role)
  )

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
