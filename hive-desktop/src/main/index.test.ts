import { afterAll, describe, expect, it, vi, beforeAll } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'

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
      getPath: vi.fn(() => userDataDir)
    },
    BrowserWindow: BrowserWindowMock,
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    shell: { openExternal: vi.fn() },
    dialog: { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) }
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
      })
    }
  }
})

vi.mock('./fsService', () => ({ createFsService: vi.fn(() => fakeFsService) }))

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
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/picked/workspace']
    } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)

    await expect(findHandler('workspace:choose')()).resolves.toBe('/picked/workspace')
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    await expect(findHandler('workspace:get')()).resolves.toBe('/picked/workspace')
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

    await findHandler('agent:send')(fakeInvokeEvent, 'hello agent')
    expect(fakeAgentService.send).toHaveBeenCalledWith('hello agent')

    const cmd = { key: 'prd' }
    await findHandler('agent:runWorkflow')(fakeInvokeEvent, cmd)
    expect(fakeAgentService.runWorkflow).toHaveBeenCalledWith(cmd)
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

    findOnHandler('bmad:install:start')(fakeEvent, '/ws')
    expect(fakeBmadService.install).toHaveBeenCalledWith('/ws')

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
})
