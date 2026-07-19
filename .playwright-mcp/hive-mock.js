async (page) => {
  await page.context().addInitScript(() => {
    const now = Date.now()
    const CREATED = [
      {
        key: 'revisor-release-notes',
        name: 'Revisor de Release Notes',
        description: 'Revisa release notes contra o padrão do time antes da publicação.',
        kind: 'skill',
        persona: null,
        hasEvals: true,
        evalCases: 4,
        relPath: '.claude/skills/revisor-release-notes',
        updatedAt: now - 2 * 3600e3
      },
      {
        key: 'clara-dados',
        name: 'Clara',
        description:
          'Especialista em análise de dados e métricas de produto. Use when the user asks to talk to Clara.',
        kind: 'agent',
        persona: 'Clara',
        hasEvals: false,
        evalCases: 0,
        relPath: '.claude/skills/clara-dados',
        updatedAt: now - 2 * 86400e3
      }
    ]
    const BMAD_CATALOG = [
      { key: 'bmad-prd', label: 'Create Edit and Review PRD', description: 'PRD workflow', module: 'bmm', kind: 'skill', persona: null },
      { key: 'bmad-brainstorming', label: 'Brainstorming', description: 'Facilitate a brainstorming session', module: 'core', kind: 'skill', persona: null },
      { key: 'bmad-domain-research', label: 'Domain Research', description: 'Conduct domain research', module: 'bmm', kind: 'skill', persona: null },
      { key: 'bmad-product-brief', label: 'Create Brief', description: 'Create a product brief', module: 'bmm', kind: 'skill', persona: null },
      { key: 'bmad-create-story', label: 'Create Story', description: 'Create the next story', module: 'bmm', kind: 'skill', persona: null },
      { key: 'bmad-create-epics-and-stories', label: 'Epics & Stories', description: 'Break requirements into epics and stories', module: 'bmm', kind: 'skill', persona: null },
      { key: 'bmad-agent-pm', label: 'John', description: 'Product manager. Use when the user asks to talk to John.', module: 'bmm', kind: 'agent', persona: 'John' },
      { key: 'bmad-agent-ux-designer', label: 'Sally', description: 'UX designer. Use when the user asks to talk to Sally.', module: 'bmm', kind: 'agent', persona: 'Sally' },
      { key: 'bmad-tea', label: 'Murat', description: 'Test architect. Use when the user asks to talk to Murat.', module: 'tea', kind: 'agent', persona: 'Murat' }
    ]
    const CATALOG = [
      ...BMAD_CATALOG,
      ...CREATED.map((s) => ({
        key: s.key,
        label: s.name,
        description: s.description,
        module: 'custom',
        kind: s.kind,
        persona: s.persona,
        custom: true
      }))
    ]
    const PM_ACTIONS = [
      { key: 'domain-research', kind: 'workflow', command: { key: 'bmad-domain-research', prompt: '/bmad-domain-research' } },
      { key: 'brainstorm', kind: 'workflow', command: { key: 'bmad-brainstorming', prompt: '/bmad-brainstorming' } },
      { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
      { key: 'product-brief', kind: 'workflow', command: { key: 'bmad-product-brief', prompt: '/bmad-product-brief' } },
      { key: 'epics-stories', kind: 'workflow', command: { key: 'bmad-create-epics-and-stories', prompt: '/bmad-create-epics-and-stories' } },
      { key: 'story', kind: 'workflow', command: { key: 'bmad-create-story', prompt: '/bmad-create-story' } },
      { key: 'persona-pm', kind: 'persona', command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' } }
    ]
    let prefs = null
    const resolveActions = () => {
      if (!prefs) return PM_ACTIONS
      const byKey = new Map(CATALOG.map((s) => [s.key, s]))
      const pick = (keys, kind) =>
        keys.flatMap((key) => {
          const s = byKey.get(key)
          return s ? [{ key, kind, label: s.label, custom: !!s.custom, command: { key, prompt: '/' + key } }] : []
        })
      return [...pick(prefs.skills, 'workflow'), ...pick(prefs.agents, 'persona')]
    }
    const TREE = [
      {
        name: '_bmad-output',
        path: '_bmad-output',
        type: 'directory',
        children: [
          { name: 'prd.md', path: '_bmad-output/prd.md', type: 'file' }
        ]
      },
      {
        name: '.claude',
        path: '.claude',
        type: 'directory',
        children: [
          {
            name: 'skills',
            path: '.claude/skills',
            type: 'directory',
            children: CREATED.map((s) => ({ name: s.key, path: s.relPath, type: 'directory', children: [{ name: 'SKILL.md', path: s.relPath + '/SKILL.md', type: 'file' }] }))
          }
        ]
      },
      { name: 'README.md', path: 'README.md', type: 'file' }
    ]
    const SESSIONS = [
      { id: 's1', title: 'PRD do módulo de cobrança', createdAt: now - 3600e3, updatedAt: now - 1800e3, messageCount: 12, agent: 'claude-cli', preview: 'Fechamos o escopo do MVP.' },
      { id: 's2', title: 'Brainstorm de onboarding', createdAt: now - 86400e3, updatedAt: now - 80000e3, messageCount: 7, agent: 'claude-cli', preview: 'Três ideias fortes.' }
    ]
    window.hive = {
      ping: async () => 'pong',
      chooseWorkspace: async () => null,
      openExternal: async () => {},
      getWorkspace: async () => '/home/user/projetos/loja-virtual',
      isProvisioned: async () => true,
      provisionState: async () => true,
      getRecentWorkspaces: async () => [],
      openWorkspace: async () => ({ ok: true }),
      listTree: async () => TREE,
      listFiles: async () => ['README.md', '_bmad-output/prd.md'],
      readFile: async (root, rel) => '# ' + rel + '\n\nConteúdo de exemplo.\n',
      watchWorkspace: () => () => {},
      agent: {
        capabilities: async () => ({
          models: [
            { id: 'sonnet', label: 'Sonnet' },
            { id: 'opus', label: 'Opus' }
          ],
          efforts: [
            { id: 'medium', label: 'Médio' },
            { id: 'high', label: 'Alto' }
          ],
          supportsAttachments: true
        }),
        chooseAttachments: async () => [],
        start: async () => {},
        send: async () => {},
        runWorkflow: async () => {},
        stop: async () => {},
        interrupt: async () => {},
        onEvent: () => () => {}
      },
      installBmad: (ws, opts, onEvent) => {
        setTimeout(() => onEvent({ type: 'done', ok: true }), 30)
        return () => {}
      },
      updateBmad: (ws, onEvent) => {
        setTimeout(() => onEvent({ type: 'done', ok: true }), 30)
        return () => {}
      },
      workflows: { list: async () => [] },
      skills: {
        list: async () => [
          ...BMAD_CATALOG.filter((s) => s.kind === 'skill').map((s) => ({ key: s.key, label: s.label, description: s.description })),
          ...CREATED.map((s) => ({ key: s.key, label: s.name, description: s.description }))
        ]
      },
      studio: { list: async () => CREATED },
      chatHistory: {
        list: async () => SESSIONS,
        get: async () => null,
        create: async () => ({ id: 'new', title: '', createdAt: now, updatedAt: now, messageCount: 0, agent: 'claude-cli', preview: '', messages: [] }),
        append: async () => null,
        rename: async () => null,
        setCliSession: async () => {},
        search: async () => [],
        delete: async () => {}
      },
      app: {
        info: async () => ({ version: '0.1.0', updatesSupported: false }),
        checkForUpdates: async () => {},
        downloadUpdate: async () => {},
        installUpdate: async () => {},
        onUpdateEvent: () => () => {}
      },
      profile: {
        agents: async () => [
          { id: 'claude-cli', displayName: 'Claude Code', available: true }
        ],
        getAgent: async () => 'claude-cli',
        setAgent: async () => {},
        getRole: async () => 'pm',
        setRole: async () => {},
        getUserName: async () => 'Gustavo',
        setUserName: async () => {},
        roleActions: async () => PM_ACTIONS
      },
      shortcuts: {
        catalog: async () => CATALOG,
        get: async () => prefs,
        set: async (next) => {
          prefs = next
        },
        actions: async () => resolveActions()
      },
      fs: {
        statFile: async () => ({ mtimeMs: now, size: 10 }),
        createFile: async () => {},
        createDirectory: async () => {},
        saveFile: async () => ({ mtimeMs: now, size: 10 }),
        move: async () => {},
        importEntry: async () => {},
        exists: async () => true,
        trash: async () => {},
        pathForFile: () => '/tmp/x'
      }
    }
    try {
      window.localStorage.setItem('hive.tourSeen', '1')
      window.localStorage.setItem('hive-desktop-theme', 'dark')
    } catch {}
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(600)
  return await page.title()
}
