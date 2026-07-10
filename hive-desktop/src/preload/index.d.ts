import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    hive: {
      ping(): Promise<string>
      chooseWorkspace(): Promise<string | null>
      getWorkspace(): Promise<string | null>
      isProvisioned(): Promise<boolean>
    }
  }
}
