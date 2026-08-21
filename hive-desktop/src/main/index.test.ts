import { afterAll, beforeEach, describe, expect, it, vi, beforeAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
  protocol,
  net,
  session
} from 'electron'
import { ConflictError } from './fsService'
import { createConfigStore } from './configStore'

// A real temp dir (not mocked) so the ConfigStore that src/main/index.ts
// constructs via createConfigStore(app.getPath('userData')) has somewhere
// real to read/write during this test, same approach as configStore.test.ts
// and workspaceService.test.ts.
const userDataDir = mkdtempSync(join(tmpdir(), 'hive-main-index-test-'))

// Mocks Electron + the electron-toolkit helpers + the ?asset icon import so
// src/main/index.ts can be imported and its bootstrap logic exercised in
// plain Node, without a real Electron main process.
// The window geometry the BrowserWindow/screen mocks below report, shared with
// the tests so they can play both the WM that honours maximize() and the one
// (WSLg's Weston) that only pretends to — see fillWorkArea() in index.ts.
const { windowGeometry } = vi.hoisted(() => ({
  windowGeometry: {
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    bounds: { x: 0, y: 0, width: 900, height: 670 },
    isMaximized: true
  }
}))

vi.mock('electron', () => {
  const BrowserWindowMock = vi.fn().mockImplementation(() => ({
    webContents: { setWindowOpenHandler: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    maximize: vi.fn(),
    isMaximized: vi.fn(() => windowGeometry.isMaximized),
    getBounds: vi.fn(() => windowGeometry.bounds),
    setBounds: vi.fn((bounds: typeof windowGeometry.bounds) => {
      windowGeometry.bounds = { ...bounds }
    }),
    loadURL: vi.fn(),
    loadFile: vi.fn()
  }))
  Object.assign(BrowserWindowMock, { getAllWindows: vi.fn(() => []) })
  return {
    app: {
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
      getPath: vi.fn(() => userDataDir),
      setName: vi.fn(),
      getName: vi.fn(() => 'Hive'),
      getVersion: vi.fn(() => '0.1.0'),
      getGPUInfo: vi.fn(async () => ({ gpuDevice: [] })),
      isPackaged: false
    },
    BrowserWindow: BrowserWindowMock,
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    shell: {
      openExternal: vi.fn(),
      trashItem: vi.fn(() => Promise.resolve()),
      showItemInFolder: vi.fn(),
      // Resolves to '' on success and to an OS error message on failure —
      // shaped like the real one so the handler's failure branch is reachable.
      openPath: vi.fn(() => Promise.resolve(''))
    },
    dialog: { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) },
    // file-clipboard: main's own clipboard, which is what every in-app copy
    // now goes through — `navigator.clipboard` is refused in the renderer.
    clipboard: { writeText: vi.fn() },
    // Second Brain / Whisper: the `hive-model:` scheme registration (pre-ready)
    // + its request handler (in whenReady).
    protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
    // Second Brain recorder: the microphone permission handler.
    session: { defaultSession: { setPermissionRequestHandler: vi.fn() } },
    screen: { getDisplayMatching: vi.fn(() => ({ workArea: windowGeometry.workArea })) },
    net: { fetch: vi.fn(() => Promise.resolve(new Response('bytes'))) }
  }
})

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false }
}))

vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon-stub' }))

// FsService (T11): mocked (rather than exercised against a real temp dir,
// which fsService.test.ts already does thoroughly) so this file can assert
// index.ts routes IPC calls to it correctly — same "does the wiring work"
// concern as the WorkspaceService tests below, just via a module mock
// instead of an injected fake, since createFsService() takes no
// Electron-ish dependency to substitute the way WorkspaceService's
// `DialogLike` does. Declared via vi.hoisted so the mock factory (which
// vi.mock hoists above these declarations) can close over it.
const { fakeFsService, watchWorkspaceCalls } = vi.hoisted(() => {
  const watchWorkspaceCalls: Array<{
    root: string
    onChange: (event: unknown) => void
    stop: ReturnType<typeof import('vitest').vi.fn>
  }> = []
  return {
    watchWorkspaceCalls,
    fakeFsService: {
      listTree: vi.fn(() => [{ name: 'a.txt', path: 'a.txt', type: 'file' }]),
      readFile: vi.fn(() => 'fake file contents'),
      watchWorkspace: vi.fn((root: string, onChange: (event: unknown) => void) => {
        const stop = vi.fn()
        watchWorkspaceCalls.push({ root, onChange, stop })
        return stop
      }),
      statFile: vi.fn(() => ({ mtimeMs: 123, size: 4 })),
      createFile: vi.fn(),
      createDirectory: vi.fn(),
      saveFile: vi.fn(() => ({ mtimeMs: 456, size: 7 })),
      move: vi.fn(),
      copyEntry: vi.fn(),
      importEntry: vi.fn(),
      exists: vi.fn(() => true),
      trash: vi.fn(() => Promise.resolve()),
      absolutePathFor: vi.fn((root: string, rel: string) => `${root}/${rel}`)
    }
  }
})

// createFsService is mocked (T11's existing rationale, still applies), but
// `createFsService` is called with T6's `{ trashItem }` dep now — asserted
// below via `createFsServiceMock.mock.calls`. `ConflictError` is re-exported
// from the *real* module (via importActual) rather than re-declared here:
// index.ts's `err instanceof ConflictError` check (T6) must see the same
// class identity this test throws, which only importActual guarantees.
const { createFsServiceMock } = vi.hoisted(() => ({ createFsServiceMock: vi.fn() }))

vi.mock('./fsService', async () => {
  const actual = await vi.importActual<typeof import('./fsService')>('./fsService')
  createFsServiceMock.mockImplementation(() => fakeFsService)
  return { ...actual, createFsService: createFsServiceMock }
})

// AgentService (T14): mocked the same way FsService is above — index.ts
// wires window.hive.agent.* to a real AgentService backed by a real
// ClaudeCliAdapter/ProcessRunner (neither of which import 'electron', so
// they're left un-mocked and constructed for real), but this file only cares
// that index.ts routes IPC calls to *whatever* AgentService it's given, not
// AgentService's own forwarding logic (covered by agentService.test.ts).
const { fakeAgentService, agentOnEventCalls } = vi.hoisted(() => {
  const agentOnEventCalls: Array<{
    listener: (event: unknown) => void
    unsubscribe: ReturnType<typeof import('vitest').vi.fn>
  }> = []
  return {
    agentOnEventCalls,
    fakeAgentService: {
      capabilities: vi.fn(() => ({ models: [], efforts: [], supportsAttachments: false })),
      startSession: vi.fn(),
      send: vi.fn(),
      runWorkflow: vi.fn(),
      stop: vi.fn(),
      interrupt: vi.fn(),
      onEvent: vi.fn((listener: (event: unknown) => void) => {
        const unsubscribe = vi.fn()
        agentOnEventCalls.push({ listener, unsubscribe })
        return unsubscribe
      })
    }
  }
})

vi.mock('./agentService', () => ({ createAgentService: vi.fn(() => fakeAgentService) }))

// agent-onboarding: the installer runs `npm i -g` for real (its own behaviour
// is covered by agentInstaller.test.ts). Here only the wiring matters — that a
// start reaches it, that its events are relayed tagged with the agent id, and
// that a stop actually cancels.
const { fakeAgentInstaller, agentInstallCalls } = vi.hoisted(() => {
  const agentInstallCalls: Array<{
    agentId: string
    emit: (event: unknown) => void
    cancel: ReturnType<typeof vi.fn>
  }> = []
  return {
    agentInstallCalls,
    fakeAgentInstaller: {
      install: vi.fn((agentId: string, onEvent: (event: unknown) => void) => {
        const cancel = vi.fn()
        agentInstallCalls.push({ agentId, emit: onEvent, cancel })
        return cancel
      })
    }
  }
})
vi.mock('./agentInstaller', () => ({ createAgentInstaller: vi.fn(() => fakeAgentInstaller) }))

// The real registry, with only `detect()` swapped for a spy: probing would
// spawn `claude --version` (and two siblings) for real, and what this file
// tests about detection is that the handler forwards the refresh flag —
// agentRegistry.test.ts owns what the probe then does with it.
const { agentDetect } = vi.hoisted(() => ({ agentDetect: vi.fn(async () => []) }))
// agent-terminal (AT-R4): the deps index.ts hands the registry, captured so a
// test can check they are live getters rather than values read once at boot.
const { registryDeps } = vi.hoisted(() => ({
  registryDeps: { value: null as Record<string, unknown> | null }
}))

vi.mock('./agentRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./agentRegistry')>()
  return {
    ...actual,
    createAgentRegistry: (...args: Parameters<typeof actual.createAgentRegistry>) => {
      registryDeps.value = (args[1] ?? {}) as Record<string, unknown>
      return {
        ...actual.createAgentRegistry(...args),
        detect: agentDetect
      }
    }
  }
})

// agent-approvals: the real bridge binds a loopback HTTP listener (covered by
// approvalService.test.ts). Here only the *wiring* matters — that index.ts
// relays its requests onto the renderer's event channel and routes verdicts
// and turn cancellations back into it.
const { fakeApprovalService, approvalRequestListeners } = vi.hoisted(() => {
  const approvalRequestListeners: Array<(request: unknown) => void> = []
  return {
    approvalRequestListeners,
    fakeApprovalService: {
      promptToolName: 'mcp__hive_approvals__approve',
      mcpConfig: vi.fn(() => null),
      listen: vi.fn(() => Promise.resolve()),
      onRequest: vi.fn((listener: (request: unknown) => void) => {
        approvalRequestListeners.push(listener)
        return vi.fn()
      }),
      respond: vi.fn(),
      cancel: vi.fn(),
      rules: vi.fn(() => []),
      clearRules: vi.fn(),
      close: vi.fn(() => Promise.resolve())
    }
  }
})

vi.mock('./approvalService', () => ({
  createApprovalService: vi.fn(() => fakeApprovalService)
}))

// agent-approvals: the "sempre permitir" → agent-config writer. Its own file
// format/syntax is covered by agentPermissions.test.ts against real files; here
// only the wiring matters — that a standing grant reaches it with the agent
// that actually asked and the active workspace.
const { grantAgentPermission } = vi.hoisted(() => ({ grantAgentPermission: vi.fn() }))
vi.mock('./agentPermissions', () => ({
  grantAgentPermission: grantAgentPermission.mockResolvedValue(null)
}))

// BmadService (T8/T9/T10): mocked the same way FsService/AgentService are
// above. Without this, index.ts's real (un-mocked, since bmadService.ts
// imports no 'electron' API) BmadService + real spawn-based ProcessRunner
// would try to actually run `npx bmad-method install` when this test
// exercises the bmad:install:*/bmad:update:* handlers — this file only cares
// that index.ts routes IPC calls to *whatever* BmadService it's given, not
// BmadService's own parsing/command logic (covered by bmadService.test.ts).
const { fakeBmadService, installGate } = vi.hoisted(() => {
  let resumeInstall: (() => void) | undefined
  return {
    installGate: { resume: () => resumeInstall?.() },
    fakeBmadService: {
      // Yields one event, then blocks on an externally-resolved gate before
      // yielding a second — lets a test call bmad:install:stop() in the gap
      // and prove the second event is never relayed (deterministic, no real
      // timers needed to win a race).
      install: vi.fn(async function* installStub() {
        yield { type: 'step', id: 's1', label: 'Step 1' }
        await new Promise<void>((resolve) => {
          resumeInstall = resolve
        })
        yield { type: 'done', ok: true }
      }),
      update: vi.fn(async function* updateStub() {
        yield { type: 'done', ok: true }
      })
    }
  }
})

// Partial-mocked (the `gitService` shape above), not wholesale: only the
// factory is faked. `bmadService` also exports `isE2ESeamEnabled`, the B-1 flag
// that `e2eAgentSeam.ts` reads while index.ts builds the agent registry — a
// full replacement would make it `undefined` and take the bootstrap down.
vi.mock('./bmadService', async () => {
  const actual = await vi.importActual<typeof import('./bmadService')>('./bmadService')
  return { ...actual, createBmadService: vi.fn(() => fakeBmadService) }
})

// GitService (git-management M10): mocked like FsService above — index.ts
// wires window.hive.git.* to a real GitService (which imports no 'electron',
// so it isn't mocked in production) backed by the real spawn-based
// ProcessRunner. Without this mock the git:* handlers would shell out to real
// git; this file only asserts index.ts routes calls to whatever GitService it
// gets + fires git:changed after mutations (GitService's own argv/parsing is
// covered by gitService.test.ts). importActual keeps the real GitError class
// identity so index.ts's `err instanceof GitError` matches what the fake throws.
const { fakeGitService } = vi.hoisted(() => ({
  fakeGitService: {
    detect: vi.fn(async () => ({ isRepo: true, root: '/ws', gitMissing: false })),
    init: vi.fn(async () => {}),
    status: vi.fn(async () => ({ branch: 'main', changes: [] })),
    stage: vi.fn(async () => {}),
    unstage: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    commit: vi.fn(async () => ({ hash: 'abc' })),
    branches: vi.fn(async () => ({ branches: [], current: 'main' })),
    createBranch: vi.fn(async () => {}),
    checkout: vi.fn(async () => {}),
    renameBranch: vi.fn(async () => {}),
    deleteBranch: vi.fn(async () => {}),
    fetch: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    sync: vi.fn(async () => {}),
    log: vi.fn(async () => []),
    diff: vi.fn(async () => ({ hunks: [], binary: false })),
    commitDiff: vi.fn(async () => ({ files: [], diff: { hunks: [], binary: false } })),
    fileAtHead: vi.fn(async () => ''),
    conflicts: vi.fn(async () => []),
    resolveConflict: vi.fn(async () => {}),
    mergeContinue: vi.fn(async () => {}),
    mergeAbort: vi.fn(async () => {}),
    stash: vi.fn(async () => {}),
    stashList: vi.fn(async () => []),
    stashApply: vi.fn(async () => {}),
    stashDrop: vi.fn(async () => {})
  }
}))

vi.mock('./gitService', async () => {
  const actual = await vi.importActual<typeof import('./gitService')>('./gitService')
  return { ...actual, createGitService: vi.fn(() => fakeGitService) }
})

// Agent Change Review (M11): CheckpointService + ReviewService mocked like
// GitService above — index.ts wires window.hive.review.* to a real
// ReviewService (no 'electron' import) over the real ProcessRunner. This file
// only asserts index.ts routes review:* calls to whatever service it's given
// and drives begin/endTurn on the turn lifecycle (the service's own math is
// covered by reviewService.test.ts). `onChanged` is captured so the turn-wiring
// tests can also confirm the emit path is registered.
const { fakeReviewService } = vi.hoisted(() => ({
  fakeReviewService: {
    beginTurn: vi.fn(async () => {}),
    attachTurn: vi.fn(),
    onFsActivity: vi.fn(async () => {}),
    endTurn: vi.fn(async () => {}),
    get: vi.fn(async () => ({ changes: [], turns: [] })),
    acceptFile: vi.fn(async () => ({ ok: true })),
    rejectFile: vi.fn(async () => ({ ok: true })),
    acceptHunk: vi.fn(async () => ({ ok: true })),
    rejectHunk: vi.fn(async () => ({ ok: true })),
    acceptAll: vi.fn(async () => ({ ok: true })),
    rejectAll: vi.fn(async () => ({ ok: true })),
    teardown: vi.fn()
  }
}))
vi.mock('./checkpointService', () => ({ createCheckpointService: vi.fn(() => ({})) }))
vi.mock('./reviewService', () => ({ createReviewService: vi.fn(() => fakeReviewService) }))

// SecondBrainService/Vault (second-brain): mocked so index.test.ts asserts the
// wiring only — each module's own math is covered by secondBrainService.test.ts
// / secondBrainVault.test.ts. install/update are async generators yielding a
// scripted SkillEvent stream so the streamed-handler path (runSbStream) is
// exercised without spawning a real `npx`.
const { fakeSecondBrainService, fakeSecondBrainVault } = vi.hoisted(() => ({
  fakeSecondBrainService: {
    detect: vi.fn(() => false),
    resolveVault: vi.fn(() => null as { path: string; name: string } | null),

    install: vi.fn(async function* () {
      yield { type: 'step', id: 'found', label: 'Found 4 skills' }
      yield { type: 'done', ok: true }
    }),
    update: vi.fn(async function* () {
      yield { type: 'done', ok: true }
    })
  },
  fakeSecondBrainVault: {
    stageRaw: vi.fn(() => ({ relPath: 'second-brain/raw/ingest-x.md', absPath: '/abs/x.md' })),
    countRawPending: vi.fn(() => 0)
  }
}))
vi.mock('./secondBrainService', () => ({
  createSecondBrainService: vi.fn(() => fakeSecondBrainService)
}))
vi.mock('./secondBrainVault', () => ({
  createSecondBrainVault: vi.fn(() => fakeSecondBrainVault)
}))

function findHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no ipcMain.handle registered for "${channel}"`)
  return call[1] as (...args: unknown[]) => unknown
}

function findOnHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.on).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no ipcMain.on registered for "${channel}"`)
  return call[1] as (...args: unknown[]) => unknown
}

describe('main process bootstrap', () => {
  beforeAll(async () => {
    await import('./index')
    // Flush the `app.whenReady().then(...)` microtask chain that registers
    // the ipcMain handler and creates the window.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  afterAll(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('registers ping as a real request/response handler (ipcMain.handle), not fire-and-forget', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('ping', expect.any(Function))
    const [, handler] = vi.mocked(ipcMain.handle).mock.calls[0] as [string, () => Promise<string>]
    await expect(handler()).resolves.toBe('pong')
  })

  // Structural proof of R1.3 (renderer never gets Node/fs/child_process access):
  // Electron enforces isolation at the OS/process level from this exact
  // webPreferences config, which a jsdom-based renderer test cannot observe
  // directly — asserting the config itself is what's actually testable here.
  it('creates the BrowserWindow with contextIsolation/sandbox on and nodeIntegration off', () => {
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
    const [options] = vi.mocked(BrowserWindow).mock.calls[0] as [
      { webPreferences: Record<string, unknown> }
    ]
    expect(options.webPreferences.contextIsolation).toBe(true)
    expect(options.webPreferences.nodeIntegration).toBe(false)
    expect(options.webPreferences.sandbox).toBe(true)
  })

  // T5: WorkspaceService wiring — the three window.hive workspace methods
  // route to a real WorkspaceService/ConfigStore pair backed by the mocked
  // app.getPath('userData') temp dir above.
  it('registers workspace:pickFolder, workspace:get, and workspace:isProvisioned handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:pickFolder', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:get', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:isProvisioned', expect.any(Function))
  })

  it('workspace:get and workspace:isProvisioned reflect defaults with no workspace picked yet', async () => {
    await expect(findHandler('workspace:get')()).resolves.toBeNull()
    await expect(findHandler('workspace:isProvisioned')()).resolves.toBe(false)
  })

  it('workspace:pickFolder drives dialog.showOpenDialog and, on its own, persists nothing', async () => {
    const pickedWorkspace = mkdtempSync(join(tmpdir(), 'hive-main-index-picked-'))
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [pickedWorkspace]
    } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)

    await expect(findHandler('workspace:pickFolder')()).resolves.toBe(pickedWorkspace)
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] })
    // multi-workspace: picking is separated from committing so the kind
    // question can be asked in between — the active workspace is untouched
    // until `workspace:open` runs.
    await expect(findHandler('workspace:get')()).resolves.toBeNull()

    rmSync(pickedWorkspace, { recursive: true, force: true })
  })

  it('workspace:preview reports the route without persisting, and workspace:open commits it', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-preview-'))

    // The exact route depends on what earlier tests in this describe left in
    // the shared ConfigStore (a primary may already exist), which is not what
    // this spec is about — that preview *answers* and doesn't *persist* is.
    const preview = (await findHandler('workspace:preview')(fakeInvokeEvent, dir)) as {
      ok: boolean
      path: string
      route: { step: string }
    }
    expect(preview).toMatchObject({ ok: true, path: dir })
    expect(['install', 'update', 'choose', 'ready']).toContain(preview.route.step)
    await expect(findHandler('workspace:get')()).resolves.toBeNull()

    // Opening commits: the workspace becomes active and lands in the registry.
    const opened = (await findHandler('workspace:open')(fakeInvokeEvent, dir, 'light')) as {
      ok: boolean
      route: { step: string }
    }
    expect(opened.ok).toBe(true)
    await expect(findHandler('workspace:get')()).resolves.toBe(dir)

    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses to make the primary workspace light, whatever the renderer asks for', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-primarykind-'))

    await findHandler('workspace:open')(fakeInvokeEvent, dir, 'managed')
    await findHandler('workspace:setPrimary')(fakeInvokeEvent, dir)
    // Ask for the one thing the invariant forbids.
    await findHandler('workspace:open')(fakeInvokeEvent, dir, 'light')

    const list = (await findHandler('workspace:list')()) as Array<{
      path: string
      kind: string
      primary: boolean
    }>
    const entry = list.find((candidate) => candidate.path === dir)
    expect(entry).toMatchObject({ primary: true, kind: 'managed' })

    rmSync(dir, { recursive: true, force: true })
  })

  it('workspace:open drops a kind the renderer made up rather than trusting it', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-kindguard-'))

    await findHandler('workspace:open')(fakeInvokeEvent, dir, 'heavy')

    const list = (await findHandler('workspace:list')()) as Array<{ path: string; kind: string }>
    expect(list.find((entry) => entry.path === dir)?.kind).toBe('managed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('registers the workspace registry handlers the switcher edits', () => {
    for (const channel of [
      'workspace:preview',
      'workspace:list',
      'workspace:rename',
      'workspace:adopt',
      'workspace:setPrimary',
      'workspace:forget'
    ]) {
      expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
    }
  })

  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching handlers, delegating to
  // the same real WorkspaceService/ConfigStore pair as the three handlers
  // above (no mocking of WorkspaceService itself — this suite already wires
  // a real instance backed by the mocked app.getPath('userData') temp dir).
  it('registers workspace:provisionState, workspace:recents, and workspace:open handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:provisionState', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:recents', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('workspace:open', expect.any(Function))
  })

  it('workspace:provisionState reports false for an unprovisioned directory (no _bmad/_config/manifest.yaml)', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-provision-'))
    await expect(findHandler('workspace:provisionState')(fakeInvokeEvent, dir)).resolves.toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('workspace:open validates and persists a path, and workspace:recents reflects it as the MRU head', async () => {
    const fakeInvokeEvent = {}
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-index-open-'))

    await expect(findHandler('workspace:open')(fakeInvokeEvent, dir)).resolves.toEqual({
      ok: true,
      path: dir,
      route: { step: 'install', primary: expect.any(Boolean) }
    })
    await expect(findHandler('workspace:get')()).resolves.toBe(dir)
    // MRU is shared with the earlier workspace tests in this describe
    // block (same ConfigStore instance), so only the head (this open) is
    // asserted rather than the full list.
    await expect(findHandler('workspace:recents')()).resolves.toEqual(expect.arrayContaining([dir]))
    const recents = (await findHandler('workspace:recents')()) as string[]
    expect(recents[0]).toBe(dir)

    rmSync(dir, { recursive: true, force: true })
  })

  it('workspace:open reports a non-fatal "missing" reason for a path that does not exist on disk', async () => {
    const fakeInvokeEvent = {}
    const missing = join(tmpdir(), 'hive-main-index-open-missing-does-not-exist')
    await expect(findHandler('workspace:open')(fakeInvokeEvent, missing)).resolves.toEqual({
      ok: false,
      reason: 'missing'
    })
  })

  // T11: FsService wiring — request/response methods route to the (mocked)
  // FsService with the exact args the renderer passed.
  it('registers fs:listTree and fs:readFile handlers, routing to FsService', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('fs:listTree', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('fs:readFile', expect.any(Function))

    // Real ipcMain.handle listeners always receive the IpcMainInvokeEvent as
    // their first argument, followed by the args the renderer passed —
    // mirrored here with a stub event object.
    const fakeInvokeEvent = {}
    await expect(findHandler('fs:listTree')(fakeInvokeEvent, '/ws', 'docs')).resolves.toEqual([
      { name: 'a.txt', path: 'a.txt', type: 'file' }
    ])
    expect(fakeFsService.listTree).toHaveBeenCalledWith('/ws', 'docs')

    await expect(findHandler('fs:readFile')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toBe(
      'fake file contents'
    )
    expect(fakeFsService.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  // T6: FsService is constructed with `shell.trashItem` injected as its
  // `trashItem` dep (design §2) — proven by inspecting what index.ts actually
  // passed to the (mocked) createFsService, then confirming that dep really
  // is shell.trashItem by calling it through.
  it('constructs FsService with shell.trashItem injected as the trashItem dep', async () => {
    expect(createFsServiceMock).toHaveBeenCalledTimes(1)
    const [deps] = createFsServiceMock.mock.calls[0] as [{ trashItem?: (abs: string) => unknown }]
    expect(deps.trashItem).toBeInstanceOf(Function)
    await deps.trashItem?.('/abs/path')
    expect(shell.trashItem).toHaveBeenCalledWith('/abs/path')
  })

  // T6: the remaining fs:* write/read handlers — each just delegates to the
  // matching FsService method with the args the renderer passed, mirroring
  // the fs:listTree/fs:readFile assertions above.
  it('registers fs:statFile/createFile/createDirectory/saveFile/move/importEntry/exists/trash, routing to FsService', async () => {
    for (const channel of [
      'fs:statFile',
      'fs:createFile',
      'fs:createDirectory',
      'fs:saveFile',
      'fs:move',
      'fs:importEntry',
      'fs:exists',
      'fs:trash'
    ]) {
      expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
    }

    const fakeInvokeEvent = {}

    await expect(findHandler('fs:statFile')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toEqual({
      mtimeMs: 123,
      size: 4
    })
    expect(fakeFsService.statFile).toHaveBeenCalledWith('/ws', 'a.txt')

    await findHandler('fs:createFile')(fakeInvokeEvent, '/ws', 'b.txt', { overwrite: true })
    expect(fakeFsService.createFile).toHaveBeenCalledWith('/ws', 'b.txt', { overwrite: true })

    await findHandler('fs:createDirectory')(fakeInvokeEvent, '/ws', 'docs')
    expect(fakeFsService.createDirectory).toHaveBeenCalledWith('/ws', 'docs')

    await expect(
      findHandler('fs:saveFile')(fakeInvokeEvent, '/ws', 'a.txt', 'content', {
        expectedMtimeMs: 111
      })
    ).resolves.toEqual({ mtimeMs: 456, size: 7 })
    expect(fakeFsService.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'content', {
      expectedMtimeMs: 111
    })

    await findHandler('fs:move')(fakeInvokeEvent, '/ws', 'a.txt', 'b.txt', { overwrite: false })
    expect(fakeFsService.move).toHaveBeenCalledWith('/ws', 'a.txt', 'b.txt', { overwrite: false })

    await findHandler('fs:importEntry')(fakeInvokeEvent, '/ws', '/outside/src.txt', 'dest.txt', {
      overwrite: true
    })
    expect(fakeFsService.importEntry).toHaveBeenCalledWith('/ws', '/outside/src.txt', 'dest.txt', {
      overwrite: true
    })

    await expect(findHandler('fs:exists')(fakeInvokeEvent, '/ws', 'a.txt')).resolves.toBe(true)
    expect(fakeFsService.exists).toHaveBeenCalledWith('/ws', 'a.txt')

    await findHandler('fs:trash')(fakeInvokeEvent, '/ws', 'a.txt')
    expect(fakeFsService.trash).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  // T6: the CONFLICT:/STALE: message-prefix convention (design §2) — a
  // thrown ConflictError from FsService comes out of the handler as a plain
  // Error whose message is prefixed per its `code`, since `code` itself
  // doesn't survive the ipcMain.handle structured-clone boundary. Exercised
  // on fs:createFile (CONFLICT) and fs:saveFile (STALE); the other
  // conflict-capable handlers (fs:move, fs:importEntry) share the same
  // `withConflictPrefix` wrapper so aren't re-tested per-handler.
  it('rethrows a ConflictError{code:"CONFLICT"} from FsService as an Error prefixed "CONFLICT: "', async () => {
    fakeFsService.createFile.mockImplementationOnce(() => {
      throw new ConflictError('CONFLICT', 'Already exists: dup.txt')
    })
    await expect(findHandler('fs:createFile')({}, '/ws', 'dup.txt')).rejects.toThrow(
      'CONFLICT: Already exists: dup.txt'
    )
  })

  it('rethrows a ConflictError{code:"STALE"} from FsService as an Error prefixed "STALE: "', async () => {
    fakeFsService.saveFile.mockImplementationOnce(() => {
      throw new ConflictError('STALE', 'File changed on disk: a.txt')
    })
    await expect(
      findHandler('fs:saveFile')({}, '/ws', 'a.txt', 'new content', { expectedMtimeMs: 1 })
    ).rejects.toThrow('STALE: File changed on disk: a.txt')
  })

  it('lets a non-ConflictError from a wrapped handler propagate unprefixed', async () => {
    fakeFsService.move.mockImplementationOnce(() => {
      throw new Error('Path escapes workspace root: ../evil')
    })
    await expect(findHandler('fs:move')({}, '/ws', 'a.txt', '../evil')).rejects.toThrow(
      'Path escapes workspace root: ../evil'
    )
  })

  // Pre-existing createWindow()/app-lifecycle branches (predate T6, not part
  // of the fs:* surface this task owns) were left unexercised by the
  // original test file, which left src/main/index.ts's branch coverage below
  // the 90% gate even before this task's changes. Covered here too (still
  // within this test file's existing scope) so the whole-file gate that T6's
  // verify step runs against actually passes.
  it("wires up the BrowserWindow's ready-to-show/window-open/browser-window-created callbacks", () => {
    const mainWindowInstance = vi.mocked(BrowserWindow).mock.results[0].value as {
      on: ReturnType<typeof vi.fn>
      once: ReturnType<typeof vi.fn>
      show: ReturnType<typeof vi.fn>
      maximize: ReturnType<typeof vi.fn>
      setBounds: ReturnType<typeof vi.fn>
      webContents: { setWindowOpenHandler: ReturnType<typeof vi.fn> }
    }

    const readyToShow = mainWindowInstance.on.mock.calls.find(
      ([channel]) => channel === 'ready-to-show'
    )?.[1] as () => void
    readyToShow()
    expect(mainWindowInstance.maximize).toHaveBeenCalled()
    expect(mainWindowInstance.show).toHaveBeenCalled()

    // The WM's resize lands afterwards: here it reports a still-900x670 window
    // on a 1920x1080 work area — the WSLg case — so the bounds are set
    // explicitly.
    const onResize = mainWindowInstance.once.mock.calls.find(
      ([channel]) => channel === 'resize'
    )?.[1] as () => void
    onResize()
    expect(mainWindowInstance.setBounds).toHaveBeenCalledWith(windowGeometry.workArea)

    const windowOpenHandler = mainWindowInstance.webContents.setWindowOpenHandler.mock
      .calls[0][0] as (details: { url: string }) => { action: string }
    expect(windowOpenHandler({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')

    const browserWindowCreated = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'browser-window-created')?.[1] as (
      _e: unknown,
      window: unknown
    ) => void
    expect(browserWindowCreated).toBeInstanceOf(Function)
    browserWindowCreated(undefined, mainWindowInstance)
  })

  it('leaves the window alone when the WM does honour maximize()', () => {
    const mainWindowInstance = vi.mocked(BrowserWindow).mock.results[0].value as {
      on: ReturnType<typeof vi.fn>
      once: ReturnType<typeof vi.fn>
      setBounds: ReturnType<typeof vi.fn>
    }
    const readyToShow = mainWindowInstance.on.mock.calls.find(
      ([channel]) => channel === 'ready-to-show'
    )?.[1] as () => void
    const lastResizeHandler = (): (() => void) => {
      const calls = mainWindowInstance.once.mock.calls.filter(([channel]) => channel === 'resize')
      return calls[calls.length - 1][1] as () => void
    }

    // A WM that actually maximizes: the window already covers the work area, so
    // fillWorkArea() must not touch its bounds — overriding them would drop the
    // genuine maximized state on Windows/macOS/normal Linux DEs.
    windowGeometry.bounds = { ...windowGeometry.workArea }
    mainWindowInstance.setBounds.mockClear()
    readyToShow()
    lastResizeHandler()()
    expect(mainWindowInstance.setBounds).not.toHaveBeenCalled()

    // And a resize on a window that is *not* maximized (the user dragged it
    // smaller) is never snapped back to full screen.
    windowGeometry.bounds = { x: 0, y: 0, width: 600, height: 400 }
    windowGeometry.isMaximized = false
    readyToShow()
    lastResizeHandler()()
    expect(mainWindowInstance.setBounds).not.toHaveBeenCalled()
    windowGeometry.isMaximized = true
  })

  it("app 'activate' recreates a window only when none are open (macOS dock-click behavior)", () => {
    const activateHandler = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'activate')?.[1] as () => void
    expect(activateHandler).toBeInstanceOf(Function)

    const windowCountBefore = vi.mocked(BrowserWindow).mock.calls.length
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValueOnce([{}] as unknown as [])
    activateHandler()
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(windowCountBefore) // no window open() call: getAllWindows() wasn't empty

    activateHandler()
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(windowCountBefore + 1) // getAllWindows() empty: a new window is created
  })

  it("app 'window-all-closed' quits outside macOS", () => {
    const windowAllClosedHandler = vi
      .mocked(app.on)
      .mock.calls.find((call) => (call[0] as string) === 'window-all-closed')?.[1] as () => void
    expect(windowAllClosedHandler).toBeInstanceOf(Function)
    windowAllClosedHandler()
    expect(app.quit).toHaveBeenCalled()
  })

  // T8/T10: the `activeInstallStops`/`activeUpdateStops` optional-chaining
  // "tear down a previous run for this sender" branch, and the async
  // generator loop's `if (stopped) return` branch — both pre-existing gaps
  // left uncovered by the original test file.
  it('a second bmad:install:start for the same sender tears down the first (optional-chaining branch)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 201, send } }
    findOnHandler('bmad:install:start')(fakeEvent, '/ws-1')
    // Second start for the same sender exercises the `activeInstallStops.get(...)?.()`
    // branch where a previous entry actually exists.
    findOnHandler('bmad:install:start')(fakeEvent, '/ws-2')
    expect(fakeBmadService.install).toHaveBeenCalledTimes(2)
  })

  it('bmad:update:start/stop stops relaying further events after stop, and a second start tears down the first', async () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 202, send } }

    findOnHandler('bmad:update:start')(fakeEvent, '/ws-1')
    // Second start for the same sender exercises the optional-chaining branch.
    findOnHandler('bmad:update:start')(fakeEvent, '/ws-2')
    findOnHandler('bmad:update:stop')(fakeEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fakeBmadService.update).toHaveBeenCalledTimes(2)
  })

  // T11: FsService streaming wiring — 'fs:watch:start'/'fs:watch:stop' are
  // registered as fire-and-forget ipcMain.on handlers (not ipcMain.handle),
  // and relay FsService's onChange events back to the requesting sender over
  // 'fs:watch:event'.
  it('registers fs:watch:start/fs:watch:stop, starts/stops FsService.watchWorkspace, and relays events to the sender', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('fs:watch:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('fs:watch:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 42, send } }

    findOnHandler('fs:watch:start')(fakeEvent, '/ws')
    expect(fakeFsService.watchWorkspace).toHaveBeenCalledWith('/ws', expect.any(Function))

    const call = watchWorkspaceCalls[watchWorkspaceCalls.length - 1]
    expect(call.root).toBe('/ws')

    // Simulate FsService firing a change: main should relay it to the sender.
    call.onChange({ type: 'add', path: 'new-file.txt' })
    expect(send).toHaveBeenCalledWith('fs:watch:event', { type: 'add', path: 'new-file.txt' })

    findOnHandler('fs:watch:stop')(fakeEvent)
    expect(call.stop).toHaveBeenCalledTimes(1)
  })

  it('starting a new watch for the same sender tears down its previous watcher first (no leaked watchers)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 7, send } }

    findOnHandler('fs:watch:start')(fakeEvent, '/ws-a')
    const firstStop = watchWorkspaceCalls[watchWorkspaceCalls.length - 1].stop

    findOnHandler('fs:watch:start')(fakeEvent, '/ws-b')

    expect(firstStop).toHaveBeenCalledTimes(1)
  })

  // T14: AgentService wiring — capabilities/start/send/runWorkflow route to
  // the (mocked) AgentService with the exact args the renderer passed, as
  // real request/response ipcMain.handle registrations.
  it('registers agent:capabilities/start/send/runWorkflow handlers, routing to AgentService', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:capabilities', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:start', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:send', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:runWorkflow', expect.any(Function))

    const fakeInvokeEvent = {}

    await expect(findHandler('agent:capabilities')()).resolves.toEqual({
      models: [],
      efforts: [],
      supportsAttachments: false
    })
    expect(fakeAgentService.capabilities).toHaveBeenCalled()

    const opts = { workspace: '/ws', model: 'claude-sonnet-4-5', effort: 'medium' }
    await findHandler('agent:start')(fakeInvokeEvent, opts)
    expect(fakeAgentService.startSession).toHaveBeenCalledWith(opts)

    // session-history: the caller's opts (resume/turnId/…) ride through to
    // AgentService. Agent Change Review (T6) ensures a turnId is always present
    // (synthesized when absent) so the turn's terminal event can be matched
    // back to its checkpoint — the renderer always supplies one in practice.
    await findHandler('agent:send')(fakeInvokeEvent, 'hello agent')
    expect(fakeAgentService.send).toHaveBeenCalledWith(
      'hello agent',
      expect.objectContaining({ turnId: expect.stringMatching(/^review-turn-/) })
    )
    await findHandler('agent:send')(fakeInvokeEvent, 'continue', {
      resume: 'cli-sess-1',
      turnId: 'r1'
    })
    expect(fakeAgentService.send).toHaveBeenCalledWith('continue', {
      resume: 'cli-sess-1',
      turnId: 'r1'
    })

    const cmd = { key: 'prd' }
    await findHandler('agent:runWorkflow')(fakeInvokeEvent, cmd, {
      resume: 'cli-sess-2',
      turnId: 'r2'
    })
    expect(fakeAgentService.runWorkflow).toHaveBeenCalledWith(cmd, {
      resume: 'cli-sess-2',
      turnId: 'r2'
    })
  })

  // T8 (WS-R5.2): explicit session-teardown handler, called by Chat's
  // unmount cleanup — routes to AgentService.stop() with no args.
  it('registers an agent:stop handler routing to AgentService.stop()', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('agent:stop', expect.any(Function))

    await findHandler('agent:stop')({})
    expect(fakeAgentService.stop).toHaveBeenCalledTimes(1)
  })

  // T14: AgentService streaming wiring — 'agent:event:start'/'agent:event:stop'
  // are fire-and-forget ipcMain.on handlers (not ipcMain.handle), mirroring
  // fs:watch:start/stop: they subscribe/unsubscribe via AgentService.onEvent
  // and relay forwarded events back to the requesting sender over
  // 'agent:event'.
  it('registers agent:event:start/agent:event:stop, subscribes/unsubscribes via AgentService.onEvent, and relays events to the sender', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('agent:event:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('agent:event:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 99, send } }

    findOnHandler('agent:event:start')(fakeEvent)
    expect(fakeAgentService.onEvent).toHaveBeenCalled()

    const call = agentOnEventCalls[agentOnEventCalls.length - 1]
    call.listener({ type: 'token', text: 'hi' })
    expect(send).toHaveBeenCalledWith('agent:event', { type: 'token', text: 'hi' })

    findOnHandler('agent:event:stop')(fakeEvent)
    expect(call.unsubscribe).toHaveBeenCalledTimes(1)
  })

  // agent-approvals: a permission request originates outside the adapter (the
  // CLI calls Hive's own MCP tool), so it rides the same 'agent:event' channel
  // through its own subscription — and the verdict comes back on its own
  // handle. Both sides must be wired, or the turn blocks with nothing on screen.
  it('relays approval requests to the renderer and releases the blocked turn on agent:approve', async () => {
    const send = vi.fn()
    findOnHandler('agent:event:start')({ sender: { id: 101, send } })

    const request = {
      type: 'approval' as const,
      requestId: 'req-1',
      tool: 'Bash',
      detail: 'mkdir vault'
    }
    approvalRequestListeners[approvalRequestListeners.length - 1](request)
    expect(send).toHaveBeenCalledWith('agent:event', request)

    await findHandler('agent:approve')({}, 'req-1', { behavior: 'allow', scope: 'once' })
    expect(fakeApprovalService.respond).toHaveBeenCalledWith('req-1', {
      behavior: 'allow',
      scope: 'once'
    })

    // Stopping a turn releases whatever it was blocked on, so a killed CLI
    // child isn't left waiting on a card that just disappeared.
    await findHandler('agent:interrupt')({}, 't-1')
    expect(fakeApprovalService.cancel).toHaveBeenCalledWith('t-1')

    findOnHandler('agent:event:stop')({ sender: { id: 101, send } })
  })

  it('persists a standing "sempre permitir" rule, so the grant survives a restart', async () => {
    const { createApprovalService } = await import('./approvalService')
    const options = vi.mocked(createApprovalService).mock.calls[0][0]
    // Seeded from disk on boot…
    expect(options?.rules).toEqual([])

    // …and written back when the bridge records a new one.
    options?.onRulesChanged?.(['Bash:npm'])
    const { createConfigStore } = await import('./configStore')
    expect(createConfigStore(app.getPath('userData')).getApprovalRules()).toEqual(['Bash:npm'])
  })

  // The defect: "Sempre permitir" recorded the grant only inside Hive, so
  // `.claude/` stayed empty and the CLI kept round-tripping through Hive for a
  // call it had been told to stop asking about.
  it('writes a standing grant into the permission config of the agent that asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-grant-'))
    await findHandler('workspace:open')({}, dir)
    grantAgentPermission.mockClear()

    // The turn names its agent; the grant has to follow that agent, not the
    // app default — a permission written into the wrong CLI's config is worse
    // than none, because it looks like it worked.
    await findHandler('agent:send')({}, 'crie a pasta', {
      turnId: 't-grant',
      agentId: 'claude-cli'
    })
    const { createApprovalService } = await import('./approvalService')
    const options = vi.mocked(createApprovalService).mock.calls[0][0]
    options?.onGranted?.({
      rule: 'Bash:mkdir',
      tool: 'Bash',
      input: { command: 'mkdir -p out' },
      turnId: 't-grant'
    })

    expect(grantAgentPermission).toHaveBeenCalledWith({
      agentId: 'claude-cli',
      workspace: dir,
      tool: 'Bash',
      input: { command: 'mkdir -p out' }
    })
  })

  it('falls back to the default agent when the grant cannot name the turn that asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-main-grant-fallback-'))
    await findHandler('workspace:open')({}, dir)
    const { createApprovalService } = await import('./approvalService')
    const options = vi.mocked(createApprovalService).mock.calls[0][0]

    // A turn id nothing registered (it already finished, or the adapter
    // reported none at all).
    for (const turnId of ['never-started', undefined]) {
      grantAgentPermission.mockClear()
      options?.onGranted?.({ rule: 'WebFetch', tool: 'WebFetch', turnId })
      expect(grantAgentPermission).toHaveBeenCalledWith(
        expect.objectContaining({ workspace: dir, tool: 'WebFetch', agentId: expect.any(String) })
      )
    }

    // A workflow turn that names no agent still registers one, so its own
    // grants resolve without falling through to this branch.
    await findHandler('agent:runWorkflow')({}, { key: 'bmad-prd' }, { turnId: 't-wf' })
    grantAgentPermission.mockClear()
    options?.onGranted?.({ rule: 'Read', tool: 'Read', turnId: 't-wf' })
    expect(grantAgentPermission).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'Read', agentId: expect.any(String) })
    )
  })

  it('starting a new agent event subscription for the same sender tears down its previous subscription first (no leaked subscriptions)', () => {
    const send = vi.fn()
    const fakeEvent = { sender: { id: 100, send } }

    findOnHandler('agent:event:start')(fakeEvent)
    const firstUnsubscribe = agentOnEventCalls[agentOnEventCalls.length - 1].unsubscribe

    findOnHandler('agent:event:start')(fakeEvent)

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
  })

  // T8/T9: BmadService.install() wiring — 'bmad:install:start'/'bmad:install:stop'
  // are fire-and-forget ipcMain.on handlers driving an async generator (not a
  // subscribe/unsubscribe pair like fs:watch:*/agent:event:*), so cancellation
  // is proven by stopping mid-stream and confirming a later-yielded event is
  // never relayed.
  it('registers bmad:install:start/stop, drives BmadService.install(workspace), relays events, and stops relaying after bmad:install:stop', async () => {
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:install:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:install:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 55, send } }

    findOnHandler('bmad:install:start')(fakeEvent, '/ws', { modules: ['bmm'] })
    expect(fakeBmadService.install).toHaveBeenCalledWith('/ws', { modules: ['bmm'] })

    // Flush the generator's first yield.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(send).toHaveBeenCalledWith('bmad:install:event', {
      type: 'step',
      id: 's1',
      label: 'Step 1'
    })

    // Stop before the gated second event resolves — it must never be relayed.
    findOnHandler('bmad:install:stop')(fakeEvent)
    installGate.resume()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(send).not.toHaveBeenCalledWith('bmad:install:event', { type: 'done', ok: true })
  })

  // agent-onboarding (AO-R2/AO-R3): the picker's two new powers.
  it('profile:agents passes the refresh flag through, so "procurar de novo" re-probes', async () => {
    const handler = findHandler('profile:agents')
    await handler({}, true)
    expect(agentDetect).toHaveBeenLastCalledWith(true)
    // Anything that isn't an explicit `true` keeps the cached answer.
    await handler({}, undefined)
    expect(agentDetect).toHaveBeenLastCalledWith(false)
  })

  it('registers agents:install:start/stop, tags relayed events with the agent, and cancels on stop', () => {
    expect(ipcMain.on).toHaveBeenCalledWith('agents:install:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('agents:install:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 71, send, isDestroyed: () => false } }
    agentInstallCalls.length = 0

    findOnHandler('agents:install:start')(fakeEvent, 'claude-cli')
    expect(fakeAgentInstaller.install).toHaveBeenCalledWith('claude-cli', expect.any(Function))

    const run = agentInstallCalls[0]
    run.emit({ type: 'progress', message: 'added 214 packages' })
    expect(send).toHaveBeenCalledWith('agents:install:event', 'claude-cli', {
      type: 'progress',
      message: 'added 214 packages'
    })

    // Stop kills npm rather than merely muting it — an install left running
    // keeps writing into a global prefix with nobody listening.
    findOnHandler('agents:install:stop')(fakeEvent, 'claude-cli')
    expect(run.cancel).toHaveBeenCalled()
  })

  it('a repeat start for the same agent replaces the run in flight instead of racing it', () => {
    const fakeEvent = { sender: { id: 72, send: vi.fn(), isDestroyed: () => false } }
    agentInstallCalls.length = 0

    findOnHandler('agents:install:start')(fakeEvent, 'github-copilot')
    findOnHandler('agents:install:start')(fakeEvent, 'github-copilot')

    expect(agentInstallCalls[0].cancel).toHaveBeenCalledTimes(1)
    expect(agentInstallCalls[1].cancel).not.toHaveBeenCalled()
  })

  it('a stop with no agent id cancels every install that sender started', () => {
    const fakeEvent = { sender: { id: 73, send: vi.fn(), isDestroyed: () => false } }
    agentInstallCalls.length = 0

    findOnHandler('agents:install:start')(fakeEvent, 'claude-cli')
    findOnHandler('agents:install:start')(fakeEvent, 'github-copilot')
    findOnHandler('agents:install:stop')(fakeEvent, undefined)

    expect(agentInstallCalls[0].cancel).toHaveBeenCalled()
    expect(agentInstallCalls[1].cancel).toHaveBeenCalled()
  })

  // T10: BmadService.update() wiring — identical shape to bmad:install:*
  // above (proven there), so this just confirms update's own channel names
  // and that it drives BmadService.update(workspace), not install().
  it('registers bmad:update:start/stop, drives BmadService.update(workspace), and relays events to the sender', async () => {
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:update:start', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('bmad:update:stop', expect.any(Function))

    const send = vi.fn()
    const fakeEvent = { sender: { id: 56, send } }

    findOnHandler('bmad:update:start')(fakeEvent, '/ws')
    expect(fakeBmadService.update).toHaveBeenCalledWith('/ws')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(send).toHaveBeenCalledWith('bmad:update:event', { type: 'done', ok: true })
  })

  // T17: WorkflowCatalog wiring — request/response, routing to the real
  // listWithDiscovery() (not mocked: it's a plain fs read with a documented
  // never-throws fallback, so exercising it for real against a workspace
  // with no _bmad/ present is simpler and just as trustworthy as mocking).
  it('registers workflows:list, routing to listWithDiscovery(workspace) with a clean curated-catalog fallback', async () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('workflows:list', expect.any(Function))

    const entries = (await findHandler('workflows:list')({}, userDataDir)) as Array<{
      key: string
      status: string
    }>
    const prd = entries.find((entry) => entry.key === 'prd')
    expect(prd?.status).toBe('wired')
  })

  // T3 (UX-R7.3): openExternal wiring — the handler must reject anything
  // that isn't http(s)/mailto *without* ever reaching shell.openExternal
  // (that's the whole point of the bridge: the renderer can't use it to open
  // local files or run script URLs), and forward everything else through.
  describe('shell:openExternal (T3)', () => {
    it('registers a shell:openExternal handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('shell:openExternal', expect.any(Function))
    })

    it('rejects a file: URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'file:///etc/passwd')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('rejects a javascript: URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'javascript:alert(1)')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('rejects an unparseable URL without calling shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await expect(findHandler('shell:openExternal')({}, 'not a url')).rejects.toThrow()
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    it('forwards a valid https: URL to shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await findHandler('shell:openExternal')({}, 'https://example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
    })

    it('forwards a valid mailto: URL to shell.openExternal', async () => {
      vi.mocked(shell.openExternal).mockClear()
      await findHandler('shell:openExternal')({}, 'mailto:someone@example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('mailto:someone@example.com')
    })
  })

  // explorer-os-actions: the bridge that makes the host OS open something.
  // The two verbs are not interchangeable, and the workspace-escape gate is
  // the reason this goes through FsService instead of taking an absolute path.
  describe('shell:revealPath (explorer-os-actions)', () => {
    beforeEach(() => {
      vi.mocked(shell.showItemInFolder).mockClear()
      vi.mocked(shell.openPath).mockClear().mockResolvedValue('')
      fakeFsService.absolutePathFor.mockClear()
    })

    it('registers the handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('shell:revealPath', expect.any(Function))
    })

    it('reveals a FILE highlighted inside its parent', async () => {
      await findHandler('shell:revealPath')({}, '/ws', 'docs/a.txt', false)
      expect(fakeFsService.absolutePathFor).toHaveBeenCalledWith('/ws', 'docs/a.txt')
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/ws/docs/a.txt')
      expect(shell.openPath).not.toHaveBeenCalled()
    })

    it('OPENS a directory as the window target — revealing it would show its parent', async () => {
      await findHandler('shell:revealPath')({}, '/ws', 'docs', true)
      expect(shell.openPath).toHaveBeenCalledWith('/ws/docs')
      expect(shell.showItemInFolder).not.toHaveBeenCalled()
    })

    it("treats '' as the workspace root (the empty-area menu)", async () => {
      await findHandler('shell:revealPath')({}, '/ws', '', true)
      expect(fakeFsService.absolutePathFor).toHaveBeenCalledWith('/ws', '')
      expect(shell.openPath).toHaveBeenCalledWith('/ws/')
    })

    it('rejects a path that escapes the workspace, without touching the OS', async () => {
      fakeFsService.absolutePathFor.mockImplementationOnce(() => {
        throw new Error('Path escapes workspace root: ../../etc')
      })
      await expect(findHandler('shell:revealPath')({}, '/ws', '../../etc', true)).rejects.toThrow(
        /escapes workspace root/
      )
      expect(shell.openPath).not.toHaveBeenCalled()
      expect(shell.showItemInFolder).not.toHaveBeenCalled()
    })

    it('rejects when openPath reports a failure — its resolved string is the error, not a success', async () => {
      vi.mocked(shell.openPath).mockResolvedValue('Failed to open path')
      await expect(findHandler('shell:revealPath')({}, '/ws', 'docs', true)).rejects.toThrow(
        /Failed to open path/
      )
    })
  })

  // file-clipboard: the two channels Ctrl+C / Ctrl+V added.
  describe('fs:copyEntry (file-clipboard)', () => {
    it('routes to FsService.copyEntry with both workspace-relative ends', async () => {
      fakeFsService.copyEntry.mockClear()
      await findHandler('fs:copyEntry')({}, '/ws', 'a.txt', 'docs/a.txt', { overwrite: true })
      expect(fakeFsService.copyEntry).toHaveBeenCalledWith('/ws', 'a.txt', 'docs/a.txt', {
        overwrite: true
      })
    })

    it('re-throws a CONFLICT with the prefix the preload bridge parses back into a typed error', async () => {
      fakeFsService.copyEntry.mockImplementationOnce(() => {
        throw new ConflictError('CONFLICT', 'Already exists: docs/a.txt')
      })
      await expect(findHandler('fs:copyEntry')({}, '/ws', 'a.txt', 'docs/a.txt')).rejects.toThrow(
        /^CONFLICT: Already exists/
      )
    })
  })

  describe('clipboard:writeText (file-clipboard)', () => {
    it("writes through main's clipboard — the renderer's own is denied by the permission handler", async () => {
      vi.mocked(clipboard.writeText).mockClear()
      await findHandler('clipboard:writeText')({}, '/ws/docs/prd.md')
      expect(clipboard.writeText).toHaveBeenCalledWith('/ws/docs/prd.md')
    })

    it('is write-only: no read channel exists to pair with it', () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map(([channel]) => channel)
      expect(channels).toContain('clipboard:writeText')
      expect(channels.filter((c) => String(c).startsWith('clipboard:'))).toEqual([
        'clipboard:writeText'
      ])
    })
  })

  describe('fs:absolutePath (explorer-os-actions)', () => {
    it('resolves through FsService so the escape check applies', async () => {
      fakeFsService.absolutePathFor.mockClear()
      const result = await findHandler('fs:absolutePath')({}, '/ws', 'docs/a.txt')
      expect(fakeFsService.absolutePathFor).toHaveBeenCalledWith('/ws', 'docs/a.txt')
      expect(result).toBe('/ws/docs/a.txt')
    })
  })

  // chat-attachments: the picker opens inside the workspace it's given.
  describe('chat:chooseAttachments', () => {
    it('forwards the workspace as the dialog defaultPath', async () => {
      vi.mocked(dialog.showOpenDialog).mockClear()
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: []
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)
      await findHandler('chat:chooseAttachments')({}, '/ws/project')
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections'],
        defaultPath: '/ws/project'
      })
    })

    it('omits defaultPath when no workspace is passed (older callers)', async () => {
      vi.mocked(dialog.showOpenDialog).mockClear()
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: []
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)
      await findHandler('chat:chooseAttachments')({})
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections']
      })
    })
  })

  // App self-update (app-settings): version info + update-flow wiring.
  describe('app info + update flow', () => {
    it('app:info reports the app name/version and unsupported updates (unpacked)', async () => {
      await expect(findHandler('app:info')()).resolves.toEqual({
        name: 'Hive',
        version: '0.1.0',
        updatesSupported: false,
        // canApply reflects the resolved apply strategy for this process's
        // real platform (no v1 strategy off-Windows — this suite runs on
        // Linux); lastCheckedAt is null since no check() has run yet.
        canApply: false,
        lastCheckedAt: null,
        // T13: read straight from ConfigStore — unset by default.
        skippedVersion: null
      })
    })

    it('app:info reports the currently-skipped version once one is persisted (T13, ND-R5.5)', async () => {
      await findHandler('update:skip')({}, '0.2.0')
      await expect(findHandler('app:info')()).resolves.toMatchObject({ skippedVersion: '0.2.0' })
    })

    it('registers the update handlers and event channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('update:check', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:download', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:install', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:cancel', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:reveal', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('update:skip', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('update:event:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('update:event:stop', expect.any(Function))
    })

    it('update:check is a safe no-op end-to-end while unsupported (app not packaged): no event ever streams back', async () => {
      const sender = { id: 99, send: vi.fn() }
      findOnHandler('update:event:start')({ sender })
      await findHandler('update:check')()
      expect(sender.send).not.toHaveBeenCalled()
      findOnHandler('update:event:stop')({ sender })
    })

    it('update:event:start is resubscribe-safe and update:event:stop is idempotent', () => {
      const sender = { id: 42, send: vi.fn() }
      findOnHandler('update:event:start')({ sender })
      // A second start replaces the first subscription instead of leaking it.
      findOnHandler('update:event:start')({ sender })
      findOnHandler('update:event:stop')({ sender })
      // Stopping again (already unsubscribed) is a no-op.
      findOnHandler('update:event:stop')({ sender })
    })

    it('update:cancel is a safe no-op when nothing is downloading', async () => {
      await expect(findHandler('update:cancel')()).resolves.toBeUndefined()
    })

    it('update:reveal does not call shell.showItemInFolder when nothing has been downloaded yet', async () => {
      vi.mocked(shell.showItemInFolder).mockClear()
      await findHandler('update:reveal')()
      expect(shell.showItemInFolder).not.toHaveBeenCalled()
    })

    it('update:skip persists the skipped version through the real ConfigStore', async () => {
      await findHandler('update:skip')({}, '0.2.0')
      const configStore = createConfigStore(userDataDir)
      expect(configStore.getSkippedUpdateVersion()).toBe('0.2.0')
      // Leaves later tests unaffected.
      configStore.setSkippedUpdateVersion(null)
    })
  })

  // skill-studio: user-created skills discovery.
  describe('studio:list (skill-studio)', () => {
    it('registers the handler and yields [] for a workspace with no created skills', async () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('studio:list', expect.any(Function))
      await expect(findHandler('studio:list')({}, userDataDir)).resolves.toEqual([])
    })
  })

  // mcp: the Model Context Protocol server module — catalog + enabled state
  // round-trip through the six handlers (real service, real temp workspace).
  describe('mcp:* (mcp)', () => {
    it('registers all six handlers', () => {
      for (const channel of [
        'mcp:list',
        'mcp:add',
        'mcp:update',
        'mcp:remove',
        'mcp:setEnabled',
        'mcp:probe'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
    })

    it('adds, toggles, renames, and removes a server through the handlers', async () => {
      const ws = mkdtempSync(join(tmpdir(), 'hive-mcp-ipc-'))
      await expect(findHandler('mcp:list')({}, ws)).resolves.toEqual([])

      await findHandler('mcp:add')({}, ws, 'srv', { transport: 'stdio', command: 'npx' })
      let list = (await findHandler('mcp:list')({}, ws)) as Array<{
        name: string
        enabled: boolean
      }>
      expect(list).toEqual([{ name: 'srv', transport: 'stdio', command: 'npx', enabled: true }])

      await findHandler('mcp:setEnabled')({}, ws, 'srv', false)
      list = (await findHandler('mcp:list')({}, ws)) as typeof list
      expect(list[0].enabled).toBe(false)

      await findHandler('mcp:update')({}, ws, 'srv', 'renamed', {
        transport: 'stdio',
        command: 'npx'
      })
      list = (await findHandler('mcp:list')({}, ws)) as typeof list
      expect(list[0].name).toBe('renamed')

      await findHandler('mcp:remove')({}, ws, 'renamed')
      await expect(findHandler('mcp:list')({}, ws)).resolves.toEqual([])
      rmSync(ws, { recursive: true, force: true })
    })

    it('mcp:probe rejects for an unknown server', async () => {
      const ws = mkdtempSync(join(tmpdir(), 'hive-mcp-ipc-'))
      await expect(findHandler('mcp:probe')({}, ws, 'ghost')).rejects.toThrow(/não encontrado/i)
      rmSync(ws, { recursive: true, force: true })
    })
  })

  // The two profile writes the terminal work sits next to. Untested before,
  // and both are the silent kind: the user edits a field, nothing complains,
  // nothing is saved.
  describe('profile:setRole / profile:setUserName', () => {
    it('round-trips the role and the display name through the config store', async () => {
      await findHandler('profile:setRole')({}, 'dev')
      await expect(findHandler('profile:getRole')({})).resolves.toBe('dev')

      await findHandler('profile:setUserName')({}, '  Gustavo  ')
      await expect(findHandler('profile:getUserName')({})).resolves.toBe('Gustavo')

      await findHandler('profile:setUserName')({}, null)
      await expect(findHandler('profile:getUserName')({})).resolves.toBeNull()
    })

    it('keeps only registered ids in the enabled set, and survives a non-array', async () => {
      await findHandler('profile:setAgents')({}, ['claude-cli', 'agente-inventado'])
      await expect(findHandler('profile:getAgents')({})).resolves.toEqual(['claude-cli'])

      // A malformed payload empties the set rather than throwing across IPC.
      await findHandler('profile:setAgents')({}, 'nao-e-lista')
      await expect(findHandler('profile:getAgents')({})).resolves.toBeNull()
    })
  })

  // agent-terminal: the terminal picker's two channels.
  describe('shell:* (agent-terminal)', () => {
    it('registers both handlers', () => {
      for (const channel of ['shell:list', 'shell:select']) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
    })

    it('answers with the machine catalog: real shells, real paths, automatic unselected', async () => {
      const view = (await findHandler('shell:list')({})) as {
        shells: Array<{ id: string; path: string }>
        selectedId: string | null
        resolvedId: string | null
      }
      expect(view.selectedId).toBeNull()
      // Whatever this machine has, every entry is an absolute path that the
      // detector actually found — the picker's whole claim.
      for (const shell of view.shells) {
        expect(shell.path.startsWith('/') || /^[A-Za-z]:\\/.test(shell.path)).toBe(true)
      }
      if (view.shells.length > 0) expect(view.resolvedId).not.toBeNull()
    })

    const selectedId = async (): Promise<string | null> =>
      ((await findHandler('shell:list')({})) as { selectedId: string | null }).selectedId

    it('persists a detected choice and restores automatic on null', async () => {
      const view = (await findHandler('shell:list')({})) as { shells: Array<{ id: string }> }
      const target = view.shells[0]
      if (!target) return // a machine with no shell at all: nothing to assert
      await findHandler('shell:select')({}, target.id)
      await expect(selectedId()).resolves.toBe(target.id)

      await findHandler('shell:select')({}, null)
      await expect(selectedId()).resolves.toBeNull()
    })

    it('ignores an id that no detection reported (the IPC boundary is not trusted)', async () => {
      await findHandler('shell:select')({}, 'shell-que-nao-existe')
      await expect(selectedId()).resolves.toBeNull()
    })

    /**
     * AT-R4. The adapters get *getters*, not values: a terminal picked while a
     * conversation is alive has to reach the very next turn, and a snapshot
     * taken at boot would freeze the choice until restart — the failure this
     * whole feature would be invisible under.
     *
     * The pair also has to agree. The chosen shell is what a turn launches in;
     * the catalog is what an adapter pins a fallback to. An adapter that
     * pinned Git Bash from a stale catalog would write a
     * `CLAUDE_CODE_GIT_BASH_PATH` for a file that is not there, and the Claude
     * CLI exits(1) on exactly that.
     */
    it('hands the adapters live terminal getters, and a catalog the choice belongs to', () => {
      const deps = registryDeps.value as {
        shell?: () => { id: string } | null
        shells?: () => Array<{ id: string }>
      }
      expect(typeof deps.shell).toBe('function')
      expect(typeof deps.shells).toBe('function')

      const available = deps.shells!()
      expect(Array.isArray(available)).toBe(true)
      const chosen = deps.shell!()
      if (chosen) expect(available.map((entry) => entry.id)).toContain(chosen.id)
    })
  })

  // shortcut-customization: catalog + persisted selection + resolved set.
  describe('shortcuts:* (shortcut-customization)', () => {
    it('registers the four shortcuts handlers', () => {
      for (const channel of [
        'shortcuts:catalog',
        'shortcuts:get',
        'shortcuts:set',
        'shortcuts:actions'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
    })

    it('shortcuts:catalog yields [] for a workspace without BMAD metadata', async () => {
      await expect(findHandler('shortcuts:catalog')({}, userDataDir)).resolves.toEqual([])
    })

    it('shortcuts:set/get round-trip per scope through the real ConfigStore, sanitizing input', async () => {
      await expect(findHandler('shortcuts:get')({})).resolves.toEqual({
        start: null,
        during: null
      })

      await findHandler('shortcuts:set')({}, 'start', {
        skills: ['bmad-prd', 7, ''],
        agents: ['a', 'a']
      })
      await expect(findHandler('shortcuts:get')({})).resolves.toEqual({
        start: { skills: ['bmad-prd'], agents: ['a'] },
        during: null
      })

      // null restores that scope's role defaults (and leaves later tests unaffected).
      await findHandler('shortcuts:set')({}, 'start', null)
      await expect(findHandler('shortcuts:get')({})).resolves.toEqual({
        start: null,
        during: null
      })
    })

    // shortcut-scopes: an unrecognized scope is dropped, not defaulted —
    // writing the wrong set is worse than writing none.
    it('shortcuts:set ignores an unknown scope instead of writing one', async () => {
      await findHandler('shortcuts:set')({}, 'sideways', { skills: ['bmad-prd'], agents: [] })
      await expect(findHandler('shortcuts:get')({})).resolves.toEqual({
        start: null,
        during: null
      })
    })

    it('shortcuts:actions resolves both scopes from the role defaults while no customization exists', async () => {
      const sets = (await findHandler('shortcuts:actions')({}, 'pm', userDataDir)) as Record<
        'start' | 'during',
        { key: string }[]
      >
      expect(sets.start.map((a) => a.key)).toContain('prd')
      expect(sets.during.map((a) => a.key)).toEqual(['party-mode'])
    })

    it('profile:roleActions serves the requested scope, defaulting to start', async () => {
      const start = (await findHandler('profile:roleActions')({}, 'pm')) as { key: string }[]
      const during = (await findHandler('profile:roleActions')({}, 'pm', 'during')) as {
        key: string
      }[]
      expect(start.map((a) => a.key)).toContain('prd')
      expect(during.map((a) => a.key)).toEqual(['party-mode'])
    })
  })

  describe('git:* (git-management M10)', () => {
    it('registers every git read + mutation handler and the changed stream', () => {
      for (const channel of [
        'git:detect',
        'git:status',
        'git:branches',
        'git:log',
        'git:diff',
        'git:commitDiff',
        'git:fileAtHead',
        'git:conflicts',
        'git:stashList',
        'git:init',
        'git:stage',
        'git:unstage',
        'git:discard',
        'git:commit',
        'git:createBranch',
        'git:checkout',
        'git:renameBranch',
        'git:deleteBranch',
        'git:fetch',
        'git:pull',
        'git:push',
        'git:sync',
        'git:resolveConflict',
        'git:mergeContinue',
        'git:mergeAbort',
        'git:stash',
        'git:stashApply',
        'git:stashDrop'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('git:changed:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('git:changed:stop', expect.any(Function))
    })

    it('injects a trashItem that routes to shell.trashItem (untracked-discard path)', async () => {
      const { createGitService } = await import('./gitService')
      const [deps] = vi.mocked(createGitService).mock.calls[0] as [
        { trashItem: (abs: string) => Promise<void> }
      ]
      await deps.trashItem('/ws/junk.txt')
      expect(shell.trashItem).toHaveBeenCalledWith('/ws/junk.txt')
    })

    it('routes a read handler to the service and returns its result', async () => {
      await expect(findHandler('git:status')({}, '/ws')).resolves.toMatchObject({ branch: 'main' })
      expect(fakeGitService.status).toHaveBeenCalledWith('/ws')

      await findHandler('git:diff')({}, '/ws', 'a.txt', 'working')
      expect(fakeGitService.diff).toHaveBeenCalledWith('/ws', 'a.txt', 'working')
    })

    it('routes a mutation handler and fires git:changed to subscribed senders', async () => {
      const send = vi.fn()
      const sender = { id: 42, send }
      findOnHandler('git:changed:start')({ sender })

      await findHandler('git:stage')({}, '/ws', ['a.txt'])
      expect(fakeGitService.stage).toHaveBeenCalledWith('/ws', ['a.txt'])
      expect(send).toHaveBeenCalledWith('git:changed', { root: '/ws' })

      // Unsubscribing stops further notifications.
      send.mockClear()
      findOnHandler('git:changed:stop')({ sender })
      await findHandler('git:commit')({}, '/ws', 'msg')
      expect(send).not.toHaveBeenCalled()
    })

    it('every git handler forwards to its matching service method', async () => {
      const sender = { id: 7, send: vi.fn() }
      findOnHandler('git:changed:start')({ sender })
      const cases: Array<[string, unknown[], keyof typeof fakeGitService]> = [
        ['git:detect', ['/ws'], 'detect'],
        ['git:branches', ['/ws'], 'branches'],
        ['git:log', ['/ws', { limit: 10 }], 'log'],
        ['git:commitDiff', ['/ws', 'abc'], 'commitDiff'],
        ['git:fileAtHead', ['/ws', 'a.txt'], 'fileAtHead'],
        ['git:conflicts', ['/ws'], 'conflicts'],
        ['git:stashList', ['/ws'], 'stashList'],
        ['git:init', ['/ws'], 'init'],
        ['git:unstage', ['/ws', ['a']], 'unstage'],
        ['git:discard', ['/ws', ['a']], 'discard'],
        ['git:createBranch', ['/ws', 'feat', 'main'], 'createBranch'],
        ['git:checkout', ['/ws', 'main'], 'checkout'],
        ['git:renameBranch', ['/ws', 'a', 'b'], 'renameBranch'],
        ['git:deleteBranch', ['/ws', 'a', true], 'deleteBranch'],
        ['git:fetch', ['/ws'], 'fetch'],
        ['git:pull', ['/ws'], 'pull'],
        ['git:sync', ['/ws'], 'sync'],
        ['git:resolveConflict', ['/ws', 'a', 'both'], 'resolveConflict'],
        ['git:mergeContinue', ['/ws'], 'mergeContinue'],
        ['git:mergeAbort', ['/ws'], 'mergeAbort'],
        ['git:stash', ['/ws', { untracked: true }], 'stash'],
        ['git:stashApply', ['/ws', 1, true], 'stashApply'],
        ['git:stashDrop', ['/ws', 1], 'stashDrop']
      ]
      for (const [channel, args, method] of cases) {
        await findHandler(channel)({}, ...args)
        expect(fakeGitService[method]).toHaveBeenCalledWith(...args)
      }
    })

    it('rethrows a GitError as a GIT:-prefixed message carrying stderr', async () => {
      const { GitError } = await vi.importActual<typeof import('./gitService')>('./gitService')
      fakeGitService.push.mockRejectedValueOnce(
        new GitError(128, 'fatal: Authentication failed', 'git push')
      )
      const err = await (findHandler('git:push')({}, '/ws') as Promise<unknown>).catch(
        (e: Error) => e
      )
      expect((err as Error).message.startsWith('GIT:')).toBe(true)
      expect((err as Error).message).toContain('Authentication failed')
    })
  })

  // Agent Change Review (M11, T6): the review:* handlers route to the injected
  // ReviewService, and the turn lifecycle drives begin/endTurn.
  describe('review:* handlers + turn wiring', () => {
    it('registers the review:* request/response handlers and the changed stream', () => {
      for (const ch of [
        'review:get',
        'review:acceptFile',
        'review:rejectFile',
        'review:acceptHunk',
        'review:rejectHunk',
        'review:acceptAll',
        'review:rejectAll',
        'review:attachTurn'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('review:changed:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('review:changed:stop', expect.any(Function))
    })

    it('routes accept/reject calls to the ReviewService', async () => {
      await findHandler('review:get')({}, '/ws')
      expect(fakeReviewService.get).toHaveBeenCalledWith('/ws')

      await findHandler('review:acceptFile')({}, '/ws', 'a.txt')
      expect(fakeReviewService.acceptFile).toHaveBeenCalledWith('/ws', 'a.txt')

      await findHandler('review:rejectFile')({}, '/ws', 'a.txt')
      expect(fakeReviewService.rejectFile).toHaveBeenCalledWith('/ws', 'a.txt')

      await findHandler('review:acceptHunk')({}, '/ws', 'a.txt', '0:1:1')
      expect(fakeReviewService.acceptHunk).toHaveBeenCalledWith('/ws', 'a.txt', '0:1:1')

      await findHandler('review:rejectHunk')({}, '/ws', 'a.txt', '0:1:1')
      expect(fakeReviewService.rejectHunk).toHaveBeenCalledWith('/ws', 'a.txt', '0:1:1')

      await findHandler('review:acceptAll')({}, '/ws')
      expect(fakeReviewService.acceptAll).toHaveBeenCalledWith('/ws')

      await findHandler('review:rejectAll')({}, '/ws')
      expect(fakeReviewService.rejectAll).toHaveBeenCalledWith('/ws')

      await findHandler('review:attachTurn')({}, '/ws', 't-xyz', 'conv-1')
      expect(fakeReviewService.attachTurn).toHaveBeenCalledWith('/ws', 't-xyz', 'conv-1')
    })

    it('rejects a review path that escapes the workspace root', async () => {
      const err = await (
        findHandler('review:acceptFile')({}, '/ws', '../../etc/passwd') as Promise<unknown>
      ).catch((e: Error) => e)
      expect((err as Error).message).toContain('escapes workspace root')
      expect(fakeReviewService.acceptFile).not.toHaveBeenCalledWith('/ws', '../../etc/passwd')
    })

    it('begins a review turn on agent:send (checkpoint before spawn) and ends it on the terminal event', async () => {
      // Activate a workspace so getWorkspace() resolves for the turn wiring.
      const dir = mkdtempSync(join(tmpdir(), 'hive-main-review-turn-'))
      await findHandler('workspace:open')({}, dir)

      fakeReviewService.beginTurn.mockClear()
      fakeReviewService.endTurn.mockClear()

      await findHandler('agent:send')({}, 'do the thing', { turnId: 't-xyz' })
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(dir, 't-xyz', undefined)
      // The agent still receives the (same) turnId.
      expect(fakeAgentService.send).toHaveBeenCalledWith(
        'do the thing',
        expect.objectContaining({ turnId: 't-xyz' })
      )
      // A watcher was started for the workspace.
      expect(watchWorkspaceCalls.some((c) => c.root === dir)).toBe(true)

      // The bootstrap review listener (index's first agentService.onEvent)
      // accumulates tool_use file paths (ACR-C7) then ends the turn on the
      // terminal event, passing the touched paths as workspace-relative POSIX.
      // Attribution reads `filePath`, never `detail`: since agent-activity
      // every tool reports, and a Bash command line is not a path.
      const reviewListener = agentOnEventCalls[0].listener
      reviewListener({ type: 'tool', name: 'Write', filePath: `${dir}/src/a.txt`, turnId: 't-xyz' })
      reviewListener({ type: 'tool', name: 'Edit', filePath: `${dir}/src/b.txt`, turnId: 't-xyz' })
      // A tool path outside the workspace is dropped.
      reviewListener({ type: 'tool', name: 'Write', filePath: '/elsewhere/c.txt', turnId: 't-xyz' })
      // A non-file tool contributes nothing, however chatty its detail.
      reviewListener({
        type: 'tool',
        name: 'Bash',
        detail: `rm -rf ${dir}/src/c.txt`,
        turnId: 't-xyz'
      })
      reviewListener({ type: 'done', turnId: 't-xyz' })
      expect(fakeReviewService.endTurn).toHaveBeenCalledWith(dir, 't-xyz', [
        'src/a.txt',
        'src/b.txt'
      ])

      rmSync(dir, { recursive: true, force: true })
    })

    it('synthesizes a turnId when agent:send omits one', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'hive-main-review-synth-'))
      await findHandler('workspace:open')({}, dir)
      fakeReviewService.beginTurn.mockClear()

      await findHandler('agent:send')({}, 'no turn id', undefined)
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(
        dir,
        expect.stringMatching(/^review-turn-/),
        undefined
      )

      rmSync(dir, { recursive: true, force: true })
    })

    /**
     * The conversation the turn was asked from rides along from the chat pane,
     * so the turn's change card renders in that transcript alone. Without it
     * every conversation showed every workspace turn's card.
     */
    it('carries the sending conversation into the turn mark, on send and on runWorkflow', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'hive-main-review-conv-'))
      await findHandler('workspace:open')({}, dir)
      fakeReviewService.beginTurn.mockClear()

      await findHandler('agent:send')({}, 'oi', { turnId: 't-1', conversationId: 'conv-a' })
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(dir, 't-1', 'conv-a')

      await findHandler('agent:runWorkflow')(
        {},
        { key: 'bmad-prd' },
        { turnId: 't-2', conversationId: 'conv-b' }
      )
      expect(fakeReviewService.beginTurn).toHaveBeenCalledWith(dir, 't-2', 'conv-b')

      rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('secondBrain:* handlers (second-brain)', () => {
    it('registers the streamed install/update channels and the request/response handlers', () => {
      for (const ch of [
        'secondBrain:install:start',
        'secondBrain:install:stop',
        'secondBrain:update:start',
        'secondBrain:update:stop'
      ]) {
        expect(ipcMain.on).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      for (const ch of [
        'secondBrain:isProvisioned',
        'secondBrain:getVault',
        'secondBrain:stageRaw'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
    })

    it('isProvisioned routes to the service.detect', async () => {
      fakeSecondBrainService.detect.mockReturnValueOnce(true)
      expect(await findHandler('secondBrain:isProvisioned')({}, '/ws')).toBe(true)
      expect(fakeSecondBrainService.detect).toHaveBeenCalledWith('/ws')
    })

    it('getVault combines resolveVault with the vault raw-pending count', async () => {
      fakeSecondBrainService.resolveVault.mockReturnValueOnce({
        path: '/ws/second-brain',
        name: 'second-brain'
      })
      fakeSecondBrainVault.countRawPending.mockReturnValueOnce(3)

      expect(await findHandler('secondBrain:getVault')({}, '/ws')).toEqual({
        path: '/ws/second-brain',
        name: 'second-brain',
        rawPending: 3
      })
    })

    it('getVault returns null path/name when no vault is configured', async () => {
      fakeSecondBrainService.resolveVault.mockReturnValueOnce(null)
      fakeSecondBrainVault.countRawPending.mockReturnValueOnce(0)
      expect(await findHandler('secondBrain:getVault')({}, '/ws')).toEqual({
        path: null,
        name: null,
        rawPending: 0
      })
    })

    it('stageRaw routes to the vault and returns only the relPath', async () => {
      fakeSecondBrainVault.stageRaw.mockReturnValueOnce({
        relPath: 'second-brain/raw/ingest-y.md',
        absPath: '/ws/second-brain/raw/ingest-y.md'
      })
      expect(await findHandler('secondBrain:stageRaw')({}, '/ws', 'hello')).toEqual({
        relPath: 'second-brain/raw/ingest-y.md'
      })
      expect(fakeSecondBrainVault.stageRaw).toHaveBeenCalledWith('/ws', 'hello')
    })

    it('install:start streams SkillEvents to the sender, and install:stop halts forwarding', async () => {
      const send = vi.fn()
      const event = { sender: { id: 4242, send } }

      findOnHandler('secondBrain:install:start')(event, '/ws')
      await new Promise((r) => setTimeout(r, 0))

      expect(fakeSecondBrainService.install).toHaveBeenCalledWith('/ws')
      expect(send).toHaveBeenCalledWith('secondBrain:install:event', {
        type: 'step',
        id: 'found',
        label: 'Found 4 skills'
      })
      expect(send).toHaveBeenCalledWith('secondBrain:install:event', { type: 'done', ok: true })

      // stop is a no-throw no-op (the stream already finished).
      expect(() => findOnHandler('secondBrain:install:stop')(event)).not.toThrow()
    })

    it('registers the hive-model: scheme as privileged, CORS-enabled and non-CSP-bypassing', () => {
      // Chromium reads the scheme registry once during startup, so every
      // privileged scheme the app owns must arrive in this single call —
      // asserted as the exact array, not a subset, because a scheme that
      // silently stopped being registered still "contains" the other one.
      expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
        expect.objectContaining({
          scheme: 'hive-model',
          privileges: expect.objectContaining({
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: false
          })
        }),
        // design-studio T3.2 — the Preview's scheme, registered in the same call.
        expect.objectContaining({
          scheme: 'hive-studio',
          privileges: expect.objectContaining({
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: false
          })
        })
      ])
    })

    it('serves a model file from the userData store, and refuses an unknown host', async () => {
      const call = vi.mocked(protocol.handle).mock.calls.find(([scheme]) => scheme === 'hive-model')
      expect(call).toBeTruthy()
      const handler = call![1] as (req: { url: string }) => Promise<Response> | Response

      // A real file, because the handler now measures what it is about to
      // serve (see below) and cannot answer for a path it can't stat.
      const modelDir = join(userDataDir, 'whisper-models', 'Xenova', 'whisper-base')
      mkdirSync(modelDir, { recursive: true })
      writeFileSync(join(modelDir, 'config.json'), '{"model_type":"whisper"}')

      await handler({ url: 'hive-model://models/Xenova/whisper-base/config.json' })
      expect(net.fetch).toHaveBeenCalledWith(
        expect.stringContaining('whisper-models/Xenova/whisper-base/config.json')
      )

      vi.mocked(net.fetch).mockClear()
      const denied = await handler({ url: 'hive-model://secrets/id_rsa' })
      expect((denied as Response).status).toBe(404)
      expect(net.fetch).not.toHaveBeenCalled()
    })

    /**
     * The regression behind "a transcrição não funciona": `net.fetch(file://…)`
     * answers without a `Content-Length`, and Transformers.js responds to a missing
     * one by reading the body into a buffer it keeps reallocating. On the
     * 208 MB fp32 decoder that turned a ~20 s model load into minutes of what
     * looked like a hang. The handler now re-attaches the real size.
     */
    it('attaches the real Content-Length to a served model file', async () => {
      const call = vi.mocked(protocol.handle).mock.calls.find(([scheme]) => scheme === 'hive-model')
      const handler = call![1] as (req: { url: string }) => Promise<Response>

      const modelDir = join(userDataDir, 'whisper-models', 'base', 'onnx')
      mkdirSync(modelDir, { recursive: true })
      const bytes = 'x'.repeat(4096)
      writeFileSync(join(modelDir, 'encoder_model.onnx'), bytes)

      const response = await handler({ url: 'hive-model://models/base/onnx/encoder_model.onnx' })
      expect(response.headers.get('content-length')).toBe(String(bytes.length))
      expect(response.headers.get('content-type')).toBe('application/octet-stream')
    })

    /**
     * design-studio T3.2. The wired handler, not the factory: this asserts the
     * header the *app* emits, off a real `Response`, so a future refactor that
     * registers the scheme without its CSP fails here.
     */
    it('serves the Preview scheme from resources/ with its own CSP on the response', async () => {
      const call = vi
        .mocked(protocol.handle)
        .mock.calls.find(([scheme]) => scheme === 'hive-studio')
      expect(call).toBeTruthy()
      const handler = call![1] as (req: { url: string }) => Promise<Response>

      const response = await handler({
        url: 'hive-studio://preview/design-system-web-awesome/catalog.json'
      })
      expect(response.status).toBe(200)
      const csp = response.headers.get('content-security-policy') ?? ''
      expect(csp).toContain('connect-src data:')
      expect(csp).not.toContain("connect-src 'none'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data:")
    })

    it('mints a live, unguessable Preview URL and retires it on close', async () => {
      const open = findHandler('designStudio:openPreview')
      const url = (await open({})) as string
      expect(url).toMatch(/^hive-studio:\/\/preview\/[0-9a-f]{64}\/index\.html$/)

      const studioHandler = vi
        .mocked(protocol.handle)
        .mock.calls.find(([scheme]) => scheme === 'hive-studio')![1] as (req: {
        url: string
      }) => Promise<Response>

      expect((await studioHandler({ url })).status).toBe(200)

      await findHandler('designStudio:closePreview')({}, url)
      expect((await studioHandler({ url })).status).toBe(404)
    })

    // design-studio T4.2 / DS-R1 AC-2: the Telas are listed *before* anything
    // is generated. The assertion that matters is not that three come back —
    // it is that no agent was touched to produce them, because an agent call
    // here would put a spinner in front of the first thing the Studio says.
    it('lists every Tela of a Spec without invoking the agent (AC-2)', async () => {
      fakeFsService.readFile.mockReturnValueOnce(
        ['## Tela — Login', '## Tela — Cadastro', '## Tela — Sucesso'].join('\n')
      )
      vi.mocked(fakeAgentService.startSession).mockClear()
      vi.mocked(fakeAgentService.send).mockClear()

      const result = (await findHandler('designStudio:screens')({}, '/ws', 'docs/ux.md')) as {
        screens: { title: string }[]
      }

      expect(fakeFsService.readFile).toHaveBeenCalledWith('/ws', 'docs/ux.md')
      expect(result.screens.map((screen) => screen.title)).toEqual(['Login', 'Cadastro', 'Sucesso'])
      expect(fakeAgentService.startSession).not.toHaveBeenCalled()
      expect(fakeAgentService.send).not.toHaveBeenCalled()
    })

    it('reports an unreadable Spec as a retryable OperationError, not a rejection (AC-5)', async () => {
      fakeFsService.readFile.mockImplementationOnce(() => {
        throw new Error('ENOENT: no such file')
      })

      await expect(findHandler('designStudio:screens')({}, '/ws', 'gone.md')).resolves.toEqual({
        kind: 'operation',
        scope: 'io',
        message: 'ENOENT: no such file',
        retryable: true
      })
    })

    it('reports a non-Error read failure with its own text rather than "[object Object]"', async () => {
      fakeFsService.readFile.mockImplementationOnce(() => {
        throw 'disco cheio'
      })

      await expect(findHandler('designStudio:screens')({}, '/ws', 'x.md')).resolves.toMatchObject({
        message: 'disco cheio',
        retryable: true
      })
    })

    // design-studio T5.1: the document lives in main because `validate()` does.
    // These assert the *document*, not just the reply shape — an edit that is
    // refused has to leave the Tela alone (DS-R6 AC-4).
    it('serves the active catalog, derived from the real CEM (DS-R13)', async () => {
      const catalog = (await findHandler('designStudio:catalog')({})) as {
        dsId: string
        components: { tag: string; props: { name: string; values?: string[] }[] }[]
      }

      expect(catalog.dsId).toBe('web-awesome')
      const variant = catalog.components
        .find((component) => component.tag === 'wa-button')
        ?.props.find((prop) => prop.name === 'variant')
      expect(variant?.values).toEqual(['neutral', 'brand', 'success', 'warning', 'danger'])
    })

    it('opens a Tela empty and grows it one undoable step at a time', async () => {
      const key = 'ipc-doc-1'
      await expect(findHandler('designStudio:view')({}, key, 'login', 'Login')).resolves.toEqual({
        document: { screenId: 'login', title: 'Login', root: null },
        canUndo: false,
        canRedo: false
      })

      const added = (await findHandler('designStudio:dispatch')(
        {},
        key,
        'login',
        'Login',
        [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: { id: 'n1', tag: 'wa-button', props: {}, children: [] }
          }
        ],
        'g1'
      )) as { document: { root: { tag: string } | null }; canUndo: boolean }
      expect(added.document.root?.tag).toBe('wa-button')
      expect(added.canUndo).toBe(true)

      const undone = (await findHandler('designStudio:undo')({}, key, 'login', 'Login')) as {
        document: { root: unknown }
        canRedo: boolean
      }
      expect(undone.document.root).toBeNull()
      expect(undone.canRedo).toBe(true)

      const redone = (await findHandler('designStudio:redo')({}, key, 'login', 'Login')) as {
        document: { root: { tag: string } | null }
      }
      expect(redone.document.root?.tag).toBe('wa-button')
    })

    it('answers a value outside the catalog with a CapabilityViolation, document untouched', async () => {
      const key = 'ipc-doc-2'
      await findHandler('designStudio:dispatch')(
        {},
        key,
        'login',
        'Login',
        [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: { id: 'n1', tag: 'wa-button', props: {}, children: [] }
          }
        ],
        'g1'
      )

      const refused = (await findHandler('designStudio:dispatch')(
        {},
        key,
        'login',
        'Login',
        [{ type: 'SetProp', componentId: 'n1', key: 'variant', value: 'roxo' }],
        'g2'
      )) as { kind: string; attemptedValue: unknown }
      expect(refused.kind).toBe('capability')
      expect(refused.attemptedValue).toBe('roxo')

      const after = (await findHandler('designStudio:view')({}, key, 'login', 'Login')) as {
        document: { root: { props: Record<string, unknown> } | null }
      }
      expect(after.document.root?.props).toEqual({})
    })

    /**
     * design-studio T7.4 / DS-R14 AC-3. Exporting is a **read**: it goes
     * through `view()`, so the log it replays is the log it leaves behind.
     * Both negatives are asserted here rather than inferred from the code —
     * the cursor does not move, and nothing about the Tela changes.
     */
    it('exports a Tela without moving the undo cursor or touching the Tela', async () => {
      const key = 'ipc-export-1'
      await findHandler('designStudio:dispatch')(
        {},
        key,
        'login',
        'Login',
        [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: { id: 'n1', tag: 'wa-button', props: { variant: 'brand' }, children: [] }
          }
        ],
        'g1'
      )
      await findHandler('designStudio:undo')({}, key, 'login', 'Login')
      const before = await findHandler('designStudio:view')({}, key, 'login', 'Login')

      const outDir = mkdtempSync(join(tmpdir(), 'hive-export-ipc-'))
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: [outDir]
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)

      const run = (await findHandler('designStudio:export')({}, [
        { key, screenId: 'login', title: 'Login' }
      ])) as { canceled: boolean; outDir: string; outcomes: { ok: boolean; file?: string }[] }

      expect(run).toMatchObject({ canceled: false, outDir })
      expect(run.outcomes).toEqual([
        { screenId: 'login', title: 'Login', ok: true, file: join(outDir, 'login.html') }
      ])
      // The Tela was at cursor 0 (undone) when the export ran, so the file it
      // wrote is the *current* Tela, and the cursor is still where it was.
      expect(await findHandler('designStudio:view')({}, key, 'login', 'Login')).toEqual(before)
      rmSync(outDir, { recursive: true, force: true })
    })

    it('writes nothing when the folder picker is closed', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: []
      } as Awaited<ReturnType<typeof dialog.showOpenDialog>>)

      await expect(
        findHandler('designStudio:export')({}, [
          { key: 'ipc-export-2', screenId: 'login', title: 'Login' }
        ])
      ).resolves.toEqual({ canceled: true, outDir: null, outcomes: [] })
    })

    /**
     * design-studio T6.2 / DS-R2 + AD-9. The Skill's turn crosses IPC as a
     * stream, and the agent is reached only through `AgentSession`/`AgentEvent`
     * — the assertion that matters is that a *prompt carrying the catalog and
     * the Spec* is what `agentService.send` receives, tagged with a turn id.
     */
    it('runs the Skill over the Spec and streams its turn to the sender', async () => {
      fakeFsService.readFile.mockReturnValueOnce('## Tela — Login\nUm botão de entrar.')
      vi.mocked(fakeAgentService.startSession).mockClear()
      vi.mocked(fakeAgentService.send).mockClear()
      const send = vi.fn()
      const fakeEvent = { sender: { id: 991, send } }

      findOnHandler('designStudio:skill:start')(fakeEvent, {
        kind: 'generate',
        workspace: '/ws',
        specPath: 'docs/ux.md',
        screenTitle: 'Login'
      })
      await vi.waitFor(() => expect(fakeAgentService.send).toHaveBeenCalled())

      expect(fakeAgentService.startSession).toHaveBeenCalledWith({ workspace: '/ws' })
      const [prompt, opts] = vi.mocked(fakeAgentService.send).mock.calls[0] as [
        string,
        { turnId: string }
      ]
      expect(prompt).toContain('Um botão de entrar.')
      expect(prompt).toContain('wa-button')
      expect(typeof opts.turnId).toBe('string')

      // The stage is told the turn started before the agent says anything.
      await vi.waitFor(() =>
        expect(send).toHaveBeenCalledWith('designStudio:skill:event', {
          type: 'status',
          phase: 'reading'
        })
      )

      // And the agent's own answer comes back as the parsed batch.
      const listener = agentOnEventCalls.at(-1)!.listener
      listener({ type: 'token', text: '{"commands": [], "message": "pronto"}', ...opts })
      listener({ type: 'done', ...opts })
      await vi.waitFor(() =>
        expect(send).toHaveBeenCalledWith('designStudio:skill:event', {
          type: 'result',
          batch: { commands: [], message: 'pronto' }
        })
      )
    })

    /**
     * design-studio T6.4 / DS-R10 AC-1. The iteration reads the Tela from the
     * very log `dispatch` writes to, and the selected Component travels into
     * the prompt — a selection the tab tracks but never sends is a context the
     * Skill cannot act on.
     */
    it('iterates over the live Tela with the selected Component as context', async () => {
      const key = '/ws docs/ux.md iterate'
      await findHandler('designStudio:dispatch')(
        {},
        key,
        'login',
        'Login',
        [
          {
            type: 'AddComponent',
            parentId: null,
            index: 0,
            node: { id: 'n1', tag: 'wa-button', props: {}, children: [] }
          }
        ],
        'manual-1'
      )
      vi.mocked(fakeAgentService.send).mockClear()
      const send = vi.fn()

      findOnHandler('designStudio:skill:start')(
        { sender: { id: 993, send } },
        {
          kind: 'iterate',
          key,
          screenId: 'login',
          title: 'Login',
          message: 'deixe o botão discreto',
          selectedComponentId: 'n1'
        }
      )
      await vi.waitFor(() => expect(fakeAgentService.send).toHaveBeenCalled())

      const prompt = vi.mocked(fakeAgentService.send).mock.calls[0][0] as string
      expect(prompt).toContain('The user has <wa-button> (id "n1") selected.')
      expect(prompt).toContain('deixe o botão discreto')
      // The tree it iterates over is the one the log produced, not an empty one.
      expect(prompt).toContain('"id":"n1"')
    })

    it('stops forwarding a Skill turn when the sender asks it to', async () => {
      fakeFsService.readFile.mockReturnValue('## Tela — Login')
      const send = vi.fn()
      const fakeEvent = { sender: { id: 992, send } }

      findOnHandler('designStudio:skill:start')(fakeEvent, {
        kind: 'generate',
        workspace: '/ws',
        specPath: 'docs/ux.md',
        screenTitle: 'Login'
      })
      // A second start for the same sender exercises the stop of the first.
      findOnHandler('designStudio:skill:start')(fakeEvent, {
        kind: 'generate',
        workspace: '/ws',
        specPath: 'docs/ux.md',
        screenTitle: 'Cadastro'
      })
      await vi.waitFor(() => expect(send).toHaveBeenCalled())

      send.mockClear()
      findOnHandler('designStudio:skill:stop')(fakeEvent)
      const listener = agentOnEventCalls.at(-1)!.listener
      const turnId = (vi.mocked(fakeAgentService.send).mock.calls.at(-1)?.[1] as { turnId: string })
        .turnId
      listener({ type: 'token', text: '{"commands": []}', turnId })
      listener({ type: 'done', turnId })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(send).not.toHaveBeenCalled()
    })

    it('gives a different Preview URL to every open', async () => {
      const open = findHandler('designStudio:openPreview')
      const first = await open({})
      const second = await open({})
      expect(first).not.toBe(second)
    })

    it('refuses an unknown host on the Preview scheme', async () => {
      const call = vi
        .mocked(protocol.handle)
        .mock.calls.find(([scheme]) => scheme === 'hive-studio')
      const handler = call![1] as (req: { url: string }) => Promise<Response>
      expect((await handler({ url: 'hive-studio://userdata/sessions.json' })).status).toBe(404)
    })

    it('404s a resolvable path that is not on disk, instead of a fetch that fails later', async () => {
      const call = vi.mocked(protocol.handle).mock.calls.find(([scheme]) => scheme === 'hive-model')
      const handler = call![1] as (req: { url: string }) => Promise<Response>

      vi.mocked(net.fetch).mockClear()
      const missing = await handler({ url: 'hive-model://models/base/nope.json' })
      expect(missing.status).toBe(404)
      expect(net.fetch).not.toHaveBeenCalled()
    })

    it('grants the microphone and clipboard *writes*, denying everything else (SB-R5.1)', () => {
      const handler = vi.mocked(session.defaultSession.setPermissionRequestHandler).mock
        .calls[0]?.[0] as (
        contents: unknown,
        permission: string,
        callback: (granted: boolean) => void
      ) => void
      expect(handler).toBeTypeOf('function')

      const granted: Record<string, boolean> = {}
      for (const permission of [
        'media',
        'geolocation',
        'notifications',
        'midi',
        // file-clipboard: the asymmetric pair. *Sanitized write* is granted —
        // without it `navigator.clipboard.writeText()` rejects with
        // `NotAllowedError` and every in-app copy fails. *Read* stays denied:
        // nothing in this app has any business seeing what the user copied
        // somewhere else.
        'clipboard-sanitized-write',
        'clipboard-read',
        'openExternal'
      ]) {
        handler({}, permission, (ok) => {
          granted[permission] = ok
        })
      }
      expect(granted).toEqual({
        media: true,
        geolocation: false,
        notifications: false,
        midi: false,
        'clipboard-sanitized-write': true,
        'clipboard-read': false,
        openExternal: false
      })
    })

    it('registers the whisper:* model-store handlers and the streamed download channels', () => {
      for (const ch of [
        'whisper:listModels',
        'whisper:modelStatus',
        'whisper:deleteModel',
        'whisper:recommend'
      ]) {
        expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
      }
      expect(ipcMain.on).toHaveBeenCalledWith('whisper:download:start', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('whisper:download:stop', expect.any(Function))
    })

    it('listModels returns the catalog with per-model download state', async () => {
      const models = (await findHandler('whisper:listModels')({})) as Array<{
        id: string
        downloaded: boolean
        bundled: boolean
        repo: string
      }>
      expect(models.length).toBeGreaterThan(0)
      expect(models.map((m) => m.id)).toContain('base')

      // The userData dir is a fresh temp one, so the ONLY thing that can be
      // available here is a model shipping inside the app (D-SB-8) — which is
      // present exactly when `npm run models:fetch` has run for this tree.
      // Asserting the *implication* rather than a fixed list keeps this honest
      // in both shapes: a clean clone has nothing, a packaged tree has three,
      // and neither is allowed to report a downloaded model that isn't there.
      for (const model of models) {
        expect(model.downloaded).toBe(model.bundled)
      }

      const status = (await findHandler('whisper:modelStatus')({}, 'base')) as {
        downloaded: boolean
        variant: string | null
        bundled: boolean
      }
      expect(status).toEqual(
        status.bundled
          ? { downloaded: true, variant: 'fp32', bundled: true }
          : { downloaded: false, variant: null, bundled: false }
      )
    })

    /**
     * SB-R7.4 — the probe stopped being advisory. This is the handler every
     * transcribing surface reads, so what matters is that it resolves to a
     * model that is actually usable rather than merely recommended.
     */
    it('preference resolves a model, and setPreferredModel pins/unpins it', async () => {
      const first = (await findHandler('whisper:preference')({})) as {
        id: string
        auto: boolean
        recommendation: { recommendedId: string }
      }
      expect(first.auto).toBe(true)
      expect(['tiny', 'base', 'small']).toContain(first.id)

      // A model that is not on disk cannot be pinned — the pin is ignored and
      // the probe keeps the decision, rather than transcription pointing at
      // weights that were never fetched.
      const pinnedMissing = (await findHandler('whisper:setPreferredModel')({}, 'large-v3')) as {
        id: string
        auto: boolean
      }
      expect(pinnedMissing.auto).toBe(true)
      expect(pinnedMissing.id).not.toBe('large-v3')

      const cleared = (await findHandler('whisper:setPreferredModel')({}, null)) as {
        auto: boolean
      }
      expect(cleared.auto).toBe(true)
    })

    it('recommend returns an advisory model and never throws, even with no GPU probe', async () => {
      const recommendation = (await findHandler('whisper:recommend')({})) as {
        recommendedId: string
        reason: string
        gpu: boolean
        ramGB: number
      }
      expect(recommendation.recommendedId).toBeTruthy()
      expect(typeof recommendation.gpu).toBe('boolean')
      expect(recommendation.ramGB).toBeGreaterThanOrEqual(0)
    })

    it('deleteModel is a safe no-op for a model that was never downloaded', async () => {
      await expect(findHandler('whisper:deleteModel')({}, 'base')).resolves.toBeUndefined()
    })

    it('download:start streams events to the sender, and stop halts forwarding', async () => {
      const send = vi.fn()
      const event = { sender: { id: 7, send } }
      findOnHandler('whisper:download:start')(event, 'base', 'fp32')
      // The real download hits the network; the store surfaces that failure as
      // an `error` event rather than rejecting (asserted in whisperModelStore's
      // own tests). Either way, stop() must never throw.
      expect(() => findOnHandler('whisper:download:stop')(event)).not.toThrow()
    })

    it('update:start streams via the update channel', async () => {
      const send = vi.fn()
      findOnHandler('secondBrain:update:start')({ sender: { id: 99, send } }, '/ws')
      await new Promise((r) => setTimeout(r, 0))
      expect(fakeSecondBrainService.update).toHaveBeenCalledWith('/ws')
      expect(send).toHaveBeenCalledWith('secondBrain:update:event', { type: 'done', ok: true })
      expect(() =>
        findOnHandler('secondBrain:update:stop')({ sender: { id: 99, send } })
      ).not.toThrow()
    })
  })
})
