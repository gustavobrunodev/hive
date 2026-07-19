async (page) => {
  await page.context().addInitScript(() => {
    const WS = '/home/demo/hive-workspace'
    const files = [
      'README.md',
      'PRODUCT.md',
      'package.json',
      'docs/prd.md',
      'docs/arquitetura.md',
      'docs/pesquisa-dominio.md',
      'docs/stories/story-001-onboarding.md',
      'docs/stories/story-002-checkout.md',
      '_bmad-output/prd/prd.md',
      '_bmad-output/brief/product-brief.md',
      'src/app.ts',
      'src/checkout/carrinho.ts',
      'src/checkout/pagamento.ts',
      'assets/logo.svg'
    ]
    const tree = [
      { name: 'README.md', path: 'README.md', type: 'file' },
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [
          { name: 'prd.md', path: 'docs/prd.md', type: 'file' },
          { name: 'arquitetura.md', path: 'docs/arquitetura.md', type: 'file' }
        ]
      }
    ]
    const listeners = []
    function emit(evt) {
      for (const cb of listeners) cb(evt)
    }
    function fakeReply(turnId) {
      const chunks = [
        'Claro! Li os arquivos que você anexou e referenciou.\n\n',
        '## O que encontrei\n\n',
        '- O **PRD** cobre o fluxo de onboarding, mas não menciona o checkout.\n',
        '- A pesquisa anexada aponta fricção na etapa de pagamento.\n\n',
        'Quer que eu atualize o PRD com uma seção de checkout?'
      ]
      setTimeout(() => emit({ type: 'session', id: 'cli-demo-1', turnId }), 200)
      chunks.forEach((text, i) => {
        setTimeout(() => emit({ type: 'token', text, turnId }), 420 + i * 180)
      })
      setTimeout(() => emit({ type: 'done', turnId }), 420 + chunks.length * 180 + 120)
    }
    const sessions = new Map()
    let sessionSeq = 0
    window.hive = {
      ping: async () => 'pong',
      chooseWorkspace: async () => WS,
      openExternal: async () => {},
      getWorkspace: async () => WS,
      isProvisioned: async () => true,
      provisionState: async () => true,
      getRecentWorkspaces: async () => [WS],
      openWorkspace: async (path) => ({ ok: true, path }),
      listTree: async () => tree,
      listFiles: async () => files,
      readFile: async () => '# Demo\n\nConteúdo do arquivo.',
      watchWorkspace: () => () => {},
      agent: {
        capabilities: async () => ({
          models: [
            { id: 'opus', label: 'Opus' },
            { id: 'sonnet', label: 'Sonnet' }
          ],
          efforts: [
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' }
          ],
          supportsAttachments: true
        }),
        chooseAttachments: async () => [
          {
            path: '/home/demo/Documentos/pesquisa-usuarios.pdf',
            name: 'pesquisa-usuarios.pdf',
            size: 2411724
          },
          {
            path: '/home/demo/Imagens/wireframe-onboarding.png',
            name: 'wireframe-onboarding.png',
            size: 487321
          }
        ],
        start: async () => {},
        send: async (_text, opts) => fakeReply(opts && opts.turnId),
        runWorkflow: async (_cmd, opts) => fakeReply(opts && opts.turnId),
        stop: async () => {},
        interrupt: async () => {},
        onEvent: (cb) => {
          listeners.push(cb)
          return () => {
            const i = listeners.indexOf(cb)
            if (i !== -1) listeners.splice(i, 1)
          }
        }
      },
      installBmad: (_ws, _opts, cb) => {
        setTimeout(() => cb({ type: 'done', ok: true }), 30)
        return () => {}
      },
      updateBmad: (_ws, cb) => {
        setTimeout(() => cb({ type: 'done', ok: true }), 30)
        return () => {}
      },
      workflows: { list: async () => [] },
      skills: {
        list: async () => [
          { key: 'bmad-prd', label: 'Criar PRD', description: 'PRD guiado pelo BMAD' },
          { key: 'bmad-brainstorming', label: 'Brainstorm', description: 'Sessão de ideação' }
        ]
      },
      chatHistory: {
        list: async () => [],
        get: async (_ws, id) => sessions.get(id) ?? null,
        create: async (_ws, agent) => {
          sessionSeq += 1
          const s = {
            id: '00000000-0000-4000-8000-00000000000' + sessionSeq,
            workspace: WS,
            agent,
            title: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            cliSessionId: null
          }
          sessions.set(s.id, s)
          return s
        },
        append: async (_ws, id, message) => {
          const s = sessions.get(id)
          if (!s) return null
          s.messages.push({ id: 'm' + s.messages.length, at: Date.now(), ...message })
          return null
        },
        rename: async () => null,
        setCliSession: async () => {},
        search: async () => [],
        delete: async () => {}
      },
      profile: {
        agents: async () => [
          { id: 'claude-cli', displayName: 'Claude Code', description: '', available: true }
        ],
        getAgent: async () => 'claude-cli',
        setAgent: async () => {},
        getRole: async () => 'pm',
        setRole: async () => {},
        roleActions: async () => [
          { key: 'domain-research', kind: 'workflow', command: { key: 'bmad-domain-research', prompt: 'p' } },
          { key: 'brainstorm', kind: 'workflow', command: { key: 'bmad-brainstorming', prompt: 'p' } },
          { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: 'p' } },
          { key: 'product-brief', kind: 'workflow', command: { key: 'bmad-product-brief', prompt: 'p' } },
          { key: 'persona-pm', kind: 'persona', command: { key: 'bmad-agent-pm', prompt: 'p' } }
        ]
      },
      fs: {
        statFile: async () => ({ mtimeMs: 1, size: 1 }),
        createFile: async () => {},
        createDirectory: async () => {},
        saveFile: async () => ({ mtimeMs: 1, size: 1 }),
        move: async () => {},
        importEntry: async () => {},
        exists: async () => false,
        trash: async () => {},
        pathForFile: (file) => '/home/demo/Downloads/' + file.name
      }
    }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(800)
  return await page.title()
}
