// Passe da barra lateral ocultável + restauração de sessão (workspace-session).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   node tools/visual/run-scene.mjs tools/visual/sidebar-session-pass.mjs
//
// Cobre a rodada inteira num arquivo: a primeira execução só com o chat, o
// clique que abre e o mesmo clique que fecha, o Ctrl+B voltando para a view
// que estava escondida, o estado da árvore sobrevivendo ao ciclo, e uma
// releitura do app com abas, pastas e conversa restauradas.
//
// Lições de sonda já pagas neste repositório e aplicadas aqui:
//
//   - **Uma asserção que estoura derruba o relatório inteiro** (run-config).
//     Tudo passa por `read()`, que devolve `⌀` em vez de lançar.
//   - **Resolva cor por canvas, nunca por regex** (agent-tool-details): os
//     tokens são `oklch()` e um parser de números lê quase-preto.
//   - **A busca de fundo sobe, não desce** (compaction): componha do elemento
//     para cima até o primeiro fundo opaco, `html` incluído.
//   - **Force o tema pelo menu** (engine-contrast), nunca pelo boot.
//   - **O init script do boot roda em TODA navegação**, então uma cena que
//     quer outro estado inicial registra o PRÓPRIO init script depois dele —
//     eles rodam na ordem de registro, e o último a escrever ganha.
async (page) => {
  const log = []
  const say = (line) => {
    log.push(line)
    console.log(line)
  }

  /** Lê algo da página sem derrubar o passe: qualquer falha vira `⌀`. */
  const read = async (fn) => {
    try {
      return await page.evaluate(fn)
    } catch {
      return '⌀'
    }
  }

  const ok = (label, actual, expected) =>
    say(
      `${JSON.stringify(actual) === JSON.stringify(expected) ? '✓' : '✗'} ${label} — ${JSON.stringify(actual)}${
        JSON.stringify(actual) === JSON.stringify(expected)
          ? ''
          : ` (esperado ${JSON.stringify(expected)})`
      }`
    )

  /** O estado que a barra lateral está mostrando, medido no DOM. */
  const sidebar = () =>
    read(() => {
      const pane = document.querySelector('.wb-pane#wb-sidebar-region')
      const panel = document.querySelector('#rail')
      const entries = Array.from(document.querySelectorAll('.wb-rail-view')).map((el) => ({
        name: el.getAttribute('aria-label'),
        pressed: el.getAttribute('aria-pressed'),
        expanded: el.getAttribute('aria-expanded'),
        active: el.hasAttribute('data-active'),
        resting: el.hasAttribute('data-resting')
      }))
      return {
        collapsed: pane?.hasAttribute('data-collapsed') ?? null,
        railWidth: Math.round(panel?.getBoundingClientRect().width ?? -1),
        // A árvore continua montada mesmo escondida — é o ponto inteiro de
        // colapsar em vez de desmontar.
        treeMounted: document.querySelector('.wb-rail-scroll') !== null,
        // The sash beside a hidden sidebar stays in the group (removing it makes
        // the library re-normalise every panel) but is taken out of the layout.
        handles: Array.from(document.querySelectorAll('[data-separator]')).filter(
          (el) => getComputedStyle(el).display !== 'none'
        ).length,
        showing: entries.find((e) => e.active)?.name ?? null,
        resting: entries.find((e) => e.resting)?.name ?? null
      }
    })

  /** Reinicia o app com um registro de sessão próprio (ou sem nenhum). */
  const relaunchWith = async (record) => {
    await page.addInitScript((value) => {
      if (value === null) localStorage.removeItem('hive.workspaceSession')
      else localStorage.setItem('hive.workspaceSession', JSON.stringify({ '/ws': value }))
    }, record)
    await page.reload()
    await page.waitForTimeout(1200)
  }

  // ─── 1. Primeira execução: só o chat ──────────────────────────────────────
  await relaunchWith(null)
  let state = await sidebar()
  ok('primeira execução: painel recolhido', state.collapsed, true)
  ok('primeira execução: largura da barra', state.railWidth, 0)
  ok('primeira execução: nada aparente na rail', state.showing, null)
  ok('primeira execução: Explorador em repouso', state.resting, 'Explorador')
  ok('primeira execução: sem alça de redimensionar à esquerda', state.handles, 0)
  ok(
    'primeira execução: o chat ocupa a largura toda',
    await read(() => {
      const body = document.querySelector('.wb-body')?.getBoundingClientRect().width ?? 0
      const chat = document.querySelector('#chat')?.getBoundingClientRect().width ?? 0
      return body > 0 && Math.abs(body - chat) < 2
    }),
    true
  )
  await page.screenshot({ path: '.playwright-mcp/sidebar-01-first-run.png' })

  // ─── 2. O clique da rail abre ─────────────────────────────────────────────
  await page.locator('.wb-rail-view').first().click()
  await page.waitForTimeout(400)
  state = await sidebar()
  ok('clique abre: painel visível', state.collapsed, false)
  ok('clique abre: view no ar', state.showing, 'Ocultar Explorador')
  ok('clique abre: a alça voltou', state.handles, 1)
  ok('clique abre: a rail tem largura de verdade', state.railWidth > 180, true)
  ok(
    'clique abre: o rótulo passou a nomear o que o clique faz',
    await read(() => document.querySelector('.wb-rail-view')?.getAttribute('aria-expanded')),
    'true'
  )
  await page.screenshot({ path: '.playwright-mcp/sidebar-02-open.png' })

  // ─── 3. Abrir uma pasta, e o mesmo clique fechar ──────────────────────────
  const folderRow = page.locator('.wb-rail-scroll .hds-tree-row', { hasText: 'docs' }).first()
  await folderRow.click()
  await page.waitForTimeout(400)
  const expandedBefore = await read(
    () => document.querySelectorAll('.wb-rail-scroll [aria-expanded="true"]').length
  )
  ok('a pasta abriu', expandedBefore > 0, true)

  await page.locator('.wb-rail-view').first().click()
  await page.waitForTimeout(400)
  state = await sidebar()
  ok('segundo clique fecha', state.collapsed, true)
  ok('a árvore NÃO foi desmontada', state.treeMounted, true)
  ok('fechada: o Explorador fica em repouso', state.resting, 'Explorador')
  ok(
    'fechada: nada dentro do painel é alcançável pelo teclado',
    await read(() => {
      const pane = document.querySelector('.wb-pane#wb-sidebar-region')
      return pane ? getComputedStyle(pane).visibility : '⌀'
    }),
    'hidden'
  )

  // ─── 4. Ctrl+B devolve o mesmo estado ─────────────────────────────────────
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  ok(
    'Ctrl+B reabre com as pastas exatamente como estavam',
    await read(() => document.querySelectorAll('.wb-rail-scroll [aria-expanded="true"]').length),
    expandedBefore
  )

  // ─── 5. Fechar sobre outra view e voltar para ELA ─────────────────────────
  await page.locator('.wb-rail-view').nth(1).click()
  await page.waitForTimeout(300)
  await page.locator('.wb-rail-view').nth(1).click()
  await page.waitForTimeout(300)
  state = await sidebar()
  ok('fechada sobre o Controle de versão', state.collapsed, true)
  ok('é ELE que fica em repouso', state.resting?.startsWith('Controle de versão'), true)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  state = await sidebar()
  ok(
    'Ctrl+B volta para o Controle de versão, não para o Explorador',
    state.showing?.startsWith('Ocultar Controle de versão'),
    true
  )
  await page.screenshot({ path: '.playwright-mcp/sidebar-03-scm-restored.png' })

  // ─── 5b. A largura sobrevive ao fechar, ao reabrir e ao relançar ──────────
  // Os frames do deslize passam por larguras que ninguém escolheu; gravar uma
  // delas faz a lateral reabrir como uma tira. Aqui a conta é feita contra a
  // biblioteca de verdade, que é a única que produz esses frames.
  await page.locator('.wb-rail-view').first().click()
  await page.waitForTimeout(500)
  const handle = await page.locator('[data-separator]').first().boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 150, handle.y + handle.height / 2, {
    steps: 12
  })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const dragged = await read(() => Math.round(document.querySelector('#rail').getBoundingClientRect().width))
  ok('o arrasto alargou a lateral', dragged > 420, true)

  await page.keyboard.press('Control+b')
  await page.waitForTimeout(600)
  const storedRail = await read(() => {
    const raw = localStorage.getItem('hive.workspaceSession')
    return Math.round(JSON.parse(raw)['/ws'].layout.rail)
  })
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(600)
  ok(
    'fechar e reabrir devolve a MESMA largura',
    await read(() => Math.round(document.querySelector('#rail').getBoundingClientRect().width)),
    dragged
  )
  ok('e o que ficou gravado é a largura, não um frame do deslize', storedRail > 28, true)

  // ─── 6. Releitura do app com sessão gravada ───────────────────────────────
  await page.addInitScript(() => {
    localStorage.setItem(
      'hive.__seedChat',
      JSON.stringify([
        {
          id: 's1',
          title: 'PRD do checkout',
          agent: 'claude-cli',
          updatedAt: Date.now(),
          cliSessionId: null,
          messages: [
            { id: 'm0', role: 'user', text: 'Vamos escrever a PRD do checkout.' },
            { id: 'm1', role: 'assistant', text: 'Perfeito — comecei pelo problema e pelas metas.' }
          ]
        }
      ])
    )
  })
  await relaunchWith({
    savedAt: Date.now(),
    tabs: [
      { path: 'docs/prd.md', pinned: true },
      { path: 'README.md', pinned: false }
    ],
    activeTab: 'README.md',
    expanded: ['docs'],
    chatSessionId: 's1',
    sidebarView: 'explorer',
    sidebarOpen: true,
    layout: null
  })
  ok(
    'restaurou as abas na ordem',
    await read(() => Array.from(document.querySelectorAll('.wb-tab-name')).map((e) => e.textContent)),
    ['prd.md', 'README.md']
  )
  ok(
    'a aba ativa é a que estava na frente',
    await read(() => document.querySelector('.wb-tab[aria-selected="true"] .wb-tab-name')?.textContent),
    'README.md'
  )
  ok(
    'a aba fixada voltou fixada (sem itálico de preview)',
    await read(() => {
      const tab = Array.from(document.querySelectorAll('.wb-tab')).find((el) =>
        el.textContent?.includes('prd.md')
      )
      return tab ? getComputedStyle(tab).fontStyle : '⌀'
    }),
    'normal'
  )
  ok(
    'a pasta gravada voltou aberta',
    await read(() => {
      const rows = Array.from(document.querySelectorAll('.wb-rail-scroll .hds-tree-row'))
      const docs = rows.find((row) => row.textContent?.trim().startsWith('docs'))
      return docs?.closest('[aria-expanded]')?.getAttribute('aria-expanded') ?? '⌀'
    }),
    'true'
  )
  ok(
    'a conversa gravada voltou para a tela',
    await read(() => document.body.innerText.includes('Vamos escrever a PRD do checkout')),
    true
  )
  await page.screenshot({ path: '.playwright-mcp/sidebar-04-restored.png' })

  // ─── 7. Uma aba cujo arquivo sumiu não volta ──────────────────────────────
  // `docs/apagado.md` não está na árvore do fixture, e o `fs.exists` do boot
  // responde a partir dela — é exatamente o arquivo apagado entre execuções.
  await relaunchWith({
    savedAt: Date.now(),
    tabs: [{ path: 'docs/apagado.md', pinned: true }],
    activeTab: 'docs/apagado.md',
    expanded: [],
    chatSessionId: null,
    sidebarView: 'explorer',
    sidebarOpen: false,
    layout: null
  })
  ok(
    'o arquivo que não existe mais não reabre (e não vira erro)',
    await read(() => ({
      tabs: document.querySelectorAll('.wb-tab-name').length,
      alerts: document.querySelectorAll('[role="alert"]').length
    })),
    { tabs: 0, alerts: 0 }
  )

  return log.join('\n')
}
