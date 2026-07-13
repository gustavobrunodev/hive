import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { EntryMeta, FsChangeEvent, TreeNode } from '../main/fsService'
import type {
  AgentCapabilities,
  AgentEvent,
  SessionOpts,
  WorkflowCommand
} from '../main/agentAdapter'
import type { BmadEvent, BmadInstallOptions } from '../main/bmadService'
import type { WorkflowEntry } from '../main/workflowCatalog'
import type { OpenResult } from '../main/workspaceService'

// Typed counterpart to main/index.ts's `CONFLICT:`/`STALE:` message-prefix
// convention (see the `withConflictPrefix` comment there for why a prefix
// rather than a serialized custom Error field). `withTypedConflict` wraps an
// invoke call and, on a prefixed rejection, throws this instead — giving the
// renderer a discriminable `.code` to branch on rather than parsing strings.
export class FsConflictError extends Error {
  code: 'CONFLICT' | 'STALE'

  constructor(code: 'CONFLICT' | 'STALE', message: string) {
    super(message)
    this.name = 'FsConflictError'
    this.code = code
  }
}

const CONFLICT_PREFIXES = ['CONFLICT', 'STALE'] as const

function withTypedConflict<Args extends unknown[], R>(
  invoke: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await invoke(...args)
    } catch (err) {
      if (err instanceof Error) {
        for (const code of CONFLICT_PREFIXES) {
          const prefix = `${code}: `
          if (err.message.startsWith(prefix)) {
            throw new FsConflictError(code, err.message.slice(prefix.length))
          }
        }
      }
      throw err
    }
  }
}

// The single typed bridge for all privileged (main-process) calls the renderer
// may make. Every future IPC method (T4+) is added here, not as a separate
// contextBridge.exposeInMainWorld call — this keeps the renderer's entire
// privileged surface enumerable in one place.
const hive = {
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
  chooseWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:choose'),
  // openExternal (T3, UX-R7.3): forwards to main's 'shell:openExternal'
  // handler, which validates the URL is http(s)/mailto before calling
  // shell.openExternal — see main/index.ts for the full rationale.
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
  isProvisioned: (): Promise<boolean> => ipcRenderer.invoke('workspace:isProvisioned'),
  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching methods, same
  // invoke/response shape as the three methods above.
  provisionState: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('workspace:provisionState', path),
  getRecentWorkspaces: (): Promise<string[]> => ipcRenderer.invoke('workspace:recents'),
  openWorkspace: (path: string): Promise<OpenResult> => ipcRenderer.invoke('workspace:open', path),

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
    // T8 (WS-R5.2): explicit teardown of the active session, called from
    // `Chat`'s unmount cleanup so a switched-away-from workspace's session
    // doesn't linger orphaned when no new session starts right after.
    stop: (): Promise<void> => ipcRenderer.invoke('agent:stop'),
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
  installBmad: (
    workspace: string,
    options: BmadInstallOptions,
    onEvent: (evt: BmadEvent) => void
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, evt: BmadEvent): void => onEvent(evt)
    ipcRenderer.on('bmad:install:event', listener)
    ipcRenderer.send('bmad:install:start', workspace, options)
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
  },

  // WorkflowCatalog (T17), grouped under a `workflows` namespace (matching
  // design.md §3's `workflows.list()`), plain invoke/response — a one-shot
  // list, not a stream.
  workflows: {
    list: (workspace: string): Promise<WorkflowEntry[]> =>
      ipcRenderer.invoke('workflows:list', workspace)
  },

  // File management (T6/T7), grouped under an `fs` namespace matching
  // design.md §3. Each wrapper's arg order mirrors the corresponding
  // `fs:<name>` handler in main/index.ts exactly. `createFile`/`saveFile`/
  // `move`/`importEntry` can reject with a `CONFLICT:`/`STALE:`-prefixed
  // Error (main/index.ts's `withConflictPrefix`, since a custom `.code` on a
  // thrown Error doesn't survive the IPC structured-clone boundary) — those
  // four are wrapped with `withTypedConflict` below, which strips the prefix
  // and rejects with a `FsConflictError` carrying a discriminable `code`
  // instead. `statFile`/`createDirectory`/`exists`/`trash` can't hit a
  // conflict, so they invoke directly.
  fs: {
    statFile: (root: string, relativePath: string): Promise<EntryMeta> =>
      ipcRenderer.invoke('fs:statFile', root, relativePath),
    createFile: withTypedConflict(
      (root: string, relativePath: string, opts?: { overwrite?: boolean }): Promise<void> =>
        ipcRenderer.invoke('fs:createFile', root, relativePath, opts)
    ),
    createDirectory: (root: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:createDirectory', root, relativePath),
    saveFile: withTypedConflict(
      (
        root: string,
        relativePath: string,
        content: string,
        opts?: { expectedMtimeMs?: number }
      ): Promise<EntryMeta> => ipcRenderer.invoke('fs:saveFile', root, relativePath, content, opts)
    ),
    move: withTypedConflict(
      (
        root: string,
        fromRel: string,
        toRel: string,
        opts?: { overwrite?: boolean }
      ): Promise<void> => ipcRenderer.invoke('fs:move', root, fromRel, toRel, opts)
    ),
    importEntry: withTypedConflict(
      (
        root: string,
        sourceAbs: string,
        destRel: string,
        opts?: { overwrite?: boolean }
      ): Promise<void> => ipcRenderer.invoke('fs:importEntry', root, sourceAbs, destRel, opts)
    ),
    exists: (root: string, relativePath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:exists', root, relativePath),
    trash: (root: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:trash', root, relativePath),
    // Turns a dropped renderer File into its absolute OS path. webUtils is
    // main/preload-only under sandbox:true — this is the ONLY way the
    // renderer can learn a dropped file's path (FM-R5).
    pathForFile: (file: File): string => webUtils.getPathForFile(file)
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
