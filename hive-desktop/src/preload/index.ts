import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// The single typed bridge for all privileged (main-process) calls the renderer
// may make. Every future IPC method (T4+) is added here, not as a separate
// contextBridge.exposeInMainWorld call — this keeps the renderer's entire
// privileged surface enumerable in one place.
const hive = {
  ping: (): Promise<string> => ipcRenderer.invoke('ping')
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
