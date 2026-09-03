import { existsSync, statSync } from 'fs'
import { join } from 'path'
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

/**
 * Result of `openWorkspace` (WS-R4/WS-R6.3): a discriminated union so callers
 * (IPC/renderer) can branch on `ok` without try/catch, mirroring
 * `fsService.ts`'s `ConflictError.code` discriminable-tag style.
 */
export type OpenResult =
  { ok: true; path: string } | { ok: false; reason: 'missing' | 'not-a-directory' | 'unreadable' }

/**
 * Dependencies `createWorkspaceService` can have injected beyond `dialog`,
 * keeping this module Electron/`fs`-import-free at the call-site level (the
 * same reasoning `fsService.ts`'s `FsServiceDeps` uses for `trashItem`).
 * Both default to real `fs` checks so existing two-argument callers (e.g.
 * `main/index.ts`) keep working unchanged against the real filesystem; tests
 * override them with fakes driven by a plain path→boolean map — no disk I/O
 * required.
 */
export interface WorkspaceServiceDeps {
  /** Does `p` exist on disk? Defaults to `fs.existsSync`. */
  pathExists?(p: string): boolean
  /** Is `p` a directory? Only called when `pathExists(p)` is true. Defaults to `fs.statSync(p).isDirectory()`. */
  isDirectory?(p: string): boolean
}

export interface WorkspaceService {
  chooseWorkspace(): Promise<string | null>
  getWorkspace(): string | null
  isProvisioned(): boolean
  /** Disk-based provisioning check for an arbitrary path (WS-R3.1–R3.2), independent of the active workspace. */
  provisionState(path: string): boolean
  /** Delegates to `ConfigStore.getRecentWorkspaces()` (WS-R2). */
  getRecentWorkspaces(): string[]
  /**
   * Validates `path` exists and is a directory, then persists it as the
   * active workspace and MRU head (WS-R4/WS-R2.2); on failure returns a
   * reason and prunes `path` from the MRU (WS-R2.3/WS-R6.3).
   */
  openWorkspace(path: string): OpenResult
}

/**
 * Creates a `WorkspaceService` wrapping a `ConfigStore` with workspace-
 * specific operations (R2.1–R2.3, WS-R3, WS-R4, WS-R6.3): pick a workspace
 * folder via the native directory picker and persist it, read back the
 * persisted workspace, read the persisted provisioned flag, and
 * validate/open an arbitrary path (path-aware provisioning + MRU).
 *
 * `configStore`, `dialog`, and `deps` (`pathExists`/`isDirectory`) are all
 * injected (mirroring `configStore.ts`'s `baseDir` injection) so this module
 * never has to import `electron` itself and can be unit tested with a real
 * `ConfigStore` (pointed at a temp dir) plus fakes — no module mocking
 * required.
 */
export function createWorkspaceService(
  configStore: ConfigStore,
  dialog: DialogLike,
  deps: WorkspaceServiceDeps = {}
): WorkspaceService {
  const pathExists = deps.pathExists ?? existsSync
  const isDirectory = deps.isDirectory ?? ((p: string) => statSync(p).isDirectory())

  function provisionState(path: string): boolean {
    return pathExists(join(path, '_bmad', '_config', 'manifest.yaml'))
  }

  function getRecentWorkspaces(): string[] {
    return configStore.getRecentWorkspaces()
  }

  function openWorkspace(path: string): OpenResult {
    try {
      if (!pathExists(path)) {
        configStore.removeRecentWorkspace(path)
        return { ok: false, reason: 'missing' }
      }
      if (!isDirectory(path)) {
        configStore.removeRecentWorkspace(path)
        return { ok: false, reason: 'not-a-directory' }
      }
    } catch {
      // Permission denied / EACCES and similar: surfaced as 'unreadable'
      // rather than throwing (WS-R6.3 — non-fatal).
      configStore.removeRecentWorkspace(path)
      return { ok: false, reason: 'unreadable' }
    }

    configStore.setWorkspacePath(path)
    configStore.pushRecentWorkspace(path)
    return { ok: true, path }
  }

  async function chooseWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const [path] = result.filePaths
    const opened = openWorkspace(path)
    return opened.ok ? opened.path : null
  }

  /**
   * The active workspace, or `null` when it is no longer on disk.
   *
   * The path was validated when it was *chosen*, and never again — so a folder
   * deleted, renamed or moved after the fact stayed configured forever, and
   * the app carried on handing it to every process it started. That is not a
   * quiet failure: `spawn(cmd, args, { cwd })` resolves `cwd` first, and the
   * ENOENT it raises names the **command**, so a deleted workspace made every
   * agent CLI on the machine report itself as not installed and every model
   * listing fall back to its hardcoded rows. (Measured on the reporter's
   * machine, whose configured workspace no longer existed.)
   *
   * Answering `null` puts the app back on the workspace picker, which is the
   * one screen that can actually fix it. The config keeps the stale path — the
   * folder may be on a drive that is merely unmounted, and forgetting it would
   * turn a reconnect into a re-setup.
   */
  function getWorkspace(): string | null {
    const path = configStore.getConfig().workspacePath
    if (path === null) return null
    try {
      return pathExists(path) && isDirectory(path) ? path : null
    } catch {
      // EACCES on the path itself: unusable now, for the same purposes.
      return null
    }
  }

  function isProvisioned(): boolean {
    return configStore.getConfig().provisioned
  }

  return {
    chooseWorkspace,
    getWorkspace,
    isProvisioned,
    provisionState,
    getRecentWorkspaces,
    openWorkspace
  }
}
