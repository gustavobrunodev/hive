import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createConfigStore, type ConfigStore } from './configStore'
import {
  createWorkspaceService,
  type DialogLike,
  type WorkspaceServiceDeps
} from './workspaceService'

// `createWorkspaceService` takes both its `ConfigStore` and Electron's
// `dialog` as plain injected arguments (mirroring configStore.ts's `baseDir`
// injection), so tests use a real `ConfigStore` pointed at a temp dir and a
// fake `dialog` object — no `electron` module mocking required.
describe('WorkspaceService', () => {
  let baseDir: string
  let configStore: ConfigStore

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-workspace-service-'))
    configStore = createConfigStore(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  function fakeDialog(result: { canceled: boolean; filePaths: string[] }): DialogLike {
    return { showOpenDialog: vi.fn().mockResolvedValue(result) }
  }

  /**
   * A `pathExists`/`isDirectory` fake driven by a plain path→boolean map, so
   * `provisionState`/`openWorkspace` tests never touch the real filesystem.
   * `existingDirs` lists paths that are both present and directories.
   */
  function fakeFsDeps(opts: {
    existingDirs?: string[]
    existingNonDirs?: string[]
    unreadable?: string[]
  }): WorkspaceServiceDeps {
    const { existingDirs = [], existingNonDirs = [], unreadable = [] } = opts
    return {
      pathExists: (p: string) =>
        existingDirs.includes(p) || existingNonDirs.includes(p) || unreadable.includes(p),
      isDirectory: (p: string) => {
        if (unreadable.includes(p)) {
          throw new Error('EACCES: permission denied')
        }
        return existingDirs.includes(p)
      }
    }
  }

  // For the pre-existing chooseWorkspace/getWorkspace/isProvisioned tests
  // below, the picked path's actual existence-on-disk isn't the point being
  // tested — so this deps fake simply treats every path as an existing
  // directory, matching the pre-T2 behavior (chooseWorkspace persisted
  // unconditionally).
  function allPathsExistDeps(): WorkspaceServiceDeps {
    return { pathExists: () => true, isDirectory: () => true }
  }

  it('chooseWorkspace() persists the picked folder and returns its path', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: ['/Users/dev/my-workspace'] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    const picked = await service.chooseWorkspace()

    expect(picked).toBe('/Users/dev/my-workspace')
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    // Persistence proof: reading back through the same ConfigStore/temp dir.
    expect(service.getWorkspace()).toBe('/Users/dev/my-workspace')
  })

  it('chooseWorkspace() pushes the picked path to the front of the MRU (WS-R2.2)', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: ['/Users/dev/my-workspace'] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    await service.chooseWorkspace()

    expect(service.getRecentWorkspaces()).toEqual(['/Users/dev/my-workspace'])
  })

  it('chooseWorkspace() returns null on cancel and does not touch the stored config', async () => {
    const dialog = fakeDialog({ canceled: true, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    const picked = await service.chooseWorkspace()

    expect(picked).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('chooseWorkspace() returns null when filePaths is empty even if canceled is false', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    expect(await service.chooseWorkspace()).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('chooseWorkspace() returns null and does not persist when the picked path fails validation', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: ['/missing/workspace'] })
    const service = createWorkspaceService(configStore, dialog, fakeFsDeps({}))

    const picked = await service.chooseWorkspace()

    expect(picked).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('getWorkspace() returns null when nothing has been picked yet', () => {
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      allPathsExistDeps()
    )
    expect(service.getWorkspace()).toBeNull()
  })

  it('isProvisioned() reflects the ConfigStore state (false by default, true after setProvisioned(true))', () => {
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      allPathsExistDeps()
    )
    expect(service.isProvisioned()).toBe(false)

    configStore.setProvisioned(true)

    expect(service.isProvisioned()).toBe(true)
  })

  it('relaunch: a fresh WorkspaceService instance backed by the same ConfigStore/temp dir sees a previously-picked path without prompting again', async () => {
    const firstService = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: false, filePaths: ['/persisted/workspace'] }),
      allPathsExistDeps()
    )
    await firstService.chooseWorkspace()

    // Simulate the app restarting: brand new ConfigStore + WorkspaceService
    // instances, same on-disk config file, and a dialog that would fail the
    // test if it were ever invoked (proving no prompt is needed).
    const restartedConfigStore = createConfigStore(baseDir)
    const dialogThatMustNotBeCalled: DialogLike = {
      showOpenDialog: vi.fn().mockRejectedValue(new Error('should not be called on relaunch'))
    }
    const secondService = createWorkspaceService(
      restartedConfigStore,
      dialogThatMustNotBeCalled,
      allPathsExistDeps()
    )

    expect(secondService.getWorkspace()).toBe('/persisted/workspace')
    expect(dialogThatMustNotBeCalled.showOpenDialog).not.toHaveBeenCalled()
  })

  it('defaults pathExists/isDirectory to real fs checks when deps is omitted (backward-compatible 2-arg call)', () => {
    // No third `deps` argument — exercises the `?? existsSync` / `?? statSync`
    // fallback used by existing 2-arg callers (e.g. main/index.ts).
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] })
    )

    // `baseDir` is a real temp directory created in beforeEach, unprovisioned
    // (no _bmad/_config/manifest.yaml under it).
    expect(service.provisionState(baseDir)).toBe(false)

    const result = service.openWorkspace(baseDir)
    expect(result).toEqual({ ok: true, path: baseDir })
    expect(service.getWorkspace()).toBe(baseDir)

    const missingResult = service.openWorkspace(join(baseDir, 'does-not-exist'))
    expect(missingResult).toEqual({ ok: false, reason: 'missing' })
  })

  describe('provisionState()', () => {
    it('returns true when <path>/_bmad/_config/manifest.yaml exists (WS-R3.1)', () => {
      const workspace = '/Users/dev/provisioned-workspace'
      const manifestPath = join(workspace, '_bmad', '_config', 'manifest.yaml')
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({ existingNonDirs: [manifestPath] })
      )

      expect(service.provisionState(workspace)).toBe(true)
    })

    it('returns false when the manifest marker is absent', () => {
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({})
      )

      expect(service.provisionState('/Users/dev/unprovisioned-workspace')).toBe(false)
    })

    it('is evaluated per-path, independent of the active/stored workspace (WS-R3.2)', () => {
      const provisioned = '/ws/provisioned'
      const unprovisioned = '/ws/unprovisioned'
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({
          existingNonDirs: [join(provisioned, '_bmad', '_config', 'manifest.yaml')]
        })
      )
      configStore.setWorkspacePath(unprovisioned)

      expect(service.provisionState(provisioned)).toBe(true)
      expect(service.provisionState(unprovisioned)).toBe(false)
    })
  })

  describe('getRecentWorkspaces()', () => {
    it('delegates to ConfigStore.getRecentWorkspaces()', () => {
      configStore.pushRecentWorkspace('/ws/a')
      configStore.pushRecentWorkspace('/ws/b')
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        allPathsExistDeps()
      )

      expect(service.getRecentWorkspaces()).toEqual(['/ws/b', '/ws/a'])
    })
  })

  describe('openWorkspace()', () => {
    it('ok: existing directory is persisted as the active workspace and pushed to the MRU', () => {
      const workspace = '/ws/valid'
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({ existingDirs: [workspace] })
      )

      const result = service.openWorkspace(workspace)

      expect(result).toEqual({ ok: true, path: workspace })
      expect(service.getWorkspace()).toBe(workspace)
      expect(service.getRecentWorkspaces()).toEqual([workspace])
    })

    it("missing: a path that doesn't exist returns reason 'missing' and is pruned from the MRU (WS-R2.3/WS-R6.3)", () => {
      const workspace = '/ws/does-not-exist'
      configStore.pushRecentWorkspace(workspace)
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({})
      )

      const result = service.openWorkspace(workspace)

      expect(result).toEqual({ ok: false, reason: 'missing' })
      expect(service.getWorkspace()).toBeNull()
      expect(service.getRecentWorkspaces()).not.toContain(workspace)
    })

    it("not-a-directory: an existing file path returns reason 'not-a-directory' and is pruned from the MRU", () => {
      const filePath = '/ws/some-file.txt'
      configStore.pushRecentWorkspace(filePath)
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({ existingNonDirs: [filePath] })
      )

      const result = service.openWorkspace(filePath)

      expect(result).toEqual({ ok: false, reason: 'not-a-directory' })
      expect(service.getWorkspace()).toBeNull()
      expect(service.getRecentWorkspaces()).not.toContain(filePath)
    })

    it("unreadable: a path whose isDirectory check throws returns reason 'unreadable' and is pruned from the MRU", () => {
      const workspace = '/ws/no-permission'
      configStore.pushRecentWorkspace(workspace)
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({ unreadable: [workspace] })
      )

      const result = service.openWorkspace(workspace)

      expect(result).toEqual({ ok: false, reason: 'unreadable' })
      expect(service.getWorkspace()).toBeNull()
      expect(service.getRecentWorkspaces()).not.toContain(workspace)
    })

    it('does not disturb the previously active workspace on failure (WS-R6.3)', () => {
      const service = createWorkspaceService(
        configStore,
        fakeDialog({ canceled: true, filePaths: [] }),
        fakeFsDeps({ existingDirs: ['/ws/active'] })
      )
      service.openWorkspace('/ws/active')

      const result = service.openWorkspace('/ws/missing')

      expect(result).toEqual({ ok: false, reason: 'missing' })
      expect(service.getWorkspace()).toBe('/ws/active')
    })
  })
})

describe('WorkspaceService — a workspace that disappeared after it was chosen', () => {
  const fakeDialog = (result: { canceled: boolean; filePaths: string[] }): DialogLike => ({
    showOpenDialog: vi.fn().mockResolvedValue(result)
  })

  it('answers null once the configured folder is gone', async () => {
    // The path is validated when it is *picked* and never again. A folder
    // deleted afterwards stayed configured, and the app kept handing it to
    // every process it started — where a missing `cwd` makes `spawn` raise an
    // ENOENT that names the **command**. That is how a deleted workspace made
    // every agent CLI on the machine report itself as not installed.
    const configStore = createConfigStore(mkdtempSync(join(tmpdir(), 'hive-ws-')))
    const dialog = fakeDialog({ canceled: false, filePaths: ['/gone'] })
    const present = createWorkspaceService(configStore, dialog, {
      pathExists: () => true,
      isDirectory: () => true
    })
    await present.chooseWorkspace()
    expect(present.getWorkspace()).toBe('/gone')

    // Same config, same path — the folder is simply no longer there.
    const afterDeletion = createWorkspaceService(configStore, dialog, {
      pathExists: () => false,
      isDirectory: () => false
    })

    expect(afterDeletion.getWorkspace()).toBeNull()
    // The path is *kept* on disk: the folder may be on a drive that is merely
    // unmounted, and forgetting it would turn a reconnect into a re-setup.
    expect(configStore.getConfig().workspacePath).toBe('/gone')
  })

  it('answers null when the configured path is now a file', () => {
    const configStore = createConfigStore(mkdtempSync(join(tmpdir(), 'hive-ws-')))
    configStore.setWorkspacePath('/was-a-folder')
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      {
        pathExists: () => true,
        isDirectory: () => false
      }
    )

    expect(service.getWorkspace()).toBeNull()
  })
})
