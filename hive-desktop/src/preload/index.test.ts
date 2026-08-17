import { describe, expect, it, vi, beforeAll } from 'vitest'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  FsConflictError as FsConflictErrorType,
  GitBridgeError as GitBridgeErrorType
} from './index'

// Mocks Electron's contextBridge/ipcRenderer (and the template's
// @electron-toolkit/preload helper, which itself imports 'electron') so the
// preload script can be imported and exercised outside a real Electron
// renderer process.
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn((channel: string) => Promise.resolve(`invoked:${channel}`)),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn()
  },
  webFrame: {},
  webUtils: { getPathForFile: vi.fn((file: File) => `/abs/path/${file.name}`) }
}))

vi.mock('@electron-toolkit/preload', () => ({
  electronAPI: { ipcRenderer: {}, webFrame: {}, webUtils: {}, process: {} }
}))

function exposedGlobals(): Map<string, unknown> {
  const calls = vi.mocked(contextBridge.exposeInMainWorld).mock.calls
  return new Map(calls.map(([key, value]) => [key as string, value]))
}

describe('preload: window.hive bridge', () => {
  let FsConflictError: typeof FsConflictErrorType
  let GitBridgeError: typeof GitBridgeErrorType

  beforeAll(async () => {
    const mod = await import('./index')
    FsConflictError = mod.FsConflictError
    GitBridgeError = mod.GitBridgeError
  })

  it('exposes "hive" with a typed ping() method, as the pattern for all future IPC', () => {
    const globals = exposedGlobals()
    expect(globals.has('hive')).toBe(true)
    expect(globals.get('hive')).toEqual(expect.objectContaining({ ping: expect.any(Function) }))
  })

  // explorer-os-actions: a value, not a method — a label that has to await an
  // IPC round trip renders wrong on first paint. It must be the string alone;
  // exposing `process` itself across the bridge would be a sandbox hole.
  it('exposes hive.platform as a plain string, not the process object', () => {
    const hive = exposedGlobals().get('hive') as { platform: unknown }
    expect(typeof hive.platform).toBe('string')
    expect(hive.platform).toBe(process.platform)
  })

  it('hive.ping() round-trips through ipcRenderer.invoke("ping")', async () => {
    const hive = exposedGlobals().get('hive') as { ping: () => Promise<string> }
    await expect(hive.ping()).resolves.toBe('invoked:ping')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('ping')
  })

  // T5: WorkspaceService IPC methods, added to the same `hive` bridge object
  // following the exact ping() pattern above.
  it('exposes hive.chooseWorkspace/getWorkspace/isProvisioned as typed methods', () => {
    const globals = exposedGlobals()
    expect(globals.get('hive')).toEqual(
      expect.objectContaining({
        chooseWorkspace: expect.any(Function),
        getWorkspace: expect.any(Function),
        isProvisioned: expect.any(Function)
      })
    )
  })

  it('hive.chooseWorkspace() round-trips through ipcRenderer.invoke("workspace:choose")', async () => {
    const hive = exposedGlobals().get('hive') as { chooseWorkspace: () => Promise<string> }
    await expect(hive.chooseWorkspace()).resolves.toBe('invoked:workspace:choose')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:choose')
  })

  it('hive.getWorkspace() round-trips through ipcRenderer.invoke("workspace:get")', async () => {
    const hive = exposedGlobals().get('hive') as { getWorkspace: () => Promise<string> }
    await expect(hive.getWorkspace()).resolves.toBe('invoked:workspace:get')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:get')
  })

  it('hive.isProvisioned() round-trips through ipcRenderer.invoke("workspace:isProvisioned")', async () => {
    const hive = exposedGlobals().get('hive') as { isProvisioned: () => Promise<boolean> }
    await expect(hive.isProvisioned()).resolves.toBe('invoked:workspace:isProvisioned')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:isProvisioned')
  })

  // T3 (WS-R3.2/WS-R2/WS-R6.3): workspace-switching IPC methods, added to
  // the same `hive` bridge object following the exact chooseWorkspace()/
  // getWorkspace()/isProvisioned() pattern above.
  it('exposes hive.provisionState/getRecentWorkspaces/openWorkspace as typed methods', () => {
    const globals = exposedGlobals()
    expect(globals.get('hive')).toEqual(
      expect.objectContaining({
        provisionState: expect.any(Function),
        getRecentWorkspaces: expect.any(Function),
        openWorkspace: expect.any(Function)
      })
    )
  })

  it('hive.provisionState(path) round-trips through ipcRenderer.invoke("workspace:provisionState", path)', async () => {
    const hive = exposedGlobals().get('hive') as {
      provisionState: (path: string) => Promise<boolean>
    }
    await expect(hive.provisionState('/some/path')).resolves.toBe(
      'invoked:workspace:provisionState'
    )
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:provisionState', '/some/path')
  })

  it('hive.getRecentWorkspaces() round-trips through ipcRenderer.invoke("workspace:recents")', async () => {
    const hive = exposedGlobals().get('hive') as { getRecentWorkspaces: () => Promise<string[]> }
    await expect(hive.getRecentWorkspaces()).resolves.toBe('invoked:workspace:recents')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:recents')
  })

  it('hive.openWorkspace(path) round-trips through ipcRenderer.invoke("workspace:open", path)', async () => {
    const hive = exposedGlobals().get('hive') as {
      openWorkspace: (path: string) => Promise<unknown>
    }
    await expect(hive.openWorkspace('/some/path')).resolves.toBe('invoked:workspace:open')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workspace:open', '/some/path')
  })

  // Proving "renderer has no require/fs/child_process access" from *this*
  // test would be hollow: the module under test never imports those, so a
  // string/shape check here only tests our mocks. The real, meaningful proof
  // is structural — see src/main/index.test.ts, which asserts the
  // BrowserWindow webPreferences (contextIsolation/sandbox/nodeIntegration)
  // that make Node APIs unreachable from the renderer in the first place.

  // T11: FsService request/response + streaming methods (predate T7, never
  // covered by a test — closing that gap here alongside the T7 fs.* work so
  // src/preload/index.ts clears its coverage gate).
  it('hive.listTree(root, rel) round-trips through ipcRenderer.invoke("fs:listTree", root, rel)', async () => {
    const hive = exposedGlobals().get('hive') as {
      listTree: (root: string, rel?: string) => Promise<unknown>
    }
    await expect(hive.listTree('/root', 'sub')).resolves.toBe('invoked:fs:listTree')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:listTree', '/root', 'sub')
  })

  it('hive.readFile(root, rel) round-trips through ipcRenderer.invoke("fs:readFile", root, rel)', async () => {
    const hive = exposedGlobals().get('hive') as {
      readFile: (root: string, rel: string) => Promise<unknown>
    }
    await expect(hive.readFile('/root', 'a.txt')).resolves.toBe('invoked:fs:readFile')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:readFile', '/root', 'a.txt')
  })

  it('hive.watchWorkspace(root, onChange) registers a listener, sends fs:watch:start, and the returned unsubscribe removes the listener + sends fs:watch:stop', () => {
    const hive = exposedGlobals().get('hive') as {
      watchWorkspace: (root: string, onChange: (evt: unknown) => void) => () => void
    }
    const onChange = vi.fn()
    const unsubscribe = hive.watchWorkspace('/root', onChange)
    expect(ipcRenderer.on).toHaveBeenCalledWith('fs:watch:event', expect.any(Function))
    expect(ipcRenderer.send).toHaveBeenCalledWith('fs:watch:start', '/root')

    const listener = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'fs:watch:event')?.[1] as (
      event: unknown,
      change: unknown
    ) => void
    const change = { type: 'change' }
    listener({}, change)
    expect(onChange).toHaveBeenCalledWith(change)

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('fs:watch:event', listener)
    expect(ipcRenderer.send).toHaveBeenCalledWith('fs:watch:stop')
  })

  // T14: AgentService namespace, never covered by a test.
  describe('hive.agent.*', () => {
    function getAgent(): {
      capabilities: () => Promise<unknown>
      start: (opts: unknown) => Promise<void>
      send: (text: string, opts?: { resume?: string | null; turnId?: string }) => Promise<void>
      runWorkflow: (
        cmd: unknown,
        opts?: { resume?: string | null; turnId?: string }
      ) => Promise<void>
      stop: () => Promise<void>
      interrupt: (turnId?: string) => Promise<void>
      onEvent: (onEvent: (evt: unknown) => void) => () => void
    } {
      return (exposedGlobals().get('hive') as { agent: ReturnType<typeof getAgent> }).agent
    }

    it('agent.capabilities() invokes "agent:capabilities"', async () => {
      await getAgent().capabilities()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:capabilities', undefined)
    })

    it('agent.start(opts) invokes "agent:start" with opts', async () => {
      const opts = { workspace: '/root' }
      await getAgent().start(opts)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:start', opts)
    })

    it('agent.send(text, opts) invokes "agent:send" with text + the turn opts', async () => {
      await getAgent().send('hello')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:send', 'hello', undefined)
      await getAgent().send('again', { resume: 'cli-sess-1', turnId: 'turn-1' })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:send', 'again', {
        resume: 'cli-sess-1',
        turnId: 'turn-1'
      })
    })

    it('agent.runWorkflow(cmd, opts) invokes "agent:runWorkflow" with cmd + the turn opts', async () => {
      const cmd = { key: 'plan' }
      await getAgent().runWorkflow(cmd, { resume: 'cli-sess-2', turnId: 'turn-2' })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:runWorkflow', cmd, {
        resume: 'cli-sess-2',
        turnId: 'turn-2'
      })
    })

    it('agent.stop() invokes "agent:stop"', async () => {
      await getAgent().stop()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:stop')
    })

    it('agent.interrupt(turnId?) invokes "agent:interrupt" with the turn id (never "agent:stop")', async () => {
      await getAgent().interrupt()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:interrupt', undefined)
      await getAgent().interrupt('turn-5')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:interrupt', 'turn-5')
    })

    it('agent.onEvent(onEvent) registers a listener, sends agent:event:start, and the returned unsubscribe removes the listener + sends agent:event:stop', () => {
      const onEvent = vi.fn()
      const unsubscribe = getAgent().onEvent(onEvent)
      expect(ipcRenderer.on).toHaveBeenCalledWith('agent:event', expect.any(Function))
      expect(ipcRenderer.send).toHaveBeenCalledWith('agent:event:start')

      const listener = vi
        .mocked(ipcRenderer.on)
        .mock.calls.find(([channel]) => channel === 'agent:event')?.[1] as (
        event: unknown,
        evt: unknown
      ) => void
      const evt = { type: 'text' }
      listener({}, evt)
      expect(onEvent).toHaveBeenCalledWith(evt)

      unsubscribe()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('agent:event', listener)
      expect(ipcRenderer.send).toHaveBeenCalledWith('agent:event:stop')
    })
  })

  // T8/T9/T10: BmadService install/update streams, never covered by a test.
  it('hive.installBmad(workspace, options, onEvent) registers a listener, sends bmad:install:start with the options, and the returned unsubscribe removes the listener + sends bmad:install:stop', () => {
    const hive = exposedGlobals().get('hive') as {
      installBmad: (
        workspace: string,
        options: { modules: string[] },
        onEvent: (evt: unknown) => void
      ) => () => void
    }
    const onEvent = vi.fn()
    const options = { modules: ['bmm'] }
    const unsubscribe = hive.installBmad('/root', options, onEvent)
    expect(ipcRenderer.on).toHaveBeenCalledWith('bmad:install:event', expect.any(Function))
    expect(ipcRenderer.send).toHaveBeenCalledWith('bmad:install:start', '/root', options)

    const listener = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'bmad:install:event')?.[1] as (
      event: unknown,
      evt: unknown
    ) => void
    const evt = { type: 'progress' }
    listener({}, evt)
    expect(onEvent).toHaveBeenCalledWith(evt)

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('bmad:install:event', listener)
    expect(ipcRenderer.send).toHaveBeenCalledWith('bmad:install:stop')
  })

  // agent-onboarding (AO-R2/AO-R3).
  it('hive.profile.agents(refresh) forwards the refresh flag, defaulting to a cached answer', () => {
    const hive = exposedGlobals().get('hive') as {
      profile: { agents: (refresh?: boolean) => Promise<unknown> }
    }
    void hive.profile.agents()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:agents', false)
    void hive.profile.agents(true)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:agents', true)
  })

  it('hive.profile.installAgent streams only its own agent’s events and cancels on unsubscribe', () => {
    const hive = exposedGlobals().get('hive') as {
      profile: { installAgent: (id: string, onEvent: (evt: unknown) => void) => () => void }
    }
    const onEvent = vi.fn()
    const unsubscribe = hive.profile.installAgent('claude-cli', onEvent)
    expect(ipcRenderer.send).toHaveBeenCalledWith('agents:install:start', 'claude-cli')

    const listener = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'agents:install:event')?.[1] as (
      event: unknown,
      id: string,
      evt: unknown
    ) => void

    const mine = { type: 'progress', message: 'added 214 packages' }
    listener({}, 'claude-cli', mine)
    expect(onEvent).toHaveBeenCalledWith(mine)
    // Two cards can install at once; neither may adopt the other's stream.
    listener({}, 'github-copilot', { type: 'done' })
    expect(onEvent).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('agents:install:event', listener)
    expect(ipcRenderer.send).toHaveBeenCalledWith('agents:install:stop', 'claude-cli')
  })

  it('hive.updateBmad(workspace, onEvent) registers a listener, sends bmad:update:start, and the returned unsubscribe removes the listener + sends bmad:update:stop', () => {
    const hive = exposedGlobals().get('hive') as {
      updateBmad: (workspace: string, onEvent: (evt: unknown) => void) => () => void
    }
    const onEvent = vi.fn()
    const unsubscribe = hive.updateBmad('/root', onEvent)
    expect(ipcRenderer.on).toHaveBeenCalledWith('bmad:update:event', expect.any(Function))
    expect(ipcRenderer.send).toHaveBeenCalledWith('bmad:update:start', '/root')

    const listener = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'bmad:update:event')?.[1] as (
      event: unknown,
      evt: unknown
    ) => void
    const evt = { type: 'progress' }
    listener({}, evt)
    expect(onEvent).toHaveBeenCalledWith(evt)

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('bmad:update:event', listener)
    expect(ipcRenderer.send).toHaveBeenCalledWith('bmad:update:stop')
  })

  // T17: WorkflowCatalog namespace, never covered by a test.
  // session-history: the chatHistory namespace, plain invoke/response.
  it('hive.chatHistory.* invoke their "chatHistory:<name>" channels with matching args', async () => {
    const chatHistory = (
      exposedGlobals().get('hive') as {
        chatHistory: {
          list: (ws: string) => Promise<unknown>
          get: (ws: string, id: string) => Promise<unknown>
          create: (ws: string, agent: string | null) => Promise<unknown>
          append: (ws: string, id: string, message: unknown) => Promise<unknown>
          rename: (ws: string, id: string, title: string) => Promise<unknown>
          setCliSession: (ws: string, id: string, cliSessionId: string) => Promise<void>
          search: (ws: string, query: string) => Promise<unknown>
          delete: (ws: string, id: string) => Promise<void>
        }
      }
    ).chatHistory

    await chatHistory.list('/ws')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:list', '/ws')
    await chatHistory.get('/ws', 'id-1')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:get', '/ws', 'id-1')
    await chatHistory.create('/ws', 'claude-cli')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:create', '/ws', 'claude-cli')
    const message = { role: 'user', text: 'oi' }
    await chatHistory.append('/ws', 'id-1', message)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:append', '/ws', 'id-1', message)
    await chatHistory.rename('/ws', 'id-1', 'Novo título')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'chatHistory:rename',
      '/ws',
      'id-1',
      'Novo título'
    )
    await chatHistory.setCliSession('/ws', 'id-1', 'cli-sess-1')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'chatHistory:setCliSession',
      '/ws',
      'id-1',
      'cli-sess-1'
    )
    await chatHistory.search('/ws', 'cascata')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:search', '/ws', 'cascata')
    await chatHistory.delete('/ws', 'id-1')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chatHistory:delete', '/ws', 'id-1')
  })

  it('hive.workflows.list(workspace) invokes "workflows:list" with workspace', async () => {
    const hive = exposedGlobals().get('hive') as {
      workflows: { list: (w: string) => Promise<unknown> }
    }
    await expect(hive.workflows.list('/root')).resolves.toBe('invoked:workflows:list')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('workflows:list', '/root')
  })

  // chat-controls (CC-R3): the skills discovery namespace.
  it('hive.skills.list(workspace) invokes "skills:list" with workspace', async () => {
    const hive = exposedGlobals().get('hive') as {
      skills: { list: (w: string) => Promise<unknown> }
    }
    await expect(hive.skills.list('/root')).resolves.toBe('invoked:skills:list')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('skills:list', '/root')
  })

  // skill-studio: the user-created-skills namespace.
  it('hive.studio.list(workspace) invokes "studio:list" with workspace', async () => {
    const hive = exposedGlobals().get('hive') as {
      studio: { list: (w: string) => Promise<unknown> }
    }
    await expect(hive.studio.list('/root')).resolves.toBe('invoked:studio:list')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('studio:list', '/root')
  })

  // design-studio T3.8: the Preview session lifecycle. The URL carries the
  // session nonce (D-DS-4), so it travels this way and no other.
  it('hive.designStudio.* invokes the Preview session channels', async () => {
    const hive = exposedGlobals().get('hive') as {
      designStudio: {
        openPreview: () => Promise<unknown>
        closePreview: (u: string) => Promise<unknown>
        screens: (w: string, p: string) => Promise<unknown>
      }
    }
    await expect(hive.designStudio.openPreview()).resolves.toBe('invoked:designStudio:openPreview')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:openPreview')

    await hive.designStudio.closePreview('hive-studio://preview/abc/index.html')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'designStudio:closePreview',
      'hive-studio://preview/abc/index.html'
    )

    await hive.designStudio.screens('/ws', 'docs/ux.md')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:screens', '/ws', 'docs/ux.md')
  })

  // design-studio T5.1: the document channels. The Tela's log lives in main
  // because `validate()` does; the tab dispatches Commands and gets views back.
  it('hive.designStudio.* invokes the document channels with the Tela’s key', async () => {
    const hive = exposedGlobals().get('hive') as {
      designStudio: {
        catalog: () => Promise<unknown>
        view: (k: string, s: string, t: string) => Promise<unknown>
        dispatch: (k: string, s: string, t: string, c: unknown[], g: string) => Promise<unknown>
        undo: (k: string, s: string, t: string) => Promise<unknown>
        redo: (k: string, s: string, t: string) => Promise<unknown>
      }
    }

    await hive.designStudio.catalog()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:catalog')

    await hive.designStudio.view('k', 'login', 'Login')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:view', 'k', 'login', 'Login')

    const commands = [{ type: 'RemoveComponent', componentId: 'n1' }]
    await hive.designStudio.dispatch('k', 'login', 'Login', commands, 'g1')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'designStudio:dispatch',
      'k',
      'login',
      'Login',
      commands,
      'g1'
    )

    await hive.designStudio.undo('k', 'login', 'Login')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:undo', 'k', 'login', 'Login')

    await hive.designStudio.redo('k', 'login', 'Login')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:redo', 'k', 'login', 'Login')
  })

  // T7.4 (DS-R15): one channel for one Tela and for many, so "the failure of
  // one does not stop the others" cannot be true on one path and false on
  // another.
  it('hive.designStudio.export invokes the export channel with every Tela asked for', async () => {
    const hive = exposedGlobals().get('hive') as {
      designStudio: {
        export: (requests: { key: string; screenId: string; title: string }[]) => Promise<unknown>
      }
    }
    const requests = [
      { key: 'k1', screenId: 'login', title: 'Login' },
      { key: 'k2', screenId: 'cadastro', title: 'Cadastro' }
    ]

    await expect(hive.designStudio.export(requests)).resolves.toBe('invoked:designStudio:export')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('designStudio:export', requests)
  })

  // agent-terminal: the terminal picker's bridge.
  it('hive.shell.* invokes the terminal channels, defaulting to the cached catalog', async () => {
    const hive = exposedGlobals().get('hive') as {
      shell: {
        list: (refresh?: boolean) => Promise<unknown>
        select: (id: string | null) => Promise<unknown>
      }
    }
    await expect(hive.shell.list()).resolves.toBe('invoked:shell:list')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:list', false)

    await hive.shell.list(true)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:list', true)

    await hive.shell.select('git-bash')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:select', 'git-bash')

    // `null` is the automatic setting and has to cross as `null`, not as an
    // omitted argument the handler would read as "no change".
    await hive.shell.select(null)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:select', null)
  })

  // Profile namespace (agent-selection + role-personalization).
  it('hive.profile.* invokes the matching profile IPC channels', async () => {
    const hive = exposedGlobals().get('hive') as {
      profile: {
        agents: () => Promise<unknown>
        getAgent: () => Promise<unknown>
        setAgent: (id: string) => Promise<unknown>
        getRole: () => Promise<unknown>
        setRole: (id: string) => Promise<unknown>
        roleActions: (role: string | null, scope?: 'start' | 'during') => Promise<unknown>
      }
    }
    await expect(hive.profile.agents()).resolves.toBe('invoked:profile:agents')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:agents', false)

    await expect(hive.profile.getAgent()).resolves.toBe('invoked:profile:getAgent')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:getAgent')

    await hive.profile.setAgent('claude-cli')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:setAgent', 'claude-cli')

    // P0-011: the *enabled set* pair, distinct from the default-agent pair
    // above and previously untested. Confusing the two is the difference
    // between changing which agent runs and changing which are offered.
    const profile = hive.profile as unknown as {
      getAgents: () => Promise<unknown>
      setAgents: (ids: string[]) => Promise<unknown>
    }
    await expect(profile.getAgents()).resolves.toBe('invoked:profile:getAgents')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:getAgents')

    await profile.setAgents(['claude-cli', 'copilot-cli'])
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:setAgents', [
      'claude-cli',
      'copilot-cli'
    ])

    await expect(hive.profile.getRole()).resolves.toBe('invoked:profile:getRole')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:getRole')

    await hive.profile.setRole('pm')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:setRole', 'pm')

    await hive.profile.roleActions('pm')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:roleActions', 'pm', undefined)

    // shortcut-scopes: the scope rides along as the second arg.
    await hive.profile.roleActions('pm', 'during')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:roleActions', 'pm', 'during')
  })

  // shortcut-customization: the shortcuts namespace.
  it('hive.shortcuts.* invokes the matching shortcuts IPC channels', async () => {
    const hive = exposedGlobals().get('hive') as {
      shortcuts: {
        catalog: (workspace: string) => Promise<unknown>
        get: () => Promise<unknown>
        set: (
          scope: 'start' | 'during',
          prefs: { skills: string[]; agents: string[] } | null
        ) => Promise<unknown>
        actions: (role: string | null, workspace: string) => Promise<unknown>
      }
    }
    await expect(hive.shortcuts.catalog('/root')).resolves.toBe('invoked:shortcuts:catalog')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shortcuts:catalog', '/root')

    await expect(hive.shortcuts.get()).resolves.toBe('invoked:shortcuts:get')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shortcuts:get')

    const prefs = { skills: ['bmad-prd'], agents: ['bmad-agent-pm'] }
    await hive.shortcuts.set('start', prefs)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shortcuts:set', 'start', prefs)
    await hive.shortcuts.set('during', null)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shortcuts:set', 'during', null)

    await hive.shortcuts.actions('pm', '/root')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shortcuts:actions', 'pm', '/root')
  })

  // Thin invoke wrappers not exercised elsewhere in this file — proven here
  // so every bridge function routes to its exact channel (coverage gate).
  it('remaining bridge wrappers invoke their exact channels', async () => {
    const hive = exposedGlobals().get('hive') as {
      openExternal: (url: string) => Promise<void>
      listFiles: (root: string) => Promise<unknown>
      agent: { chooseAttachments: (defaultPath?: string) => Promise<unknown> }
      profile: {
        getUserName: () => Promise<unknown>
        setUserName: (name: string | null) => Promise<void>
      }
      app: {
        info: () => Promise<unknown>
        checkForUpdates: (explicit?: boolean) => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
        cancelUpdate: () => Promise<void>
        revealInstaller: () => Promise<void>
        skipVersion: (version: string) => Promise<void>
        onUpdateEvent: (onEvent: (evt: unknown) => void) => () => void
      }
    }

    await hive.openExternal('https://example.com')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:openExternal', 'https://example.com')

    await expect(hive.listFiles('/root')).resolves.toBe('invoked:fs:listFiles')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:listFiles', '/root')

    await hive.agent.chooseAttachments('/root')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('chat:chooseAttachments', '/root')

    await expect(hive.profile.getUserName()).resolves.toBe('invoked:profile:getUserName')
    await hive.profile.setUserName('Gustavo')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('profile:setUserName', 'Gustavo')

    await expect(hive.app.info()).resolves.toBe('invoked:app:info')
    // Zero-arg (explicit-by-default at the IPC layer) and the T14-widened
    // explicit `false` (the silent launch/periodic check) both forward
    // faithfully — `explicit` is just passed straight through as the second
    // invoke argument, `undefined` when omitted.
    await hive.app.checkForUpdates()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:check', undefined)
    await hive.app.checkForUpdates(false)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:check', false)
    await hive.app.downloadUpdate()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:download')
    await hive.app.installUpdate()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:install')

    // npm-distribution: cancel/reveal/skip.
    await hive.app.cancelUpdate()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:cancel')
    await hive.app.revealInstaller()
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:reveal')
    await hive.app.skipVersion('0.2.0')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('update:skip', '0.2.0')

    // onUpdateEvent: subscribes on 'update:event' + signals start/stop.
    const onEvent = vi.fn()
    const unsubscribe = hive.app.onUpdateEvent(onEvent)
    expect(ipcRenderer.on).toHaveBeenCalledWith('update:event', expect.any(Function))
    expect(ipcRenderer.send).toHaveBeenCalledWith('update:event:start')
    const listener = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'update:event')?.[1] as (
      event: unknown,
      evt: unknown
    ) => void
    listener({}, { type: 'checking' })
    expect(onEvent).toHaveBeenCalledWith({ type: 'checking' })
    unsubscribe()
    expect(ipcRenderer.send).toHaveBeenCalledWith('update:event:stop')
  })

  // T7: file management, window.hive.fs.* + pathForFile.
  // (A local shape rather than `typeof window.hive.fs`: the latter depends on
  // the ambient `declare global` in index.d.ts resolving under this file's
  // DOM lib, which isn't guaranteed under tsconfig.node.json.)
  interface HiveFs {
    statFile: (root: string, rel: string) => Promise<unknown>
    readBinary: (root: string, rel: string) => Promise<unknown>
    readDocx: (root: string, rel: string) => Promise<unknown>
    readSheet: (root: string, rel: string) => Promise<unknown>
    readSlides: (root: string, rel: string) => Promise<unknown>
    createFile: (root: string, rel: string, opts?: { overwrite?: boolean }) => Promise<void>
    createDirectory: (root: string, rel: string) => Promise<void>
    saveFile: (
      root: string,
      rel: string,
      content: string,
      opts?: { expectedMtimeMs?: number }
    ) => Promise<unknown>
    move: (root: string, from: string, to: string, opts?: { overwrite?: boolean }) => Promise<void>
    importEntry: (
      root: string,
      src: string,
      dest: string,
      opts?: { overwrite?: boolean }
    ) => Promise<void>
    exists: (root: string, rel: string) => Promise<boolean>
    trash: (root: string, rel: string) => Promise<void>
    pathForFile: (file: File) => string
    revealPath: (root: string, rel: string, isDir: boolean) => Promise<unknown>
    absolutePath: (root: string, rel: string) => Promise<string>
  }

  describe('hive.fs.*', () => {
    function getFs(): HiveFs {
      return (exposedGlobals().get('hive') as { fs: HiveFs }).fs
    }

    it('exposes hive.fs with all expected methods', () => {
      expect(getFs()).toEqual(
        expect.objectContaining({
          statFile: expect.any(Function),
          readBinary: expect.any(Function),
          readDocx: expect.any(Function),
          readSheet: expect.any(Function),
          readSlides: expect.any(Function),
          createFile: expect.any(Function),
          createDirectory: expect.any(Function),
          saveFile: expect.any(Function),
          move: expect.any(Function),
          importEntry: expect.any(Function),
          exists: expect.any(Function),
          trash: expect.any(Function),
          pathForFile: expect.any(Function)
        })
      )
    })

    it('fs.statFile(root, rel) invokes "fs:statFile" with matching args', async () => {
      await getFs().statFile('/root', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:statFile', '/root', 'a.txt')
    })

    it.each([
      ['readBinary', 'fs:readBinary'],
      ['readDocx', 'fs:readDocx'],
      ['readSheet', 'fs:readSheet'],
      ['readSlides', 'fs:readSlides']
    ] as const)('fs.%s(root, rel) invokes "%s" with matching args', async (method, channel) => {
      await getFs()[method]('/root', 'a.docx')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(channel, '/root', 'a.docx')
    })

    it('fs.createFile(root, rel, opts) invokes "fs:createFile" with matching args', async () => {
      await getFs().createFile('/root', 'a.txt', { overwrite: true })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:createFile', '/root', 'a.txt', {
        overwrite: true
      })
    })

    it('fs.createDirectory(root, rel) invokes "fs:createDirectory" with matching args', async () => {
      await getFs().createDirectory('/root', 'dir')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:createDirectory', '/root', 'dir')
    })

    it('fs.saveFile(root, rel, content, opts) invokes "fs:saveFile" with matching args', async () => {
      await getFs().saveFile('/root', 'a.txt', 'hello', { expectedMtimeMs: 123 })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:saveFile', '/root', 'a.txt', 'hello', {
        expectedMtimeMs: 123
      })
    })

    it('fs.move(root, from, to, opts) invokes "fs:move" with matching args', async () => {
      await getFs().move('/root', 'a.txt', 'b.txt', { overwrite: false })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:move', '/root', 'a.txt', 'b.txt', {
        overwrite: false
      })
    })

    it('fs.importEntry(root, src, dest, opts) invokes "fs:importEntry" with matching args', async () => {
      await getFs().importEntry('/root', '/abs/src.txt', 'dest.txt', { overwrite: true })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'fs:importEntry',
        '/root',
        '/abs/src.txt',
        'dest.txt',
        { overwrite: true }
      )
    })

    it('fs.exists(root, rel) invokes "fs:exists" with matching args', async () => {
      await getFs().exists('/root', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:exists', '/root', 'a.txt')
    })

    it('fs.trash(root, rel) invokes "fs:trash" with matching args', async () => {
      await getFs().trash('/root', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:trash', '/root', 'a.txt')
    })

    // explorer-os-actions: `isDir` is a real argument, not a hint — main picks
    // reveal-the-item vs open-the-folder from it, so a bridge that dropped it
    // would silently open the parent of every folder.
    it('fs.revealPath(root, rel, isDir) invokes "shell:revealPath" with matching args', async () => {
      await getFs().revealPath('/root', 'docs', true)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:revealPath', '/root', 'docs', true)
    })

    it('fs.absolutePath(root, rel) invokes "fs:absolutePath" with matching args', async () => {
      await getFs().absolutePath('/root', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:absolutePath', '/root', 'a.txt')
    })

    it('fs.pathForFile delegates to webUtils.getPathForFile', () => {
      const file = { name: 'dropped.txt' } as File
      const path = getFs().pathForFile(file)
      expect(webUtils.getPathForFile).toHaveBeenCalledWith(file)
      expect(path).toBe('/abs/path/dropped.txt')
    })

    describe.each([
      ['createFile', ['/root', 'a.txt', undefined]],
      ['saveFile', ['/root', 'a.txt', 'hello', undefined]],
      ['move', ['/root', 'a.txt', 'b.txt', undefined]],
      ['importEntry', ['/root', '/abs/src.txt', 'dest.txt', undefined]]
    ] as const)('%s conflict-mapping', (method, args) => {
      it('maps a CONFLICT:-prefixed rejection to an FsConflictError', async () => {
        vi.mocked(ipcRenderer.invoke).mockRejectedValueOnce(
          new Error('CONFLICT: dest.txt already exists')
        )
        const fs = getFs()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = (fs[method] as any)(...args)
        await expect(call).rejects.toBeInstanceOf(FsConflictError)
        try {
          await call
        } catch (err) {
          expect((err as FsConflictErrorType).code).toBe('CONFLICT')
          expect((err as FsConflictErrorType).message).toBe('dest.txt already exists')
        }
      })

      it('maps a STALE:-prefixed rejection to an FsConflictError', async () => {
        vi.mocked(ipcRenderer.invoke).mockRejectedValueOnce(
          new Error('STALE: file changed on disk')
        )
        const fs = getFs()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = (fs[method] as any)(...args)
        await expect(call).rejects.toBeInstanceOf(FsConflictError)
        try {
          await call
        } catch (err) {
          expect((err as FsConflictErrorType).code).toBe('STALE')
          expect((err as FsConflictErrorType).message).toBe('file changed on disk')
        }
      })

      it('passes through a non-prefixed rejection unchanged', async () => {
        const original = new Error('boom')
        vi.mocked(ipcRenderer.invoke).mockRejectedValueOnce(original)
        const fs = getFs()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = (fs[method] as any)(...args)
        await expect(call).rejects.toBe(original)
      })
    })
  })

  describe('hive.git.* (git-management M10)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getGit(): Record<string, (...a: any[]) => Promise<any>> & {
      onChanged: (cb: (evt: { root: string }) => void) => () => void
    } {
      return (exposedGlobals().get('hive') as { git: unknown }).git as never
    }

    it('exposes the full git namespace', () => {
      const git = getGit()
      for (const method of [
        'detect',
        'status',
        'init',
        'stage',
        'unstage',
        'discard',
        'commit',
        'branches',
        'createBranch',
        'checkout',
        'renameBranch',
        'deleteBranch',
        'fetch',
        'pull',
        'push',
        'sync',
        'log',
        'diff',
        'commitDiff',
        'fileAtHead',
        'conflicts',
        'resolveConflict',
        'mergeContinue',
        'mergeAbort',
        'stash',
        'stashList',
        'stashApply',
        'stashDrop',
        'onChanged'
      ]) {
        expect(git[method]).toBeInstanceOf(Function)
      }
    })

    it.each([
      ['detect', ['/ws'], 'git:detect'],
      ['status', ['/ws'], 'git:status'],
      ['init', ['/ws'], 'git:init'],
      ['stage', ['/ws', ['a.txt']], 'git:stage'],
      ['unstage', ['/ws', ['a.txt']], 'git:unstage'],
      ['discard', ['/ws', ['a.txt']], 'git:discard'],
      ['commit', ['/ws', 'msg', { amend: true }], 'git:commit'],
      ['branches', ['/ws'], 'git:branches'],
      ['createBranch', ['/ws', 'feat', 'main'], 'git:createBranch'],
      ['checkout', ['/ws', 'main'], 'git:checkout'],
      ['renameBranch', ['/ws', 'a', 'b'], 'git:renameBranch'],
      ['deleteBranch', ['/ws', 'a', true], 'git:deleteBranch'],
      ['fetch', ['/ws'], 'git:fetch'],
      ['pull', ['/ws'], 'git:pull'],
      ['push', ['/ws', { setUpstream: true }], 'git:push'],
      ['sync', ['/ws'], 'git:sync'],
      ['log', ['/ws', { limit: 10 }], 'git:log'],
      ['diff', ['/ws', 'a.txt', 'working'], 'git:diff'],
      ['commitDiff', ['/ws', 'abc'], 'git:commitDiff'],
      ['fileAtHead', ['/ws', 'a.txt'], 'git:fileAtHead'],
      ['conflicts', ['/ws'], 'git:conflicts'],
      ['resolveConflict', ['/ws', 'a', 'both'], 'git:resolveConflict'],
      ['mergeContinue', ['/ws'], 'git:mergeContinue'],
      ['mergeAbort', ['/ws'], 'git:mergeAbort'],
      ['stash', ['/ws', { untracked: true }], 'git:stash'],
      ['stashList', ['/ws'], 'git:stashList'],
      ['stashApply', ['/ws', 2, true], 'git:stashApply'],
      ['stashDrop', ['/ws', 1], 'git:stashDrop']
    ] as const)('%s forwards to ipcRenderer.invoke(%s)', async (method, args, channel) => {
      const git = getGit()
      await git[method](...args)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(channel, ...args)
    })

    it('maps a GIT:-prefixed rejection to a GitBridgeError carrying stderr/code', async () => {
      vi.mocked(ipcRenderer.invoke).mockRejectedValueOnce(
        new Error(
          `GIT:${JSON.stringify({ code: 128, stderr: 'fatal: Authentication failed', command: 'git push' })}`
        )
      )
      const call = getGit().push('/ws')
      await expect(call).rejects.toBeInstanceOf(GitBridgeError)
      try {
        await call
      } catch (err) {
        expect((err as GitBridgeErrorType).code).toBe(128)
        expect((err as GitBridgeErrorType).stderr).toBe('fatal: Authentication failed')
        expect((err as GitBridgeErrorType).command).toBe('git push')
      }
    })

    it('passes a non-git rejection through unchanged', async () => {
      const original = new Error('boom')
      vi.mocked(ipcRenderer.invoke).mockRejectedValueOnce(original)
      await expect(getGit().status('/ws')).rejects.toBe(original)
    })

    it('onChanged registers a listener, sends git:changed:start, and unsubscribe tears down', () => {
      const git = getGit()
      const cb = vi.fn()
      const unsubscribe = git.onChanged(cb)
      expect(ipcRenderer.on).toHaveBeenCalledWith('git:changed', expect.any(Function))
      expect(ipcRenderer.send).toHaveBeenCalledWith('git:changed:start')

      const listener = vi
        .mocked(ipcRenderer.on)
        .mock.calls.find(([ch]) => ch === 'git:changed')?.[1] as (
        event: unknown,
        evt: { root: string }
      ) => void
      listener({}, { root: '/ws' })
      expect(cb).toHaveBeenCalledWith({ root: '/ws' })

      unsubscribe()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('git:changed', listener)
      expect(ipcRenderer.send).toHaveBeenCalledWith('git:changed:stop')
    })
  })

  // Agent Change Review (M11, T7): the review bridge — plain invoke/response
  // decisions + the review:changed snapshot stream.
  describe('hive.review bridge', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const review = (): any => (exposedGlobals().get('hive') as any).review

    it('routes get/accept/reject calls through the matching review:* channels', async () => {
      const r = review()
      await r.get('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:get', '/ws')
      await r.acceptFile('/ws', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:acceptFile', '/ws', 'a.txt')
      await r.rejectFile('/ws', 'a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:rejectFile', '/ws', 'a.txt')
      await r.acceptHunk('/ws', 'a.txt', '0:1:1')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:acceptHunk', '/ws', 'a.txt', '0:1:1')
      await r.rejectHunk('/ws', 'a.txt', '0:1:1')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:rejectHunk', '/ws', 'a.txt', '0:1:1')
      await r.acceptAll('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:acceptAll', '/ws')
      await r.rejectAll('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:rejectAll', '/ws')
      // Names a turn's conversation after the fact, so its change card lands in
      // the transcript that asked for it.
      await r.attachTurn('/ws', 't-1', 'conv-a')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('review:attachTurn', '/ws', 't-1', 'conv-a')
    })

    it('subscribes to review:changed, relays the snapshot, and unsubscribes', () => {
      const cb = vi.fn()
      const unsubscribe = review().onChanged(cb)
      expect(ipcRenderer.on).toHaveBeenCalledWith('review:changed', expect.any(Function))
      expect(ipcRenderer.send).toHaveBeenCalledWith('review:changed:start')

      const listener = vi
        .mocked(ipcRenderer.on)
        .mock.calls.find(([ch]) => ch === 'review:changed')?.[1] as (
        event: unknown,
        evt: unknown
      ) => void
      const payload = { workspace: '/ws', changes: [], turns: [] }
      listener({}, payload)
      expect(cb).toHaveBeenCalledWith(payload)

      unsubscribe()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('review:changed', listener)
      expect(ipcRenderer.send).toHaveBeenCalledWith('review:changed:stop')
    })
  })

  // P0-011 (R-03): the MCP module's bridge had no test at all — six methods
  // whose only job is to carry the right channel and the right argument order.
  // A transposed argument here is invisible until a user's `.mcp.json` is
  // written wrong.
  describe('hive.mcp bridge', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcp = (): any => (exposedGlobals().get('hive') as any).mcp

    it('routes every mcp:* method with its arguments in handler order', async () => {
      const config = { command: 'npx', args: ['-y', 'some-server'] }

      await mcp().list('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('mcp:list', '/ws')

      await mcp().add('/ws', 'srv', config)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('mcp:add', '/ws', 'srv', config)

      // update carries BOTH names — the original (to find the entry) and the
      // new one (to rename it). Swapping them silently renames the wrong server.
      await mcp().update('/ws', 'old-name', 'new-name', config)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'mcp:update',
        '/ws',
        'old-name',
        'new-name',
        config
      )

      await mcp().remove('/ws', 'srv')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('mcp:remove', '/ws', 'srv')

      await mcp().setEnabled('/ws', 'srv', false)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('mcp:setEnabled', '/ws', 'srv', false)

      await mcp().probe('/ws', 'srv')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('mcp:probe', '/ws', 'srv')
    })
  })

  // Second Brain (M12): streamed install/update + invoke isProvisioned/getVault/stageRaw.
  describe('hive.secondBrain bridge', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = (): any => (exposedGlobals().get('hive') as any).secondBrain

    it('routes isProvisioned/getVault/stageRaw through the matching secondBrain:* channels', async () => {
      await sb().isProvisioned('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('secondBrain:isProvisioned', '/ws')
      await sb().getVault('/ws')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('secondBrain:getVault', '/ws')
      await sb().stageRaw('/ws', 'hello')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('secondBrain:stageRaw', '/ws', 'hello')
    })

    // P0-011 (R-03): the health-cadence quartet (SB-R10) shipped with a bridge
    // but no bridge test. An unwired channel name here fails silently at
    // runtime — the renderer just never hears back.
    it('routes the health-cadence quartet through the matching secondBrain:* channels', async () => {
      for (const method of ['getHealth', 'noteIngest', 'noteLint', 'snoozeHealth'] as const) {
        await sb()[method]('/ws')
        expect(ipcRenderer.invoke).toHaveBeenCalledWith(`secondBrain:${method}`, '/ws')
      }
    })

    for (const kind of ['install', 'update'] as const) {
      it(`${kind} subscribes to secondBrain:${kind}:event, relays SkillEvents, and unsubscribes`, () => {
        const onEvent = vi.fn()
        const unsubscribe = sb()[kind]('/ws', onEvent)
        expect(ipcRenderer.on).toHaveBeenCalledWith(
          `secondBrain:${kind}:event`,
          expect.any(Function)
        )
        expect(ipcRenderer.send).toHaveBeenCalledWith(`secondBrain:${kind}:start`, '/ws')

        const listener = vi
          .mocked(ipcRenderer.on)
          .mock.calls.find(([ch]) => ch === `secondBrain:${kind}:event`)?.[1] as (
          event: unknown,
          evt: unknown
        ) => void
        const evt = { type: 'done', ok: true }
        listener({}, evt)
        expect(onEvent).toHaveBeenCalledWith(evt)

        unsubscribe()
        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          `secondBrain:${kind}:event`,
          listener
        )
        expect(ipcRenderer.send).toHaveBeenCalledWith(`secondBrain:${kind}:stop`)
      })
    }
  })

  // Whisper model store (M12): invoke-based catalog/status/delete + a streamed
  // download.
  describe('hive.whisper bridge', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whisper = (): any => (exposedGlobals().get('hive') as any).whisper

    it('routes listModels/modelStatus/deleteModel through the matching whisper:* channels', async () => {
      await whisper().listModels()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('whisper:listModels')
      await whisper().modelStatus('base')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('whisper:modelStatus', 'base')
      await whisper().deleteModel('base')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('whisper:deleteModel', 'base')
      await whisper().recommend()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('whisper:recommend')
    })

    it('downloadModel subscribes, relays progress, and unsubscribes', () => {
      const onEvent = vi.fn()
      const unsubscribe = whisper().downloadModel('base', 'fp32', onEvent)
      expect(ipcRenderer.on).toHaveBeenCalledWith('whisper:download:event', expect.any(Function))
      expect(ipcRenderer.send).toHaveBeenCalledWith('whisper:download:start', 'base', 'fp32')

      const listener = vi
        .mocked(ipcRenderer.on)
        .mock.calls.find(([ch]) => ch === 'whisper:download:event')?.[1] as (
        event: unknown,
        evt: unknown
      ) => void
      const evt = { type: 'progress', id: 'base', loaded: 10, total: 20, file: 'config.json' }
      listener({}, evt)
      expect(onEvent).toHaveBeenCalledWith(evt)

      unsubscribe()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('whisper:download:event', listener)
      expect(ipcRenderer.send).toHaveBeenCalledWith('whisper:download:stop')
    })
  })
})
