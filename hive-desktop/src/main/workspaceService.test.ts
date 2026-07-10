import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createConfigStore, type ConfigStore } from './configStore'
import { createWorkspaceService, type DialogLike } from './workspaceService'

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

  it('chooseWorkspace() persists the picked folder and returns its path', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: ['/Users/dev/my-workspace'] })
    const service = createWorkspaceService(configStore, dialog)

    const picked = await service.chooseWorkspace()

    expect(picked).toBe('/Users/dev/my-workspace')
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    // Persistence proof: reading back through the same ConfigStore/temp dir.
    expect(service.getWorkspace()).toBe('/Users/dev/my-workspace')
  })

  it('chooseWorkspace() returns null on cancel and does not touch the stored config', async () => {
    const dialog = fakeDialog({ canceled: true, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog)

    const picked = await service.chooseWorkspace()

    expect(picked).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('chooseWorkspace() returns null when filePaths is empty even if canceled is false', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog)

    expect(await service.chooseWorkspace()).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('getWorkspace() returns null when nothing has been picked yet', () => {
    const service = createWorkspaceService(configStore, fakeDialog({ canceled: true, filePaths: [] }))
    expect(service.getWorkspace()).toBeNull()
  })

  it('isProvisioned() reflects the ConfigStore state (false by default, true after setProvisioned(true))', () => {
    const service = createWorkspaceService(configStore, fakeDialog({ canceled: true, filePaths: [] }))
    expect(service.isProvisioned()).toBe(false)

    configStore.setProvisioned(true)

    expect(service.isProvisioned()).toBe(true)
  })

  it('relaunch: a fresh WorkspaceService instance backed by the same ConfigStore/temp dir sees a previously-picked path without prompting again', async () => {
    const firstService = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: false, filePaths: ['/persisted/workspace'] })
    )
    await firstService.chooseWorkspace()

    // Simulate the app restarting: brand new ConfigStore + WorkspaceService
    // instances, same on-disk config file, and a dialog that would fail the
    // test if it were ever invoked (proving no prompt is needed).
    const restartedConfigStore = createConfigStore(baseDir)
    const dialogThatMustNotBeCalled: DialogLike = {
      showOpenDialog: vi.fn().mockRejectedValue(new Error('should not be called on relaunch'))
    }
    const secondService = createWorkspaceService(restartedConfigStore, dialogThatMustNotBeCalled)

    expect(secondService.getWorkspace()).toBe('/persisted/workspace')
    expect(dialogThatMustNotBeCalled.showOpenDialog).not.toHaveBeenCalled()
  })
})
