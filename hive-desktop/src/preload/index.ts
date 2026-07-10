import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { FsChangeEvent, TreeNode } from '../main/fsService'

// The single typed bridge for all privileged (main-process) calls the renderer
// may make. Every future IPC method (T4+) is added here, not as a separate
// contextBridge.exposeInMainWorld call — this keeps the renderer's entire
// privileged surface enumerable in one place.
const hive = {
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
  chooseWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:choose'),
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
  isProvisioned: (): Promise<boolean> => ipcRenderer.invoke('workspace:isProvisioned'),

  // FsService (T11), request/response — same invoke/response shape as the
  // methods above.
  listTree: (root: string, relativePath?: string): Promise<TreeNode[]> =>
    ipcRenderer.invoke('fs:listTree', root, relativePath),
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
