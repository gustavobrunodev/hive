import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createConfigStore, type ConfigStore } from './configStore'
import {
  createWorkspaceService,
  folderName,
  type DialogLike,
  type WorkspaceServiceDeps
} from './workspaceService'

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

  // For the getWorkspace/isProvisioned tests below, the picked path's actual
  // existence-on-disk isn't the point being tested — so this deps fake simply
  // treats every path as an existing directory.
  function allPathsExistDeps(): WorkspaceServiceDeps {
    return { pathExists: () => true, isDirectory: () => true }
  }

  it('pickFolder() returns the chosen path and persists nothing (multi-workspace)', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: ['/Users/dev/my-workspace'] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    const picked = await service.pickFolder()

    expect(picked).toBe('/Users/dev/my-workspace')
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    // The whole point of splitting pick from open: the kind question happens
    // in between, so picking a folder must not commit to it.
    expect(service.getWorkspace()).toBeNull()
  })

  it('openWorkspace() persists the picked folder and pushes it to the front of the MRU (WS-R2.2)', () => {
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      allPathsExistDeps()
    )

    expect(service.openWorkspace('/Users/dev/my-workspace').ok).toBe(true)

    // Persistence proof: reading back through the same ConfigStore/temp dir.
    expect(service.getWorkspace()).toBe('/Users/dev/my-workspace')
    expect(service.getRecentWorkspaces()).toEqual(['/Users/dev/my-workspace'])
  })

  it('pickFolder() returns null on cancel and does not touch the stored config', async () => {
    const dialog = fakeDialog({ canceled: true, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    expect(await service.pickFolder()).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('pickFolder() returns null when filePaths is empty even if canceled is false', async () => {
    const dialog = fakeDialog({ canceled: false, filePaths: [] })
    const service = createWorkspaceService(configStore, dialog, allPathsExistDeps())

    expect(await service.pickFolder()).toBeNull()
    expect(service.getWorkspace()).toBeNull()
  })

  it('openWorkspace() does not persist a path that fails validation', () => {
    const service = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      fakeFsDeps({})
    )

    expect(service.openWorkspace('/missing/workspace')).toEqual({
      ok: false,
      reason: 'missing'
    })
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

  it('relaunch: a fresh WorkspaceService instance backed by the same ConfigStore/temp dir sees a previously-picked path without prompting again', () => {
    const firstService = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: false, filePaths: ['/persisted/workspace'] }),
      allPathsExistDeps()
    )
    firstService.openWorkspace('/persisted/workspace')

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
    // multi-workspace: a successful open also reports the route to take next.
    expect(result).toEqual({ ok: true, path: baseDir, route: { step: 'install', primary: true } })
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

      expect(result).toEqual({
        ok: true,
        path: workspace,
        route: { step: 'install', primary: true }
      })
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

/**
 * multi-workspace: the registry and the install-vs-update-vs-ask rules.
 *
 * `routeFor` is where the whole feature's behaviour lives, so these specs
 * drive it through every combination that reaches it: a first workspace, a
 * folder that already carries BMAD, a genuinely new secondary, a `light` one,
 * and a managed one whose install never finished.
 */
describe('WorkspaceService — registry + routing (multi-workspace)', () => {
  let baseDir: string
  let configStore: ConfigStore

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-workspace-registry-'))
    configStore = createConfigStore(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  const BMAD_MARKER = join('_bmad', '_config', 'manifest.yaml')

  /**
   * A filesystem fake: `dirs` exist and are directories, `provisioned` also
   * carry a BMAD manifest. Everything else is missing.
   */
  function fs(opts: { dirs?: string[]; provisioned?: string[] }): WorkspaceServiceDeps {
    const { dirs = [], provisioned = [] } = opts
    const markers = provisioned.map((dir) => join(dir, BMAD_MARKER))
    return {
      pathExists: (p: string) => dirs.includes(p) || markers.includes(p),
      isDirectory: (p: string) => dirs.includes(p)
    }
  }

  function service(deps: WorkspaceServiceDeps): ReturnType<typeof createWorkspaceService> {
    return createWorkspaceService(configStore, fakeDialog({ canceled: true, filePaths: [] }), deps)
  }

  it('routes the very first workspace to install as the primary — it is never asked', () => {
    const ws = service(fs({ dirs: ['/first'] }))

    expect(ws.previewWorkspace('/first')).toEqual({
      ok: true,
      path: '/first',
      route: { step: 'install', primary: true }
    })
    expect(ws.openWorkspace('/first').ok).toBe(true)
    expect(ws.listWorkspaces()[0]).toMatchObject({ primary: true, kind: 'managed' })
  })

  it('asks about a brand-new secondary folder that carries no BMAD', () => {
    const ws = service(fs({ dirs: ['/first', '/second'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')

    expect(ws.previewWorkspace('/second')).toEqual({
      ok: true,
      path: '/second',
      route: { step: 'choose' }
    })
    // The question is owed *before* anything is written: previewing must not
    // register the folder or move the active workspace.
    expect(ws.listWorkspaces().map((entry) => entry.path)).toEqual(['/first'])
    expect(ws.getWorkspace()).toBe('/first')
  })

  it('adopts a folder that already has BMAD instead of asking — the answer is on disk', () => {
    const ws = service(fs({ dirs: ['/first', '/adopted'], provisioned: ['/first', '/adopted'] }))
    ws.openWorkspace('/first')

    expect(ws.previewWorkspace('/adopted')).toEqual({
      ok: true,
      path: '/adopted',
      route: { step: 'update' }
    })
  })

  it('opening a light workspace is ready — no gate, nothing written', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')

    const opened = ws.openWorkspace('/notes', 'light')

    expect(opened).toEqual({ ok: true, path: '/notes', route: { step: 'ready' } })
    expect(ws.listWorkspaces().find((entry) => entry.path === '/notes')?.kind).toBe('light')
  })

  it('a light workspace stays ready even if the folder happens to contain a foreign _bmad/', () => {
    // Someone else's BMAD install is not consent to manage the folder — the
    // kind is the user's intent, and it short-circuits before the disk check.
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first', '/notes'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    expect(ws.previewWorkspace('/notes')).toEqual({
      ok: true,
      path: '/notes',
      route: { step: 'ready' }
    })
  })

  it('a managed workspace whose install never finished routes back to install, not update', () => {
    const ws = service(fs({ dirs: ['/first', '/half'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/half', 'managed')

    expect(ws.previewWorkspace('/half')).toEqual({
      ok: true,
      path: '/half',
      route: { step: 'install', primary: false }
    })
  })

  it('re-opening keeps the kind the workspace already had when none is passed', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    expect(ws.openWorkspace('/notes')).toMatchObject({ route: { step: 'ready' } })
    expect(ws.listWorkspaces().find((entry) => entry.path === '/notes')?.kind).toBe('light')
  })

  it('a workspace whose folder is gone reports missing and is pruned from the registry', () => {
    const deps = fs({ dirs: ['/first', '/gone'], provisioned: ['/first'] })
    const ws = service(deps)
    ws.openWorkspace('/first')
    ws.openWorkspace('/gone', 'light')

    // The folder disappears between sessions.
    const afterDelete = service(fs({ dirs: ['/first'], provisioned: ['/first'] }))
    expect(afterDelete.listWorkspaces().find((entry) => entry.path === '/gone')?.missing).toBe(true)

    expect(afterDelete.openWorkspace('/gone')).toEqual({ ok: false, reason: 'missing' })
    expect(afterDelete.listWorkspaces().map((entry) => entry.path)).toEqual(['/first'])
  })

  it('listWorkspaces joins the registry with what the disk currently says', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    const list = ws.listWorkspaces()
    expect(list.map((entry) => entry.path)).toEqual(['/notes', '/first'])
    expect(list.find((entry) => entry.path === '/first')).toMatchObject({
      displayName: 'first',
      provisioned: true,
      missing: false,
      primary: true
    })
    expect(list.find((entry) => entry.path === '/notes')).toMatchObject({
      provisioned: false,
      kind: 'light'
    })
  })

  it('a missing folder reports provisioned:false rather than being interrogated about BMAD', () => {
    const ws = service(fs({ dirs: ['/first'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    // Register a second one, then take its folder away.
    ws.openWorkspace('/first')
    configStore.upsertWorkspace('/vanished', { kind: 'managed', lastOpenedAt: 1 })

    const entry = ws.listWorkspaces().find((candidate) => candidate.path === '/vanished')
    expect(entry).toMatchObject({ missing: true, provisioned: false })
  })

  it('renameWorkspace sets a display name, and an empty one restores the folder name', () => {
    const ws = service(fs({ dirs: ['/home/dev/api-gateway'] }))
    ws.openWorkspace('/home/dev/api-gateway')

    ws.renameWorkspace('/home/dev/api-gateway', '  API Gateway  ')
    expect(ws.listWorkspaces()[0].displayName).toBe('API Gateway')

    ws.renameWorkspace('/home/dev/api-gateway', '   ')
    expect(ws.listWorkspaces()[0]).toMatchObject({ name: null, displayName: 'api-gateway' })
  })

  it('adoptWorkspace turns a light workspace managed, which then routes to install', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    ws.adoptWorkspace('/notes')

    expect(ws.listWorkspaces().find((entry) => entry.path === '/notes')?.kind).toBe('managed')
    expect(ws.previewWorkspace('/notes')).toEqual({
      ok: true,
      path: '/notes',
      route: { step: 'install', primary: false }
    })
  })

  it('setPrimaryWorkspace promotes a light workspace by making it managed first', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    ws.setPrimaryWorkspace('/notes')

    const list = ws.listWorkspaces()
    expect(list.find((entry) => entry.primary)).toMatchObject({ path: '/notes', kind: 'managed' })
    // The old primary keeps everything it had; only the flag moved.
    expect(list.find((entry) => entry.path === '/first')).toMatchObject({
      primary: false,
      kind: 'managed',
      provisioned: true
    })
    // And the promoted one now owes an install, which is what makes the
    // "primary always has BMAD" rule true rather than merely declared.
    expect(ws.previewWorkspace('/notes').ok && ws.previewWorkspace('/notes')).toMatchObject({
      route: { step: 'install', primary: true }
    })
  })

  it('forgetWorkspace drops a secondary and refuses the primary', () => {
    const ws = service(fs({ dirs: ['/first', '/notes'], provisioned: ['/first'] }))
    ws.openWorkspace('/first')
    ws.openWorkspace('/notes', 'light')

    expect(ws.forgetWorkspace('/first')).toBe(false)
    expect(ws.listWorkspaces()).toHaveLength(2)

    expect(ws.forgetWorkspace('/notes')).toBe(true)
    expect(ws.listWorkspaces().map((entry) => entry.path)).toEqual(['/first'])

    // An unknown path is refused rather than silently "succeeding".
    expect(ws.forgetWorkspace('/never-seen')).toBe(false)
  })

  it('an unreadable folder is reported, not thrown, and never becomes active', () => {
    const ws = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      fakeFsDeps({ unreadable: ['/locked'] })
    )

    expect(ws.previewWorkspace('/locked')).toEqual({ ok: false, reason: 'unreadable' })
    expect(ws.openWorkspace('/locked')).toEqual({ ok: false, reason: 'unreadable' })
    expect(ws.getWorkspace()).toBeNull()
  })

  it('a path that exists but is a file is refused', () => {
    const ws = createWorkspaceService(
      configStore,
      fakeDialog({ canceled: true, filePaths: [] }),
      fakeFsDeps({ existingNonDirs: ['/a-file.txt'] })
    )

    expect(ws.previewWorkspace('/a-file.txt')).toEqual({ ok: false, reason: 'not-a-directory' })
  })

  it('folderName handles both separators, so a Windows path shows its folder', () => {
    expect(folderName('/home/dev/api-gateway')).toBe('api-gateway')
    expect(folderName('C:\\Users\\dev\\api-gateway')).toBe('api-gateway')
    expect(folderName('/home/dev/trailing/')).toBe('trailing')
  })
})
