// Functional + visual pass for the 2026-09-12 round: the seven reported
// defects, each driven through the real UI and *measured*, not eyeballed.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   node tools/visual/run-scene.mjs tools/visual/round-2026-09-12.mjs
//   HIVE_THEME=light node tools/visual/run-scene.mjs tools/visual/round-2026-09-12.mjs
//
// Every check returns `{ ok, … }` so a red result is unmistakable in the
// output — a pass that only returns data reads as "fine" to anyone skimming,
// which is exactly how `claude-signin-pass.mjs` stayed broken.
//
// `HIVE_SHOT_DIR` writes one screenshot per step.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const shots = globalThis.HIVE_SHOT_DIR || null
  const results = {}
  const shot = async (name) => {
    if (shots) await page.screenshot({ path: `${shots}/${name}-${theme}.png` })
  }

  // A workspace with NO stored session — the first-open case item 3 is about —
  // and a legacy global left behind by a build that predates the Chat tab.
  // Seeded conversations give the selection something to act on.
  await page.addInitScript(() => {
    localStorage.removeItem('hive.workspaceSession')
    localStorage.setItem('hive.sidebarView', 'scm')
    localStorage.setItem(
      'hive.__seedChat',
      JSON.stringify(
        ['Revisar o PRD', 'Plano de testes', 'Refatorar o explorer', 'Notas da sprint'].map(
          (title, index) => ({
            id: `seed-${index}`,
            title,
            agent: 'claude-cli',
            updatedAt: Date.now() - index * 3_600_000,
            cliSessionId: `cli-${index}`,
            messages: [
              { id: `${index}-u`, role: 'user', text: title, at: Date.now() },
              { id: `${index}-a`, role: 'assistant', text: 'Feito.', at: Date.now() }
            ]
          })
        )
      )
    )
  })

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }
  await page.reload()
  await page.waitForTimeout(900)

  // ---------------------------------------------------------------- item 3
  // A workspace nobody has opened before lands on Chat & Cowork with the
  // transcript in front — never on whatever an old global names.
  results.firstOpen = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find(
      (node) => node.getAttribute('aria-selected') === 'true'
    )
    const chatVisible = document.querySelector('.wb-work-layer[data-view="chat"][data-active]')
    return {
      ok: tab?.textContent === 'Chat & Cowork' && chatVisible !== null,
      tab: tab?.textContent ?? null,
      workView:
        document.querySelector('.wb-work-layer[data-active]')?.getAttribute('data-view') ?? null
    }
  })
  await shot('r-1-first-open')

  // ---------------------------------------------------------------- item 1
  // With the sidebar away the conversation is the only pane, so the pane's
  // layout chrome (grip + name + ↔) has nothing to refer to and goes.
  const chromeOf = () =>
    page.evaluate(() => ({
      header: document.querySelector('.wb-pane-header') !== null,
      grip: document.querySelector('.wb-pane-grip') !== null,
      move: document.querySelector('.wb-pane-move-btn') !== null
    }))
  const withSidebar = await chromeOf()
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  const soloChrome = await chromeOf()
  results.soloPane = {
    ok:
      withSidebar.grip &&
      withSidebar.move &&
      !soloChrome.header &&
      !soloChrome.grip &&
      !soloChrome.move,
    withSidebar,
    solo: soloChrome
  }
  await shot('r-2-solo-pane')

  // …but a panel COVERING the conversation keeps its header: the title names
  // what you are looking at and the ✕ is the way back. Only the layout
  // affordances go — and the strip must not offer the grab cursor either.
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Revisão do agente', exact: true }).click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  results.soloWithPanel = await page.evaluate(() => {
    const header = document.querySelector('.wb-pane-header')
    return {
      ok:
        header !== null &&
        header.querySelector('.wb-pane-grip') === null &&
        document.querySelector('.wb-pane-move-btn') === null &&
        getComputedStyle(header).cursor === 'default' &&
        document.querySelector('.wb-pane-header-primary button') !== null,
      title: header?.querySelector('.wb-pane-header-label')?.textContent ?? null,
      cursor: header ? getComputedStyle(header).cursor : null,
      hasClose: document.querySelector('.wb-pane-header-primary button') !== null
    }
  })
  await shot('r-2b-solo-panel')
  // Back to the conversation, sidebar showing, for the steps below.
  const close = page.locator('.wb-pane-header-primary button').first()
  if ((await close.count()) > 0) await close.click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)

  // ---------------------------------------------------------------- item 6
  // Switching agents must never show the previous agent's models. The probe
  // makes the detection *slow* so the window it used to lie in is wide open,
  // then reads what the control offers while it is in flight.
  await page.evaluate(() => {
    const real = window.hive.agent.capabilities
    window.hive.agent.capabilities = (...args) =>
      new Promise((resolve) => setTimeout(() => resolve(real(...args)), 700))
  })
  await page.locator('.wb-agent-pill-btn').first().click()
  await page.waitForTimeout(250)
  await page.getByRole('menuitemradio', { name: /Devin/ }).first().click()
  await page.waitForTimeout(200)
  results.engineSwitch = await page.evaluate(() => {
    const loading = document.querySelector('.wb-engine-btn-loading')
    const trigger = document.querySelector('.wb-engine-btn:not(.wb-engine-btn-loading)')
    return {
      // While detection is in flight there is a loading control and NO model
      // name — the failure this replaces was Claude's rows under Devin's name.
      ok: loading !== null && trigger === null,
      loading: loading !== null,
      busy: loading?.getAttribute('aria-busy') ?? null,
      label: loading?.getAttribute('aria-label') ?? null,
      staleTrigger: trigger?.textContent ?? null
    }
  })
  await shot('r-3-engine-loading')
  await page.waitForTimeout(900)
  results.engineSettled = await page.evaluate(() => {
    const trigger = document.querySelector('.wb-engine-btn')
    return {
      ok: trigger !== null && !trigger.classList.contains('wb-engine-btn-loading'),
      label: trigger?.textContent ?? null
    }
  })

  // ---------------------------------------------------------------- item 4+5
  // A turn that dies signed-out: the sentence and its repair must not be glued
  // together, and the repair must FINISH — banner gone, question re-sent —
  // however the sign-in landed.
  await page.evaluate(() => {
    window.__sends = 0
    const send = window.hive.agent.send
    window.hive.agent.send = (...args) => {
      window.__sends += 1
      return send(...args)
    }
    // The sign-in the user actually does: it lands (the account is good) but
    // the CLI's own promise never says so — a killed timeout, a slow browser
    // tab. This is the case the old code could not recover from.
    window.hive.claudeAuth.login = () =>
      new Promise((resolve) => {
        setTimeout(() => {
          window.__claude.status({
            state: 'connected',
            account: { loggedIn: true, email: 'gustavo@fitame.dev', subscription: 'max' }
          })
          window.__claude.login({ phase: 'success' })
          resolve({ ok: false, reason: 'failed', message: 'exit 1' })
        }, 400)
      })
    window.__claude.status({ state: 'signed-out', account: null })
  })
  await page.reload()
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    window.__sends = 0
    const send = window.hive.agent.send
    window.hive.agent.send = (...args) => {
      window.__sends += 1
      return send(...args)
    }
    window.hive.claudeAuth.login = () =>
      new Promise((resolve) => {
        setTimeout(() => {
          window.__claude.status({
            state: 'connected',
            account: { loggedIn: true, email: 'gustavo@fitame.dev', subscription: 'max' }
          })
          window.__claude.login({ phase: 'success' })
          resolve({ ok: false, reason: 'failed', message: 'exit 1' })
        }, 400)
      })
    window.__claude.status({ state: 'signed-out', account: null })
  })

  const composer = page.locator('.hds-prompt-input-textarea').first()
  await composer.click()
  await composer.fill('Resuma o PRD em três linhas')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const sentFirst = await page.evaluate(() => window.__sends)
  await page.evaluate(() =>
    window.__agentEvent({ type: 'error', message: 'claude-auth:signed-out' })
  )
  await page.waitForTimeout(300)
  results.banner = await page.evaluate(() => {
    const alert = document.querySelector('.wb-turnfix')
    const text = alert?.querySelector('.wb-turnfix-text')
    const cta = alert?.querySelector('.wb-turnfix-cta')
    // The defect was a missing space in the RENDERED text, so measure the
    // rendered text — and the gap that has to produce it.
    const rendered = alert?.innerText.replace(/\s+/g, ' ').trim() ?? ''
    const textBox = text?.getBoundingClientRect()
    const ctaBox = cta?.getBoundingClientRect()
    const gap =
      textBox && ctaBox
        ? ctaBox.top >= textBox.bottom
          ? ctaBox.top - textBox.bottom // wrapped to its own line
          : ctaBox.left - textBox.right
        : null
    return {
      ok: !rendered.includes('parou.Conectar') && gap !== null && gap >= 8,
      rendered,
      gap,
      icon: alert?.querySelector('.hds-alert-icon') !== null
    }
  })
  await shot('r-4-banner')

  await page.getByRole('button', { name: 'Conectar conta' }).click()
  await page.waitForTimeout(150)
  results.bannerBusy = await page.evaluate(() => {
    const cta = document.querySelector('.wb-turnfix-cta')
    return {
      ok: cta?.getAttribute('aria-disabled') === 'true',
      label: cta?.textContent?.trim() ?? null,
      spinner: cta?.querySelector('.wb-turnfix-spinner') !== null
    }
  })
  await page.waitForTimeout(1200)
  results.repair = await page.evaluate(() => {
    const gone = document.querySelector('.wb-turnfix') === null
    return {
      // The repair is finished only when the false statement is off screen AND
      // the question the user asked is on its way again.
      ok: gone && window.__sends >= 2,
      bannerGone: gone,
      sends: window.__sends
    }
  })
  results.repair.sentFirst = sentFirst
  await shot('r-5-repaired')

  // ---------------------------------------------------------------- item 7
  // The context reading belongs to the conversation: moving between two of
  // them must not blank the meter.
  await page.evaluate(() => {
    window.__agentEvent({
      type: 'usage',
      final: true,
      usage: {
        inputTokens: 24_000,
        outputTokens: 800,
        cacheReadTokens: 61_000,
        cacheCreationTokens: 3_000,
        contextWindow: 200_000,
        model: 'claude-opus-5'
      }
    })
  })
  await page.waitForTimeout(300)
  const meterText = () =>
    page.evaluate(
      () => document.querySelector('.wb-ctx-meter-value')?.textContent?.trim() ?? null
    )
  const measured = await meterText()
  // Row 0 is the conversation just used (the list is newest-first); row 1 is a
  // seeded one that has never reported usage. Both must keep the meter on
  // screen, and coming back must bring the number back.
  await page.locator('[data-history-open]').nth(1).click()
  await page.waitForTimeout(700)
  const otherConversation = await meterText()
  await shot('r-6-meter-other')
  await page.locator('[data-history-open]').first().click()
  await page.waitForTimeout(700)
  const afterReturn = await meterText()
  results.meter = {
    ok:
      measured !== null &&
      measured !== '0%' &&
      // The one thing the old code did wrong: the control disappeared.
      otherConversation !== null &&
      // …and the one thing that proves the reading is kept per conversation.
      afterReturn === measured,
    measured,
    otherConversation,
    afterReturn
  }

  // ---------------------------------------------------------------- item 2
  // Multi-select and bulk delete in the history.
  const rowCount = () => page.locator('.wb-history-row').count()
  const startRows = await rowCount()
  await page.locator('.wb-history-check').first().click({ force: true })
  await page.waitForTimeout(200)
  // Shift on the third box takes everything between it and the first.
  await page.locator('.wb-history-check').nth(2).click({ force: true, modifiers: ['Shift'] })
  await page.waitForTimeout(200)
  results.selection = await page.evaluate(() => {
    const bar = document.querySelector('.wb-history-selbar')
    return {
      ok:
        bar !== null &&
        document.querySelectorAll('.wb-history-row[data-selected]').length === 3 &&
        // The visible count is short so it survives a 280px column; the
        // accessible name is the full sentence, and both have to say three.
        /3 selecionadas/.test(bar.textContent ?? '') &&
        bar.getAttribute('aria-label') === '3 conversas selecionadas',
      count: document.querySelectorAll('.wb-history-row[data-selected]').length,
      bar: bar?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      ariaLabel: bar?.getAttribute('aria-label') ?? null,
      // Every row shows its box once a selection exists.
      boxesVisible: [...document.querySelectorAll('.wb-history-check')].every(
        (node) => getComputedStyle(node).opacity === '1'
      )
    }
  })
  await shot('r-7-selection')

  await page.getByRole('button', { name: 'Excluir', exact: true }).first().click()
  await page.waitForTimeout(250)
  results.bulkConfirm = await page.evaluate(() => {
    const bar = document.querySelector('.wb-history-selbar')
    const list = bar?.parentElement
    // Width is measured HERE, not only in the selection state: asking adds a
    // question and a second button to a bar that already fitted, and that is
    // exactly where "Cancelar" went off its own edge.
    const buttons = [...(bar?.querySelectorAll('button') ?? [])]
    const barBox = bar?.getBoundingClientRect()
    const listBox = list?.getBoundingClientRect()
    return {
      ok:
        /Excluir 3 conversas\?/.test(bar?.textContent ?? '') &&
        barBox !== undefined &&
        listBox !== undefined &&
        barBox.right <= listBox.right + 1 &&
        // Every control whole: a clipped "Cancelar" is a way out nobody finds.
        buttons.length > 0 &&
        buttons.every((node) => node.scrollWidth <= node.clientWidth + 1 && node.getBoundingClientRect().right <= listBox.right + 1),
      question: bar?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      buttons: buttons.map((node) => node.textContent?.trim()),
      overflow: barBox && listBox ? Math.round(barBox.right - listBox.right) : null,
      // The wrapped layout exists so nothing has to be cut in a 280px column.
      promptClipped: (() => {
        const node = bar?.querySelector('.hds-selbar-prompt')
        return node ? node.scrollWidth > node.clientWidth + 1 : null
      })(),
      lines: barBox ? Math.round(barBox.height) : null
    }
  })
  await shot('r-8-bulk-confirm')
  await page.locator('.wb-history-selbar .wb-history-confirm-btn[data-danger]').click()
  await page.waitForTimeout(700)
  const endRows = await rowCount()
  results.bulkDelete = {
    ok: endRows === startRows - 3,
    startRows,
    endRows,
    barGone: (await page.locator('.wb-history-selbar').count()) === 0
  }
  await shot('r-9-after-delete')

  const failures = Object.entries(results)
    .filter(([, value]) => value && value.ok === false)
    .map(([name]) => name)
  return { theme, failures, results }
}
