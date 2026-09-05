import {
  app,
  shell,
  BrowserWindow,
  clipboard,
  ipcMain,
  dialog,
  Notification,
  screen,
  session,
  utilityProcess
} from 'electron'
import { spawn } from 'child_process'
import { statSync } from 'fs'
import { basename, join, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import packageJson from '../../package.json'
import { APP_ID, APP_NAME } from './appIdentity'
import { createConfigStore } from './configStore'
import { migrateUserData } from './userDataMigration'
import { createChatHistoryStore, type StoredCompaction } from './chatHistoryStore'
import { createWorkspaceService } from './workspaceService'
import { createFsService, ConflictError, type FsChangeEvent } from './fsService'
import { createProcessRunner } from './processRunner'
import { createGitService, GitError, type GitDiffSide } from './gitService'
import { createGitCommandLog, type GitCommandEntry } from './gitCommandLog'
import { createCheckpointService } from './checkpointService'
import { createReviewService, type ReviewSnapshot } from './reviewService'
import { createAgentRegistry } from './agentRegistry'
import { createAwsAuthService, type AwsLoginState } from './awsAuthService'
import { reconcileAgents } from './agentAdoption'
import { createShellService, type ShellService } from './shellService'
import type { ShellInfo } from './shellCatalog'
import { createAgentInstaller } from './agentInstaller'
import { createAgentService } from './agentService'
import { createApprovalService } from './approvalService'
import { grantAgentPermission } from './agentPermissions'
import { withScriptedAgentCli } from './e2eAgentSeam'
import type {
  AgentEvent,
  ApprovalDecision,
  AttachmentPick,
  SessionOpts,
  TurnOpts,
  WorkflowCommand
} from './agentAdapter'
import { createBmadService, type BmadInstallOptions } from './bmadService'
import { createSecondBrainService } from './secondBrainService'
import { createSecondBrainVault } from './secondBrainVault'
import { createSecondBrainHealthStore } from './secondBrainHealth'
import { createAsrModelStore } from './asr/asrModelStore'
import { createAsrDownloadManager } from './asr/asrDownloads'
import { autoDownloadOnStartup } from './asr/asrAutoDownload'
import { asrDownloadNotification } from './osNotificationCopy'
import { FALLBACK_THREADS, probeRuntime } from './asr/asrHardware'
import { createAsrEngine } from './asr/asrProcess'
import { sherpaModuleSpecifier } from './asr/asrAddon'
import { ASR_MODELS_DIRNAME } from './asr/asrPaths'
import { measureLegacyModels, removeLegacyModels } from './asr/legacyModels'
import type { AsrDownload, AsrModelId, AsrReadiness, AsrRuntimeProfile } from './asr/asrTypes'
import { listWithDiscovery } from './workflowCatalog'
import { listCatalogWithCreated, listCreatedSkills, listSkillsWithCreated } from './skillStudio'
import { createMcpService, type McpServerConfig } from './mcpService'
import { mcpProbe } from './mcpProbe'
import { createMcpLogService, type McpLogQuery } from './mcpLogService'
import { resolveAllShortcuts, resolveRoleActions } from './roleCatalog'
import { isShortcutScope, sanitizeEnginePin, sanitizeShortcutPrefs } from './configStore'
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

/**
 * Opens the window filling the screen, treating `maximize()` as a *request*
 * rather than a result.
 *
 * On WSLg (Electron's window manager on WSL2 is Weston in RAIL mode)
 * `maximize()` is accepted at the protocol level — the window's
 * `_NET_WM_STATE` gains the MAXIMIZED_VERT/HORZ atoms and `isMaximized()`
 * returns true — but it is resized to a fixed ~1012x687 whatever the display
 * measures. Because the window then *believes* it is maximized, the titlebar's
 * maximize button only toggles that bogus state, so it can't be filled by hand
 * either. Measured on that host: workArea 1920x1080, bounds 1012x687.
 *
 * The correction has to wait for the WM's own resize to land: Weston applies
 * its (wrong) geometry asynchronously, so bounds set synchronously after
 * `maximize()` are simply overwritten a frame later. Hence the check hangs off
 * the first `resize` — there, the WM has committed and an explicit `setBounds`
 * sticks, keeping the real maximized state intact.
 *
 * On Windows/macOS/normal Linux DEs that same resize reports the work area
 * already covered, the guard is false, and nothing is touched. `isMaximized()`
 * additionally scopes this to the maximize path: a window the user resized by
 * hand is un-maximized first, so a later resize can never snap back to full
 * screen.
 */
function fillWorkArea(window: BrowserWindow): void {
  window.once('resize', () => {
    if (!window.isMaximized()) return
    const { workArea } = screen.getDisplayMatching(window.getBounds())
    const { width, height } = window.getBounds()
    if (width < workArea.width * 0.9 || height < workArea.height * 0.9) {
      window.setBounds(workArea)
    }
  })
  window.maximize()
}

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
    // The 900x670 above is only the *restored* size: the app's shell (rail +
    // chat + viewer) needs the whole screen to be usable, so the window opens
    // filling the work area. F11 (the default menu's accelerator) still toggles
    // real fullscreen.
    mainWindow.show()
    fillWorkArea(mainWindow)
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

// The app declares no privileged scheme. `hive-model:` used to be declared
// here: it existed for one reason: the sandboxed renderer ran the
// transcription model itself and could not fetch its own weights, so main had
// to serve them over a privileged scheme. With inference in a utility process
// (M29) the renderer never sees a weight file, and the safest scheme is the
// one that does not exist.

// The product is called Hive. Packaged, `electron-builder.yml`'s `productName`
// already tells Electron that; in dev the name would fall out of package.json's
// scoped npm identity instead, so `userData` — and every store in it — would
// live somewhere else than in the shipped app. Set it here so the two runs are
// the same app, and set it BEFORE the first `getPath('userData')`: Electron
// resolves that path from `app.name` on first use and caches it.
app.setName(APP_NAME)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // The rename moved `userData`; carry the previous one over before anything
  // reads from it. First statement in `whenReady` by necessity — every store
  // below loads its file in its constructor.
  const migration = migrateUserData(app.getPath('userData'))
  if (migration.moved) {
    console.info(`[hive] migrated ${migration.entries} entries of user data from ${migration.from}`)
  }

  // The AppUserModelID is what Windows uses to group taskbar buttons, attach
  // jump lists and match a running window to its shortcut. It must equal the
  // installer's `appId` or the pinned shortcut and the running app read as two
  // different programs.
  electronApp.setAppUserModelId(APP_ID)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Second Brain recorder (SB-R5.1): a sandboxed renderer's getUserMedia() is
  // refused unless main answers the permission request. Only `media` is
  // granted, and only to our own renderer — every other permission (geolocation,
  // notifications, midi, …) is denied outright rather than left to Electron's
  // default, so adding the microphone doesn't widen anything else.
  //
  // `clipboard-sanitized-write` rides along for a different reason: with the
  // deny-everything default, `navigator.clipboard.writeText()` rejects with
  // `NotAllowedError: Write permission denied` — which is what made every
  // "Copiar caminho" in the Explorer surface "Não foi possível concluir a
  // ação". Our own copies go through the `clipboard:writeText` bridge below
  // (main's clipboard needs no permission and no focused document), but any
  // web-API copy — a design-system component, a future surface — has to work
  // too, and *sanitized* write is the narrow half of the pair: it can put text
  // on the clipboard, never read what is already there (`clipboard-read` stays
  // denied, so nothing here can look at what the user copied elsewhere).
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media' || permission === 'clipboard-sanitized-write')
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
  // chat-attachments: flat file list feeding the composer's `@` mention menu.
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
  // file-clipboard: an in-workspace copy (Ctrl+C / Ctrl+V on a tree row). The
  // move/import pair could not cover it — `move` relocates instead of
  // duplicating, and `importEntry` takes an absolute *outside* source, so
  // pasting through it would mean handing the renderer a real OS path and
  // trusting it back. Both ends `resolveSafe`-checked, same as `move`.
  ipcMain.handle(
    'fs:copyEntry',
    withConflictPrefix(
      async (
        _event: unknown,
        root: string,
        fromRel: string,
        toRel: string,
        opts?: { overwrite?: boolean }
      ) => fsService.copyEntry(root, fromRel, toRel, opts)
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
  ipcMain.handle('fs:absolutePath', async (_event, root: string, relativePath: string) =>
    fsService.absolutePathFor(root, relativePath)
  )
  // file-clipboard: the renderer's only reliable way onto the system
  // clipboard. `navigator.clipboard.writeText()` is refused in this window
  // (see the permission handler above) and, even once permitted, requires a
  // focused document — which a copy fired from a menu that is closing cannot
  // guarantee. Electron's own `clipboard` has neither constraint. Text only:
  // this bridge writes, never reads, so it can't be used to exfiltrate what
  // the user copied somewhere else.
  ipcMain.handle('clipboard:writeText', async (_event, text: string): Promise<void> => {
    clipboard.writeText(String(text))
  })

  // explorer-os-actions: hands a workspace path to the host's file manager —
  // Explorer on Windows, Finder on macOS, whatever `xdg-open` resolves to on
  // Linux. Two verbs, because they are what the OS itself distinguishes: a
  // *file* is revealed with its parent open and the item highlighted
  // (`showItemInFolder`), a *directory* is opened as the window's own target
  // (`openPath`) — revealing a folder would show its parent instead, which is
  // never what "open this folder" means.
  //
  // Routed through `fsService.absolutePathFor` rather than taking an absolute
  // path from the renderer: this is a bridge that makes the OS open something,
  // so the workspace-escape check is the whole point of it. `''` is the
  // workspace root itself (the empty-area menu), which resolves to `root` and
  // passes the check like any other in-tree path.
  ipcMain.handle(
    'shell:revealPath',
    async (_event, root: string, relativePath: string, isDir: boolean): Promise<void> => {
      const absolute = fsService.absolutePathFor(root, relativePath)
      if (!isDir) {
        shell.showItemInFolder(absolute)
        return
      }
      // Unlike the void `showItemInFolder`, `openPath` resolves to a *string*:
      // empty on success, an OS error message otherwise. Silence would leave
      // the renderer showing a success it never got.
      const failure = await shell.openPath(absolute)
      if (failure) throw new Error(`revealPath: ${failure}`)
    }
  )

  // ── Uma janela que morre sem se despedir ─────────────────────────────────
  // Every main -> renderer stream below is a per-sender subscription that the
  // renderer tears down with an explicit `:stop`. A window that is *closed*
  // never sends one: it simply stops existing, and whatever still holds its
  // WebContents — an fs watcher's inotify handle, an agent's stdout, a
  // download — goes on firing. `WebContents.send` then throws
  // `TypeError: Object has been destroyed` from inside a native callback with
  // no `try` above it, i.e. an uncaught exception in the main process, which
  // Electron shows the user as a crash dialog *after* they closed the app
  // (reported 2026-08-31, stack: FSWatcher.handleRawEvent -> WebContents.send).
  //
  // Two halves, and both are needed:
  //   `sendTo`         — never touch a destroyed WebContents. No race to worry
  //                      about: main is single-threaded, so nothing can destroy
  //                      it between the check and the send.
  //   `whenSenderGone` — run a subscription's own teardown when its window
  //                      dies, so the watcher/stream stops firing at all rather
  //                      than being merely muted. Keyed per stream, so a repeat
  //                      start replaces its teardown instead of stacking a
  //                      stale one on top.
  const senderTeardowns = new Map<number, Map<string, () => void>>()

  function sendTo(sender: Electron.WebContents, channel: string, ...args: unknown[]): void {
    if (sender.isDestroyed()) return
    sender.send(channel, ...args)
  }

  function whenSenderGone(
    sender: Electron.WebContents,
    stream: string,
    teardown: () => void
  ): void {
    const id = sender.id // read now: reading `id` off a destroyed object throws
    let perStream = senderTeardowns.get(id)
    if (!perStream) {
      const created = new Map<string, () => void>()
      perStream = created
      senderTeardowns.set(id, created)
      sender.once('destroyed', () => {
        senderTeardowns.delete(id)
        for (const run of created.values()) {
          // One teardown throwing must not strand the others — the window is
          // already gone and there is nobody left to report the failure to.
          try {
            run()
          } catch (err) {
            console.error('[hive] teardown after window close failed', err)
          }
        }
      })
    }
    perStream.set(stream, teardown)
  }

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

  function stopWatch(senderId: number): void {
    activeWatchStops.get(senderId)?.()
    activeWatchStops.delete(senderId)
  }

  ipcMain.on('fs:watch:start', (event, root: string) => {
    const senderId = event.sender.id
    stopWatch(senderId)
    const stop = fsService.watchWorkspace(root, (change: FsChangeEvent) => {
      sendTo(event.sender, 'fs:watch:event', change)
    })
    activeWatchStops.set(senderId, stop)
    // The watcher outlives its window otherwise: closing the app leaves an
    // inotify handle firing into a destroyed WebContents (see `sendTo` above).
    whenSenderGone(event.sender, 'fs:watch', () => stopWatch(senderId))
  })

  ipcMain.on('fs:watch:stop', (event) => {
    stopWatch(event.sender.id)
  })

  // AgentService (T14): a single ClaudeCliAdapter (the MVP's sole
  // AgentAdapter, C1) backed by a real (spawn-based) ProcessRunner, wrapped
  // by AgentService to own the active session. Exposed to the renderer as
  // window.hive.agent.{capabilities,start,send,runWorkflow,onEvent}.
  // agent-terminal (AT-R3): every agent turn is spawned inside the terminal the
  // user chose. The getter is deliberately late-bound — `ShellService` needs the
  // registry (for each agent's caveats) and the registry needs this runner, so
  // the cycle is broken by reading the service at spawn time rather than at
  // construction time. Until it exists (and whenever no shell is detected), the
  // runner spawns exactly as it did before this feature.
  let shellService: ShellService | null = null
  /** The terminal a turn runs in right now — one getter, two consumers below. */
  const currentShell = (): ShellInfo | null => shellService?.current() ?? null
  /** Every terminal this machine has — what an adapter pins a fallback to (agent-terminal). */
  const detectedShells = (): ShellInfo[] => shellService?.detected() ?? []
  const processRunner = createProcessRunner({ shell: currentShell })
  // multi-agent: the registry holds every real adapter (Claude, Copilot,
  // Devin); availability is detected per machine by `registry.detect()` (queried
  // by the `profile.agents` picker below). `AgentService` runs a pool of
  // sessions — one per agent — so several agents can drive different
  // conversations concurrently. Each turn names its `agentId`; the service
  // routes it (and lazily starts that agent's session).
  //
  // R-06/P0-003: the registry — and only the registry — gets its runner wrapped
  // by the scripted-agent seam, so an armed E2E launch redirects agent-CLI
  // spawns (turns and `--version` probes) to a stand-in binary while every
  // other spawner here keeps the unwrapped `processRunner`. Disarmed, the wrap
  // returns that same object; see e2eAgentSeam.ts for the two conditions.
  //
  // agent-approvals: the CLI drives turns non-interactively, so a tool it
  // isn't pre-authorized for has nowhere to ask — it used to be refused
  // silently while the agent told the user to "approve the prompt" that never
  // appeared. `ApprovalService` hosts the MCP tool the CLI's
  // `--permission-prompt-tool` calls, which blocks the turn on a real answer
  // from the chat UI. Standing "sempre" rules live in the config store, so a
  // decision survives a restart.
  //
  // A "sempre" decision is *also* written into the agent's own permission
  // config for the workspace (`agentPermissions.ts`) — a standing grant the
  // user can find in `.claude/`, that the CLI honours without round-tripping
  // through Hive, and that survives running the same agent outside Hive. The
  // write is best-effort: Hive's own rule is already recorded by the time this
  // runs, so a read-only workspace costs the file, never the grant.
  const turnAgents = new Map<string, string>() // turnId -> the agent that ran it
  const approvalService = createApprovalService({
    // The per-turn `--mcp-config` file lives under the app's own data
    // directory, never in argv (see `approvalService.ts` for the Windows
    // argv split that made inline JSON unusable).
    configDir: join(app.getPath('userData'), 'mcp'),
    rules: configStore.getApprovalRules(),
    onRulesChanged: (rules) => configStore.setApprovalRules(rules),
    onGranted: (grant) => {
      const workspace = workspaceService.getWorkspace()
      if (!workspace) return
      const agentId =
        (grant.turnId !== undefined ? turnAgents.get(grant.turnId) : undefined) ??
        agentRegistry.defaultId()
      void grantAgentPermission({
        agentId,
        workspace,
        tool: grant.tool,
        input: grant.input
      }).catch(() => null)
    }
  })
  // Non-blocking: adapters read `mcpConfig()` per turn and simply omit the
  // flags while it returns `null`, so a listener that is slow (or fails) costs
  // the approval UX, never the turn.
  void approvalService.listen().catch(() => {})

  // aws-bedrock: the AWS session gate. It holds the **unwrapped** runner — an
  // E2E launch redirects *agent* CLIs to a stand-in binary, and `aws` is not
  // one of them — and it opens the browser through Electron's shell, which is
  // the whole reason `aws sso login --no-browser` can be driven from a window.
  const awsAuth = createAwsAuthService({
    processRunner,
    // Bound rather than wrapped: an arrow here would be one more function on
    // the boot path that no test can reach without a real browser.
    openExternal: shell.openExternal.bind(shell),
    preferredProfile: configStore.getAwsProfile
  })

  const agentRegistry = createAgentRegistry(withScriptedAgentCli(processRunner), {
    permissionPrompt: approvalService,
    // aws-bedrock: only the Claude adapter reads these, and only when its CLI
    // is pointed at Bedrock. Everywhere else they cost one file read that
    // answers "not applicable".
    awsAuth,
    preferredAwsProfile: configStore.getAwsProfile,
    // agent-terminal (AT-R4): the adapters translate this into their own CLI's
    // environment (`CLAUDE_CODE_SHELL` and friends), read per turn. `shells`
    // rides along because an adapter that cannot honour the pick has to pin a
    // real, installed shell instead of leaving the CLI to decide.
    shell: currentShell,
    shells: detectedShells,
    // Per-turn throwaway files (the Devin `--export` that carries its session
    // id back). Under `userData` rather than the OS temp dir so a hardened
    // machine that wipes `/tmp` mid-session doesn't cost the conversation.
    scratchDir: join(app.getPath('userData'), 'agent-scratch')
  })
  const shells = createShellService(configStore, agentRegistry)
  shellService = shells
  const agentService = createAgentService(agentRegistry)
  // agent-onboarding: `npm i -g` for the agent CLIs the picker offers to
  // install. Holds the **unwrapped** runner on purpose — the E2E seam
  // redirects agent-CLI spawns to a stand-in binary, and an install is npm,
  // not an agent.
  const agentInstaller = createAgentInstaller({ processRunner, registry: agentRegistry })

  // GitService (git-management, M10): drives the system git binary through the
  // same ProcessRunner as the agents (D-GIT engine), trashing untracked
  // discards via shell.trashItem (kept out of the Electron-free service, like
  // fsService). Exposed as window.hive.git.* (preload T12).
  // git-logs: the command journal every `git` invocation writes to, and the
  // console reads. Owned here (not by the service) so it outlives any window
  // and so `GitService` stays a mechanism with no buffer of its own.
  const gitCommandLog = createGitCommandLog()

  const gitService = createGitService({
    processRunner,
    trashItem: (abs) => shell.trashItem(abs),
    onCommand: (entry) => gitCommandLog.record(entry)
  })

  // git:changed stream — renderers subscribe (start/stop, the fs:watch
  // pattern) and get a `{ root }` ping after every mutation so the store
  // re-runs status without polling (design.md §3.3/§4). Keyed by sender id so
  // each window has its own subscription.
  const gitChangedSenders = new Map<number, Electron.WebContents>()
  ipcMain.on('git:changed:start', (event) => {
    const senderId = event.sender.id
    gitChangedSenders.set(senderId, event.sender)
    whenSenderGone(event.sender, 'git:changed', () => gitChangedSenders.delete(senderId))
  })
  ipcMain.on('git:changed:stop', (event) => {
    gitChangedSenders.delete(event.sender.id)
  })
  function notifyGitChanged(root: string): void {
    for (const sender of gitChangedSenders.values()) {
      sendTo(sender, 'git:changed', { root })
    }
  }

  // A `GitError` crossing IPC loses its custom `code`/`stderr`/`command`
  // fields (structured-clone only keeps message/name), so — mirroring
  // `withConflictPrefix` above — rethrow it as a plain Error whose message is
  // `GIT:` + a JSON payload the preload bridge (T12) parses back into a typed
  // `GitBridgeError` carrying the raw stderr (G3 — surface git's real message).
  function withGitError<Args extends unknown[], R>(
    handler: (...args: Args) => R | Promise<R>
  ): (...args: Args) => Promise<R> {
    return async (...args: Args) => {
      try {
        return await handler(...args)
      } catch (err) {
        if (err instanceof GitError) {
          throw new Error(
            `GIT:${JSON.stringify({ code: err.code, stderr: err.stderr, command: err.command })}`
          )
        }
        throw err
      }
    }
  }

  // Wraps a mutating git call so it fires `git:changed` for `ws` after it
  // succeeds, so the renderer store settles on truth (design.md §3.3). The
  // arg tuple is inferred from each callback, keeping registrations typed.
  function gitMutation<Args extends unknown[]>(
    run: (ws: string, ...args: Args) => Promise<unknown>
  ): (event: unknown, ws: string, ...args: Args) => Promise<unknown> {
    return withGitError(async (_event: unknown, ws: string, ...args: Args) => {
      const result = await run(ws, ...args)
      notifyGitChanged(ws)
      return result
    })
  }

  // Reads (no git:changed notification).
  ipcMain.handle(
    'git:detect',
    withGitError(async (_e, ws: string) => gitService.detect(ws))
  )
  ipcMain.handle(
    'git:status',
    withGitError(async (_e, ws: string) => gitService.status(ws))
  )
  ipcMain.handle(
    'git:branches',
    withGitError(async (_e, ws: string) => gitService.branches(ws))
  )
  ipcMain.handle(
    'git:log',
    withGitError(async (_e, ws: string, opts?: { file?: string; skip?: number; limit?: number }) =>
      gitService.log(ws, opts)
    )
  )
  ipcMain.handle(
    'git:diff',
    withGitError(async (_e, ws: string, path: string, side: GitDiffSide) =>
      gitService.diff(ws, path, side)
    )
  )
  ipcMain.handle(
    'git:commitDiff',
    withGitError(async (_e, ws: string, hash: string) => gitService.commitDiff(ws, hash))
  )
  ipcMain.handle(
    'git:fileAtHead',
    withGitError(async (_e, ws: string, path: string) => gitService.fileAtHead(ws, path))
  )
  ipcMain.handle(
    'git:conflicts',
    withGitError(async (_e, ws: string) => gitService.conflicts(ws))
  )
  ipcMain.handle(
    'git:stashList',
    withGitError(async (_e, ws: string) => gitService.stashList(ws))
  )

  // Mutations (each fires git:changed on success).
  ipcMain.handle(
    'git:init',
    gitMutation((ws) => gitService.init(ws))
  )
  ipcMain.handle(
    'git:stage',
    gitMutation((ws, paths: string[]) => gitService.stage(ws, paths))
  )
  ipcMain.handle(
    'git:unstage',
    gitMutation((ws, paths: string[]) => gitService.unstage(ws, paths))
  )
  ipcMain.handle(
    'git:discard',
    gitMutation((ws, paths: string[]) => gitService.discard(ws, paths))
  )
  ipcMain.handle(
    'git:commit',
    gitMutation((ws, message: string, opts?: { amend?: boolean; stageAll?: boolean }) =>
      gitService.commit(ws, message, opts)
    )
  )
  ipcMain.handle(
    'git:createBranch',
    gitMutation((ws, name: string, from?: string) => gitService.createBranch(ws, name, from))
  )
  ipcMain.handle(
    'git:checkout',
    gitMutation((ws, ref: string) => gitService.checkout(ws, ref))
  )
  ipcMain.handle(
    'git:renameBranch',
    gitMutation((ws, from: string, to: string) => gitService.renameBranch(ws, from, to))
  )
  ipcMain.handle(
    'git:deleteBranch',
    gitMutation((ws, name: string, force?: boolean) => gitService.deleteBranch(ws, name, force))
  )
  ipcMain.handle(
    'git:fetch',
    gitMutation((ws) => gitService.fetch(ws))
  )
  ipcMain.handle(
    'git:pull',
    gitMutation((ws) => gitService.pull(ws))
  )
  ipcMain.handle(
    'git:push',
    gitMutation((ws, opts?: { setUpstream?: boolean }) => gitService.push(ws, opts))
  )
  ipcMain.handle(
    'git:sync',
    gitMutation((ws) => gitService.sync(ws))
  )
  ipcMain.handle(
    'git:resolveConflict',
    gitMutation((ws, path: string, choice: 'current' | 'incoming' | 'both') =>
      gitService.resolveConflict(ws, path, choice)
    )
  )
  ipcMain.handle(
    'git:mergeContinue',
    gitMutation((ws) => gitService.mergeContinue(ws))
  )
  ipcMain.handle(
    'git:mergeAbort',
    gitMutation((ws) => gitService.mergeAbort(ws))
  )
  ipcMain.handle(
    'git:stash',
    gitMutation((ws, opts?: { message?: string; untracked?: boolean }) =>
      gitService.stash(ws, opts)
    )
  )
  ipcMain.handle(
    'git:stashApply',
    gitMutation((ws, index: number, pop?: boolean) => gitService.stashApply(ws, index, pop))
  )
  ipcMain.handle(
    'git:stashDrop',
    gitMutation((ws, index: number) => gitService.stashDrop(ws, index))
  )

  // git-logs: history is a plain read; new entries stream on the `git:changed`
  // subscription pattern (start/stop keyed by sender), because the console is
  // usually opened *after* the command that is being investigated has already
  // run — history is what makes it useful, the stream is what keeps it live.
  ipcMain.handle('git:logs:history', () => gitCommandLog.history())
  ipcMain.handle('git:logs:clear', () => gitCommandLog.clear())
  const gitLogSenders = new Map<number, Electron.WebContents>()
  ipcMain.on('git:logs:start', (event) => {
    const senderId = event.sender.id
    gitLogSenders.set(senderId, event.sender)
    whenSenderGone(event.sender, 'git:logs:entry', () => gitLogSenders.delete(senderId))
  })
  ipcMain.on('git:logs:stop', (event) => {
    gitLogSenders.delete(event.sender.id)
  })
  gitCommandLog.subscribe((entry: GitCommandEntry) => {
    for (const sender of gitLogSenders.values()) sendTo(sender, 'git:logs:entry', entry)
  })

  // ── Agent Change Review (M11) ────────────────────────────────────────────
  // CheckpointService (shadow-git snapshot engine) + ReviewService (the single
  // pending set + accept/reject) over the same ProcessRunner as git/agents.
  // The shadow store lives under userData, independent of the user's .git
  // (ACR-C2). Exposed as window.hive.review.* (preload T7).
  const checkpointService = createCheckpointService({
    processRunner,
    userDataDir: app.getPath('userData')
  })

  // review:changed stream — renderers subscribe (start/stop, the git:changed
  // pattern) and get the fresh snapshot after every recompute/decision so all
  // four surfaces re-render from one source (ACR-R2.5). Keyed by sender id.
  const reviewChangedSenders = new Map<number, Electron.WebContents>()
  ipcMain.on('review:changed:start', (event) => {
    const senderId = event.sender.id
    reviewChangedSenders.set(senderId, event.sender)
    whenSenderGone(event.sender, 'review:changed', () => reviewChangedSenders.delete(senderId))
  })
  ipcMain.on('review:changed:stop', (event) => {
    reviewChangedSenders.delete(event.sender.id)
  })
  const reviewService = createReviewService({
    checkpoint: checkpointService,
    onChanged: (workspace: string, snapshot: ReviewSnapshot) => {
      for (const sender of reviewChangedSenders.values()) {
        sendTo(sender, 'review:changed', { workspace, ...snapshot })
      }
    }
  })

  // One debounced fs watcher per workspace feeds `onFsActivity` so the pending
  // set recomputes as the agent's writes stream in (design.md §4). Lazily
  // started on the first turn for a workspace; `onFsActivity` self-gates (a
  // no-op when there's no baseline), so idle edits after a clean review are
  // cheap. Keyed by workspace so a switch tears the old one down.
  const reviewWatchStops = new Map<string, () => void>()
  const reviewDebounce = new Map<string, ReturnType<typeof setTimeout>>()
  function ensureReviewWatch(workspace: string): void {
    if (reviewWatchStops.has(workspace)) return
    const stop = fsService.watchWorkspace(workspace, () => {
      clearTimeout(reviewDebounce.get(workspace))
      reviewDebounce.set(
        workspace,
        setTimeout(() => {
          void reviewService.onFsActivity(workspace)
        }, 250)
      )
    })
    reviewWatchStops.set(workspace, stop)
  }

  // These watchers are keyed by *workspace*, not by window, so no
  // `whenSenderGone` covers them: they would go on firing (and re-running
  // `git status` through the debounce) while the app is on its way out, long
  // after the last renderer that cared about the answer stopped existing.
  app.on('before-quit', () => {
    for (const stop of reviewWatchStops.values()) stop()
    reviewWatchStops.clear()
    for (const timer of reviewDebounce.values()) clearTimeout(timer)
    reviewDebounce.clear()
  })

  // Rejects a review path that would escape the workspace root (defense in
  // depth — the paths come from our own diff output, but every handler is
  // path-checked, mirroring FsService's `resolveSafe`).
  function assertWithinWorkspace(workspace: string, path: string): void {
    const resolved = join(workspace, path)
    if (resolved !== workspace && !resolved.startsWith(workspace + sep)) {
      throw new Error(`Path escapes workspace root: ${path}`)
    }
  }

  ipcMain.handle('review:get', async (_e, ws: string) => reviewService.get(ws))
  ipcMain.handle('review:acceptFile', async (_e, ws: string, path: string) => {
    assertWithinWorkspace(ws, path)
    return reviewService.acceptFile(ws, path)
  })
  ipcMain.handle('review:rejectFile', async (_e, ws: string, path: string) => {
    assertWithinWorkspace(ws, path)
    return reviewService.rejectFile(ws, path)
  })
  // One turn's whole set, in one pass (the change card's "Aceitar tudo" /
  // "Rejeitar tudo") — see `acceptFiles` for why this is not a loop over
  // `review:acceptFile` in the renderer.
  ipcMain.handle('review:acceptFiles', async (_e, ws: string, paths: string[]) => {
    ensureReviewWatch(ws)
    return reviewService.acceptFiles(ws, paths)
  })
  ipcMain.handle('review:rejectFiles', async (_e, ws: string, paths: string[]) => {
    ensureReviewWatch(ws)
    return reviewService.rejectFiles(ws, paths)
  })
  ipcMain.handle('review:acceptHunk', async (_e, ws: string, path: string, hunkId: string) => {
    assertWithinWorkspace(ws, path)
    return reviewService.acceptHunk(ws, path, hunkId)
  })
  ipcMain.handle('review:rejectHunk', async (_e, ws: string, path: string, hunkId: string) => {
    assertWithinWorkspace(ws, path)
    return reviewService.rejectHunk(ws, path, hunkId)
  })
  ipcMain.handle('review:acceptAll', async (_e, ws: string) => reviewService.acceptAll(ws))
  ipcMain.handle('review:rejectAll', async (_e, ws: string) => reviewService.rejectAll(ws))
  // The chat pane names a turn's conversation once the conversation exists on
  // disk — the first turn of a brand-new one is sent before its id is minted.
  ipcMain.handle(
    'review:attachTurn',
    async (_e, ws: string, turnId: string, conversationId: string) => {
      reviewService.attachTurn(ws, turnId, conversationId)
    }
  )

  // Turn lifecycle wiring: take the checkpoint *before* the CLI spawns
  // (race-free pre-image, ACR-R1.1) and finalize the set on the turn's terminal
  // event. The workspace is the active one (Hive drives one workspace at a
  // time); a turn without an explicit id gets a synthesized one so its terminal
  // event can be matched back. Best-effort touched `paths` land in T17.
  const activeReviewTurns = new Map<string, string>() // turnId -> workspace
  const reviewTurnPaths = new Map<string, Set<string>>() // turnId -> touched file paths (attribution, ACR-C7)
  let reviewTurnCounter = 0
  // `conversationId` (session-history) rides along so the turn's change card
  // renders in the conversation that asked for it and in no other one.
  function beginReviewTurn(turnId: string, conversationId?: string): void {
    const ws = workspaceService.getWorkspace()
    if (!ws) return
    ensureReviewWatch(ws)
    activeReviewTurns.set(turnId, ws)
    reviewTurnPaths.set(turnId, new Set())
    void reviewService.beginTurn(ws, turnId, conversationId)
  }
  /**
   * agent-approvals: which agent a turn runs on, so a "sempre permitir" raised
   * by that turn is written into *that* agent's permission config and not
   * whichever one happens to be the default. Entries are dropped on the turn's
   * terminal event below; an approval always arrives while its turn is live.
   */
  function rememberTurnAgent(turnId: string, agentId: string | undefined): void {
    turnAgents.set(turnId, agentId ?? agentRegistry.defaultId())
  }
  agentService.onEvent((agentEvent: AgentEvent) => {
    // Attribution plumbing (ACR-C7): accumulate the paths the agent's file-edit
    // tools touched, keyed by turn, so `endTurn` can annotate the change card.
    // Keyed on `filePath`, never `detail` — since agent-activity every tool
    // reports, and a `Bash` command line is not a path.
    if (agentEvent.type === 'tool') {
      if (agentEvent.turnId !== undefined && agentEvent.filePath) {
        reviewTurnPaths.get(agentEvent.turnId)?.add(agentEvent.filePath)
      }
      return
    }
    if (
      agentEvent.type === 'done' ||
      agentEvent.type === 'error' ||
      agentEvent.type === 'interrupted'
    ) {
      const turnId = agentEvent.turnId
      if (turnId === undefined) return
      turnAgents.delete(turnId)
      const ws = activeReviewTurns.get(turnId)
      if (!ws) return
      activeReviewTurns.delete(turnId)
      // The tool_use paths are absolute; make them workspace-relative POSIX to
      // match the pending set's path convention (the diff is authoritative — an
      // empty/partial list is fine).
      const paths = [...(reviewTurnPaths.get(turnId) ?? [])]
        .filter((p) => p.startsWith(ws))
        .map((p) =>
          p
            .slice(ws.length)
            .replace(/^[/\\]/, '')
            .split('\\')
            .join('/')
        )
      reviewTurnPaths.delete(turnId)
      void reviewService.endTurn(ws, turnId, paths)
    }
  })

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

  ipcMain.handle(
    'agent:capabilities',
    async (_event, agentId?: string, opts?: { workspace?: string; refresh?: boolean }) =>
      // model-picker: the workspace is part of the question — a project's own
      // `.claude/settings.json` can point the CLI at a different provider, so
      // the same agent legitimately answers differently per workspace.
      agentService.capabilities(
        agentId,
        { ...(opts?.workspace ? { workspace: opts.workspace } : {}) },
        opts?.refresh ?? false
      )
  )
  // engine-pins: the model+effort each agent starts on, persisted. Read on
  // every surface that opens an engine control (the composer, the ingestion
  // sheet, "Perguntar à base", the studio) and written by the pin itself.
  ipcMain.handle('agent:pins', async () => configStore.getEnginePins())
  // Renderer input crosses the boundary sanitized — `null` removes the pin,
  // and the store re-applies the same rule on the way to disk.
  ipcMain.handle('agent:pin', async (_event, agentId: unknown, pin: unknown) => {
    if (typeof agentId !== 'string') return configStore.getEnginePins()
    if (pin === null) return configStore.setEnginePin(agentId, null)
    const sanitized = sanitizeEnginePin(pin)
    return sanitized === null
      ? configStore.getEnginePins()
      : configStore.setEnginePin(agentId, sanitized)
  })
  // context-compaction: whether Hive itself compacts when the window gets
  // tight. Only ever acted on for an agent that does not do it already — the
  // renderer holds that rule, because it is the side that knows which agent a
  // conversation is running on.
  ipcMain.handle('agent:autoCompact', async () => configStore.getAutoCompact())
  ipcMain.handle('agent:autoCompact:set', async (_event, enabled: unknown) => {
    configStore.setAutoCompact(enabled === true)
  })
  ipcMain.handle('agent:start', async (_event, opts: SessionOpts) => {
    agentService.startSession(opts)
  })
  ipcMain.handle('agent:send', async (_event, text: string, opts?: TurnOpts) => {
    // Checkpoint before the turn spawns (ACR-R1.1). Synthesize a turnId when
    // the caller didn't supply one so the terminal event can be matched back;
    // pass it through to the agent so its events carry the same id.
    const turnId = opts?.turnId ?? `review-turn-${++reviewTurnCounter}`
    beginReviewTurn(turnId, opts?.conversationId)
    rememberTurnAgent(turnId, opts?.agentId)
    agentService.send(text, { ...opts, turnId })
  })
  ipcMain.handle('agent:runWorkflow', async (_event, cmd: WorkflowCommand, opts?: TurnOpts) => {
    const turnId = opts?.turnId ?? `review-turn-${++reviewTurnCounter}`
    beginReviewTurn(turnId, opts?.conversationId)
    rememberTurnAgent(turnId, opts?.agentId)
    agentService.runWorkflow(cmd, { ...opts, turnId })
  })
  // T8 (WS-R5.2): explicit session teardown, called by Chat's unmount
  // cleanup so a switched-away-from workspace's session doesn't keep
  // running orphaned when no new session immediately replaces it.
  ipcMain.handle('agent:stop', async () => {
    agentService.stop()
  })
  // aws-bedrock: the AWS session surface.
  //
  //   'aws:status'   — what the panel and the chip draw (files only, no spawn).
  //   'aws:login'    — an explicit "Reconectar", optionally on another profile.
  //   'aws:cancel'   — stops the in-flight login.
  //   'aws:profile'  — reads/writes the pinned profile.
  //   'aws:state:*'  — the live login stream, same start/stop shape as the
  //                    agent-event channel above (one subscription per window).
  //
  // A turn never comes through here: the gate lives in the adapter, so a
  // login can start with no window listening and still finish correctly.
  ipcMain.handle('aws:status', async (_event, workspace?: string) => awsAuth.status(workspace))
  ipcMain.handle('aws:loginState', async () => awsAuth.loginState())
  ipcMain.handle('aws:login', async (_event, profile?: string | null, workspace?: string) =>
    awsAuth.login(profile ?? null, workspace)
  )
  ipcMain.handle('aws:cancel', async () => {
    awsAuth.cancel()
  })
  ipcMain.handle('aws:getProfile', async () => configStore.getAwsProfile())
  ipcMain.handle('aws:setProfile', async (_event, name: string | null) => {
    configStore.setAwsProfile(name)
  })

  const awsStateUnsubs = new Map<number, () => void>()
  ipcMain.on('aws:state:start', (event) => {
    const senderId = event.sender.id
    awsStateUnsubs.get(senderId)?.()
    awsStateUnsubs.set(
      senderId,
      awsAuth.onState((state: AwsLoginState) => sendTo(event.sender, 'aws:state', state))
    )
    // The current state, immediately: a window that subscribes *during* a
    // login (a reload, a second window) would otherwise show nothing until the
    // next phase change — and the phase it is waiting on may be the user
    // finishing in the browser, which can take a minute.
    sendTo(event.sender, 'aws:state', awsAuth.loginState())
    event.sender.once('destroyed', () => {
      awsStateUnsubs.get(senderId)?.()
      awsStateUnsubs.delete(senderId)
    })
  })
  ipcMain.on('aws:state:stop', (event) => {
    const senderId = event.sender.id
    awsStateUnsubs.get(senderId)?.()
    awsStateUnsubs.delete(senderId)
  })

  // chat-controls CC-R1 via session-history: the Stop button interrupts one
  // in-flight turn — background-turns keep streaming — and the session stays
  // alive (see AgentService.interrupt's doc for why this must not be
  // 'agent:stop').
  ipcMain.handle('agent:interrupt', async (_event, turnId?: string) => {
    // A stopped turn can be blocked on an approval the user will now never
    // answer — release it as a denial so the CLI child exits instead of
    // waiting on a card that just disappeared.
    approvalService.cancel(turnId)
    agentService.interrupt(turnId)
  })
  // agent-approvals: the chat card's verdict, released back to the blocked CLI
  // child. Unknown/expired ids are a deliberate no-op (the card may have
  // outlived its turn).
  ipcMain.handle('agent:approve', async (_event, requestId: string, decision: ApprovalDecision) => {
    approvalService.respond(requestId, decision)
  })
  // agent-approvals (session grant): the chat's footer chip is the only place
  // the blanket grant is visible, so it has to be able to read the real state
  // after a window reload — and to hand it back.
  ipcMain.handle('agent:approvalSession', async () => approvalService.sessionAllowAll())
  ipcMain.handle('agent:approvalSession:set', async (_event, enabled: boolean) => {
    approvalService.setSessionAllowAll(enabled)
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

  function stopAgentEvents(senderId: number): void {
    activeAgentEventUnsubs.get(senderId)?.()
    activeAgentEventUnsubs.delete(senderId)
  }

  ipcMain.on('agent:event:start', (event) => {
    const senderId = event.sender.id
    activeAgentEventUnsubs.get(senderId)?.()
    const unsubscribe = agentService.onEvent((agentEvent: AgentEvent) => {
      sendTo(event.sender, 'agent:event', agentEvent)
    })
    // agent-approvals rides the same channel: an approval request is just
    // another event in the turn's stream as far as the renderer is concerned,
    // routed by the same `turnId`. It originates outside the adapter (the CLI
    // calls Hive's MCP tool), which is the only reason it needs its own
    // subscription here.
    const unsubscribeApprovals = approvalService.onRequest((request) => {
      sendTo(event.sender, 'agent:event', request)
    })
    activeAgentEventUnsubs.set(senderId, () => {
      unsubscribe()
      unsubscribeApprovals()
    })
    // A turn can still be streaming when the user quits: the adapter's stdout
    // keeps arriving until the child dies, and every chunk is a send into a
    // window that is no longer there.
    whenSenderGone(event.sender, 'agent:event', () => stopAgentEvents(senderId))
  })

  ipcMain.on('agent:event:stop', (event) => {
    stopAgentEvents(event.sender.id)
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
        sendTo(event.sender, 'bmad:install:event', bmadEvent)
      }
    })()
    const senderId = event.sender.id
    activeInstallStops.set(senderId, () => {
      stopped = true
    })
    whenSenderGone(event.sender, 'bmad:install', () => {
      activeInstallStops.get(senderId)?.()
      activeInstallStops.delete(senderId)
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
        sendTo(event.sender, 'bmad:update:event', bmadEvent)
      }
    })()
    const senderId = event.sender.id
    activeUpdateStops.set(senderId, () => {
      stopped = true
    })
    whenSenderGone(event.sender, 'bmad:update', () => {
      activeUpdateStops.get(senderId)?.()
      activeUpdateStops.delete(senderId)
    })
  })

  ipcMain.on('bmad:update:stop', (event) => {
    activeUpdateStops.get(event.sender.id)?.()
    activeUpdateStops.delete(event.sender.id)
  })

  // SecondBrainService (second-brain, SB-R1/R2/R3): reuses the same
  // ProcessRunner. install/update stream SkillEvents on the exact same
  // start/event/stop shape as bmad:install/update:*; isProvisioned/getVault/
  // stageRaw are request/response. getVault combines the service's
  // resolveVault with the vault module's raw-pending count (SB-R2.5).
  const secondBrainService = createSecondBrainService(processRunner)
  const secondBrainVault = createSecondBrainVault()
  // SB-R10: the health-check cadence ledger, per workspace, in userData (never
  // in the git-versioned vault — see secondBrainHealth.ts for why).
  const secondBrainHealth = createSecondBrainHealthStore(app.getPath('userData'))

  // Where the ASR model's bytes live: one directory in `userData`, written by
  // main and read by the utility process. There is no scheme and no handler
  // any more — the renderer is not in the path at all.
  const downloadedModelsDir = join(app.getPath('userData'), ASR_MODELS_DIRNAME)

  const activeSbInstallStops = new Map<number, () => void>()
  const activeSbUpdateStops = new Map<number, () => void>()

  // Generic in the event type so any other stream can reuse the very same
  // one-stop-handle-per-sender path.
  const runSbStream = <T>(
    event: Electron.IpcMainEvent,
    stops: Map<number, () => void>,
    channel: string,
    stream: AsyncIterable<T>
  ): void => {
    const senderId = event.sender.id
    stops.get(senderId)?.()
    let stopped = false
    void (async () => {
      for await (const skillEvent of stream) {
        if (stopped) return
        sendTo(event.sender, channel, skillEvent)
      }
    })()
    stops.set(senderId, () => {
      stopped = true
    })
    whenSenderGone(event.sender, channel, () => {
      stops.get(senderId)?.()
      stops.delete(senderId)
    })
  }

  ipcMain.on('secondBrain:install:start', (event, workspace: string) => {
    runSbStream(
      event,
      activeSbInstallStops,
      'secondBrain:install:event',
      secondBrainService.install(workspace)
    )
  })
  ipcMain.on('secondBrain:install:stop', (event) => {
    activeSbInstallStops.get(event.sender.id)?.()
    activeSbInstallStops.delete(event.sender.id)
  })

  ipcMain.on('secondBrain:update:start', (event, workspace: string) => {
    runSbStream(
      event,
      activeSbUpdateStops,
      'secondBrain:update:event',
      secondBrainService.update(workspace)
    )
  })
  ipcMain.on('secondBrain:update:stop', (event) => {
    activeSbUpdateStops.get(event.sender.id)?.()
    activeSbUpdateStops.delete(event.sender.id)
  })

  ipcMain.handle('secondBrain:isProvisioned', async (_event, workspace: string) =>
    secondBrainService.detect(workspace)
  )
  ipcMain.handle('secondBrain:getVault', async (_event, workspace: string) => {
    const vault = secondBrainService.resolveVault(workspace)
    return {
      path: vault?.path ?? null,
      name: vault?.name ?? null,
      rawPending: secondBrainVault.countRawPending(workspace)
    }
  })
  ipcMain.handle('secondBrain:stageRaw', async (_event, workspace: string, content: string) => {
    const { relPath } = secondBrainVault.stageRaw(workspace, content)
    return { relPath }
  })

  // Health-check cadence (SB-R10): the ledger behind the skill's own "run
  // after every 10 ingests or monthly" practice. The rule is derived here, in
  // one place; the renderer only renders the result and launches the command.
  ipcMain.handle('secondBrain:getHealth', async (_event, workspace: string) =>
    secondBrainHealth.get(workspace)
  )
  ipcMain.handle('secondBrain:noteIngest', async (_event, workspace: string) =>
    secondBrainHealth.noteIngest(workspace)
  )
  ipcMain.handle('secondBrain:noteLint', async (_event, workspace: string) =>
    secondBrainHealth.noteLint(workspace)
  )
  ipcMain.handle('secondBrain:snoozeHealth', async (_event, workspace: string) =>
    secondBrainHealth.snooze(workspace)
  )

  // The ASR model store (M29): whether the model is on disk, plus download and
  // delete. Downloads stream byte progress on their own channel (the
  // bmad/secondBrain streamed pattern); everything else is request/response.
  const asrStore = createAsrModelStore(downloadedModelsDir)

  // The hardware probe — never blocks anything, which is why it is not awaited
  // here: `app.getGPUInfo` is a real round trip, and startup must not wait on a
  // reading that only decides a thread count. The fallback profile is honest
  // until the real one lands (`cores: 0` is "we have not measured"), and every
  // reader takes it per call rather than capturing it.
  //
  // `app.getGPUInfo` is the injected probe so `asrHardware` stays Electron-free.
  let runtimeProfile: AsrRuntimeProfile = {
    threads: FALLBACK_THREADS,
    facts: { gpu: false, ramGB: 0, cores: 0 }
  }
  void probeRuntime({ gpuInfo: () => app.getGPUInfo('basic') }).then((profile) => {
    runtimeProfile = profile
  })

  /**
   * Can the app transcribe, and what did it measure?
   *
   * The descendant of `whisper:preference`, which answered "which of ten
   * models, and who chose it" — a question with no remaining sides. What is
   * left is the half that was always load-bearing: recording surfaces need to
   * know whether there is anything to transcribe with, so that a fresh install
   * can *offer the download* instead of opening a microphone that can only
   * fail.
   */
  const readiness = (): AsrReadiness => ({
    installed: asrStore.installed(),
    model: asrStore.info(),
    runtime: runtimeProfile
  })

  ipcMain.handle('asr:readiness', async () => readiness())

  /**
   * The Whisper models an upgrading install still has (M29).
   *
   * Offered, never taken: what is on disk is a download the user waited for,
   * often gigabytes of it, and a migration that deletes it at startup is a
   * surprise with no undo. The voice panel shows the measured figure and a
   * button.
   */
  ipcMain.handle('asr:legacyModels', async () => measureLegacyModels(app.getPath('userData')).bytes)
  ipcMain.handle(
    'asr:removeLegacyModels',
    async () => removeLegacyModels(app.getPath('userData')).bytes
  )
  ipcMain.handle('asr:deleteModel', async () => {
    asrStore.remove()
    asrEngine.evict()
    // Removing is the one action that means "give me the disk space back", so
    // it also switches off the startup fetch below. Without this the next
    // launch downloads the same 671 MB and the button accomplishes nothing.
    configStore.setAsrAutoDownload(false)
    return readiness()
  })

  /**
   * The transcription engine — one utility process for the whole app.
   *
   * `paths` and `threads` are read per request rather than captured, so a model
   * that finishes downloading mid-session makes the very next phrase work with
   * nothing restarted.
   */
  const asrEngine = createAsrEngine({
    fork: () => {
      const child = utilityProcess.fork(join(__dirname, 'asrWorker.js'), [], {
        // The addon is ~1 GB resident once warm; it must never inherit a
        // window's lifetime, and it must not keep the app alive on quit.
        serviceName: 'hive-asr',
        stdio: 'ignore'
      })
      return {
        postMessage: (message) => child.postMessage(message),
        onMessage: (listener) => child.on('message', listener),
        onExit: (listener) => child.on('exit', listener),
        kill: () => {
          child.kill()
        }
      }
    },
    specifier: () => sherpaModuleSpecifier({ appPath: app.getAppPath(), packaged: app.isPackaged }),
    paths: () => asrStore.paths(),
    threads: () => runtimeProfile.threads
  })

  ipcMain.handle('asr:warm', async () => {
    await asrEngine.warm()
  })
  ipcMain.handle('asr:transcribe', async (_event, pcm: Float32Array) => asrEngine.transcribe(pcm))
  ipcMain.handle('asr:evict', async () => asrEngine.evict())

  // The engine's phase is a fact about the app, not about a subscription, so
  // it is broadcast to every live window rather than answered to a sender.
  asrEngine.subscribe((phase) => {
    for (const window of BrowserWindow.getAllWindows()) {
      const contents = window.webContents
      if (!contents.isDestroyed()) contents.send('asr:phase', phase)
    }
  })

  /**
   * Model downloads (M26, carried into M29): owned here, not by whichever
   * window started them.
   *
   * The snapshot is broadcast to **every** live window rather than answered to
   * the sender, because "is the model still downloading?" is a fact about the
   * app. That is also what makes closing the sheet harmless: nothing is torn
   * down, and the next window to open simply reads the same list.
   */
  const asrDownloads = createAsrDownloadManager({ store: asrStore })

  const broadcastDownloads = (downloads: AsrDownload[]): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      const contents = window.webContents
      if (!contents.isDestroyed()) contents.send('asr:downloads', downloads)
    }
  }
  asrDownloads.subscribe(broadcastDownloads)

  asrDownloads.onSettled((download) => {
    for (const window of BrowserWindow.getAllWindows()) {
      const contents = window.webContents
      if (!contents.isDestroyed()) contents.send('asr:download:settled', download)
    }
    // Only when the app is not the thing being looked at: a toast about
    // something the user is already watching finish is noise.
    const focused = BrowserWindow.getAllWindows().some((win) => win.isFocused())
    if (focused || !Notification.isSupported()) return
    new Notification(asrDownloadNotification(download)).show()
  })

  ipcMain.handle('asr:downloads', async () => asrDownloads.list())
  ipcMain.handle('asr:download:start', async () => {
    // Asking for the model is the opposite intent to having removed it.
    configStore.setAsrAutoDownload(true)
    return asrDownloads.start(asrStore.info().id)
  })
  ipcMain.handle('asr:download:cancel', async (_event, id: AsrModelId) => {
    asrDownloads.cancel(id)
  })
  ipcMain.handle('asr:download:dismiss', async (_event, id: AsrModelId) => {
    asrDownloads.dismiss(id)
  })
  /**
   * Fetch the transcription model at startup, if it is not already here.
   *
   * Deliberately *after* the window and every handler exist, and deliberately
   * not awaited: this is 671 MB, and nothing about entering the app may wait on
   * it. The transfer is the same one the voice panel starts, owned by
   * `asrDownloads` rather than by any window, so it survives navigation, shows
   * its progress wherever the user happens to look, and announces its own
   * ending. The rules for whether to start at all are in `asrAutoDownload.ts`.
   */
  const autoDownload = autoDownloadOnStartup({
    installed: () => asrStore.installed(),
    downloading: () => asrDownloads.list().some((item) => item.status === 'downloading'),
    allowed: () => configStore.getAsrAutoDownload(),
    start: () => {
      asrDownloads.start(asrStore.info().id)
    }
  })
  if (autoDownload === 'started') {
    console.info('[hive] no transcription model installed — fetching it in the background')
  }

  app.on('before-quit', () => {
    asrDownloads.stopAll()
    asrEngine.dispose()
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
      message: {
        role: 'user' | 'assistant' | 'compaction'
        text: string
        attachments?: string[]
        compaction?: StoredCompaction
      }
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

  // MCP console (mcp-logs): the Claude Code CLI's own per-server log files for
  // this workspace — what each MCP server actually did while the agent worked,
  // as opposed to `mcp:probe`'s one-shot handshake. `sources`/`read` are plain
  // invoke/response; the live tail follows the same streaming shape as
  // `fs:watch:*` above (start/stop sends, one event channel, one watcher per
  // sender, a repeat start replacing the previous watcher). `openDir` hands
  // the raw log directory to the OS file manager — it is the service's own
  // reported path, never a renderer-supplied one, so it cannot be used to open
  // an arbitrary location.
  const mcpLogService = createMcpLogService()
  const activeMcpLogStops = new Map<number, () => void>()

  ipcMain.handle('mcpLogs:sources', async (_event, workspace: string) =>
    mcpLogService.sources(workspace)
  )
  ipcMain.handle('mcpLogs:read', async (_event, workspace: string, query: McpLogQuery) =>
    mcpLogService.read(workspace, query)
  )
  ipcMain.handle('mcpLogs:locate', async (_event, workspace: string) =>
    mcpLogService.locate(workspace)
  )
  ipcMain.handle('mcpLogs:openDir', async (_event, workspace: string, server: string) => {
    const source = (await mcpLogService.sources(workspace)).find((entry) => entry.server === server)
    if (!source) throw new Error(`Sem logs para o servidor "${server}".`)
    await shell.openPath(source.dir)
  })

  function stopMcpLogWatch(senderId: number): void {
    activeMcpLogStops.get(senderId)?.()
    activeMcpLogStops.delete(senderId)
  }

  ipcMain.on('mcpLogs:watch:start', (event, workspace: string) => {
    const senderId = event.sender.id
    stopMcpLogWatch(senderId)
    const stop = mcpLogService.watch(workspace, (entries) => {
      sendTo(event.sender, 'mcpLogs:watch:event', entries)
    })
    activeMcpLogStops.set(senderId, stop)
    whenSenderGone(event.sender, 'mcpLogs:watch', () => stopMcpLogWatch(senderId))
  })

  ipcMain.on('mcpLogs:watch:stop', (event) => {
    stopMcpLogWatch(event.sender.id)
  })

  // Profile IPC (agent-selection + role-personalization) — the app-wide agent
  // and role preferences plus the resolved role action list. Grouped under
  // window.hive.profile.* in the preload bridge.
  // multi-agent: the picker's source of truth — probes each CLI on this machine
  // and returns availability + install hints for the disabled ("como instalar")
  // cards. Detection is cached in the registry after the first probe.
  // `refresh` re-probes instead of answering from the cache (agent-onboarding,
  // AO-R2): the picker's "procurar de novo" control, and the only way a CLI
  // installed while the app is open becomes usable without a restart.
  ipcMain.handle('profile:agents', async (_event, refresh?: boolean) => {
    const detected = await agentRegistry.detect(refresh === true)
    // An agent installed after onboarding is detected on every launch and
    // offered on none, because the enabled set is written once and never
    // revisited. `reconcileAgents` is the policy — including why "enable
    // everything detected" would be the wrong repair. Done here rather than in
    // a renderer so every surface that lists agents agrees, and so the write
    // happens once per probe instead of once per screen that asks.
    const decision = reconcileAgents({
      detected,
      enabled: configStore.getEnabledAgents(),
      known: configStore.getKnownAgents()
    })
    if (decision.enabled) configStore.setEnabledAgents(decision.enabled)
    if (decision.known) configStore.setKnownAgents(decision.known)
    return detected
  })

  // Installing an agent CLI from inside the app (AO-R3). Same start/event/stop
  // channel trio as bmad:install:* — one install at a time per renderer, keyed
  // by agent id so a second card can't silently adopt the first one's stream.
  //
  //   'agents:install:start' (renderer -> main): begin installing `agentId`.
  //   'agents:install:event' (main -> renderer, repeated): AgentInstallEvent.
  //   'agents:install:stop'  (renderer -> main): cancel + stop forwarding.
  const activeAgentInstalls = new Map<number, Map<string, () => void>>()

  function cancelAgentInstalls(senderId: number, agentId?: string): void {
    const perSender = activeAgentInstalls.get(senderId)
    if (!perSender) return
    for (const [id, cancel] of perSender) {
      if (agentId === undefined || id === agentId) {
        cancel()
        perSender.delete(id)
      }
    }
    if (perSender.size === 0) activeAgentInstalls.delete(senderId)
  }

  ipcMain.on('agents:install:start', (event, agentId: string) => {
    // A repeat start for the same agent (the user hitting "tentar de novo")
    // replaces the previous run rather than racing it.
    const senderId = event.sender.id
    cancelAgentInstalls(senderId, agentId)
    const cancel = agentInstaller.install(agentId, (installEvent) => {
      sendTo(event.sender, 'agents:install:event', agentId, installEvent)
    })
    const perSender = activeAgentInstalls.get(senderId) ?? new Map<string, () => void>()
    perSender.set(agentId, cancel)
    activeAgentInstalls.set(senderId, perSender)
    // Closing the window kills the install rather than orphaning an `npm i -g`
    // that keeps writing into a global prefix with nobody listening.
    whenSenderGone(event.sender, 'agents:install', () => cancelAgentInstalls(senderId))
  })

  ipcMain.on('agents:install:stop', (event, agentId?: string) => {
    cancelAgentInstalls(event.sender.id, typeof agentId === 'string' ? agentId : undefined)
  })
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
  // agent-terminal: the terminal picker (AT-R1/AT-R2). `list` joins the
  // detected shells with the persisted choice and each enabled agent's caveat
  // code; `refresh` re-detects instead of answering from the cache — the
  // "procurar de novo" control, and the only way a Git Bash installed while
  // the app is open becomes selectable without a restart. `select(null)`
  // restores automatic.
  ipcMain.handle('shell:list', async (_event, refresh?: boolean) => shells.list(refresh === true))
  ipcMain.handle('shell:select', async (_event, id: unknown) => {
    shells.select(typeof id === 'string' && id !== '' ? id : null)
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
  // The role's *defaults* for a scope (`start` when unspecified — the shape
  // every pre-scope caller meant). Drives the first-run role previews and the
  // customizer's "restore the role default" baseline.
  ipcMain.handle('profile:roleActions', async (_event, role: string | null, scope: unknown) =>
    resolveRoleActions(role, isShortcutScope(scope) ? scope : 'start')
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
  // Renderer input crosses the IPC boundary sanitized (`null` restores that
  // scope's role defaults) — the store re-applies the same rule defensively.
  // An unknown scope is dropped rather than defaulted: writing the wrong set
  // is worse than writing none.
  ipcMain.handle('shortcuts:set', async (_event, scope: unknown, prefs: unknown) => {
    if (!isShortcutScope(scope)) return
    configStore.setShortcuts(scope, sanitizeShortcutPrefs(prefs))
  })
  // Both scopes in one round trip — the hero and the strip always render
  // together, so they resolve together and can't disagree.
  ipcMain.handle('shortcuts:actions', async (_event, role: string | null, workspace: string) =>
    resolveAllShortcuts(role, configStore.getShortcuts(), await listCatalogWithCreated(workspace))
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

  // app-reload: the VS Code "Developer: Reload Window" affordance. Reloads the
  // *sender's* window, not the focused one — a reload triggered from a window
  // must never land on a different window just because focus moved while the
  // IPC was in flight. `reloadIgnoringCache` rather than `reload`: the reason
  // to reload by hand is almost always "the renderer is in a bad state or the
  // bundle on disk changed", and a cached bundle answers neither.
  ipcMain.handle('app:reload', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) window.webContents.reloadIgnoringCache()
  })

  ipcMain.handle('app:info', async (): Promise<AppInfo> => ({
    name: app.getName(),
    version: app.getVersion(),
    updatesSupported: app.isPackaged,
    canApply: updateService.getCanApply(),
    lastCheckedAt: updateService.getLastCheckedAt(),
    // UpdateCenter T13 (ND-R5.5): the renderer's only way to learn which
    // version is currently skipped (needed even fresh after a restart, when
    // no `available` event for it will ever arrive again — see AppInfo's
    // own doc comment in updateService.ts).
    skippedVersion: configStore.getSkippedUpdateVersion()
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

  function stopUpdateEvents(senderId: number): void {
    activeUpdateEventUnsubs.get(senderId)?.()
    activeUpdateEventUnsubs.delete(senderId)
  }

  ipcMain.on('update:event:start', (event) => {
    const senderId = event.sender.id
    stopUpdateEvents(senderId)
    const unsubscribe = updateService.onEvent((updateEvent) => {
      sendTo(event.sender, 'update:event', updateEvent)
    })
    activeUpdateEventUnsubs.set(senderId, unsubscribe)
    whenSenderGone(event.sender, 'update:event', () => stopUpdateEvents(senderId))
  })

  ipcMain.on('update:event:stop', (event) => {
    stopUpdateEvents(event.sender.id)
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
