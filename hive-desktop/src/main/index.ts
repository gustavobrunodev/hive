import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createConfigStore } from './configStore'
import { createWorkspaceService } from './workspaceService'
import { createFsService, type FsChangeEvent } from './fsService'
import { createProcessRunner } from './processRunner'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import { createAgentService } from './agentService'
import type { AgentEvent, SessionOpts, WorkflowCommand } from './agentAdapter'
import { createBmadService } from './bmadService'

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

  // FsService (T11): a single stateless instance (it takes `root` per call,
  // see fsService.ts) exposed as window.hive.{listTree,readFile,watchWorkspace}.
  const fsService = createFsService()

  ipcMain.handle('fs:listTree', async (_event, root: string, relativePath?: string) =>
    fsService.listTree(root, relativePath)
  )
  ipcMain.handle('fs:readFile', async (_event, root: string, relativePath: string) =>
    fsService.readFile(root, relativePath)
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
  const claudeCliAdapter = createClaudeCliAdapter(processRunner)
  const agentService = createAgentService(claudeCliAdapter)

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

  ipcMain.on('bmad:install:start', (event, workspace: string) => {
    activeInstallStops.get(event.sender.id)?.()
    let stopped = false
    void (async () => {
      for await (const bmadEvent of bmadService.install(workspace)) {
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
