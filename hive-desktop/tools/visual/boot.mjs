// The visual pass's boot harness (docs/visual-validation.md), as a file the
// Playwright MCP `browser_run_code_unsafe` tool can run directly:
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//
// It injects the whole `window.hive` surface App/WorkUI touch at boot BEFORE
// the first page script (an init script, the only thing that beats the
// renderer's CSP), clears the first-run gates, and lands on the work UI.
//
// Fixtures the page exposes for driving state from later snippets:
//   window.__setVault(v)  — create/remove the Second Brain vault, then fire an
//                           fs change (proves the live re-probe, M12 bugfix)
//   window.__fsChange(p)  — one workspace filesystem event
//   window.__agentEvent(e)— one agent stream event
//   window.__setReview(s) — push a pending Agent Change Review set
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  await page.context().clearCookies()
  await page.addInitScript((theme) => {
    localStorage.setItem('hive.tourSeen', '1')
    localStorage.setItem('hive-desktop-theme', theme)

    const noop = () => {}
    const unsub = () => noop
    const ok = (v) => () => Promise.resolve(v)

    // A workspace BMAD catalog big enough for the shortcut picker to look real
    // (groups, counts, scrolling) — mirrors `main/workflowCatalog.ts`'s shape.
    const skill = (key, label, module = 'bmm') => ({
      key,
      label,
      description: '',
      module,
      kind: 'skill',
      persona: null
    })
    const agent = (key, persona) => ({
      key,
      label: persona,
      description: `talk to ${persona}`,
      module: 'bmm',
      kind: 'agent',
      persona
    })
    const SHORTCUT_CATALOG = [
      skill('bmad-prd', 'Create Edit and Review PRD'),
      skill('bmad-brainstorming', 'Brainstorming', 'core'),
      skill('bmad-domain-research', 'Domain Research'),
      skill('bmad-product-brief', 'Product Brief'),
      skill('bmad-create-epics-and-stories', 'Epics and Stories'),
      skill('bmad-create-story', 'Create Story'),
      skill('bmad-architecture', 'Architecture'),
      skill('bmad-ux', 'UX Spec'),
      skill('bmad-party-mode', 'Party Mode', 'core'),
      skill('bmad-code-review', 'Code Review'),
      skill('bmad-testarch-test-design', 'Test Design', 'tea'),
      skill('bmad-spec', 'Spec Kernel'),
      agent('bmad-agent-pm', 'John'),
      agent('bmad-agent-architect', 'Winston'),
      agent('bmad-agent-ux-designer', 'Sally'),
      agent('bmad-agent-dev', 'Amelia'),
      agent('bmad-tea', 'Murat'),
      {
        key: 'revisor-notas',
        label: 'Revisor de Notas',
        description: 'Revisa release notes.',
        module: 'custom',
        kind: 'skill',
        persona: null,
        custom: true
      }
    ]

    // Mutable fixture state the test drives from the console.
    const state = {
      vault: { path: null, name: null, rawPending: 0 },
      watchers: []
    }
    window.__hiveState = state
    window.__fsChange = (path) => {
      for (const cb of state.watchers) cb({ type: 'add', path: path || 'second-brain/wiki/index.md' })
    }
    window.__setVault = (v) => {
      state.vault = v
        ? { path: '/ws/second-brain', name: 'second-brain', rawPending: v.rawPending ?? 0 }
        : { path: null, name: null, rawPending: 0 }
      window.__fsChange()
    }

    const FRESH_HEALTH = {
      ingestsSinceLint: 0,
      ingestThreshold: 10,
      intervalDays: 30,
      lastLintAt: null,
      daysSinceLint: null,
      daysUntilInterval: null,
      reason: null,
      due: false,
      snoozedUntil: null
    }

    const agentListeners = []
    window.__agentEvent = (evt) => {
      for (const cb of agentListeners) cb(evt)
    }

    // Agent Change Review: a fixture the pass can push a pending set into, so
    // the in-chat change card can be looked at without a real turn on disk.
    const reviewListeners = []
    state.review = { changes: [], turns: [] }
    window.__setReview = (snapshot) => {
      state.review = snapshot
      for (const cb of reviewListeners) cb({ workspace: '/ws', ...snapshot })
    }

    // mcp-logs: the MCP console's fixture. Every sentence below is the CLI's
    // real wording (see src/main/mcpLogParse.ts) so the console renders the
    // same shapes it will in production — including the slow call the duration
    // bars exist to expose, a stderr line, and a failure with a stack.
    const mcpListeners = []
    let mcpSeq = 0
    const mcpEntry = (over) => {
      mcpSeq += 1
      return {
        id: `visual#${mcpSeq}`,
        server: 'playwright',
        at: Date.now() - (60 - mcpSeq) * 1000,
        level: 'info',
        kind: 'notice',
        text: '',
        detail: '',
        sessionId: 'sess-a',
        tool: null,
        durationMs: null,
        transport: null,
        serverVersion: null,
        raw: '{}',
        ...over
      }
    }
    state.mcpLogs = [
      mcpEntry({ kind: 'connecting', level: 'debug', text: 'Starting connection' }),
      mcpEntry({ kind: 'connected', transport: 'stdio', durationMs: 2302 }),
      mcpEntry({
        kind: 'capabilities',
        level: 'debug',
        serverVersion: 'Playwright v1.63.0'
      }),
      mcpEntry({ kind: 'tool-call', tool: 'browser_navigate' }),
      mcpEntry({ kind: 'tool-ok', tool: 'browser_navigate', durationMs: 1420 }),
      mcpEntry({ kind: 'tool-call', tool: 'browser_snapshot' }),
      mcpEntry({ kind: 'tool-ok', tool: 'browser_snapshot', durationMs: 260 }),
      mcpEntry({
        server: 'pencil',
        kind: 'connected',
        transport: 'stdio',
        durationMs: 180
      }),
      mcpEntry({ server: 'pencil', kind: 'tool-call', tool: 'get_app_state' }),
      mcpEntry({ server: 'pencil', kind: 'tool-ok', tool: 'get_app_state', durationMs: 48 }),
      mcpEntry({
        server: 'pencil',
        kind: 'stderr',
        text: '2026/08/06 21:15:27 [TransportClient] connected to /home/u/.pencil/socket',
        raw: '{"error":"Server stderr: …"}'
      }),
      mcpEntry({ kind: 'tool-call', tool: 'browser_take_screenshot' }),
      mcpEntry({ kind: 'tool-ok', tool: 'browser_take_screenshot', durationMs: 8600 }),
      mcpEntry({ sessionId: 'sess-b', kind: 'reconnect', level: 'debug' }),
      mcpEntry({ sessionId: 'sess-b', kind: 'tool-call', tool: 'browser_click' }),
      mcpEntry({
        sessionId: 'sess-b',
        kind: 'tool-failed',
        level: 'error',
        text: 'TimeoutError: locator.click: Timeout 5000ms exceeded.',
        detail:
          'Call log:\n  - waiting for getByRole(\'button\', { name: \'Salvar\' })\n  - locator resolved to hidden <button>…</button>',
        raw: '{"error":"### Error\\nTimeoutError: locator.click…"}'
      }),
      mcpEntry({
        sessionId: 'sess-b',
        kind: 'tool-running',
        level: 'warn',
        tool: 'browser_run_code_unsafe',
        durationMs: 30000
      })
    ]
    // Push one live event (or a whole batch) into the open console.
    window.__mcpLog = (over) => {
      const batch = Array.isArray(over) ? over.map(mcpEntry) : [mcpEntry({ at: Date.now(), ...over })]
      state.mcpLogs = [...state.mcpLogs, ...batch]
      for (const cb of mcpListeners) cb(batch)
    }

    const sessions = []
    window.hive = {
      ping: ok('pong'),
      chooseWorkspace: ok('/ws'),
      openExternal: ok(undefined),
      getWorkspace: ok('/ws'),
      isProvisioned: ok(true),
      provisionState: ok(true),
      getRecentWorkspaces: ok(['/ws']),
      openWorkspace: ok({ ok: true, path: '/ws' }),
      listTree: ok([
        { name: 'second-brain', path: 'second-brain', kind: 'directory' },
        { name: 'README.md', path: 'README.md', kind: 'file' }
      ]),
      listFiles: ok(['README.md']),
      readFile: ok('# README\n'),
      watchWorkspace: (root, onChange) => {
        state.watchers.push(onChange)
        return () => {
          const i = state.watchers.indexOf(onChange)
          if (i >= 0) state.watchers.splice(i, 1)
        }
      },
      agent: {
        // session-usage: the meter's denominator comes from the model list, so
        // the mock has to declare one or the context readout never appears.
        capabilities: ok({
          models: [
            { id: 'opus', label: 'Opus', contextWindow: 200000 },
            { id: 'sonnet', label: 'Sonnet', contextWindow: 200000 }
          ],
          efforts: [
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' }
          ],
          supportsAttachments: true,
          supportsResume: true
        }),
        chooseAttachments: ok([]),
        start: ok(undefined),
        send: ok(undefined),
        runWorkflow: ok(undefined),
        stop: ok(undefined),
        interrupt: ok(undefined),
        respondApproval: ok(undefined),
        onEvent: (cb) => {
          agentListeners.push(cb)
          return () => {}
        }
      },
      installBmad: (_ws, _o, onEvent) => {
        onEvent({ type: 'done', ok: true })
        return noop
      },
      updateBmad: (_ws, onEvent) => {
        onEvent({ type: 'done', ok: true })
        return noop
      },
      workflows: { list: ok([]) },
      skills: { list: ok([]) },
      studio: { list: ok([]) },
      mcp: {
        // `pencil` is deliberately NOT in the catalog: it logs here but isn't
        // in this workspace's .mcp.json, which is the case the console flags.
        list: ok([
          { name: 'playwright', transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'], enabled: true }
        ]),
        add: ok(undefined),
        update: ok(undefined),
        remove: ok(undefined),
        setEnabled: ok(undefined),
        probe: ok({ ok: true, tools: [], logs: [] })
      },
      mcpLogs: {
        sources: ok([
          { server: 'playwright', dir: '/cache/mcp-logs-playwright', files: 12, lastActivityAt: Date.now() },
          { server: 'pencil', dir: '/cache/mcp-logs-pencil', files: 4, lastActivityAt: Date.now() - 90000 }
        ]),
        read: () => Promise.resolve(state.mcpLogs),
        openDir: ok(undefined),
        watch: (_ws, onBatch) => {
          mcpListeners.push(onBatch)
          return () => {
            const i = mcpListeners.indexOf(onBatch)
            if (i >= 0) mcpListeners.splice(i, 1)
          }
        }
      },
      chatHistory: {
        list: () => Promise.resolve(sessions.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt }))),
        get: (_ws, id) => Promise.resolve(sessions.find((s) => s.id === id) || null),
        create: (_ws, agent) => {
          const s = {
            id: `s${sessions.length + 1}`,
            title: 'Conversa',
            agent,
            messages: [],
            updatedAt: Date.now(),
            cliSessionId: null
          }
          sessions.push(s)
          return Promise.resolve(s)
        },
        append: (_ws, id, message) => {
          const s = sessions.find((x) => x.id === id)
          if (s) {
            s.messages.push({ id: `m${s.messages.length}`, ...message })
            s.title = s.messages[0].text.slice(0, 40)
          }
          return Promise.resolve(s ? { id: s.id, title: s.title, updatedAt: Date.now() } : null)
        },
        rename: ok(null),
        setCliSession: ok(undefined),
        search: ok([]),
        delete: ok(undefined)
      },
      app: {
        info: ok({ version: '0.1.0', channel: 'stable' }),
        checkForUpdates: ok(undefined),
        downloadUpdate: ok(undefined),
        installUpdate: ok(undefined),
        cancelUpdate: ok(undefined),
        revealInstaller: ok(undefined),
        skipVersion: ok(undefined),
        onUpdateEvent: unsub
      },
      profile: {
        agents: ok([{ id: 'claude', label: 'Claude Code', available: true }]),
        getAgent: ok('claude'),
        setAgent: ok(undefined),
        getAgents: ok(['claude']),
        setAgents: ok(undefined),
        getRole: ok(globalThis.HIVE_ROLE ?? 'pm'),
        setRole: ok(undefined),
        getUserName: ok('Gustavo'),
        setUserName: ok(undefined),
        // shortcut-scopes: role *defaults* per scope, which is what the
        // customizer pre-checks when nothing is stored yet.
        roleActions: (role, scope) =>
          Promise.resolve(
            scope === 'during'
              ? [
                  {
                    key: 'party-mode',
                    kind: 'workflow',
                    command: { key: 'bmad-party-mode', prompt: '/bmad-party-mode' }
                  }
                ]
              : [
                  { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
                  {
                    key: 'brainstorm',
                    kind: 'workflow',
                    command: { key: 'bmad-brainstorming', prompt: '/bmad-brainstorming' }
                  },
                  {
                    key: 'persona-pm',
                    kind: 'persona',
                    command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
                  }
                ]
          ),
      },
      shortcuts: {
        catalog: ok(SHORTCUT_CATALOG),
        get: ok({ start: null, during: null }),
        set: ok(undefined),
        // Both scopes, the shape `WorkUI` now consumes: the hero's set and the
        // (deliberately short) in-conversation one.
        actions: ok({
          start: [
            { key: 'bmad-prd', kind: 'workflow', label: 'PRD', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
            { key: 'bmad-brainstorming', kind: 'workflow', label: 'Brainstorm', command: { key: 'bmad-brainstorming', prompt: '/bmad-brainstorming' } },
            { key: 'bmad-ux', kind: 'workflow', label: 'UX', command: { key: 'bmad-ux', prompt: '/bmad-ux' } },
            { key: 'bmad-agent-pm', kind: 'persona', label: 'John', command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' } }
          ],
          during: [
            { key: 'party-mode', kind: 'workflow', command: { key: 'bmad-party-mode', prompt: '/bmad-party-mode' } }
          ]
        })
      },
      fs: {
        statFile: ok({ mtimeMs: 1, size: 1 }),
        readBinary: ok({ data: '', mime: 'text/plain' }),
        readDocx: ok({ html: '' }),
        readSheet: ok({ sheets: [] }),
        readSlides: ok({ slides: [] }),
        createFile: ok(undefined),
        createDirectory: ok(undefined),
        saveFile: ok({ mtimeMs: 2, size: 2 }),
        move: ok(undefined),
        importEntry: ok(undefined),
        exists: ok(true),
        trash: ok(undefined),
        pathForFile: () => '/ws/file'
      },
      git: {
        detect: ok({ isRepo: false, gitMissing: false }),
        status: ok({ branch: 'main', changes: [], staged: [], ahead: 0, behind: 0 }),
        onChanged: unsub
      },
      review: {
        get: () => Promise.resolve(state.review),
        acceptFile: ok({ ok: true }),
        rejectFile: ok({ ok: true }),
        acceptFiles: ok({ ok: true }),
        rejectFiles: ok({ ok: true }),
        acceptHunk: ok({ ok: true }),
        rejectHunk: ok({ ok: true }),
        acceptAll: ok({ ok: true }),
        rejectAll: ok({ ok: true }),
        onChanged: (cb) => {
          reviewListeners.push(cb)
          return noop
        }
      },
      secondBrain: {
        install: (_ws, onEvent) => {
          onEvent({ type: 'done', ok: true })
          return noop
        },
        update: (_ws, onEvent) => {
          onEvent({ type: 'done', ok: true })
          return noop
        },
        isProvisioned: ok(true),
        getVault: () => Promise.resolve(state.vault),
        stageRaw: ok({ relPath: 'second-brain/raw/ingest.md' }),
        getHealth: ok(FRESH_HEALTH),
        noteIngest: ok(FRESH_HEALTH),
        noteLint: ok(FRESH_HEALTH),
        snoozeHealth: ok(FRESH_HEALTH)
      },
      whisper: {
        listModels: ok([{ id: 'base', params: '74M', downloaded: false }]),
        modelStatus: ok({ downloaded: false, variant: null }),
        downloadModel: () => noop,
        deleteModel: ok(undefined),
        recommend: ok({ id: 'base', reason: 'balanced' })
      }
    }
  }, theme)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(1200)
  return await page.evaluate(() => document.body.innerText.slice(0, 400))
}
