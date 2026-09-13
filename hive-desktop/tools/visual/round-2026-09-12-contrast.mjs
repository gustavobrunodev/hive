// Contrast + structure probe for the surfaces the 2026-09-12 round introduced,
// across the three themes:
//
//   · the selection bar over the conversation history (tint + count + the bulk
//     delete + the ✕), and a ticked row;
//   · the dead-turn banner and its repair button (accent fill inside a danger
//     tint — a pairing nothing in this app had measured before);
//   · the engine picker's loading control.
//
//   node tools/visual/run-scene.mjs tools/visual/round-2026-09-12-contrast.mjs
//
// Method is the house one (docs/visual-validation.md): resolve every colour
// through a canvas (Chromium serialises `oklch()`/`color-mix()` verbatim and a
// regex reads those numbers as near-black), composite alpha over the real
// stack, and kill transitions before measuring.
async (page) => {
  const THEMES = [
    ['escuro', null],
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]

  // [label, ink selector, 'self' | 'parent', floor]
  const TEXT = [
    ['contagem da barra de seleção', '.wb-history-selbar .hds-selbar-count', 'self', 4.5],
    ['botão Excluir da barra', '.wb-history-selbar .wb-history-bulk-btn', 'self', 4.5],
    ['título de uma linha marcada', '.wb-history-row[data-selected] .wb-history-row-name', 'parent', 4.5],
    ['meta de uma linha marcada', '.wb-history-row[data-selected] .wb-history-row-meta', 'parent', 4.5],
    // The same tint the ACTIVE row has always used — measured here so a
    // failure on the selected row cannot be mistaken for a new regression.
    ['meta da linha atual', '.wb-history-row[data-active] .wb-history-row-meta', 'parent', 4.5],
    ['frase do turno morto', '.wb-turnfix-text', 'parent', 4.5],
    ['botão Conectar conta', '.wb-turnfix-cta', 'self', 4.5]
  ]
  // Marks and controls: 3:1.
  const MARKS = [
    ['✕ da barra de seleção', '.wb-history-selbar .hds-selbar-dismiss', 'parent', 3],
    ['marca da conta no banner', '.wb-turnfix .hds-alert-icon', 'parent', 3],
    // 'self': a checked box is a filled accent plate, and measuring its tick
    // against the row behind it flatters a plate that hides its own glyph.
    ['caixa marcada de uma linha', '.wb-history-row[data-selected] .hds-checkbox-indicator', 'self', 3]
  ]
  // Plates: a surface that exists to hold its content apart from what is behind.
  const PLATES = [
    ['barra de seleção vs. a lista', '.wb-history-selbar', 1.08],
    ['linha marcada vs. a lista', '.wb-history-row[data-selected]', 1.08],
    ['botão Excluir vs. a barra', '.wb-history-bulk-btn', 1.08]
  ]

  const measure = (targets) =>
    page.evaluate(
      ({ text, marks, plates, structure }) => {
        const kill = document.createElement('style')
        kill.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'
        document.head.append(kill)
        const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
        const parse = (value) => {
          if (value === '' || value === 'none') return null
          paint.clearRect(0, 0, 1, 1)
          paint.fillStyle = '#000'
          paint.fillStyle = value
          paint.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
          return { rgb: [r, g, b], a: a / 255 }
        }
        const lum = (rgb) => {
          const [r, g, b] = rgb.map((c) => {
            const v = c / 255
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const ratio = (a, b) => {
          const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p)
          return (hi + 0.05) / (lo + 0.05)
        }
        const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
        const groundOf = (el) => {
          const stack = []
          for (let node = el; node; node = node.parentElement) {
            const style = getComputedStyle(node)
            // `background-image` carries the flat tint a sticky element needs
            // to be opaque; a probe that only reads `background-color` measures
            // the layer underneath it.
            for (const value of [style.backgroundImage.match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/)?.[0], style.backgroundColor]) {
              const bg = parse(value ?? '')
              if (!bg || bg.a === 0) continue
              if (bg.a >= 0.999) {
                let out = bg.rgb
                for (const tint of stack.reverse()) out = over(tint, out)
                return out
              }
              stack.push(bg)
            }
          }
          return [0, 0, 0]
        }

        const rows = []
        for (const [label, sel, mode, floor] of [...text, ...marks]) {
          const el = document.querySelector(sel)
          if (!el) {
            rows.push({ label, missing: true, ok: false })
            continue
          }
          const ink = parse(getComputedStyle(el).color)
          const ground = groundOf(mode === 'self' ? el : el.parentElement)
          const r = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }
        for (const [label, sel, floor] of plates) {
          const el = document.querySelector(sel)
          if (!el) {
            rows.push({ label, missing: true, ok: false })
            continue
          }
          const r = ratio(groundOf(el), groundOf(el.parentElement))
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }

        if (structure) {
          // Contrast cannot see any of this.
          const count = document.querySelector('.hds-selbar-count')
          rows.push({
            label: 'a contagem não é cortada na coluna de 280px',
            detail: count ? `${count.scrollWidth} / ${count.clientWidth}` : null,
            ok: count !== null && count.scrollWidth <= count.clientWidth + 1
          })
          const bar = document.querySelector('.wb-history-selbar')
          const list = bar?.parentElement
          rows.push({
            label: 'a lista rola (a barra está na sua largura mais apertada)',
            detail: list ? `${list.scrollHeight} > ${list.clientHeight}` : null,
            ok: list !== null && list !== undefined && list.scrollHeight > list.clientHeight
          })
          rows.push({
            label: 'a barra cabe na largura da lista',
            detail: bar && list ? `${Math.round(bar.getBoundingClientRect().width)} / ${Math.round(list.getBoundingClientRect().width)}` : null,
            ok:
              bar !== null &&
              list !== null &&
              bar.getBoundingClientRect().width <= list.getBoundingClientRect().width + 1
          })
          // The bar is sticky, so it has to be opaque — rows scrolling through
          // a translucent toolbar is the defect the CSV header already paid for.
          rows.push({
            label: 'a barra pegajosa é opaca',
            detail: bar ? getComputedStyle(bar).backgroundImage.slice(0, 40) : null,
            ok: bar !== null && getComputedStyle(bar).backgroundColor !== 'rgba(0, 0, 0, 0)'
          })
          // The banner's sentence and its button are siblings with a real gap:
          // the whole defect was a `gap` spent one level too high in the tree.
          const text = document.querySelector('.wb-turnfix-text')
          const cta = document.querySelector('.wb-turnfix-cta')
          const a = text?.getBoundingClientRect()
          const b = cta?.getBoundingClientRect()
          const gap = a && b ? (b.top >= a.bottom ? b.top - a.bottom : b.left - a.right) : null
          rows.push({ label: 'o texto e o botão do banner têm folga ≥8px', detail: gap, ok: gap !== null && gap >= 8 })
          // The loading control must not resize the toolbar when it settles.
          const skel = document.querySelector('.wb-engine-btn-loading')
          rows.push({
            label: 'o esqueleto do seletor tem a altura do controle real',
            detail: skel ? Math.round(skel.getBoundingClientRect().height) : null,
            ok: skel !== null && Math.round(skel.getBoundingClientRect().height) === 26
          })
        }

        kill.remove()
        return rows
      },
      targets
    )

  // --- the scene: a selection, a dead turn, and a loading engine control ----
  const scene = async () => {
    // A failed turn, so the banner is on screen.
    const composer = page.locator('.hds-prompt-input-textarea').first()
    if ((await page.locator('.wb-turnfix').count()) === 0) {
      await composer.click()
      await composer.fill('Resuma o PRD')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(350)
      await page.evaluate(() =>
        window.__agentEvent({ type: 'error', message: 'claude-auth:signed-out' })
      )
      await page.waitForTimeout(250)
    }
    // Two ticked rows, so the bar and a selected row are both measurable.
    if ((await page.locator('.wb-history-selbar').count()) === 0) {
      await page.locator('.wb-history-check').first().click({ force: true })
      await page.locator('.wb-history-check').nth(1).click({ force: true })
      await page.waitForTimeout(250)
    }
  }

  await page.addInitScript(() => {
    // The harness seeds a session pinned to the Explorer; this probe needs the
    // Chat tab, which is where the conversation list lives. Dropping the stored
    // session is also the first-run state, so no second knob is needed.
    localStorage.removeItem('hive.workspaceSession')
    localStorage.removeItem('hive.sidebarView')
    // The engine detection never answers, so the picker's loading control is on
    // screen for the whole probe. Driving it by *switching agents* instead
    // cannot work here: the switcher locks the moment a conversation has a
    // message, and this scene needs a failed turn.
    const hang = () => {
      if (!window.hive?.agent) return
      window.hive.agent.capabilities = () => new Promise(() => {})
    }
    hang()
    localStorage.setItem(
      'hive.__seedChat',
      // Enough rows to force a scrollbar in the 280px column: the bar is sticky
      // inside that scroller, and the ~8px the scrollbar takes is exactly what
      // made "3 conversas selecionadas" truncate. A scene without a scroller
      // measures a bar that is never as narrow as the real one.
      JSON.stringify(
        [
          'Revisar o PRD',
          'Plano de testes',
          'Refatorar o explorer',
          'Notas da sprint',
          'Arquitetura do checkout',
          'Pesquisa de domínio',
          'Roteiro da release',
          'Bugs do viewer'
        ].map((title, index) => ({
          id: `seed-${index}`,
          title,
          agent: 'claude-cli',
          updatedAt: Date.now() - index * 3_600_000,
          cliSessionId: null,
          messages: [{ id: `${index}-u`, role: 'user', text: title, at: Date.now() }]
        }))
      )
    )
  })
  await page.reload()
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__claude.status({ state: 'signed-out', account: null }))

  const report = {}
  for (const [name, menuLabel] of THEMES) {
    if (menuLabel !== null) {
      await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
      await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
      await page.waitForTimeout(320)
    }
    await scene()
    report[name] = await measure({ text: TEXT, marks: MARKS, plates: PLATES, structure: true })
  }
  const failures = Object.entries(report).flatMap(([theme, rows]) =>
    rows.filter((row) => row.ok === false).map((row) => `${theme}: ${row.label} ${row.ratio ?? row.detail ?? 'ausente'}`)
  )
  return { failures, report }
}
