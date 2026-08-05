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
        capabilities: ok({ models: [], efforts: [], supportsResume: true }),
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
        list: ok([]),
        add: ok(undefined),
        update: ok(undefined),
        remove: ok(undefined),
        setEnabled: ok(undefined),
        probe: ok({ ok: true, tools: [], logs: [] })
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
        getRole: ok('dev'),
        setRole: ok(undefined),
        getUserName: ok('Gustavo'),
        setUserName: ok(undefined),
        roleActions: ok([])
      },
      shortcuts: {
        catalog: ok([]),
        get: ok(null),
        set: ok(undefined),
        actions: ok([
          { key: 'bmad-prd', kind: 'workflow', label: 'PRD', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
          { key: 'bmad-ux', kind: 'workflow', label: 'UX', command: { key: 'bmad-ux', prompt: '/bmad-ux' } }
        ])
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
