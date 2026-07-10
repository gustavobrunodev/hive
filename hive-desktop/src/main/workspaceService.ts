import type { ConfigStore } from './configStore'

/**
 * The slice of Electron's `dialog` module `WorkspaceService` needs. Declared
 * locally (instead of importing `electron`'s `OpenDialogOptions`/
 * `OpenDialogReturnValue` types) to keep this module's only coupling to
 * Electron at the type level, matching `configStore.ts`'s approach of taking
 * its environment as an injected argument rather than importing `electron`
 * directly. Callers wiring this into the app (T5, in `src/main/index.ts`)
 * pass the real `dialog` from `electron`; tests pass a fake.
 */
export interface DialogLike {
  showOpenDialog(options: {
    properties: string[]
  }): Promise<{ canceled: boolean; filePaths: string[] }>
}

export interface WorkspaceService {
  chooseWorkspace(): Promise<string | null>
  getWorkspace(): string | null
  isProvisioned(): boolean
}

/**
 * Creates a `WorkspaceService` wrapping a `ConfigStore` with workspace-
 * specific operations (R2.1–R2.3): pick a workspace folder via the native
 * directory picker and persist it, read back the persisted workspace, and
 * read the persisted provisioned flag.
 *
 * Both `configStore` and `dialog` are injected (mirroring `configStore.ts`'s
 * `baseDir` injection) so this module never imports `electron` itself and
 * can be unit tested with a real `ConfigStore` (pointed at a temp dir) plus
 * a fake `dialog` — no module mocking required.
 */
export function createWorkspaceService(
  configStore: ConfigStore,
  dialog: DialogLike
): WorkspaceService {
  async function chooseWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const [path] = result.filePaths
    configStore.setWorkspacePath(path)
    return path
  }

  function getWorkspace(): string | null {
    return configStore.getConfig().workspacePath
  }

  function isProvisioned(): boolean {
    return configStore.getConfig().provisioned
  }

  return { chooseWorkspace, getWorkspace, isProvisioned }
}
