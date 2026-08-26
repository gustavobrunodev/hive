// Records a ~60s screen-capture demo of Hive Desktop's renderer, driven the
// same way as the visual pass (docs/visual-validation.md): renderer served
// statically at :8123, `window.hive` mocked via an init script so the app
// boots straight into the work UI without a real Electron/main process.
//
// Unlike the visual pass's boot.mjs, this opens its OWN browser context
// (recordVideo can only be set at newContext() time, and the MCP's shared
// `page` was created before this script runs) and drives a short tour:
// chat turn -> Second Brain -> Source Control -> Studio -> theme switch ->
// profile. Closing the context flushes the .webm to disk.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/record-demo.mjs
async (page) => {
  const VIDEO_DIR = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/video'
  const browser = page.context().browser()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
  })

  await context.addInitScript(() => {
    localStorage.setItem('hive.tourSeen', '1')
    localStorage.setItem('hive-desktop-theme', 'dark')

    const noop = () => {}
    const unsub = () => noop
    const ok = (v) => () => Promise.resolve(v)

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

    // Scripted assistant reply: `agent.send` below captures the turnId the
    // composer generated and plays back a token stream + a tool step + done,
    // so the recording shows a live-looking response instead of a stuck
    // "thinking" state (the boot mock's `agent.send` is a bare no-op).
    const REPLY =
      'Aqui está uma visão geral do workspace: a Second Brain já está indexada, ' +
      'o Studio tem duas skills prontas e não há alterações pendentes no Git.'
    function playReply(turnId) {
      const words = REPLY.split(' ')
      let i = 0
      const tick = () => {
        if (i < words.length) {
          window.__agentEvent({ type: 'token', turnId, text: (i === 0 ? '' : ' ') + words[i] })
          i += 1
          setTimeout(tick, 45)
        } else {
          setTimeout(() => window.__agentEvent({ type: 'done', turnId }), 300)
        }
      }
      setTimeout(tick, 500)
    }

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
        send: (_value, opts) => {
          playReply(opts.turnId)
          return Promise.resolve(undefined)
        },
        runWorkflow: (_cmd, opts) => {
          playReply(opts.turnId)
          return Promise.resolve(undefined)
        },
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
      studio: {
        list: ok([
          { id: 'sk1', name: 'Resumo de reunião', kind: 'skill' },
          { id: 'sk2', name: 'Revisor de PR', kind: 'skill' }
        ])
      },
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
        detect: ok({ isRepo: true, gitMissing: false }),
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
        downloads: () => Promise.resolve([]),
        startDownload: () => Promise.resolve(undefined),
        cancelDownload: () => Promise.resolve(undefined),
        dismissDownload: () => Promise.resolve(undefined),
        onDownloads: () => noop,
        onDownloadSettled: () => noop,
        deleteModel: ok(undefined),
        recommend: ok({
          recommendedId: 'base',
          reason: 'unknown',
          gpu: false,
          ramGB: 0,
          cores: 0
        }),
        // M26: `id: null` is the fresh-install answer, and every surface that
        // listens has to render it — a demo that hands back a model nobody
        // downloaded shows a flow that no new user can reach.
        preference: ok({
          id: null,
          auto: true,
          installed: [],
          recommendation: { recommendedId: 'base', reason: 'unknown', gpu: false, ramGB: 0, cores: 0 }
        }),
        setPreferredModel: ok({
          id: null,
          auto: true,
          installed: [],
          recommendation: { recommendedId: 'base', reason: 'unknown', gpu: false, ramGB: 0, cores: 0 }
        })
      }
    }
  })

  const p = await context.newPage()
  const wait = (ms) => p.waitForTimeout(ms)

  const clickSelector = async (sel) => {
    await p.evaluate((s) => {
      const el = document.querySelector(s)
      if (el) el.click()
    }, sel)
  }
  const clickText = async (text) => {
    await p.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, [role="menuitemradio"], [role="button"]')]
      const el = els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t))
      if (el) el.click()
    }, text)
  }

  await p.goto('http://localhost:8123/index.html')
  await wait(5000) // settle on the work UI, dark theme, hero visible

  // 1) A chat turn — type into the composer, submit, watch the scripted reply stream in.
  await clickSelector('[data-tour="composer"] textarea')
  await p.keyboard.type('Me dê um resumo do workspace', { delay: 35 })
  await wait(600)
  await p.keyboard.press('Enter')
  await wait(8000) // token stream + done + a beat to read it

  // 2) Second Brain — populate the vault fixture, open the rail view, ask a question.
  await p.evaluate(() => window.__setVault({ rawPending: 2 }))
  await clickSelector('[data-tour="brain"]')
  await wait(4000)
  await clickSelector('[data-tour="brain-ask"]')
  await wait(1500)
  await p.keyboard.type('Onde ficam as notas de arquitetura?', { delay: 30 })
  await wait(3000)
  await p.keyboard.press('Escape')
  await wait(1000)

  // 3) Source Control — brief look at the panel.
  await clickSelector('[data-tour="scm"]')
  await wait(4500)

  // 4) Studio — skills gallery.
  await clickSelector('[data-tour="studio"]')
  await wait(4500)
  await p.keyboard.press('Escape')
  await wait(800)

  // 5) Theme picker — cycle through the three themes.
  await clickSelector('header.wb-topbar button.wb-icon-btn')
  await wait(800)
  await clickText('Claro')
  await wait(2800)
  await clickSelector('header.wb-topbar button.wb-icon-btn')
  await wait(800)
  await clickText('Hive')
  await wait(2800)
  await clickSelector('header.wb-topbar button.wb-icon-btn')
  await wait(800)
  await clickText('Escuro')
  await wait(2800)

  // 6) Profile sheet.
  await clickSelector('[data-tour="profile"]')
  await wait(4500)
  await p.keyboard.press('Escape')
  await wait(1000)

  const videoPath = await p.video().path().catch(() => null)
  await context.close() // flushes the .webm to VIDEO_DIR
  return { videoDir: VIDEO_DIR, videoPathHint: videoPath }
}
