// Run boot.mjs first through the Playwright MCP. This pass uses the real renderer
// with an isolated bridge fixture; Electron E2E covers the same flows against disk.
async (page) => {
  const output = '/tmp/hive-navigation-artifacts'
  const report = { screenshots: [], checks: [], contrast: [], errors: [], failures: [] }
  globalThis.navigationReport = report
  page.on('pageerror', (error) => report.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text())
  })
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload()
  await page.getByRole('tab', { name: 'Chat', exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    const now = Date.now()
    const day = 86_400_000
    const titles = ['Planejamento do próximo ciclo', 'Revisão da arquitetura', 'Pesquisa com clientes', 'Preparar apresentação', 'Notas da equipe']
    window.__navSessions = Array.from({ length: 16 }, (_, index) => ({
      id: `nav-${index}`, title: titles[index % titles.length] + (index >= 5 ? ` · ${index}` : ''),
      createdAt: now - (index + 1) * day, updatedAt: now - index * day,
      agent: 'claude-cli', messageCount: index + 2, preview: `Conteúdo da conversa ${index}`
    }))
    window.hive.chatHistory.list = async () => window.__navSessions
    window.hive.chatHistory.search = async (_ws, query) => window.__navSessions.filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()))
    window.hive.chatHistory.rename = async (_ws, id, title) => {
      window.__navSessions = window.__navSessions.map((entry) => entry.id === id ? { ...entry, title } : entry)
      return window.__navSessions.find((entry) => entry.id === id)
    }
    window.hive.chatHistory.delete = async (_ws, id) => { window.__navSessions = window.__navSessions.filter((entry) => entry.id !== id) }
  })
  // The archive refreshes the shared store when opened.
  await page.getByRole('button', { name: /Ver todas as conversas/ }).click()
  await page.locator('.wb-allconv .wb-history-row-name').first().waitFor()
  await page.keyboard.press('Escape')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  const check = (name, passed, detail) => {
    report.checks.push({ name, passed, detail })
    if (!passed) report.failures.push(name)
  }
  const screenshot = async (name) => {
    const filename = `${output}/${name}.png`
    await page.screenshot({ path: filename })
    report.screenshots.push(filename)
  }
  const measure = async (theme, selectors) => {
    const values = await page.evaluate((selectors) => {
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      const rgb = (value) => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v)
      }
      const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])).concat(1)
      const ground = (element) => {
        const layers = []
        for (let current = element; current; current = current.parentElement) {
          const value = rgb(getComputedStyle(current).backgroundColor)
          layers.push(value)
          if (value[3] === 1) break
        }
        return layers.reverse().reduce((bg, fg) => over(fg, bg), [255, 255, 255, 1])
      }
      const lum = (color) => color.slice(0, 3).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
      return selectors.map(([selector, floor]) => {
        const element = document.querySelector(selector)
        if (!element) return { selector, floor, missing: true }
        const bg = ground(element)
        const fg = over(rgb(getComputedStyle(element).color), bg)
        const a = lum(bg), b = lum(fg)
        return { selector, floor, ratio: Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100 }
      })
    }, selectors)
    for (const value of values) {
      report.contrast.push({ theme, ...value })
      if (value.missing || value.ratio < value.floor) report.failures.push(`${theme}: ${value.selector} contrast`)
    }
  }
  for (const [theme, label] of [['dark', 'Escuro'], ['light', 'Claro'], ['hive', 'Hive']]) {
    await page.getByRole('button', { name: /^Escolha do tema/ }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click()
    await page.locator('body').click({ position: { x: 900, y: 20 } })
    await screenshot(`${theme}-1440-chat`)
    await measure(theme, [
      ['.wb-navbar-btn', 3], ['.wb-workspace-chip-name', 4.5], ['.wb-sidebar-tab[data-active]', 4.5],
      // The INACTIVE tab too. Measuring only the active one is how a 4.34:1
      // label shipped: the pair sits on its own darker track, so the quiet half
      // is the half at risk, and it was the one nobody sampled.
      ['.wb-sidebar-tab:not([data-active])', 4.5],
      ['.wb-newconv-text', 4.5], ['.wb-nav-item-label', 4.5], ['.wb-sidebar-group-label', 4.5],
      ['.wb-conv-control-value', 4.5], ['.wb-history-row-name', 4.5], ['.wb-history-row-meta', 4.5],
      ['.wb-chatside-all-text', 4.5], ['.wb-usermenu-name', 4.5], ['.wb-usermenu-role', 4.5]
    ])
    await page.getByRole('button', { name: /Ver todas as conversas/ }).click()
    await page.locator('.wb-allconv .wb-history-row-name').first().waitFor()
    await screenshot(`${theme}-1440-history`)
    await measure(theme, [['.wb-allconv-title', 4.5], ['.wb-allconv-desc', 4.5], ['.wb-allconv-count', 4.5]])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Menu do usuário: Gustavo' }).click()
    await measure(theme, [['.wb-usermenu-head-name', 4.5], ['.wb-usermenu-head-role', 4.5], ['.wb-menu-item-sub', 4.5]])
    await page.keyboard.press('Escape')
  }
  for (const width of [1440, 1024, 800, 640]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 })
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('.wb-navbar').getBoundingClientRect()
      const pane = document.querySelector('[data-navtop]').getBoundingClientRect()
      const send = document.querySelector('.hds-prompt-input-send').getBoundingClientRect()
      const controls = [...document.querySelectorAll('.wb-conv-control')].map((el) => el.getBoundingClientRect())
      return { navRight: nav.right, paneRight: pane.right, sendRight: send.right, viewport: innerWidth,
        filtersFit: controls.every((box) => box.right <= pane.right), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    check(`geometry ${width}`, geometry.navRight <= geometry.paneRight + 1 && geometry.sendRight <= width && geometry.filtersFit && !geometry.overflow, geometry)
    await screenshot(`hive-${width}-chat`)
    await page.getByRole('button', { name: 'Ocultar barra lateral', exact: true }).click()
    await page.getByRole('button', { name: 'Menu do usuário: Gustavo' }).click()
    check(`collapsed user menu ${width}`, await page.locator('.wb-usermenu-head-name').isVisible())
    await page.keyboard.press('Escape')
    await screenshot(`hive-${width}-collapsed`)
    await page.getByRole('button', { name: 'Exibir barra lateral', exact: true }).click()
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  // Real state surfaces, with only the disk response controlled by the fixture.
  const archive = page.locator('.wb-allconv')
  await page.evaluate(() => { window.hive.chatHistory.list = () => new Promise((resolve) => { window.__navResolve = resolve }) })
  await page.getByRole('button', { name: /Ver todas as conversas/ }).click()
  await archive.getByRole('status', { name: 'Carregando conversas…' }).waitFor()
  check('history loading', true)
  await page.evaluate(() => window.__navResolve([]))
  await archive.getByText('Nenhuma conversa ainda', { exact: true }).waitFor()
  check('history empty', true)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.hive.chatHistory.list = async () => { throw new Error('fixture read failure') } })
  await page.getByRole('button', { name: /Ver todas as conversas/ }).click()
  await archive.getByRole('alert').waitFor()
  check('history read error', true)
  await screenshot('history-error')
  await page.evaluate(() => { window.hive.chatHistory.list = async () => window.__navSessions })
  await archive.getByRole('button', { name: 'Tentar de novo' }).click()
  await archive.locator('.wb-history-row-name').first().waitFor()
  check('history retry', true)
  await page.keyboard.press('Escape')
  // --- the chat tools open in the WORK pane, not over the history ----------
  await page.setViewportSize({ width: 1440, height: 900 })
  const activeWork = () => page.locator('.wb-work-layer[data-active]').getAttribute('data-view')
  const historyVisible = () => page.locator('.wb-chatside').isVisible()
  await page.getByRole('button', { name: 'Revisão do agente', exact: true }).click()
  await page.locator('.wb-work-layer[data-view="review"][data-active]').waitFor()
  check('review opens in the work pane', await activeWork() === 'review')
  check('history survives a tool', await historyVisible())
  const headings = await page.locator('.wb-pane-header-label, .wb-review-panel-title').allInnerTexts()
  check('no duplicated panel title', headings.filter((h) => /REVIS/i.test(h)).length === 1, headings)
  await screenshot('work-review')
  await measure('hive', [['.wb-pane-header-label', 4.5], ['.wb-history-row-name', 4.5]])
  // The pane carries its own way out, and it is not hover-revealed.
  const closeBtn = page.getByRole('button', { name: /^Fechar Revisão do agente/ })
  check('close button is always visible', await closeBtn.isVisible())
  await closeBtn.click()
  check('close returns the transcript', await activeWork() === 'chat')

  await page.getByRole('button', { name: 'Bases de conhecimento', exact: true }).click()
  await page.locator('.wb-work-layer[data-view="brain"][data-active]').waitFor()
  check('knowledge base opens in the work pane', await activeWork() === 'brain')
  check('history survives the second tool', await historyVisible())
  await screenshot('work-brain')
  // The row is a toggle: pressing the one in front returns the transcript.
  await page.getByRole('button', { name: 'Ocultar Bases de conhecimento' }).click()
  check('row toggles back to the transcript', await activeWork() === 'chat')

  // The account row reads as a control: a caret that turns while the menu is up.
  const caret = page.locator('.wb-usermenu-caret')
  check('account caret present', await caret.count() === 1)
  await page.getByRole('button', { name: 'Menu do usuário: Gustavo' }).click()
  await page.locator('.wb-usermenu-head-name').waitFor()
  await screenshot('account-menu-open')
  check('caret turns while open', (await caret.evaluate((el) => getComputedStyle(el).transform)) !== 'none')
  await page.keyboard.press('Escape')

  // The navbar's second control is workspace search, not a shortcut to a tab.
  const navSearch = page.locator('.wb-navbar').getByRole('button', { name: 'Buscar arquivos no workspace' })
  check('navbar carries search', await navSearch.count() === 1)
  check('navbar has no explorer shortcut',
    await page.locator('.wb-navbar').getByRole('button', { name: 'Explorador de arquivos' }).count() === 0)
  await navSearch.click()
  await page.getByPlaceholder('Buscar arquivos no workspace…').waitFor()
  check('search opens from the navbar', true)
  await screenshot('navbar-search')
  await page.keyboard.press('Escape')

  check('console and runtime', report.errors.length === 0, report.errors)
  return report
}
