import { describe, expect, it, vi, beforeAll } from 'vitest'
import { contextBridge, ipcRenderer } from 'electron'

// Mocks Electron's contextBridge/ipcRenderer (and the template's
// @electron-toolkit/preload helper, which itself imports 'electron') so the
// preload script can be imported and exercised outside a real Electron
// renderer process.
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn((channel: string) => Promise.resolve(`invoked:${channel}`)) },
  webFrame: {},
  webUtils: {}
}))

vi.mock('@electron-toolkit/preload', () => ({
  electronAPI: { ipcRenderer: {}, webFrame: {}, webUtils: {}, process: {} }
}))

function exposedGlobals(): Map<string, unknown> {
  const calls = vi.mocked(contextBridge.exposeInMainWorld).mock.calls
  return new Map(calls.map(([key, value]) => [key as string, value]))
}

describe('preload: window.hive bridge', () => {
  beforeAll(async () => {
    await import('./index')
  })

  it('exposes "hive" with a typed ping() method, as the pattern for all future IPC', () => {
    const globals = exposedGlobals()
    expect(globals.has('hive')).toBe(true)
    expect(globals.get('hive')).toEqual(expect.objectContaining({ ping: expect.any(Function) }))
  })

  it('hive.ping() round-trips through ipcRenderer.invoke("ping")', async () => {
    const hive = exposedGlobals().get('hive') as { ping: () => Promise<string> }
    await expect(hive.ping()).resolves.toBe('invoked:ping')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('ping')
  })

  // Proving "renderer has no require/fs/child_process access" from *this*
  // test would be hollow: the module under test never imports those, so a
  // string/shape check here only tests our mocks. The real, meaningful proof
  // is structural — see src/main/index.test.ts, which asserts the
  // BrowserWindow webPreferences (contextIsolation/sandbox/nodeIntegration)
  // that make Node APIs unreachable from the renderer in the first place.
})
