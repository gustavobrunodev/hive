import { ElectronAPI } from '@electron-toolkit/preload'
import type { EntryMeta, FsChangeEvent, TreeNode } from '../main/fsService'
import type {
  AgentCapabilities,
  AgentEvent,
  SessionOpts,
  WorkflowCommand
} from '../main/agentAdapter'
import type { BmadEvent } from '../main/bmadService'
import type { WorkflowEntry } from '../main/workflowCatalog'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    hive: {
      ping(): Promise<string>
      chooseWorkspace(): Promise<string | null>
      getWorkspace(): Promise<string | null>
      isProvisioned(): Promise<boolean>
      listTree(root: string, relativePath?: string): Promise<TreeNode[]>
      readFile(root: string, relativePath: string): Promise<string>
      /** Starts watching `root`; returns an unsubscribe function (see preload/index.ts for the full channel design). */
      watchWorkspace(root: string, onChange: (event: FsChangeEvent) => void): () => void
      /** AgentService (T14) surface — see preload/index.ts for the full channel design. */
      agent: {
        capabilities(): Promise<AgentCapabilities>
        start(opts: SessionOpts): Promise<void>
        send(text: string): Promise<void>
        runWorkflow(cmd: WorkflowCommand): Promise<void>
        /** Subscribes to the active session's events; returns an unsubscribe function. */
        onEvent(onEvent: (evt: AgentEvent) => void): () => void
      }
      /** BmadService (T8/T9) install stream — see preload/index.ts for the full channel design. */
      installBmad(workspace: string, onEvent: (evt: BmadEvent) => void): () => void
      /** BmadService.update() (T10) stream — see preload/index.ts for the full channel design. */
      updateBmad(workspace: string, onEvent: (evt: BmadEvent) => void): () => void
      /** WorkflowCatalog (T17) surface — see preload/index.ts for the full channel design. */
      workflows: {
        list(workspace: string): Promise<WorkflowEntry[]>
      }
      /**
       * File management (T6/T7) surface — see preload/index.ts for the full
       * channel design. `createFile`/`saveFile`/`move`/`importEntry` reject
       * with a `FsConflictError` (exported from preload/index.ts) on a
       * `CONFLICT`/`STALE` outcome instead of a plain Error.
       */
      fs: {
        statFile(root: string, relativePath: string): Promise<EntryMeta>
        createFile(root: string, relativePath: string, opts?: { overwrite?: boolean }): Promise<void>
        createDirectory(root: string, relativePath: string): Promise<void>
        saveFile(
          root: string,
          relativePath: string,
          content: string,
          opts?: { expectedMtimeMs?: number }
        ): Promise<EntryMeta>
        move(
          root: string,
          fromRel: string,
          toRel: string,
          opts?: { overwrite?: boolean }
        ): Promise<void>
        importEntry(
          root: string,
          sourceAbs: string,
          destRel: string,
          opts?: { overwrite?: boolean }
        ): Promise<void>
        exists(root: string, relativePath: string): Promise<boolean>
        trash(root: string, relativePath: string): Promise<void>
        /** Turns a dropped renderer File into its absolute OS path via webUtils. */
        pathForFile(file: File): string
      }
    }
  }
}
