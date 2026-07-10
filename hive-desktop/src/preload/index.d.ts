import { ElectronAPI } from '@electron-toolkit/preload'
import type { FsChangeEvent, TreeNode } from '../main/fsService'

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
    }
  }
}
