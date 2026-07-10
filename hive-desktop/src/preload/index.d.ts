import { ElectronAPI } from '@electron-toolkit/preload'
import type { FsChangeEvent, TreeNode } from '../main/fsService'
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
    }
  }
}
