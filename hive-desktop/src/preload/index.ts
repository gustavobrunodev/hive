import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { FsChangeEvent, TreeNode } from '../main/fsService'
import type {
  AgentCapabilities,
  AgentEvent,
  SessionOpts,
  WorkflowCommand
} from '../main/agentAdapter'
import type { BmadEvent } from '../main/bmadService'

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
  },

  // AgentService (T14). Grouped under a nested `agent` namespace (unlike the
  // flat top-level methods above) to match design.md §3's IPC surface
  // (`agent.capabilities()`, `agent.start(opts)`, `agent.send(...)`,
  // `agent.runWorkflow(key)`). `capabilities`/`start`/`send`/`runWorkflow`
  // are plain invoke/response calls — even though a session's *events*
  // stream separately via `onEvent`, starting/sending/running a workflow
  // just needs to succeed or fail. `onEvent` is the streaming half and
  // follows the exact `watchWorkspace` channel-pattern above: one
  // main -> renderer event channel ('agent:event'), a start/stop pair of
  // renderer -> main sends ('agent:event:start'/'agent:event:stop'), and a
  // subscribe-returning-unsubscribe shape.
  agent: {
    capabilities: (): Promise<AgentCapabilities> => ipcRenderer.invoke('agent:capabilities'),
    start: (opts: SessionOpts): Promise<void> => ipcRenderer.invoke('agent:start', opts),
    send: (text: string): Promise<void> => ipcRenderer.invoke('agent:send', text),
    runWorkflow: (cmd: WorkflowCommand): Promise<void> =>
      ipcRenderer.invoke('agent:runWorkflow', cmd),
    onEvent: (onEvent: (evt: AgentEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, evt: AgentEvent): void => onEvent(evt)
      ipcRenderer.on('agent:event', listener)
      ipcRenderer.send('agent:event:start')
      return () => {
        ipcRenderer.removeListener('agent:event', listener)
        ipcRenderer.send('agent:event:stop')
      }
    }
  },

  // BmadService (T8/T9), streaming. Same channel-pattern as `watchWorkspace`
  // above: 'bmad:install:event' pushes each BmadEvent, a start/stop pair of
  // renderer -> main sends drives the underlying install, and the bridge
  // method returns an unsubscribe function. Unlike `watchWorkspace`, the
  // underlying stream naturally ends on its own (a `done`/`error` event is
  // always the last one) — `unsubscribe` is still provided for an early-exit
  // case (e.g. the onboarding screen unmounting mid-install).
  installBmad: (workspace: string, onEvent: (evt: BmadEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, evt: BmadEvent): void => onEvent(evt)
    ipcRenderer.on('bmad:install:event', listener)
    ipcRenderer.send('bmad:install:start', workspace)
    return () => {
      ipcRenderer.removeListener('bmad:install:event', listener)
      ipcRenderer.send('bmad:install:stop')
    }
  },

  // BmadService.update() (T10) — identical shape to installBmad above, on
  // its own channel pair.
  updateBmad: (workspace: string, onEvent: (evt: BmadEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, evt: BmadEvent): void => onEvent(evt)
    ipcRenderer.on('bmad:update:event', listener)
    ipcRenderer.send('bmad:update:start', workspace)
    return () => {
      ipcRenderer.removeListener('bmad:update:event', listener)
      ipcRenderer.send('bmad:update:stop')
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
