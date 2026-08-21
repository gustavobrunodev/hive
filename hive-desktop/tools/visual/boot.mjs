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
//   window.__studioSkill(e)— one Design Studio Skill event, after a turn starts
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

    // design-studio (M18): one Tela with a small tree, and a catalog with one
    // prop of every `kind` — the Inspetor derives its controls from the kind,
    // so a catalog with only enums would never show a Switch or an Input.
    const STUDIO_DOC = {
      screenId: 'login',
      title: 'Login',
      root: {
        id: 'n1',
        tag: 'wa-card',
        props: { appearance: 'outlined' },
        children: [
          { id: 'n2', tag: 'wa-input', props: { label: 'E-mail' }, children: [] },
          { id: 'n3', tag: 'wa-button', props: { variant: 'brand' }, children: [] }
        ]
      }
    }
    const STUDIO_CATALOG = {
      dsId: 'web-awesome',
      version: '3.11.0',
      components: [
        {
          tag: 'wa-card',
          slots: [''],
          props: [
            {
              name: 'appearance',
              kind: 'enum',
              values: ['accent', 'filled', 'outlined', 'plain'],
              group: 'appearance'
            }
          ]
        },
        {
          tag: 'wa-button',
          slots: ['', 'start', 'end'],
          props: [
            {
              name: 'variant',
              kind: 'enum',
              values: ['neutral', 'brand', 'success', 'warning', 'danger'],
              group: 'appearance'
            },
            { name: 'pill', kind: 'boolean', group: 'appearance' },
            { name: 'disabled', kind: 'boolean', group: 'state' },
            { name: 'name', kind: 'string', group: 'advanced' }
          ]
        },
        {
          tag: 'wa-input',
          slots: ['', 'label', 'hint'],
          props: [
            { name: 'label', kind: 'string', group: 'content' },
            { name: 'disabled', kind: 'boolean', group: 'state' }
          ]
        }
      ]
    }

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
    // mcp-visibility: the empty console. `window.__mcpSilence(loc)` drops every
    // log entry and points the console at a directory that isn't there — the
    // state a user hits on a fresh workspace, and the one that used to be
    // indistinguishable from "this app has no idea MCP exists".
    const MISSING_CACHE =
      'C:\\Users\\gusta\\AppData\\Local\\claude-cli-nodejs\\Cache\\C--Users-gusta-Desktop-teste-hive'
    state.mcpLocation = { dir: '/home/u/.cache/claude-cli-nodejs/-home-u-ws', exists: true }
    // Driven by `?mcpsilent=1` rather than by a console call, because
    // `useMcpLogs` reads history once per workspace: mutating the fixture after
    // the store has loaded changes nothing on screen (and a probe that mutates
    // and then measures reports a state it never rendered). A query param
    // forces a real navigation, which re-runs this init script — same reason
    // the agent-picker probe uses one (docs/visual-validation.md, M17).
    if (location.search.includes('mcpsilent=1')) {
      state.mcpLogs = []
      state.mcpLocation = { dir: MISSING_CACHE, exists: false }
    }
    window.__mcpSilence = (dir) => {
      state.mcpLogs = []
      state.mcpLocation = { dir: dir ?? MISSING_CACHE, exists: false }
    }

    // Push one live event (or a whole batch) into the open console.
    window.__mcpLog = (over) => {
      const batch = Array.isArray(over) ? over.map(mcpEntry) : [mcpEntry({ at: Date.now(), ...over })]
      state.mcpLogs = [...state.mcpLogs, ...batch]
      for (const cb of mcpListeners) cb(batch)
    }

    // agent-terminal: the terminal catalog, shaped like a Windows machine on
    // purpose — cmd is the platform default there, and the Claude caveat under
    // it (the CLI has no cmd executor) is the one state of this surface a
    // screenshot has to prove reads well. `state.shellSelected` makes the
    // picker really change when clicked.
    state.shellView = globalThis.HIVE_SHELLS ?? {
      shells: [
        {
          id: 'cmd',
          path: 'C:\\WINDOWS\\system32\\cmd.exe',
          family: 'cmd',
          automatic: false,
          preview:
            'C:\\WINDOWS\\system32\\cmd.exe /d /s /c ""C:\\Users\\gusta\\AppData\\Roaming\\npm\\claude.cmd" "-p" "…""',
          agents: [
            {
              agentId: 'claude-cli',
              displayName: 'Claude CLI',
              support: 'fallback',
              note: 'cmd-no-executor',
              runsIn: 'git-bash'
            },
            {
              agentId: 'github-copilot',
              displayName: 'GitHub Copilot CLI',
              support: 'launch-only',
              note: 'no-cli-binding',
              runsIn: null
            }
          ]
        },
        {
          id: 'powershell',
          path: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          family: 'powershell',
          automatic: false,
          preview:
            "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoLogo -NoProfile -NonInteractive -Command [Console]::OutputEncoding=[Text.Encoding]::UTF8; & 'claude' '-p' '…'; exit $LASTEXITCODE",
          agents: [
            {
              agentId: 'claude-cli',
              displayName: 'Claude CLI',
              support: 'native',
              note: 'powershell-preview',
              runsIn: 'powershell'
            },
            {
              agentId: 'github-copilot',
              displayName: 'GitHub Copilot CLI',
              support: 'launch-only',
              note: 'no-cli-binding',
              runsIn: null
            }
          ]
        },
        {
          id: 'git-bash',
          path: 'C:\\Program Files\\Git\\bin\\bash.exe',
          family: 'bash',
          automatic: true,
          preview:
            "C:\\Program Files\\Git\\bin\\bash.exe -c exec 'C:\\Users\\gusta\\AppData\\Roaming\\npm\\claude.cmd' '-p' '…'",
          agents: [
            {
              agentId: 'claude-cli',
              displayName: 'Claude CLI',
              support: 'native',
              note: 'windows-git-bash',
              runsIn: 'git-bash'
            },
            {
              agentId: 'github-copilot',
              displayName: 'GitHub Copilot CLI',
              support: 'launch-only',
              note: 'no-cli-binding',
              runsIn: null
            }
          ]
        }
      ],
      selectedId: null,
      resolvedId: 'git-bash',
      missingSelection: false,
      platform: 'win32'
    }
    state.shellSelected = state.shellView.selectedId ?? null

    const HARDWARE = globalThis.HIVE_HARDWARE ?? {
      recommendedId: 'small',
      reason: 'discreteGpu',
      gpu: true,
      ramGB: 32,
      cores: 12
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
      // The field is `type`, not `kind` (Explorer's `FsTreeNode`): a fixture
      // written with `kind` makes every row a *leaf* — no folders, no nesting,
      // no multi-select range worth the name — and the pass reads that as the
      // component's behavior. Nested and deep enough to exercise the tree's
      // real surfaces: expand/collapse, Ctrl/Shift multi-select over the
      // visible-flat order, and the row/empty-area context menus.
      listTree: ok([
        {
          name: '_bmad',
          path: '_bmad',
          type: 'directory',
          children: [
            {
              name: '_config',
              path: '_bmad/_config',
              type: 'directory',
              children: [
                { name: 'manifest.yaml', path: '_bmad/_config/manifest.yaml', type: 'file' }
              ]
            }
          ]
        },
        {
          name: 'docs',
          path: 'docs',
          type: 'directory',
          children: [
            { name: 'prd.md', path: 'docs/prd.md', type: 'file' },
            { name: 'architecture.md', path: 'docs/architecture.md', type: 'file' },
            { name: 'ux-spec.md', path: 'docs/ux-spec.md', type: 'file' },
            { name: 'epics.md', path: 'docs/epics.md', type: 'file' }
          ]
        },
        { name: 'second-brain', path: 'second-brain', type: 'directory', children: [] },
        {
          name: 'src',
          path: 'src',
          type: 'directory',
          children: [
            { name: 'index.ts', path: 'src/index.ts', type: 'file' },
            { name: 'app.tsx', path: 'src/app.tsx', type: 'file' }
          ]
        },
        { name: 'README.md', path: 'README.md', type: 'file' },
        { name: 'package.json', path: 'package.json', type: 'file' },
        // Config kinds get their own glyph (`ui/fileIcons.tsx`) — the fixture
        // carries one of each family so a visual pass can actually see it.
        { name: 'electron-builder.yml', path: 'electron-builder.yml', type: 'file' },
        { name: 'docker-compose.yaml', path: 'docker-compose.yaml', type: 'file' },
        { name: '.env', path: '.env', type: 'file' },
        { name: 'deploy.sh', path: 'deploy.sh', type: 'file' },
        { name: 'logo.svg', path: 'logo.svg', type: 'file' },
        { name: 'notas.txt', path: 'notas.txt', type: 'file' }
      ]),
      listFiles: ok(['README.md', 'docs/ux-spec.md']),
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
        // agent-approvals (session grant): `Chat` reads this at mount, so a
        // mock without it throws before the pane renders at all. `?allowall=1`
        // boots with the grant already armed — the state the footer chip and
        // the composer strip exist for.
        approvalSession: ok(location.search.includes('allowall=1')),
        setApprovalSession: ok(undefined),
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
      // design-studio (M18): enough of the Studio's bridge for the Bancada to
      // render for real — two Telas so both "has Components" and "still empty"
      // are reachable without a reload, and a catalog with one prop of every
      // `kind` so the Inspetor shows a Select, a Switch and an Input.
      // `window.__studioSkill(evt)` drives a Skill turn from the console.
      designStudio: {
        openPreview: ok('hive-studio://preview/' + '0'.repeat(64) + '/index.html'),
        closePreview: ok(undefined),
        screens: ok({
          screens: [
            { screenId: 'login', title: 'Login', probe: 'screenHeading' },
            { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' }
          ],
          probed: ['screenHeading', 'iaTable']
        }),
        catalog: ok(STUDIO_CATALOG),
        view: (_key, screenId, title) =>
          Promise.resolve({
            document: screenId === 'login' ? STUDIO_DOC : { screenId, title, root: null },
            canUndo: screenId === 'login',
            canRedo: false
          }),
        dispatch: (_key, screenId, title) =>
          Promise.resolve({
            document: screenId === 'login' ? STUDIO_DOC : { screenId, title, root: null },
            canUndo: true,
            canRedo: false
          }),
        undo: ok({ document: STUDIO_DOC, canUndo: false, canRedo: true }),
        redo: ok({ document: STUDIO_DOC, canUndo: true, canRedo: false }),
        // One Tela lands, one fails — the partly-good batch DS-R15 allows, and
        // the only state in which the report has anything to say.
        export: ok({
          canceled: false,
          outDir: '/ws/bundles',
          outcomes: [
            { screenId: 'login', title: 'Login', ok: true, file: '/ws/bundles/login.html' },
            {
              screenId: 'cadastro',
              title: 'Cadastro',
              ok: false,
              error: {
                kind: 'operation',
                scope: 'export',
                message: 'O Componente "wa-combobox" não existe no design system ativo.',
                retryable: true
              }
            }
          ]
        }),
        runSkill: (_request, onEvent) => {
          window.__studioSkill = onEvent
          onEvent({ type: 'status', phase: 'reading' })
          return noop
        }
      },
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
        // mcp-visibility: where the console read from. `exists: false` is the
        // interesting case — it is what the empty state has to explain.
        locate: () => Promise.resolve(state.mcpLocation),
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
        // The full `ChatSessionMeta` the history rows render — a list that
        // omits `messageCount`/`preview` prints "undefined mensagens" and the
        // pass reads a fixture gap as a defect.
        list: () =>
          Promise.resolve(
            sessions.map((s) => ({
              id: s.id,
              title: s.title,
              updatedAt: s.updatedAt,
              createdAt: s.updatedAt,
              messageCount: s.messages.length,
              agent: s.agent ?? null,
              preview: s.messages[s.messages.length - 1]?.text ?? ''
            }))
          ),
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
      // agent-terminal: the terminal picker's bridge (catalog in `state`).
      shell: {
        // Stateful on purpose: with a no-op `select`, every pass would look at
        // a picker that never changes its selection — and would read the
        // fixture's inertia as the component's.
        list: () => Promise.resolve({ ...state.shellView, selectedId: state.shellSelected }),
        select: (id) => {
          state.shellSelected = id
          return Promise.resolve(undefined)
        }
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
        copyEntry: ok(undefined),
        importEntry: ok(undefined),
        exists: ok(true),
        trash: ok(undefined),
        pathForFile: () => '/ws/file',
        // explorer-os-actions. Recorded rather than no-op'd: a probe that
        // clicks "Abrir no gerenciador de arquivos" against a silent stub
        // cannot tell a wired menu item from a dead one.
        revealPath: (_ws, rel, isDir) => {
          state.revealed = { rel, isDir }
          return Promise.resolve(undefined)
        },
        absolutePath: (_ws, rel) => Promise.resolve(rel ? `/ws/${rel}` : '/ws')
      },
      // file-clipboard: recorded, not no-op'd — a pass that clicks "Copiar"
      // against a silent stub cannot tell a wired action from a dead one.
      clipboard: {
        writeText: (text) => {
          state.clipboardText = text
          return Promise.resolve(undefined)
        }
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
        // The chat names a brand-new conversation on the turn it already sent;
        // the fixture records it so a pass can see which conversation a card
        // belongs to.
        attachTurn: (_ws, turnId, conversationId) => {
          const mark = state.review.turns.find((t) => t.turnId === turnId)
          if (mark && mark.conversationId === undefined) mark.conversationId = conversationId
          return Promise.resolve(undefined)
        },
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
      // D-SB-8: tiny/base/small ship inside the app, so the honest default
      // for a visual pass is "already here", not "nothing downloaded".
      whisper: {
        listModels: ok([
          { id: 'tiny', repo: 'Xenova/whisper-tiny', params: '39 M', sizeMB: { fp32: 144, q8: 39 }, approxVramGB: 1, relativeSpeed: '~10x', multilingual: true, downloaded: true, downloadedVariant: 'fp32', bundled: true },
          { id: 'base', repo: 'Xenova/whisper-base', params: '74 M', sizeMB: { fp32: 278, q8: 73 }, approxVramGB: 1, relativeSpeed: '~7x', multilingual: true, downloaded: true, downloadedVariant: 'fp32', bundled: true },
          { id: 'small', repo: 'Xenova/whisper-small', params: '244 M', sizeMB: { fp32: 923, q8: 238 }, approxVramGB: 2, relativeSpeed: '~4x', multilingual: true, downloaded: true, downloadedVariant: 'fp32', bundled: true },
          { id: 'medium', repo: 'Xenova/whisper-medium', params: '769 M', sizeMB: { fp32: 2916, q8: 740 }, approxVramGB: 5, relativeSpeed: '~2x', multilingual: true, downloaded: false, downloadedVariant: null, bundled: false },
          // An English-only row so the `só inglês` tag is on screen for the
          // contrast pass: a selector that never renders reports `missing`,
          // which is noise rather than a finding (M19).
          { id: 'medium.en', repo: 'Xenova/whisper-medium.en', params: '769 M', sizeMB: { fp32: 2916, q8: 740 }, approxVramGB: 5, relativeSpeed: '~2x', multilingual: false, downloaded: false, downloadedVariant: null, bundled: false },
          { id: 'large-v3-turbo', repo: 'onnx-community/whisper-large-v3-turbo', params: '809 M', sizeMB: { fp32: 3086, q8: 1035 }, approxVramGB: 6, relativeSpeed: '~8x', multilingual: true, downloaded: false, downloadedVariant: null, bundled: false }
        ]),
        modelStatus: ok({ downloaded: true, variant: 'fp32', bundled: true }),
        downloadModel: () => noop,
        deleteModel: ok(undefined),
        recommend: ok(HARDWARE),
        preference: ok({ id: 'small', auto: true, recommendation: HARDWARE }),
        setPreferredModel: (id) =>
          Promise.resolve(
            id === null
              ? { id: 'small', auto: true, recommendation: HARDWARE }
              : { id, auto: false, recommendation: HARDWARE }
          )
      }
    }
  }, theme)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(1200)
  return await page.evaluate(() => document.body.innerText.slice(0, 400))
}
