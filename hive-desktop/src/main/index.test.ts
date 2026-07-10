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

function findHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no ipcMain.handle registered for "${channel}"`)
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
})
