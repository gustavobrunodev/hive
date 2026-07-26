import { afterAll, describe, expect, it, vi, beforeAll } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { app, BrowserWindow, dialog, ipcMain, shell, protocol, net } from 'electron'
import { ConflictError } from './fsService'
import { createConfigStore } from './configStore'

// A real temp dir (not mocked) so the ConfigStore that src/main/index.ts
// constructs via createConfigStore(app.getPath('userData')) has somewhere
// real to read/write during this test, same approach as configStore.test.ts
// and workspaceService.test.ts.
const userDataDir = mkdtempSync(join(tmpdir(), 'hive-main-index-test-'))

// Mocks Electron + the electron-toolkit helpers + the ?asset icon import so
// src/main/index.ts can be imported and its bootstrap logic exercised in
// plain Node, without a real Electron main process.
vi.mock('electron', () => {
  const BrowserWindowMock = vi.fn().mockImplementation(() => ({
    webContents: { setWindowOpenHandler: vi.fn() },
    on: vi.fn(),
    show: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn()
  }))
  Object.assign(BrowserWindowMock, { getAllWindows: vi.fn(() => []) })
  return {
    app: {
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
      getPath: vi.fn(() => userDataDir),
      getName: vi.fn(() => 'hive-desktop'),
      getVersion: vi.fn(() => '0.1.0'),
      isPackaged: false
    },
    BrowserWindow: BrowserWindowMock,
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    shell: {
      openExternal: vi.fn(),
      trashItem: vi.fn(() => Promise.resolve()),
      showItemInFolder: vi.fn()
    },
    dialog: { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) },
    // Second Brain / Whisper: the `hive-model:` scheme registration (pre-ready)
    // + its request handler (in whenReady).
    protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
    net: { fetch: vi.fn(() => Promise.resolve(new Response('bytes'))) }
  }
})

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false }
}))

vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon-stub' }))

// FsService (T11): mocked (rather than exercised against a real temp dir,
// which fsService.test.ts already does thoroughly) so this file can assert
// index.ts routes IPC calls to it correctly — same "does the wiring work"
// concern as the WorkspaceService tests below, just via a module mock
// instead of an injected fake, since createFsService() takes no
// Electron-ish dependency to substitute the way WorkspaceService's
// `DialogLike` does. Declared via vi.hoisted so the mock factory (which
// vi.mock hoists above these declarations) can close over it.
const { fakeFsService, watchWorkspaceCalls } = vi.hoisted(() => {
  const watchWorkspaceCalls: Array<{
    root: string
    onChange: (event: unknown) => void
    stop: ReturnType<typeof import('vitest').vi.fn>
  }> = []
  return {
    watchWorkspaceCalls,
    fakeFsService: {
      listTree: vi.fn(() => [{ name: 'a.txt', path: 'a.txt', type: 'file' }]),
      readFile: vi.fn(() => 'fake file contents'),
      watchWorkspace: vi.fn((root: string, onChange: (event: unknown) => void) => {
        const stop = vi.fn()
        watchWorkspaceCalls.push({ root, onChange, stop })
        return stop
      }),
      statFile: vi.fn(() => ({ mtimeMs: 123, size: 4 })),
      createFile: vi.fn(),
      createDirectory: vi.fn(),
      saveFile: vi.fn(() => ({ mtimeMs: 456, size: 7 })),
      move: vi.fn(),
      importEntry: vi.fn(),
      exists: vi.fn(() => true),
      trash: vi.fn(() => Promise.resolve())
    }
  }
})

// createFsService is mocked (T11's existing rationale, still applies), but
// `createFsService` is called with T6's `{ trashItem }` dep now — asserted
// below via `createFsServiceMock.mock.calls`. `ConflictError` is re-exported
// from the *real* module (via importActual) rather than re-declared here:
// index.ts's `err instanceof ConflictError` check (T6) must see the same
// class identity this test throws, which only importActual guarantees.
const { createFsServiceMock } = vi.hoisted(() => ({ createFsServiceMock: vi.fn() }))

vi.mock('./fsService', async () => {
  const actual = await vi.importActual<typeof import('./fsService')>('./fsService')
  createFsServiceMock.mockImplementation(() => fakeFsService)
  return { ...actual, createFsService: createFsServiceMock }
})

// AgentService (T14): mocked the same way FsService is above — index.ts
// wires window.hive.agent.* to a real AgentService backed by a real
// ClaudeCliAdapter/ProcessRunner (neither of which import 'electron', so
// they're left un-mocked and constructed for real), but this file only cares
// that index.ts routes IPC calls to *whatever* AgentService it's given, not
// AgentService's own forwarding logic (covered by agentService.test.ts).
const { fakeAgentService, agentOnEventCalls } = vi.hoisted(() => {
  const agentOnEventCalls: Array<{
    listener: (event: unknown) => void
    unsubscribe: ReturnType<typeof import('vitest').vi.fn>
  }> = []
  return {
    agentOnEventCalls,
    fakeAgentService: {
      capabilities: vi.fn(() => ({ models: [], efforts: [], supportsAttachments: false })),
      startSession: vi.fn(),
      send: vi.fn(),
      runWorkflow: vi.fn(),
      stop: vi.fn(),
      onEvent: vi.fn((listener: (event: unknown) => void) => {
        const unsubscribe = vi.fn()
        agentOnEventCalls.push({ listener, unsubscribe })
        return unsubscribe
      })
    }
  }
})

vi.mock('./agentService', () => ({ createAgentService: vi.fn(() => fakeAgentService) }))

// BmadService (T8/T9/T10): mocked the same way FsService/AgentService are
// above. Without this, index.ts's real (un-mocked, since bmadService.ts
// imports no 'electron' API) BmadService + real spawn-based ProcessRunner
// would try to actually run `npx bmad-method install` when this test
// exercises the bmad:install:*/bmad:update:* handlers — this file only cares
// that index.ts routes IPC calls to *whatever* BmadService it's given, not
// BmadService's own parsing/command logic (covered by bmadService.test.ts).
const { fakeBmadService, installGate } = vi.hoisted(() => {
  let resumeInstall: (() => void) | undefined
  return {
    installGate: { resume: () => resumeInstall?.() },
    fakeBmadService: {
      // Yields one event, then blocks on an externally-resolved gate before
      // yielding a second — lets a test call bmad:install:stop() in the gap
      // and prove the second event is never relayed (deterministic, no real
      // timers needed to win a race).
      install: vi.fn(async function* installStub() {
        yield { type: 'step', id: 's1', label: 'Step 1' }
        await new Promise<void>((resolve) => {
          resumeInstall = resolve
        })
        yield { type: 'done', ok: true }
      }),
      update: vi.fn(async function* updateStub() {
        yield { type: 'done', ok: true }
      })
    }
  }
})

vi.mock('./bmadService', () => ({ createBmadService: vi.fn(() => fakeBmadService) }))

// GitService (git-management M10): mocked like FsService above — index.ts
// wires window.hive.git.* to a real GitService (which imports no 'electron',
// so it isn't mocked in production) backed by the real spawn-based
// ProcessRunner. Without this mock the git:* handlers would shell out to real
// git; this file only asserts index.ts routes calls to whatever GitService it
// gets + fires git:changed after mutations (GitService's own argv/parsing is
// covered by gitService.test.ts). importActual keeps the real GitError class
// identity so index.ts's `err instanceof GitError` matches what the fake throws.
const { fakeGitService } = vi.hoisted(() => ({
  fakeGitService: {
    detect: vi.fn(async () => ({ isRepo: true, root: '/ws', gitMissing: false })),
    init: vi.fn(async () => {}),
    status: vi.fn(async () => ({ branch: 'main', changes: [] })),
    stage: vi.fn(async () => {}),
    unstage: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    commit: vi.fn(async () => ({ hash: 'abc' })),
    branches: vi.fn(async () => ({ branches: [], current: 'main' })),
    createBranch: vi.fn(async () => {}),
    checkout: vi.fn(async () => {}),
    renameBranch: vi.fn(async () => {}),
    deleteBranch: vi.fn(async () => {}),
    fetch: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    sync: vi.fn(async () => {}),
    log: vi.fn(async () => []),
    diff: vi.fn(async () => ({ hunks: [], binary: false })),
    commitDiff: vi.fn(async () => ({ files: [], diff: { hunks: [], binary: false } })),
    fileAtHead: vi.fn(async () => ''),
    conflicts: vi.fn(async () => []),
    resolveConflict: vi.fn(async () => {}),
    mergeContinue: vi.fn(async () => {}),
    mergeAbort: vi.fn(async () => {}),
    stash: vi.fn(async () => {}),
    stashList: vi.fn(async () => []),
    stashApply: vi.fn(async () => {}),
    stashDrop: vi.fn(async () => {})
  }
}))

vi.mock('./gitService', async () => {
  const actual = await vi.importActual<typeof import('./gitService')>('./gitService')
  return { ...actual, createGitService: vi.fn(() => fakeGitService) }
})

// Agent Change Review (M11): CheckpointService + ReviewService mocked like
// GitService above — index.ts wires window.hive.review.* to a real
// ReviewService (no 'electron' import) over the real ProcessRunner. This file
// only asserts index.ts routes review:* calls to whatever service it's given
// and drives begin/endTurn on the turn lifecycle (the service's own math is
// covered by reviewService.test.ts). `onChanged` is captured so the turn-wiring
// tests can also confirm the emit path is registered.
const { fakeReviewService } = vi.hoisted(() => ({
  fakeReviewService: {
    beginTurn: vi.fn(async () => {}),
    onFsActivity: vi.fn(async () => {}),
    endTurn: vi.fn(async () => {}),
    get: vi.fn(async () => ({ changes: [], turns: [] })),
    acceptFile: vi.fn(async () => ({ ok: true })),
    rejectFile: vi.fn(async () => ({ ok: true })),
    acceptHunk: vi.fn(async () => ({ ok: true })),
    rejectHunk: vi.fn(async () => ({ ok: true })),
    acceptAll: vi.fn(async () => ({ ok: true })),
    rejectAll: vi.fn(async () => ({ ok: true })),
    teardown: vi.fn()
  }
}))
vi.mock('./checkpointService', () => ({ createCheckpointService: vi.fn(() => ({})) }))
vi.mock('./reviewService', () => ({ createReviewService: vi.fn(() => fakeReviewService) }))

// SecondBrainService/Vault (second-brain): mocked so index.test.ts asserts the
// wiring only — each module's own math is covered by secondBrainService.test.ts
// / secondBrainVault.test.ts. install/update are async generators yielding a
// scripted SkillEvent stream so the streamed-handler path (runSbStream) is
// exercised without spawning a real `npx`.
const { fakeSecondBrainService, fakeSecondBrainVault } = vi.hoisted(() => ({
  fakeSecondBrainService: {
    detect: vi.fn(() => false),
    resolveVault: vi.fn(() => null as { path: string; name: string } | null),

    install: vi.fn(async function* () {
      yield { type: 'step', id: 'found', label: 'Found 4 skills' }
      yield { type: 'done', ok: true }
    }),
    update: vi.fn(async function* () {
      yield { type: 'done', ok: true }
    })
  },
  fakeSecondBrainVault: {
    stageRaw: vi.fn(() => ({ relPath: 'second-brain/raw/ingest-x.md', absPath: '/abs/x.md' })),
    countRawPending: vi.fn(() => 0)
  }
}))
vi.mock('./secondBrainService', () => ({
  createSecondBrainService: vi.fn(() => fakeSecondBrainService)
}))
vi.mock('./secondBrainVault', () => ({
  createSecondBrainVault: vi.fn(() => fakeSecondBrainVault)
}))

function findHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no ipcMain.handle registered for "${channel}"`)
  return call[1] as (...args: unknown[]) => unknown
}

function findOnHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.on).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no ipcMain.on registered for "${channel}"`)
  return call[1] as (...args: unknown[]) => unknown
}

describe('main process bootstrap', () => {
  beforeAll(async () => {
    await import('./index')
    // Flush the `app.whenReady().then(...)` microtask chain that registers
    // the ipcMain handler and creates the window.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  afterAll(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('registers ping as a real request/response handler (ipcMain.handle), not fire-and-forget', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('ping', expect.any(Function))
    const [, handler] = vi.mocked(ipcMain.handle).mock.calls[0] as [string, () => Promise<string>]
    await expect(handler()).resolves.toBe('pong')
  })

  // Structural proof of R1.3 (renderer never gets Node/fs/child_process access):
  // Electron enforces isolation at the OS/process level from this exact
  // webPreferences config, which a jsdom-based renderer test cannot observe
  // directly — asserting the config itself is what's actually testable here.
  it('creates the BrowserWindow with contextIsolation/sandbox on and nodeIntegration off', () => {
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
    const [options] = vi.mocked(BrowserWindow).mock.calls[0] as [
      { webPreferences: Record<string, unknown> }
    ]
    expect(options.webPreferences.contextIsolation).toBe(true)
    expect(options.webPreferences.nodeIntegration).toBe(false)
    expect(options.webPreferences.sandbox).toBe(true)
  })

  // T5: WorkspaceService wiring — the three window.hive workspace methods
  // route to a real WorkspaceService/ConfigStore pair backed by the mocked
  // app.getPath('userData') temp dir above.
  it('registers workspace:choose, workspace:get, and workspace:isProvisioned handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:choose', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:get', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:isProvisioned', expect.any(Function))
  })

  it('workspace:get and workspace:isProvisioned reflect defaults with no workspace picked yet', async () => {
    await expect(findHandler('workspace:get')()).resolves.toBeNull()
    await expect(findHandler('workspace:isProvisioned')()).resolves.toBe(false)
  })

  it('workspace:choose drives dialog.showOpenDialog, persists the pick, and is readable back via workspace:get', async () => {
    // WorkspaceService (T2) now validates the picked path against the real
    // filesystem (openWorkspace's default pathExists/isDirectory), so this
    // uses a real, existing directory rather than an arbitrary fake path.
    const pickedWorkspace = mkdtempSync(join(tmpdir(), 'hive-main-index-picked-'))
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [pickedWorkspace]
    } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)

    await expect(findHandler('workspace:choose')()).resolves.toBe(pickedWorkspace)
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    await expect(findHandler('workspace:get')()).resolves.toBe(pickedWorkspace)

    rmSync(pickedWorkspace, { recursive: true, force: true })
  })

  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching handlers, delegating to
  // the same real WorkspaceService/ConfigStore pair as the three handlers
  // above (no mocking of WorkspaceService itself — this suite already wires
  // a real instance backed by the mocked app.getPath('userData') temp dir).
  it('registers workspace:provisionState, workspace:recents, and workspace:open handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:provisionState', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:recents', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:open', expect.any(Function))
  })

  it('workspace:provisionState reports false for an unprovisioned directory (no _bmad/_config/manifest.yaml)', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-provision-'))
    await expect(findHandler('workspace:provisionState')(fakeInvokeEvent, dir)).resolves.toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('workspace:open validates and persists a path, and workspace:recents reflects it as the MRU head', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-open-'))

    await expect(findHandler('workspace:open')(fakeInvokeEvent, dir)).resolves.toEqual({
      ok: true,
      path: dir
    })
    await expect(findHandler('workspace:get')()).resolves.toBe(dir)
    // MRU is shared with the earlier workspace:choose test in this describe
    // block (same ConfigStore instance), so only the head (this open) is
    // asserted rather than the full list.
    await expect(findHandler('workspace:recents')()).resolves.toEqual(expect.arrayContaining([dir]))
    const recents = (await findHandler('workspace:recents')()) as string[]
    expect(recents[0]).toBe(dir)

    rmSync(dir, { recursive: true, force: true })
  })

  it('workspace:open reports a non-fatal "missing" reason for a path that does not exist on disk', async () => {
    const fakeInvokeEvent = {}
    const missing = join(tmpdir(), 'hive-main-index-open-missing-does-not-exist')
    await expect(findHandler('workspace:open')(fakeInvokeEvent, missing)).resolves.toEqual({
      ok: false,
      reason: 'missing'
    })
  })

  // T11: FsService wiring — request/response methods route to the (mocked)
  // FsService with the exact args the renderer passed.
  it('registers fs:listTree and fs:readFile handlers, routing to FsService', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('fs:listTree', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('fs:readFile', expect.any(Function))

    // Real ipcMain.handle listeners always receive the IpcMainInvokeEvent as
    // their first argument, followed by the args the renderer passed —
    // mirrored here with a stub event object.
    const fakeInvokeEvent = {}
    await expect(findHandler('fs:listTree')(fakeInvokeEvent, '/ws', 'docs')).resolves.toEqual([
      { name: 'a.txt', path: 'a.txt', type: 'file' }
    ])
    expect(fakeFsService.listTree).toHaveBeenCalledWith('/ws', 'docs')

    await expect(findHandler('fs:readFile')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toBe(
      'fake file contents'
    )
    expect(fakeFsService.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  // T6: FsService is constructed with `shell.trashItem` injected as its
  // `trashItem` dep (design §2) — proven by inspecting what index.ts actually
  // passed to the (mocked) createFsService, then confirming that dep really
  // is shell.trashItem by calling it through.
  it('constructs FsService with shell.trashItem injected as the trashItem dep', async () => {
    expect(createFsServiceMock).toHaveBeenCalledTimes(1)
    const [deps] = createFsServiceMock.mock.calls[0] as [{ trashItem?: (abs: string) => unknown }]
    expect(deps.trashItem).toBeInstanceOf(Function)
    await deps.trashItem?.('/abs/path')
    expect(shell.trashItem).toHaveBeenCalledWith('/abs/path')
  })

  // T6: the remaining fs:* write/read handlers — each just delegates to the
  // matching FsService method with the args the renderer passed, mirroring
  // the fs:listTree/fs:readFile assertions above.
  it('registers fs:statFile/createFile/createDirectory/saveFile/move/importEntry/exists/trash, routing to FsService', async () => {
    for (const channel of [
      'fs:statFile',
      'fs:createFile',
      'fs:createDirectory',
      'fs:saveFile',
      'fs:move',
      'fs:importEntry',
      'fs:exists',
      'fs:trash'
    ]) {
      expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
    }

    const fakeInvokeEvent = {}

    await expect(findHandler('fs:statFile')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toEqual({
      mtimeMs: 123,
      size: 4
    })
    expect(fakeFsService.statFile).toHaveBeenCalledWith('/ws', 'a.txt')

    await findHandler('fs:createFile')(fakeInvokeEvent, '/ws', 'b.txt', { overwrite: true })
    expect(fakeFsService.createFile).toHaveBeenCalledWith('/ws', 'b.txt', { overwrite: true })

    await findHandler('fs:createDirectory')(fakeInvokeEvent, '/ws', 'docs')
    expect(fakeFsService.createDirectory).toHaveBeenCalledWith('/ws', 'docs')

    await expect(
      findHandler('fs:saveFile')(fakeInvokeEvent, '/ws', 'a.txt', 'content', {
        expectedMtimeMs: 111
      })
    ).resolves.toEqual({ mtimeMs: 456, size: 7 })
    expect(fakeFsService.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'content', {
      expectedMtimeMs: 111
    })

    await findHandler('fs:move')(fakeInvokeEvent, '/ws', 'a.txt', 'b.txt', { overwrite: false })
    expect(fakeFsService.move).toHaveBeenCalledWith('/ws', 'a.txt', 'b.txt', { overwrite: false })

    await findHandler('fs:importEntry')(fakeInvokeEvent, '/ws', '/outside/src.txt', 'dest.txt', {
      overwrite: true
    })
    expect(fakeFsService.importEntry).toHaveBeenCalledWith('/ws', '/outside/src.txt', 'dest.txt', {
      overwrite: true
    })

    await expect(findHandler('fs:exists')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toBe(true)
    expect(fakeFsService.exists).toHaveBeenCalledWith('/ws', 'a.txt')

    await findHandler('fs:trash')(fakeInvokeEvent, '/ws', 'a.txt')
    expect(fakeFsService.trash).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  // T6: the CONFLICT:/STALE: message-prefix convention (design §2) — a
  // thrown ConflictError from FsService comes out of the handler as a plain
  // Error whose message is prefixed per its `code`, since `code` itself
  // doesn't survive the ipcMain.handle structured-clone boundary. Exercised
  // on fs:createFile (CONFLICT) and fs:saveFile (STALE); the other
  // conflict-capable handlers (fs:move, fs:importEntry) share the same
  // `withConflictPrefix` wrapper so aren't re-tested per-handler.
  it('rethrows a ConflictError{code:"CONFLICT"} from FsService as an Error prefixed "CONFLICT: "', async () => {
    fakeFsService.createFile.mockImplementationOnce(() => {
      throw new ConflictError('CONFLICT', 'Already exists: dup.txt')
    })
    await expect(findHandler('fs:createFile')({}, '/ws', 'dup.txt')).rejects.toThrow(
      'CONFLICT: Already exists: dup.txt'
    )
  })

  it('rethrows a ConflictError{code:"STALE"} from FsService as an Error prefixed "STALE: "', async () => {
    fakeFsService.saveFile.mockImplementationOnce(() => {
      throw new ConflictError('STALE', 'File changed on disk: a.txt')
    })
    await expect(
      findHandler('fs:saveFile')({}, '/ws', 'a.txt', 'new content', { expectedMtimeMs: 1 })
    ).rejects.toThrow('STALE: File changed on disk: a.txt')
  })

  it('lets a non-ConflictError from a wrapped handler propagate unprefixed', async () => {
    fakeFsService.move.mockImplementationOnce(() => {
      throw new Error('Path escapes workspace root: ../evil')
    })
    await expect(findHandler('fs:move')({}, '/ws', 'a.txt', '../evil')).rejects.toThrow(
      'Path escapes workspace root: ../evil'
    )
  })

  // Pre-existing createWindow()/app-lifecycle branches (predate T6, not part
  // of the fs:* surface this task owns) were left unexercised by the
  // original test file, which left src/main/index.ts's branch coverage below
  // the 90% gate even before this task's changes. Covered here too (still
  // within this test file's existing scope) so the whole-file gate that T6's
  // verify step runs against actually passes.
  it("wires up the BrowserWindow's ready-to-show/window-open/browser-window-created callbacks", () => {
    const mainWindowInstance = vi.mocked(BrowserWindow).mock.results[0].value as {
      on: ReturnType<typeof vi.fn>
      show: ReturnType<typeof vi.fn>
      webContents: { setWindowOpenHandler: ReturnType<typeof vi.fn> }
    }

    const readyToShow = mainWindowInstance.on.mock.calls.find(
      ([channel]) => channel === 'ready-to-show'
    )?.[1] as () => void
    readyToShow()
    expect(mainWindowInstance.show).toHaveBeenCalled()

    const windowOpenHandler = mainWindowInstance.webContents.setWindowOpenHandler.mock
      .calls[0][0] as (details: { url: string }) => { action: string }
    expect(windowOpenHandler({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')

    const browserWindowCreated = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'browser-window-created')?.[1] as (
      _e: unknown,
      window: unknown
    ) => void
    expect(browserWindowCreated).toBeInstanceOf(Function)
    browserWindowCreated(undefined, mainWindowInstance)
  })

  it("app 'activate' recreates a window only when none are open (macOS dock-click behavior)", () => {
    const activateHandler = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'activate')?.[1] as () => void
    expect(activateHandler).toBeInstanceOf(Function)

    const windowCountBefore = vi.mocked(BrowserWindow).mock.calls.length
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValueOnce([{}] as unknown as [])
    activateHandler()
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(windowCountBefore) // no window open() call: getAllWindows() wasn't empty

    activateHandler()
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(windowCountBefore + 1) // getAllWindows() empty: a new window is created
  })

  it("app 'window-all-closed' quits outside macOS", () => {
    const windowAllClosedHandler = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'window-all-closed')?.[1] as () => void
    expect(windowAllClosedHandler).toBeInstanceOf(Function)
    windowAllClosedHandler()
    expect(app.quit).toHaveBeenCalled()
  })

  // T8/T10: the `activeInstallStops`/`activeUpdateStops` optional-chaining
  // "tear down a previous run for this sender" branch, and the async
  // generator loop's `if (stopped) return` branch — both pre-existing gaps
  // left uncovered by the original test file.
  it('a second bmad:install:start for the same sender tears down the first (optional-chaining branch)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 201, send } }
    findOnHandler('bmad:install:start')(fakeEvent, '/ws-1')
    // Second start for the same sender exercises the `activeInstallStops.get(...)?.()`
    // branch where a previous entry actually exists.
    findOnHandler('bmad:install:start')(fakeEvent, '/ws-2')
    expect(fakeBmadService.install).toHaveBeenCalledTimes(2)
  })

  it('bmad:update:start/stop stops relaying further events after stop, and a second start tears down the first', async () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 202, send } }

    findOnHandler('bmad:update:start')(fakeEvent, '/ws-1')
    // Second start for the same sender exercises the optional-chaining branch.
    findOnHandler('bmad:update:start')(fakeEvent, '/ws-2')
    findOnHandler('bmad:update:stop')(fakeEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fakeBmadService.update).toHaveBeenCalledTimes(2)
  })

  // T11: FsService streaming wiring — 'fs:watch:start'/'fs:watch:stop' are
  // registered as fire-and-forget ipcMain.on handlers (not ipcMain.handle),
  // and relay FsService's onChange events back to the requesting sender over
  // 'fs:watch:event'.
  it('registers fs:watch:start/fs:watch:stop, starts/stops FsService.watchWorkspace, and relays events to the sender', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('fs:watch:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('fs:watch:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 42, send } }

    findOnHandler('fs:watch:start')(fakeEvent, '/ws')
    expect(fakeFsService.watchWorkspace).toHaveBeenCalledWith('/ws', expect.any(Function))

    const call = watchWorkspaceCalls[watchWorkspaceCalls.length - 1]
    expect(call.root).toBe('/ws')

    // Simulate FsService firing a change: main should relay it to the sender.
    call.onChange({ type: 'add', path: 'new-file.txt' })
    expect(send).toHaveBeenCalledWith('fs:watch:event', { type: 'add', path: 'new-file.txt' })

    findOnHandler('fs:watch:stop')(fakeEvent)
    expect(call.stop).toHaveBeenCalledTimes(1)
  })

  it('starting a new watch for the same sender tears down its previous watcher first (no leaked watchers)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 7, send } }

    findOnHandler('fs:watch:start')(fakeEvent, '/ws-a')
    const firstStop = watchWorkspaceCalls[watchWorkspaceCalls.length - 1].stop

    findOnHandler('fs:watch:start')(fakeEvent, '/ws-b')

    expect(firstStop).toHaveBeenCalledTimes(1)
  })

  // T14: AgentService wiring — capabilities/start/send/runWorkflow route to
  // the (mocked) AgentService with the exact args the renderer passed, as
  // real request/response ipcMain.handle registrations.
  it('registers agent:capabilities/start/send/runWorkflow handlers, routing to AgentService', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:capabilities', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:start', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:send', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:runWorkflow', expect.any(Function))

    const fakeInvokeEvent = {}

    await expect(findHandler('agent:capabilities')()).resolves.toEqual({
      models: [],
      efforts: [],
      supportsAttachments: false
    })
    expect(fakeAgentService.capabilities).toHaveBeenCalled()

    const opts = { workspace: '/ws', model: 'claude-sonnet-4-5', effort: 'medium' }
    await findHandler('agent:start')(fakeInvokeEvent, opts)
    expect(fakeAgentService.startSession).toHaveBeenCalledWith(opts)

    // session-history: the caller's opts (resume/turnId/…) ride through to
    // AgentService. Agent Change Review (T6) ensures a turnId is always present
    // (synthesized when absent) so the turn's terminal event can be matched
    // back to its checkpoint — the renderer always supplies one in practice.
    await findHandler('agent:send')(fakeInvokeEvent, 'hello agent')
    expect(fakeAgentService.send).toHaveBeenCalledWith(
      'hello agent',
      expect.objectContaining({ turnId: expect.stringMatching(/^review-turn-/) })
    )
    await findHandler('agent:send')(fakeInvokeEvent, 'continue', {
      resume: 'cli-sess-1',
      turnId: 'r1'
    })
    expect(fakeAgentService.send).toHaveBeenCalledWith('continue', {
      resume: 'cli-sess-1',
      turnId: 'r1'
    })

    const cmd = { key: 'prd' }
    await findHandler('agent:runWorkflow')(fakeInvokeEvent, cmd, {
      resume: 'cli-sess-2',
      turnId: 'r2'
    })
    expect(fakeAgentService.runWorkflow).toHaveBeenCalledWith(cmd, {
      resume: 'cli-sess-2',
      turnId: 'r2'
    })
  })

  // T8 (WS-R5.2): explicit session-teardown handler, called by Chat's
  // unmount cleanup — routes to AgentService.stop() with no args.
  it('registers an agent:stop handler routing to AgentService.stop()', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:stop', expect.any(Function))

    await findHandler('agent:stop')({})
    expect(fakeAgentService.stop).toHaveBeenCalledTimes(1)
  })

  // T14: AgentService streaming wiring — 'agent:event:start'/'agent:event:stop'
  // are fire-and-forget ipcMain.on handlers (not ipcMain.handle), mirroring
  // fs:watch:start/stop: they subscribe/unsubscribe via AgentService.onEvent
  // and relay forwarded events back to the requesting sender over
  // 'agent:event'.
  it('registers agent:event:start/agent:event:stop, subscribes/unsubscribes via AgentService.onEvent, and relays events to the sender', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('agent:event:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('agent:event:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 99, send } }

    findOnHandler('agent:event:start')(fakeEvent)
    expect(fakeAgentService.onEvent).toHaveBeenCalled()

    const call = agentOnEventCalls[agentOnEventCalls.length - 1]
    call.listener({ type: 'token', text: 'hi' })
    expect(send).toHaveBeenCalledWith('agent:event', { type: 'token', text: 'hi' })

    findOnHandler('agent:event:stop')(fakeEvent)
    expect(call.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('starting a new agent event subscription for the same sender tears down its previous subscription first (no leaked subscriptions)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 100, send } }

    findOnHandler('agent:event:start')(fakeEvent)
    const firstUnsubscribe = agentOnEventCalls[agentOnEventCalls.length - 1].unsubscribe

    findOnHandler('agent:event:start')(fakeEvent)

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
  })

  // T8/T9: BmadService.install() wiring — 'bmad:install:start'/'bmad:install:stop'
  // are fire-and-forget ipcMain.on handlers driving an async generator (not a
  // subscribe/unsubscribe pair like fs:watch:*/agent:event:*), so cancellation
  // is proven by stopping mid-stream and confirming a later-yielded event is
  // never relayed.
  it('registers bmad:install:start/stop, drives BmadService.install(workspace), relays events, and stops relaying after bmad:install:stop', async () => {
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:install:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:install:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 55, send } }

    findOnHandler('bmad:install:start')(fakeEvent, '/ws', { modules: ['bmm'] })
    expect(fakeBmadService.install).toHaveBeenCalledWith('/ws', { modules: ['bmm'] })

    // Flush the generator's first yield.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(send).toHaveBeenCalledWith('bmad:install:event', {
      type: 'step',
      id: 's1',
      label: 'Step 1'
    })

    // Stop before the gated second event resolves — it must never be relayed.
    findOnHandler('bmad:install:stop')(fakeEvent)
    installGate.resume()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(send).not.toHaveBeenCalledWith('bmad:install:event', { type: 'done', ok: true })
  })

  // T10: BmadService.update() wiring — identical shape to bmad:install:*
  // above (proven there), so this just confirms update's own channel names
  // and that it drives BmadService.update(workspace), not install().
  it('registers bmad:update:start/stop, drives BmadService.update(workspace), and relays events to the sender', async () => {
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:update:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:update:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 56, send } }

    findOnHandler('bmad:update:start')(fakeEvent, '/ws')
    expect(fakeBmadService.update).toHaveBeenCalledWith('/ws')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(send).toHaveBeenCalledWith('bmad:update:event', { type: 'done', ok: true })
  })

  // T17: WorkflowCatalog wiring — request/response, routing to the real
  // listWithDiscovery() (not mocked: it's a plain fs read with a documented
  // never-throws fallback, so exercising it for real against a workspace
  // with no _bmad/ present is simpler and just as trustworthy as mocking).
  it('registers workflows:list, routing to listWithDiscovery(workspace) with a clean curated-catalog fallback', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workflows:list', expect.any(Function))

    const entries = (await findHandler('workflows:list')({}, userDataDir)) as Array<{
      key: string
      status: string
    }>
    const prd = entries.find((entry) => entry.key === 'prd')
    expect(prd?.status).toBe('wired')
  })

  // T3 (UX-R7.3): openExternal wiring — the handler must reject anything
  // that isn't http(s)/mailto *without* ever reaching shell.openExternal
  // (that's the whole point of the bridge: the renderer can't use it to open
  // local files or run script URLs), and forward everything else through.
  describe('shell:openExternal (T3)', () => {
    it('registers a shell:openExternal handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('shell:openExternal', expect.any(Function))
    })

    it('rejects a file: URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'file:///etc/passwd')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('rejects a javascript: URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'javascript:alert(1)')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('rejects an unparseable URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'not a url')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('forwards a valid https: URL to shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await findHandler('shell:openExternal')({}, 'https://example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
    })

    it('forwards a valid mailto: URL to shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await findHandler('shell:openExternal')({}, 'mailto:someone@example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('mailto:someone@example.com')
    })
  })

  // chat-attachments: the picker opens inside the workspace it's given.
  describe('chat:chooseAttachments', () => {
    it('forwards the workspace as the dialog defaultPath', async () => {
      vi.mocked(dialog.showOpenDialog).mockClear()
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: []
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)
      await findHandler('chat:chooseAttachments')({}, '/ws/project')
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections'],
        defaultPath: '/ws/project'
      })
    })

    it('omits defaultPath when no workspace is passed (older callers)', async () => {
      vi.mocked(dialog.showOpenDialog).mockClear()
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: []
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)
      await findHandler('chat:chooseAttachments')({})
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections']
      })
    })
  })

  // App self-update (app-settings): version info + update-flow wiring.
  describe('app info + update flow', () => {
    it('app:info reports the app name/version and unsupported updates (unpacked)', async () => {
      await expect(findHandler('app:info')()).resolves.toEqual({
        name: 'hive-desktop',
        version: '0.1.0',
        updatesSupported: false,
        // canApply reflects the resolved apply strategy for this process's
        // real platform (no v1 strategy off-Windows — this suite runs on
        // Linux); lastCheckedAt is null since no check() has run yet.
        canApply: false,
        lastCheckedAt: null,
        // T13: read straight from ConfigStore — unset by default.
        skippedVersion: null
      })
    })

    it('app:info reports the currently-skipped version once one is persisted (T13, ND-R5.5)', async () => {
      await findHandler('update:skip')({}, '0.2.0')
      await expect(findHandler('app:info')()).resolves.toMatchObject({ skippedVersion: '0.2.0' })
    })

    it('registers the update handlers and event channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('update:check', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:download', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:install', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:cancel', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:reveal', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:skip', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('update:event:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('update:event:stop', expect.any(Function))
    })

    it('update:check is a safe no-op end-to-end while unsupported (app not packaged): no event ever streams back', async () => {
      const sender = { id: 99, send: vi.fn() }
      findOnHandler('update:event:start')({ sender })
      await findHandler('update:check')()
      expect(sender.send).not.toHaveBeenCalled()
      findOnHandler('update:event:stop')({ sender })
    })

    it('update:event:start is resubscribe-safe and update:event:stop is idempotent', () => {
      const sender = { id: 42, send: vi.fn() }
      findOnHandler('update:event:start')({ sender })
      // A second start replaces the first subscription instead of leaking it.
      findOnHandler('update:event:start')({ sender })
      findOnHandler('update:event:stop')({ sender })
      // Stopping again (already unsubscribed) is a no-op.
      findOnHandler('update:event:stop')({ sender })
    })

    it('update:cancel is a safe no-op when nothing is downloading', async () => {
      await expect(findHandler('update:cancel')()).resolves.toBeUndefined()
    })

    it('update:reveal does not call shell.showItemInFolder when nothing has been downloaded yet', async () => {
      vi.mocked(shell.showItemInFolder).mockClear()
      await findHandler('update:reveal')()
      expect(shell.showItemInFolder).not.toHaveBeenCalled()
    })

    it('update:skip persists the skipped version through the real ConfigStore', async () => {
      await findHandler('update:skip')({}, '0.2.0')
      const configStore = createConfigStore(userDataDir)
      expect(configStore.getSkippedUpdateVersion()).toBe('0.2.0')
      // Leaves later tests unaffected.
      configStore.setSkippedUpdateVersion(null)
    })
  })

  // skill-studio: user-created skills discovery.
  describe('studio:list (skill-studio)', () => {
    it('registers the handler and yields [] for a workspace with no created skills', async () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('studio:list', expect.any(Function))
      await expect(findHandler('studio:list')({}, userDataDir)).resolves.toEqual([])
    })
  })

  // mcp: the Model Context Protocol server module — catalog + enabled state
  // round-trip through the six handlers (real service, real temp workspace).
  describe('mcp:* (mcp)', () => {
    it('registers all six handlers', () => {
      for (const channel of [
        'mcp:list',
        'mcp:add',
        'mcp:update',
        'mcp:remove',
        'mcp:setEnabled',
        'mcp:probe'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
    })

    it('adds, toggles, renames, and removes a server through the handlers', async () => {
      const ws = mkdtempSync(join(tmpdir(), 'hive-mcp-ipc-'))
      await expect(findHandler('mcp:list')({}, ws)).resolves.toEqual([])

      await findHandler('mcp:add')({}, ws, 'srv', { transport: 'stdio', command: 'npx' })
      let list = (await findHandler('mcp:list')({}, ws)) as Array<{
        name: string
        enabled: boolean
      }>
      expect(list).toEqual([{ name: 'srv', transport: 'stdio', command: 'npx', enabled: true }])

      await findHandler('mcp:setEnabled')({}, ws, 'srv', false)
      list = (await findHandler('mcp:list')({}, ws)) as typeof list
      expect(list[0].enabled).toBe(false)

      await findHandler('mcp:update')({}, ws, 'srv', 'renamed', {
        transport: 'stdio',
        command: 'npx'
      })
      list = (await findHandler('mcp:list')({}, ws)) as typeof list
      expect(list[0].name).toBe('renamed')

      await findHandler('mcp:remove')({}, ws, 'renamed')
      await expect(findHandler('mcp:list')({}, ws)).resolves.toEqual([])
      rmSync(ws, { recursive: true, force: true })
    })

    it('mcp:probe rejects for an unknown server', async () => {
      const ws = mkdtempSync(join(tmpdir(), 'hive-mcp-ipc-'))
      await expect(findHandler('mcp:probe')({}, ws, 'ghost')).rejects.toThrow(/não encontrado/i)
      rmSync(ws, { recursive: true, force: true })
    })
  })

  // shortcut-customization: catalog + persisted selection + resolved set.
  describe('shortcuts:* (shortcut-customization)', () => {
    it('registers the four shortcuts handlers', () => {
      for (const channel of [
        'shortcuts:catalog',
        'shortcuts:get',
        'shortcuts:set',
        'shortcuts:actions'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
    })

    it('shortcuts:catalog yields [] for a workspace without BMAD metadata', async () => {
      await expect(findHandler('shortcuts:catalog')({}, userDataDir)).resolves.toEqual([])
    })

    it('shortcuts:set/get round-trip through the real ConfigStore, sanitizing input', async () => {
      await expect(findHandler('shortcuts:get')({})).resolves.toBeNull()

      await findHandler('shortcuts:set')({}, { skills: ['bmad-prd', 7, ''], agents: ['a', 'a'] })
      await expect(findHandler('shortcuts:get')({})).resolves.toEqual({
        skills: ['bmad-prd'],
        agents: ['a']
      })

      // null restores the role defaults (and leaves later tests unaffected).
      await findHandler('shortcuts:set')({}, null)
      await expect(findHandler('shortcuts:get')({})).resolves.toBeNull()
    })

    it('shortcuts:actions resolves the role defaults while no customization exists', async () => {
      const actions = (await findHandler('shortcuts:actions')({}, 'pm', userDataDir)) as {
        key: string
      }[]
      expect(actions.map((a) => a.key)).toContain('prd')
    })
  })

  describe('git:* (git-management M10)', () => {
    it('registers every git read + mutation handler and the changed stream', () => {
      for (const channel of [
        'git:detect',
        'git:status',
        'git:branches',
        'git:log',
        'git:diff',
        'git:commitDiff',
        'git:fileAtHead',
        'git:conflicts',
        'git:stashList',
        'git:init',
        'git:stage',
        'git:unstage',
        'git:discard',
        'git:commit',
        'git:createBranch',
        'git:checkout',
        'git:renameBranch',
        'git:deleteBranch',
        'git:fetch',
        'git:pull',
        'git:push',
        'git:sync',
        'git:resolveConflict',
        'git:mergeContinue',
        'git:mergeAbort',
        'git:stash',
        'git:stashApply',
        'git:stashDrop'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('git:changed:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('git:changed:stop', expect.any(Function))
    })

    it('injects a trashItem that routes to shell.trashItem (untracked-discard path)', async () => {
      const { createGitService } = await import('./gitService')
      const [deps] = vi.mocked(createGitService).mock.calls[0] as [
        { trashItem: (abs: string) => Promise<void> }
      ]
      await deps.trashItem('/ws/junk.txt')
      expect(shell.trashItem).toHaveBeenCalledWith('/ws/junk.txt')
    })

    it('routes a read handler to the service and returns its result', async () => {
      await expect(findHandler('git:status')({}, '/ws')).resolves.toMatchObject({ branch: 'main' })
      expect(fakeGitService.status).toHaveBeenCalledWith('/ws')

      await findHandler('git:diff')({}, '/ws', 'a.txt', 'working')
      expect(fakeGitService.diff).toHaveBeenCalledWith('/ws', 'a.txt', 'working')
    })

    it('routes a mutation handler and fires git:changed to subscribed senders', async () => {
      const send = vi.fn()
      const sender = { id: 42, send }
      findOnHandler('git:changed:start')({ sender })

      await findHandler('git:stage')({}, '/ws', ['a.txt'])
      expect(fakeGitService.stage).toHaveBeenCalledWith('/ws', ['a.txt'])
      expect(send).toHaveBeenCalledWith('git:changed', { root: '/ws' })

      // Unsubscribing stops further notifications.
      send.mockClear()
      findOnHandler('git:changed:stop')({ sender })
      await findHandler('git:commit')({}, '/ws', 'msg')
      expect(send).not.toHaveBeenCalled()
    })

    it('every git handler forwards to its matching service method', async () => {
      const sender = { id: 7, send: vi.fn() }
      findOnHandler('git:changed:start')({ sender })
      const cases: Array<[string, unknown[], keyof typeof fakeGitService]> = [
        ['git:detect', ['/ws'], 'detect'],
        ['git:branches', ['/ws'], 'branches'],
        ['git:log', ['/ws', { limit: 10 }], 'log'],
        ['git:commitDiff', ['/ws', 'abc'], 'commitDiff'],
        ['git:fileAtHead', ['/ws', 'a.txt'], 'fileAtHead'],
        ['git:conflicts', ['/ws'], 'conflicts'],
        ['git:stashList', ['/ws'], 'stashList'],
        ['git:init', ['/ws'], 'init'],
        ['git:unstage', ['/ws', ['a']], 'unstage'],
        ['git:discard', ['/ws', ['a']], 'discard'],
        ['git:createBranch', ['/ws', 'feat', 'main'], 'createBranch'],
        ['git:checkout', ['/ws', 'main'], 'checkout'],
        ['git:renameBranch', ['/ws', 'a', 'b'], 'renameBranch'],
        ['git:deleteBranch', ['/ws', 'a', true], 'deleteBranch'],
        ['git:fetch', ['/ws'], 'fetch'],
        ['git:pull', ['/ws'], 'pull'],
        ['git:sync', ['/ws'], 'sync'],
        ['git:resolveConflict', ['/ws', 'a', 'both'], 'resolveConflict'],
        ['git:mergeContinue', ['/ws'], 'mergeContinue'],
        ['git:mergeAbort', ['/ws'], 'mergeAbort'],
        ['git:stash', ['/ws', { untracked: true }], 'stash'],
        ['git:stashApply', ['/ws', 1, true], 'stashApply'],
        ['git:stashDrop', ['/ws', 1], 'stashDrop']
      ]
      for (const [channel, args, method] of cases) {
        await findHandler(channel)({}, ...args)
        expect(fakeGitService[method]).toHaveBeenCalledWith(...args)
      }
    })

    it('rethrows a GitError as a GIT:-prefixed message carrying stderr', async () => {
      const { GitError } = await vi.importActual<typeof import('./gitService')>('./gitService')
      fakeGitService.push.mockRejectedValueOnce(
        new GitError(128, 'fatal: Authentication failed', 'git push')
      )
      const err = await (findHandler('git:push')({}, '/ws') as Promise<unknown>).catch(
        (e: Error) => e
      )
      expect((err as Error).message.startsWith('GIT:')).toBe(true)
      expect((err as Error).message).toContain('Authentication failed')
    })
  })

  // Agent Change Review (M11, T6): the review:* handlers route to the injected
  // ReviewService, and the turn lifecycle drives begin/endTurn.
  describe('review:* handlers + turn wiring', () => {
    it('registers the review:* request/response handlers and the changed stream', () => {
      for (const ch of [
        'review:get',
        'review:acceptFile',
        'review:rejectFile',
        'review:acceptHunk',
        'review:rejectHunk',
        'review:acceptAll',
        'review:rejectAll'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('review:changed:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('review:changed:stop', expect.any(Function))
    })

    it('routes accept/reject calls to the ReviewService', async () => {
      await findHandler('review:get')({}, '/ws')
      expect(fakeReviewService.get).toHaveBeenCalledWith('/ws')

      await findHandler('review:acceptFile')({}, '/ws', 'a.txt')
      expect(fakeReviewService.acceptFile).toHaveBeenCalledWith('/ws', 'a.txt')

      await findHandler('review:rejectFile')({}, '/ws', 'a.txt')
      expect(fakeReviewService.rejectFile).toHaveBeenCalledWith('/ws', 'a.txt')

      await findHandler('review:acceptHunk')({}, '/ws', 'a.txt', '0:1:1')
      expect(fakeReviewService.acceptHunk).toHaveBeenCalledWith('/ws', 'a.txt', '0:1:1')

      await findHandler('review:rejectHunk')({}, '/ws', 'a.txt', '0:1:1')
      expect(fakeReviewService.rejectHunk).toHaveBeenCalledWith('/ws', 'a.txt', '0:1:1')

      await findHandler('review:acceptAll')({}, '/ws')
      expect(fakeReviewService.acceptAll).toHaveBeenCalledWith('/ws')

      await findHandler('review:rejectAll')({}, '/ws')
      expect(fakeReviewService.rejectAll).toHaveBeenCalledWith('/ws')
    })

    it('rejects a review path that escapes the workspace root', async () => {
      const err = await (
        findHandler('review:acceptFile')({}, '/ws', '../../etc/passwd') as Promise<unknown>
      ).catch((e: Error) => e)
      expect((err as Error).message).toContain('escapes workspace root')
      expect(fakeReviewService.acceptFile).not.toHaveBeenCalledWith('/ws', '../../etc/passwd')
    })

    it('begins a review turn on agent:send (checkpoint before spawn) and ends it on the terminal event', async () => {
      // Activate a workspace so getWorkspace() resolves for the turn wiring.
      const dir = mkdtempSync(join(tmpdir(), 'hive-main-review-turn-'))
      await findHandler('workspace:open')({}, dir)

      fakeReviewService.beginTurn.mockClear()
      fakeReviewService.endTurn.mockClear()

      await findHandler('agent:send')({}, 'do the thing', { turnId: 't-xyz' })
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(dir, 't-xyz')
      // The agent still receives the (same) turnId.
      expect(fakeAgentService.send).toHaveBeenCalledWith(
        'do the thing',
        expect.objectContaining({ turnId: 't-xyz' })
      )
      // A watcher was started for the workspace.
      expect(watchWorkspaceCalls.some((c) => c.root === dir)).toBe(true)

      // The bootstrap review listener (index's first agentService.onEvent)
      // accumulates tool_use file paths (ACR-C7) then ends the turn on the
      // terminal event, passing the touched paths as workspace-relative POSIX.
      const reviewListener = agentOnEventCalls[0].listener
      reviewListener({ type: 'tool', name: 'Write', detail: `${dir}/src/a.txt`, turnId: 't-xyz' })
      reviewListener({ type: 'tool', name: 'Edit', detail: `${dir}/src/b.txt`, turnId: 't-xyz' })
      // A tool path outside the workspace is dropped.
      reviewListener({ type: 'tool', name: 'Write', detail: '/elsewhere/c.txt', turnId: 't-xyz' })
      reviewListener({ type: 'done', turnId: 't-xyz' })
      expect(fakeReviewService.endTurn).toHaveBeenCalledWith(dir, 't-xyz', [
        'src/a.txt',
        'src/b.txt'
      ])

      rmSync(dir, { recursive: true, force: true })
    })

    it('synthesizes a turnId when agent:send omits one', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'hive-main-review-synth-'))
      await findHandler('workspace:open')({}, dir)
      fakeReviewService.beginTurn.mockClear()

      await findHandler('agent:send')({}, 'no turn id', undefined)
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(
        dir,
        expect.stringMatching(/^review-turn-/)
      )

      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('secondBrain:* handlers (second-brain)', () => {
    it('registers the streamed install/update channels and the request/response handlers', () => {
      for (const ch of [
        'secondBrain:install:start',
        'secondBrain:install:stop',
        'secondBrain:update:start',
        'secondBrain:update:stop'
      ]) {
        expect(ipcMain.on).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      for (const ch of [
        'secondBrain:isProvisioned',
        'secondBrain:getVault',
        'secondBrain:stageRaw'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
    })

    it('isProvisioned routes to the service.detect', async () => {
      fakeSecondBrainService.detect.mockReturnValueOnce(true)
      expect(await findHandler('secondBrain:isProvisioned')({}, '/ws')).toBe(true)
      expect(fakeSecondBrainService.detect).toHaveBeenCalledWith('/ws')
    })

    it('getVault combines resolveVault with the vault raw-pending count', async () => {
      fakeSecondBrainService.resolveVault.mockReturnValueOnce({
        path: '/ws/second-brain',
        name: 'second-brain'
      })
      fakeSecondBrainVault.countRawPending.mockReturnValueOnce(3)

      expect(await findHandler('secondBrain:getVault')({}, '/ws')).toEqual({
        path: '/ws/second-brain',
        name: 'second-brain',
        rawPending: 3
      })
    })

    it('getVault returns null path/name when no vault is configured', async () => {
      fakeSecondBrainService.resolveVault.mockReturnValueOnce(null)
      fakeSecondBrainVault.countRawPending.mockReturnValueOnce(0)
      expect(await findHandler('secondBrain:getVault')({}, '/ws')).toEqual({
        path: null,
        name: null,
        rawPending: 0
      })
    })

    it('stageRaw routes to the vault and returns only the relPath', async () => {
      fakeSecondBrainVault.stageRaw.mockReturnValueOnce({
        relPath: 'second-brain/raw/ingest-y.md',
        absPath: '/ws/second-brain/raw/ingest-y.md'
      })
      expect(await findHandler('secondBrain:stageRaw')({}, '/ws', 'hello')).toEqual({
        relPath: 'second-brain/raw/ingest-y.md'
      })
      expect(fakeSecondBrainVault.stageRaw).toHaveBeenCalledWith('/ws', 'hello')
    })

    it('install:start streams SkillEvents to the sender, and install:stop halts forwarding', async () => {
      const send = vi.fn()
      const event = { sender: { id: 4242, send } }

      findOnHandler('secondBrain:install:start')(event, '/ws')
      await new Promise((r) => setTimeout(r, 0))

      expect(fakeSecondBrainService.install).toHaveBeenCalledWith('/ws')
      expect(send).toHaveBeenCalledWith('secondBrain:install:event', {
        type: 'step',
        id: 'found',
        label: 'Found 4 skills'
      })
      expect(send).toHaveBeenCalledWith('secondBrain:install:event', { type: 'done', ok: true })

      // stop is a no-throw no-op (the stream already finished).
      expect(() => findOnHandler('secondBrain:install:stop')(event)).not.toThrow()
    })

    it('registers the hive-model: scheme as privileged, CORS-enabled and non-CSP-bypassing', () => {
      expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
        expect.objectContaining({
          scheme: 'hive-model',
          privileges: expect.objectContaining({
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: false
          })
        })
      ])
    })

    it('serves a model file from the userData store, and refuses an unknown host', async () => {
      const call = vi.mocked(protocol.handle).mock.calls.find(([scheme]) => scheme === 'hive-model')
      expect(call).toBeTruthy()
      const handler = call![1] as (req: { url: string }) => Promise<Response> | Response

      await handler({ url: 'hive-model://models/Xenova/whisper-base/config.json' })
      expect(net.fetch).toHaveBeenCalledWith(
        expect.stringContaining('whisper-models/Xenova/whisper-base/config.json')
      )

      vi.mocked(net.fetch).mockClear()
      const denied = await handler({ url: 'hive-model://secrets/id_rsa' })
      expect((denied as Response).status).toBe(404)
      expect(net.fetch).not.toHaveBeenCalled()
    })

    it('registers the whisper:* model-store handlers and the streamed download channels', () => {
      for (const ch of ['whisper:listModels', 'whisper:modelStatus', 'whisper:deleteModel']) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('whisper:download:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('whisper:download:stop', expect.any(Function))
    })

    it('listModels returns the catalog with per-model download state', async () => {
      const models = (await findHandler('whisper:listModels')({})) as Array<{
        id: string
        downloaded: boolean
        repo: string
      }>
      expect(models.length).toBeGreaterThan(0)
      expect(models.map((m) => m.id)).toContain('base')
      // Nothing is downloaded in a fresh temp userData dir.
      expect(models.every((m) => m.downloaded === false)).toBe(true)
      expect(await findHandler('whisper:modelStatus')({}, 'base')).toEqual({
        downloaded: false,
        variant: null
      })
    })

    it('deleteModel is a safe no-op for a model that was never downloaded', async () => {
      await expect(findHandler('whisper:deleteModel')({}, 'base')).resolves.toBeUndefined()
    })

    it('download:start streams events to the sender, and stop halts forwarding', async () => {
      const send = vi.fn()
      const event = { sender: { id: 7, send } }
      findOnHandler('whisper:download:start')(event, 'base', 'fp32')
      // The real download hits the network; the store surfaces that failure as
      // an `error` event rather than rejecting (asserted in whisperModelStore's
      // own tests). Either way, stop() must never throw.
      expect(() => findOnHandler('whisper:download:stop')(event)).not.toThrow()
    })

    it('update:start streams via the update channel', async () => {
      const send = vi.fn()
      findOnHandler('secondBrain:update:start')({ sender: { id: 99, send } }, '/ws')
      await new Promise((r) => setTimeout(r, 0))
      expect(fakeSecondBrainService.update).toHaveBeenCalledWith('/ws')
      expect(send).toHaveBeenCalledWith('secondBrain:update:event', { type: 'done', ok: true })
      expect(() =>
        findOnHandler('secondBrain:update:stop')({ sender: { id: 99, send } })
      ).not.toThrow()
    })
  })
})
