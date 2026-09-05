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
    // The sidebar remembers which view it was left on, in the *browser
    // profile* the MCP reuses across sessions — so a pass that opens the
    // explorer would fail on a machine whose last run ended in Source
    // Control, for reasons entirely outside the scene it is measuring.
    // Pinned here so every pass starts from the same sidebar.
    localStorage.setItem('hive.sidebarView', globalThis.HIVE_SIDEBAR ?? 'explorer')
    localStorage.setItem('hive-desktop-theme', theme)

    const noop = () => {}
    const unsub = () => noop
    /**
     * model-picker: the three agents' capability answers, in the shape the main
     * process now detects (see `src/main/claudeModelCatalog.ts`). Kept here so a
     * visual pass can see the picker's real anatomy — groups, descriptions,
     * resolved ids, provenance — without a machine that has all three CLIs.
     */
    const CAPABILITIES = {
      'claude-cli': {
        // context-compaction: what this agent's adapter measured (see its
        // catalog module). Claude takes `/compact` but does not self-compact in
        // print mode; Devin does both; Copilot is unmeasured.
        compaction: { command: true, automatic: false },
        models: [
          {
            id: '',
            label: 'Automático',
            descriptionKey: 'cliDefault',
            traits: ['cli-default'],
            group: 'default',
            source: 'configured',
            resolvedId: 'opus',
            contextWindow: 200000
          },
          {
            id: 'opus',
            label: 'Opus',
            descriptionKey: 'claude.opus',
            contextWindow: 200000,
            traits: ['flagship', 'thinking'],
            group: 'recommended',
            source: 'catalog'
          },
          {
            id: 'sonnet',
            label: 'Sonnet',
            descriptionKey: 'claude.sonnet',
            contextWindow: 200000,
            traits: ['balanced', 'thinking'],
            group: 'recommended',
            source: 'catalog'
          },
          {
            id: 'haiku',
            label: 'Haiku',
            descriptionKey: 'claude.haiku',
            contextWindow: 200000,
            traits: ['fast'],
            group: 'recommended',
            source: 'catalog'
          },
          {
            id: 'claude-fable-5[1m]',
            label: 'Fable',
            description: 'Fable 5 · Most capable for your hardest and longest-running tasks',
            contextWindow: 1000000,
            traits: ['flagship', 'long-context'],
            group: 'recommended',
            source: 'detected',
            resolvedId: 'claude-fable-5[1m]'
          },
          {
            id: 'sonnet[1m]',
            label: 'Sonnet 1M',
            descriptionKey: 'claude.sonnet1m',
            contextWindow: 1000000,
            traits: ['balanced', 'long-context'],
            group: 'more',
            source: 'catalog'
          },
          {
            id: 'opusplan',
            label: 'Opus Plan',
            descriptionKey: 'claude.opusplan',
            contextWindow: 200000,
            traits: ['flagship'],
            group: 'more',
            source: 'catalog'
          },
          {
            id: 'opus48',
            label: 'Opus 4.8',
            descriptionKey: 'claude.pinned',
            contextWindow: 200000,
            traits: ['legacy'],
            group: 'legacy',
            source: 'catalog'
          },
          {
            id: 'haiku35',
            label: 'Haiku 3.5',
            descriptionKey: 'claude.pinned',
            contextWindow: 200000,
            traits: ['legacy'],
            group: 'legacy',
            source: 'catalog'
          }
        ],
        efforts: [
          { id: '', label: 'Automático', descriptionKey: 'effort.cliDefault', group: 'default' },
          { id: 'low', label: 'Baixo', descriptionKey: 'effort.low' },
          { id: 'medium', label: 'Médio', descriptionKey: 'effort.medium' },
          { id: 'high', label: 'Alto', descriptionKey: 'effort.high' },
          { id: 'xhigh', label: 'Extra', descriptionKey: 'effort.xhigh' },
          { id: 'max', label: 'Máx', descriptionKey: 'effort.max' }
        ],
        supportsAttachments: true,
        supportsResume: true,
        provider: { id: 'anthropic', detail: null },
        modelSource: 'detected',
        defaults: { model: 'opus', effort: 'xhigh' }
      },
      'github-copilot': {
        // context-compaction: what this agent's adapter measured (see its
        // catalog module). Claude takes `/compact` but does not self-compact in
        // print mode; Devin does both; Copilot is unmeasured.
        compaction: { command: false, automatic: false },
        models: [
          {
            id: '',
            label: 'Automático',
            descriptionKey: 'cliDefault',
            traits: ['cli-default'],
            group: 'default',
            source: 'configured',
            resolvedId: 'gpt-5.1'
          },
          {
            id: 'claude-sonnet-4.5',
            label: 'Claude Sonnet 4.5',
            descriptionKey: 'copilot.sonnet45',
            vendor: 'Anthropic',
            contextWindow: 200000,
            traits: ['balanced', 'thinking'],
            group: 'recommended',
            source: 'catalog'
          },
          {
            id: 'claude-opus-4.5',
            label: 'Claude Opus 4.5',
            descriptionKey: 'copilot.opus45',
            vendor: 'Anthropic',
            contextWindow: 200000,
            traits: ['flagship', 'thinking'],
            group: 'recommended',
            source: 'catalog'
          },
          {
            id: 'gpt-5.1',
            label: 'GPT-5.1',
            descriptionKey: 'copilot.gpt51',
            vendor: 'OpenAI',
            traits: ['flagship', 'thinking'],
            group: 'recommended',
            source: 'configured'
          },
          {
            id: 'gpt-5-mini',
            label: 'GPT-5 mini',
            descriptionKey: 'copilot.gpt5mini',
            vendor: 'OpenAI',
            traits: ['fast'],
            group: 'more',
            source: 'catalog'
          },
          {
            id: 'gemini-3-pro-preview',
            label: 'Gemini 3 Pro',
            descriptionKey: 'copilot.gemini3',
            vendor: 'Google',
            traits: ['flagship'],
            group: 'more',
            source: 'catalog'
          }
        ],
        efforts: [],
        supportsAttachments: false,
        supportsResume: true,
        provider: { id: 'github', detail: null },
        modelSource: 'configured',
        defaults: { model: 'gpt-5.1', effort: null },
        note: 'no-listing'
      },
      // Devin, in the shape `devinModelCatalog` really detects: models are
      // model *families*, and each family carries its own reasoning ladder
      // (its variants). There is no agent-wide `efforts` — that is the whole
      // point, and a fixture that flattened it would hide the control the
      // picker now grows per row.
      devin: {
        models: [
          {
            id: '',
            label: 'Automático',
            descriptionKey: 'cliDefault',
            traits: ['cli-default'],
            group: 'default',
            source: 'configured',
            resolvedId: 'adaptive'
          },
          {
            id: 'claude-opus-5',
            label: 'Claude Opus 5',
            vendor: 'Anthropic',
            contextWindow: 1000000,
            aliases: ['opus'],
            traits: ['flagship', 'thinking', 'long-context'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              {
                id: 'claude-opus-5-low',
                label: 'Baixo',
                description: '$5 / 1M Input · $0,5 / 1M Cached input · $25 / 1M Output'
              },
              {
                id: 'claude-opus-5-medium',
                label: 'Médio',
                description: '$5 / 1M Input · $0,5 / 1M Cached input · $25 / 1M Output'
              },
              {
                id: 'claude-opus-5-high',
                label: 'Alto',
                description: '$5 / 1M Input · $0,5 / 1M Cached input · $25 / 1M Output',
                fastId: 'claude-opus-5-high-fast'
              },
              {
                id: 'claude-opus-5-xhigh',
                label: 'Extra',
                description: '$5 / 1M Input · $0,5 / 1M Cached input · $25 / 1M Output',
                fastId: 'claude-opus-5-xhigh-fast'
              },
              {
                id: 'claude-opus-5-max',
                label: 'Máximo',
                description: '$5 / 1M Input · $0,5 / 1M Cached input · $25 / 1M Output',
                fastId: 'claude-opus-5-max-fast'
              }
            ]
          },
          {
            id: 'claude-sonnet-5',
            label: 'Claude Sonnet 5',
            vendor: 'Anthropic',
            contextWindow: 1000000,
            aliases: ['sonnet'],
            traits: ['balanced', 'thinking', 'long-context'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              { id: 'claude-sonnet-5-low', label: 'Baixo', description: 'Med cost' },
              { id: 'claude-sonnet-5-medium', label: 'Médio', description: 'Med cost' },
              { id: 'claude-sonnet-5-high', label: 'Alto', description: 'Med cost' },
              { id: 'claude-sonnet-5-max', label: 'Máximo', description: 'Med cost' }
            ]
          },
          {
            id: 'gpt-5.6-terra',
            label: 'GPT-5.6 Terra',
            vendor: 'OpenAI',
            contextWindow: 1000000,
            aliases: ['gpt'],
            traits: ['flagship', 'thinking', 'long-context'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              { id: 'gpt-5-6-terra-none', label: 'Sem raciocínio', description: 'Med cost' },
              { id: 'gpt-5-6-terra-low', label: 'Baixo', description: 'Med cost' },
              { id: 'gpt-5-6-terra-medium', label: 'Médio', description: 'Med cost' },
              { id: 'gpt-5-6-terra-high', label: 'Alto', description: 'Med cost' },
              { id: 'gpt-5-6-terra-max', label: 'Máximo', description: 'Med cost' }
            ]
          },
          {
            id: 'gemini-3.8-flash',
            label: 'Gemini 3.8 Flash',
            vendor: 'Google',
            contextWindow: 1048576,
            aliases: ['gemini'],
            traits: ['balanced', 'thinking', 'long-context'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              { id: 'gemini-3-8-flash-low', label: 'Baixo', description: 'Med cost' },
              { id: 'gemini-3-8-flash-medium', label: 'Médio', description: 'Med cost' },
              { id: 'gemini-3-8-flash-high', label: 'Alto', description: 'Med cost' }
            ]
          },
          {
            id: 'swe-1.7-lightning',
            label: 'SWE-1.7 Lightning',
            vendor: 'Cognition',
            contextWindow: 202752,
            aliases: ['swe'],
            traits: ['balanced', 'thinking'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              { id: 'swe-1-7-lightning-medium', label: 'Médio', description: 'Med cost' },
              { id: 'swe-1-7-lightning', label: 'Máximo', description: 'Med cost' }
            ]
          },
          {
            id: 'adaptive',
            label: 'Adaptive',
            descriptionKey: 'devin.adaptive',
            vendor: 'Cognition',
            traits: ['router'],
            group: 'recommended',
            source: 'detected'
          },
          {
            id: 'glm-5.3',
            label: 'GLM-5.3',
            vendor: 'Z.ai',
            contextWindow: 1048576,
            traits: ['fast', 'thinking', 'long-context'],
            group: 'recommended',
            source: 'detected',
            efforts: [
              {
                id: '',
                label: 'Automático',
                descriptionKey: 'effort.cliDefault',
                traits: ['cli-default'],
                group: 'default'
              },
              { id: 'glm-5-3-low', label: 'Baixo', description: 'Low cost' },
              { id: 'glm-5-3-high', label: 'Alto', description: 'Low cost' },
              { id: 'glm-5-3-max', label: 'Máximo', description: 'Low cost' }
            ]
          }
        ],
        efforts: [],
        supportsAttachments: true,
        supportsResume: true,
        provider: { id: 'cognition', detail: null },
        modelSource: 'detected',
        defaults: { model: 'adaptive', effort: null }
      }
    }

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

    /**
     * The workspace, in the order `listDir` really returns it: folders before
     * files, each group naturally compared (`src/main/fileOrder.ts`). One of
     * each config family so the icon set is visible, and a `second-brain/`
     * vault with real pages — the knowledge base browses it with the very same
     * `FileTree`.
     */
    const WORKSPACE_TREE = [
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
          { name: 'architecture.md', path: 'docs/architecture.md', type: 'file' },
          { name: 'epics.md', path: 'docs/epics.md', type: 'file' },
          { name: 'prd.md', path: 'docs/prd.md', type: 'file' },
          { name: 'ux-spec.md', path: 'docs/ux-spec.md', type: 'file' }
        ]
      },
      {
        name: 'second-brain',
        path: 'second-brain',
        type: 'directory',
        children: [
          {
            name: 'raw',
            path: 'second-brain/raw',
            type: 'directory',
            children: [
              { name: 'reuniao-2026-09-01.md', path: 'second-brain/raw/reuniao-2026-09-01.md', type: 'file' }
            ]
          },
          {
            name: 'wiki',
            path: 'second-brain/wiki',
            type: 'directory',
            children: [
              {
                name: 'decisoes',
                path: 'second-brain/wiki/decisoes',
                type: 'directory',
                children: [
                  { name: 'adr-1.md', path: 'second-brain/wiki/decisoes/adr-1.md', type: 'file' },
                  { name: 'adr-2.md', path: 'second-brain/wiki/decisoes/adr-2.md', type: 'file' },
                  { name: 'adr-10.md', path: 'second-brain/wiki/decisoes/adr-10.md', type: 'file' }
                ]
              },
              { name: 'glossario.md', path: 'second-brain/wiki/glossario.md', type: 'file' },
              { name: 'index.md', path: 'second-brain/wiki/index.md', type: 'file' },
              { name: 'onboarding.md', path: 'second-brain/wiki/onboarding.md', type: 'file' }
            ]
          },
          { name: 'README.md', path: 'second-brain/README.md', type: 'file' }
        ]
      },
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          { name: 'app.tsx', path: 'src/app.tsx', type: 'file' },
          { name: 'index.ts', path: 'src/index.ts', type: 'file' }
        ]
      },
      { name: '.env', path: '.env', type: 'file' },
      { name: 'deploy.sh', path: 'deploy.sh', type: 'file' },
      { name: 'docker-compose.yaml', path: 'docker-compose.yaml', type: 'file' },
      { name: 'electron-builder.yml', path: 'electron-builder.yml', type: 'file' },
      { name: 'logo.svg', path: 'logo.svg', type: 'file' },
      { name: 'notas.txt', path: 'notas.txt', type: 'file' },
      { name: 'package.json', path: 'package.json', type: 'file' },
      { name: 'README.md', path: 'README.md', type: 'file' }
    ]

    /** `listTree`'s answer for a workspace-relative directory (undefined = the root). */
    const subtreeAt = (rel) => {
      if (!rel) return WORKSPACE_TREE
      let nodes = WORKSPACE_TREE
      for (const segment of rel.split('/')) {
        const next = nodes.find((node) => node.name === segment)
        if (!next) return []
        nodes = next.children ?? []
      }
      return nodes
    }

    const agentListeners = []
    window.__agentEvent = (evt) => {
      for (const cb of agentListeners) cb(evt)
    }

    /**
     * engine-pins: the per-agent default `agent.pins`/`agent.pin` hold for this
     * session. In memory, so pinning inside a scene is real — the trigger's
     * mark, the hoisted "Seu padrão" section and the footer's button all read
     * it back — without a config.json anywhere.
     */
    const enginePins = {}

    // git-management: one of every row the change list groups — staged,
    // modified, untracked, renamed and conflicted — so a pass sees the whole
    // panel rather than the one group the fixture happened to fill.
    const change = (path, index, worktree, over = {}) => ({
      path,
      index,
      worktree,
      isConflict: false,
      isUntracked: false,
      isIgnored: false,
      ...over
    })
    state.gitStatus = {
      branch: 'feat/parakeet-asr',
      detached: false,
      oid: 'a'.repeat(40),
      upstream: 'origin/feat/parakeet-asr',
      ahead: 2,
      behind: 0,
      mergeInProgress: false,
      changes: [
        change('src/main/gitService.ts', 'M', '.'),
        change('src/renderer/src/scm/CommitBox.tsx', 'A', '.'),
        change('src/renderer/src/assets/workbench.css', '.', 'M'),
        change('docs/visual-validation.md', '.', 'M'),
        change('notas.txt', '?', '?', { isUntracked: true })
      ]
    }
    const GIT_LOG = [
      {
        hash: 'a'.repeat(40),
        shortHash: '1fb6ba5',
        author: 'gustavobgt',
        date: '2026-09-01T18:04:00-03:00',
        subject: 'fix(asr): o instalador não levava o motor'
      },
      {
        hash: 'b'.repeat(40),
        shortHash: '90c1b6e',
        author: 'gustavobgt',
        date: '2026-09-01T15:41:00-03:00',
        subject: 'feat(asr): oferecer de volta o espaço dos modelos antigos'
      }
    ]

    // git-logs: the command journal, in the shape main records it. Real
    // commands with real timings, including the two states the console exists
    // for — a failure with git's own stderr, and a call slow enough to explain
    // a stall.
    const gitLogListeners = []
    let gitSeq = 0
    const gitCmd = (over) => {
      gitSeq += 1
      return {
        id: `git#${gitSeq}`,
        at: Date.now() - (40 - gitSeq) * 1500,
        cwd: '/ws',
        args: ['status', '--porcelain=v2', '--branch', '-z'],
        code: 0,
        durationMs: 34,
        stderr: '',
        ...over
      }
    }
    state.gitCommandLog = [
      gitCmd({ args: ['rev-parse', '--is-inside-work-tree'], durationMs: 12 }),
      gitCmd({ args: ['rev-parse', '--show-toplevel'], durationMs: 11 }),
      gitCmd({}),
      gitCmd({ args: ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], code: 1, durationMs: 9 }),
      gitCmd({ args: ['add', '--', 'src/main/gitService.ts'], durationMs: 41 }),
      gitCmd({}),
      gitCmd({ args: ['fetch'], durationMs: 2840 }),
      gitCmd({
        args: ['push'],
        code: 128,
        durationMs: 1960,
        stderr:
          'fatal: could not read Username for \'https://github.com\': terminal prompts disabled'
      }),
      gitCmd({ args: ['log', '--max-count=50'], durationMs: 63 })
    ]
    /** Push one live command entry into the open console. */
    window.__gitLog = (over) => {
      const entry = gitCmd({ at: Date.now(), ...over })
      state.gitCommandLog = [...state.gitCommandLog, entry]
      for (const cb of gitLogListeners) cb(entry)
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

    /**
     * M29 — one model, so the fixture is one record instead of a catalog. The
     * hardware facts survive because the voice panel still reports what the
     * probe read (and what thread count it chose from it).
     */
    const FACTS = globalThis.HIVE_FACTS ?? { gpu: true, ramGB: 32, cores: 12 }
    const PARAKEET = {
      id: 'parakeet-tdt-0.6b-v3-int8',
      repo: 'istupakov/parakeet-tdt-0.6b-v3-onnx',
      params: '600 M',
      sizeMB: 670,
      languages: 25,
      downloaded: globalThis.HIVE_NO_MODELS !== true
    }
    const READINESS = {
      installed: PARAKEET.downloaded,
      model: PARAKEET,
      runtime: { threads: 6, facts: FACTS }
    }
    // Exposed so a scene can re-derive readiness for the not-installed state.
    window.__HIVE_ASR = READINESS

    const downloadSubs = []
    const settledSubs = []
    const phaseSubs = []
    const awsSubs = []

    // aws-bedrock: a real-shaped Bedrock machine with a live session. The
    // numbers are the ones a Identity Center account actually produces —
    // twelve-digit account, an `sso_session`-backed profile, an eight-hour
    // token — because a fixture that rounds those off hides exactly the
    // layout problems this scene exists to find.
    const AWS_STATUS = {
      active: true,
      profile: 'fitame-dev',
      profileSource: 'claude-settings',
      region: 'us-east-1',
      accountId: '060795902845',
      roleName: 'AdministratorAccess',
      startUrl: 'https://fitame.awsapps.com/start',
      authKind: 'sso',
      state: 'ready',
      expiresAt: new Date(Date.now() + 6.2 * 3600e3).toISOString(),
      expiresInMs: 6.2 * 3600e3,
      cliAvailable: true,
      authRefreshCommand: 'aws sso login --profile fitame-dev',
      profiles: [
        {
          name: 'fitame-dev',
          accountId: '060795902845',
          roleName: 'AdministratorAccess',
          region: 'us-east-1',
          authKind: 'sso',
          signedIn: true
        },
        {
          name: 'fitame-prod',
          accountId: '241533149506',
          roleName: 'ReadOnly',
          region: 'sa-east-1',
          authKind: 'sso',
          signedIn: false
        }
      ]
    }
    const AWS_IDLE_LOGIN = {
      phase: 'idle',
      profile: null,
      url: null,
      code: null,
      message: null,
      startedAt: null,
      expiresAt: null
    }
    /** Push one engine phase to every subscriber (M29). */
    window.__asrPhase = (phase) => {
      for (const fn of [...phaseSubs]) fn(phase)
    }
    /** Push a downloads snapshot to every subscriber, as main's manager does. */
    window.__downloads = (list) => {
      for (const fn of [...downloadSubs]) fn(list)
    }
    /** Push one ending to every subscriber. */
    window.__downloadSettled = (record) => {
      for (const fn of [...settledSubs]) fn(record)
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
      // The tree comes back in the order the real `listDir` produces it
      // (`src/main/fileOrder.ts`): every folder first, then every file, each
      // group compared naturally. Authoring the fixture in any other order
      // would make a pass see an ordering the app never ships.
      //
      // `listTree(root, rel)` browses a *subtree* when `rel` is given — the
      // knowledge base points this same explorer at its vault folder — so the
      // mock resolves the path instead of always answering with the root.
      listTree: (_root, rel) => Promise.resolve(subtreeAt(rel)),
      // chat-file-links: the oracle that decides which paths in a reply are
      // openable. Wide enough that a scene can name real ones AND a path that
      // is deliberately not here, so a pass can see both outcomes side by side.
      listFiles: ok([
        'README.md',
        'docs/ux-spec.md',
        'docs/prd.md',
        'package.json',
        'src/main/agentService.ts',
        'src/main/devinCliAdapter.ts',
        'src/renderer/src/chat/Chat.tsx',
        'src/renderer/src/assets/workbench.css',
        'logo.svg'
      ]),
      // Enough prose for the editor to be an editor: several lines, headings,
      // and a document long enough that "where was I?" is a real question when
      // the surface swaps between Editar and Visualizar.
      readFile: (_root, rel) =>
        Promise.resolve(
          rel && rel.endsWith('.md')
            ? [
                `# ${rel.split('/').pop()?.replace(/\.md$/, '') ?? 'Documento'}`,
                '',
                'Este documento é o rascunho que a squad revisa em conjunto.',
                '',
                '## Contexto',
                '',
                'O time precisa de um lugar único para as decisões — hoje elas',
                'moram em três canais diferentes e ninguém sabe qual vale.',
                '',
                '## Decisão',
                '',
                '1. Uma base por workspace.',
                '2. Toda ingestão passa por revisão.',
                '3. O índice é a porta de entrada.',
                ''
              ].join('\n')
            : '# README\n'
        ),
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
        //
        // Per-agent, because that is the real contract, and the engine picker
        // reshapes itself around it: Claude has the effort ladder and four
        // groups of models; Copilot has many models across three vendors and
        // NO effort; Devin has a router model at the top. A fixture that
        // answered the same for every agent would hide the whole point.
        //
        // model-picker: shaped like what `detectClaudeCapabilities` &co really
        // return — `descriptionKey`/`traits`/`group`/`source`/`resolvedId` and
        // the provenance fields the panel's footer reads.
        capabilities: (agentId) => Promise.resolve(CAPABILITIES[agentId] ?? CAPABILITIES['claude-cli']),
        // engine-pins: the model+effort each agent starts on. Held in memory so
        // pinning inside a scene is real — the trigger's mark, the hoisted
        // "Seu padrão" section and the footer's button all read it back.
        pins: () => Promise.resolve({ ...enginePins }),
        pin: (agentId, pin) => {
          if (pin === null) delete enginePins[agentId]
          else enginePins[agentId] = pin
          return Promise.resolve({ ...enginePins })
        },
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
        // context-compaction: `Chat` reads this at mount too. `?nocompact=1`
        // boots with Hive's own 80% threshold already off — the state the
        // context sheet's switch exists for.
        autoCompact: ok(!location.search.includes('nocompact=1')),
        setAutoCompact: ok(undefined),
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
      // chat-slash-commands: a real slice of a provisioned workspace's BMAD
      // catalog, so the menu's two sections and its descriptions are exercised.
      skills: {
        list: ok([
          { key: 'bmad-prd', label: 'Criar PRD', description: 'Requisitos do produto, do problema ao escopo' },
          { key: 'bmad-ux', label: 'Criar UX', description: 'Padrões de interação e especificação de interface' },
          { key: 'bmad-architecture', label: 'Arquitetura', description: 'A espinha técnica que mantém tudo consistente' },
          { key: 'bmad-create-story', label: 'Criar story', description: 'A próxima história, com todo o contexto' },
          { key: 'bmad-code-review', label: 'Revisar código', description: 'Revisão adversarial em camadas paralelas' }
        ])
      },
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
        // `AgentMeta`'s field is `displayName`, not `label` — a fixture using
        // the wrong key makes every surface fall back to the raw id, and the
        // composer's agent pill reads "claude" instead of "Claude Code".
        // Two agents, because the pickers that offer a choice (the chat
        // switcher, the studio's builder picker) only appear when there is one.
        // Three, not two: the engine picker takes a different shape for each
        // (Claude has the effort ladder, Copilot groups by vendor with no
        // effort, Devin leads with a router model), and a fixture with two
        // agents can only ever show two of the three.
        agents: ok([
          { id: 'claude-cli', displayName: 'Claude Code', available: true },
          { id: 'github-copilot', displayName: 'GitHub Copilot', available: true },
          { id: 'devin', displayName: 'Devin', available: true }
        ]),
        getAgent: ok('claude-cli'),
        setAgent: ok(undefined),
        getAgents: ok(['claude-cli', 'github-copilot', 'devin']),
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
      // git-management: a real repo by default, because every Source Control
      // surface (the change groups, the commit box, the history timeline) is
      // invisible without one — the previous fixture said `isRepo: false`, so
      // the whole view rendered its "initialize a repository" state and no
      // pass could ever look at the panel it was meant to look at.
      // `globalThis.HIVE_NO_REPO = true` gives that state back.
      git: {
        detect: ok(
          globalThis.HIVE_NO_REPO === true
            ? { isRepo: false, root: null, gitMissing: false }
            : { isRepo: true, root: '/ws', gitMissing: false }
        ),
        status: () => Promise.resolve(state.gitStatus),
        stage: ok(undefined),
        unstage: ok(undefined),
        discard: ok(undefined),
        commit: ok({ hash: 'a'.repeat(40) }),
        branches: ok({
          current: 'feat/parakeet-asr',
          detached: false,
          local: [
            { name: 'main', current: false, upstream: 'origin/main', ahead: 0, behind: 0 },
            {
              name: 'feat/parakeet-asr',
              current: true,
              upstream: 'origin/feat/parakeet-asr',
              ahead: 2,
              behind: 0
            }
          ],
          remote: [{ name: 'origin/main' }, { name: 'origin/feat/parakeet-asr' }]
        }),
        createBranch: ok(undefined),
        checkout: ok(undefined),
        renameBranch: ok(undefined),
        deleteBranch: ok(undefined),
        fetch: ok(undefined),
        pull: ok(undefined),
        push: ok(undefined),
        sync: ok(undefined),
        log: ok(GIT_LOG),
        diff: ok({ path: 'src/index.ts', binary: false, hunks: [] }),
        commitDiff: ok({ hash: 'a'.repeat(40), files: [] }),
        // The amend prefill reads the last message off the log; a stub that
        // returns nothing makes the amend checkbox look like it does nothing.
        fileAtHead: ok(''),
        conflicts: ok([]),
        resolveConflict: ok(undefined),
        mergeContinue: ok(undefined),
        mergeAbort: ok(undefined),
        stash: ok(undefined),
        stashList: ok([]),
        stashApply: ok(undefined),
        stashDrop: ok(undefined),
        onChanged: unsub,
        // git-logs: the command journal the console reads. `history` is the
        // backlog; `window.__gitLog(entry)` pushes a live one, which is the
        // only way to see the console's arrival behaviour without a real repo.
        logs: {
          history: () => Promise.resolve(state.gitCommandLog),
          clear: () => {
            state.gitCommandLog = []
            return Promise.resolve(undefined)
          },
          onEntry: (cb) => {
            gitLogListeners.push(cb)
            return () => {
              const i = gitLogListeners.indexOf(cb)
              if (i >= 0) gitLogListeners.splice(i, 1)
            }
          }
        }
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
      // M29: one model, downloaded by main and broadcast to every window.
      // `globalThis.HIVE_NO_MODELS = true` gives the fresh install (nothing on
      // disk), which is the state the voice gate exists for.
      asr: {
        readiness: () => Promise.resolve(globalThis.__HIVE_READINESS ?? READINESS),
        deleteModel: () => Promise.resolve({ ...READINESS, installed: false }),
        legacyModelBytes: ok(globalThis.HIVE_LEGACY_BYTES ?? 0),
        removeLegacyModels: ok(0),
        // Resolved, never rejected: every dictation surface calls `warm()` on
        // hover, and a rejection there paints an engine error over a scene that
        // was only ever meant to be looked at.
        warm: ok(undefined),
        transcribe: ok(''),
        evict: ok(undefined),
        // The phase stream. `window.__asrPhase({status:'ready'})` drives it —
        // the client reads the CURRENT phase from these pushes, so a fixture
        // that only registers the listener leaves every mic control `idle`.
        onPhase: (fn) => {
          phaseSubs.push(fn)
          fn(globalThis.HIVE_ASR_PHASE ?? { status: 'ready' })
          return () => phaseSubs.splice(phaseSubs.indexOf(fn), 1)
        },
        downloads: () => Promise.resolve(globalThis.__HIVE_DOWNLOADS ?? []),
        startDownload: () =>
          Promise.resolve({
            id: PARAKEET.id,
            status: 'downloading',
            loaded: 0,
            total: PARAKEET.sizeMB * 1e6,
            file: 'encoder.int8.onnx',
            bytesPerSecond: 0,
            failure: null,
            startedAt: Date.now(),
            updatedAt: Date.now()
          }),
        cancelDownload: ok(undefined),
        dismissDownload: ok(undefined),
        // Every listener, not the last one. Main broadcasts to all live
        // windows; a fixture that keeps only the newest subscriber silently
        // hands the stream to whichever surface mounted most recently — which
        // is how a probe ends up pushing an ending into the model gate and
        // waiting forever for the notice that was never told.
        onDownloads: (fn) => {
          downloadSubs.push(fn)
          return () => downloadSubs.splice(downloadSubs.indexOf(fn), 1)
        },
        onDownloadSettled: (fn) => {
          settledSubs.push(fn)
          return () => settledSubs.splice(settledSubs.indexOf(fn), 1)
        }
      },
      // aws-bedrock: the AWS session behind Claude-on-Bedrock. The default is
      // a live session on a real-shaped profile, so every surface renders its
      // ordinary state; drive the rest from the console:
      //
      //   window.__aws.status({ state: 'expired', expiresInMs: -1 })
      //   window.__aws.login({ phase: 'browser', url: '…', code: 'VFRM-JRXW' })
      //   window.__aws.login({ phase: 'success' })
      aws: {
        status: () => Promise.resolve(globalThis.__HIVE_AWS ?? AWS_STATUS),
        loginState: () => Promise.resolve(globalThis.__HIVE_AWS_LOGIN ?? AWS_IDLE_LOGIN),
        login: ok({ ok: true, refreshed: true }),
        cancel: ok(undefined),
        getProfile: ok(null),
        setProfile: ok(undefined),
        onState: (fn) => {
          awsSubs.push(fn)
          return () => awsSubs.splice(awsSubs.indexOf(fn), 1)
        }
      }
    }

    window.__aws = {
      /** Replaces the machine's answer and re-reads it on the next poll. */
      status: (patch) => {
        globalThis.__HIVE_AWS = { ...(globalThis.__HIVE_AWS ?? AWS_STATUS), ...patch }
      },
      /** Pushes one live login phase to every subscriber. */
      login: (patch) => {
        globalThis.__HIVE_AWS_LOGIN = { ...AWS_IDLE_LOGIN, ...patch }
        for (const fn of awsSubs) fn(globalThis.__HIVE_AWS_LOGIN)
      }
    }
  }, theme)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(1200)
  return await page.evaluate(() => document.body.innerText.slice(0, 400))
}
