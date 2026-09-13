// A menu opened from inside a modal must not take the modal with it.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_THEME=dark node tools/visual/run-scene.mjs tools/visual/modal-menu-pass.mjs
//   (repeat for light and hive — the pass is only closed when all three are)
//
// The reported failure: open "Nova skill" in the Estúdio, click the agent
// selector twice, and the whole dialog closes with the briefing in it. The
// mechanism is four facts deep and the full account lives in the design
// system's `useSurfaceDismissGuard`; what this pass adds is proof on the three
// surfaces that actually host that control — a Dialog (the Estúdio's create
// form), a Sheet (the ingestion panel) and a second Dialog that also
// intercepts Escape ("Perguntar à base").
//
// Two things it measures that no unit test can:
//
//  1. **Reachability.** With the menu open, `elementFromPoint` over the modal
//     must find the modal's own controls — not the modal's overlay. A modal
//     menu blacks out pointer events on everything below it, and the overlay
//     is the one element Radix hardcodes back to `pointer-events: auto`, so it
//     silently becomes the hit target for the whole panel.
//  2. **Survival, with a real gesture.** `locator.click()` presses and
//     releases inside one tick, before React has flushed the closing menu's
//     layer cleanup — which is early enough that the deferred outside-click
//     check still declines. The bug only appears for a click built from
//     separate `mouse.down()`/`mouse.up()` events, i.e. every human click.
//     Measured: `click()` reported PASS on a build where the dialog closed
//     every single time by hand.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const out = []
  const failures = []
  const say = (ok, label, detail) => {
    const line = `${ok ? 'PASS' : 'FAIL'} [${theme}] ${label}${detail ? ` — ${detail}` : ''}`
    out.push(line)
    if (!ok) failures.push(line)
    console.log(line)
  }
  const shot = (name) =>
    page.screenshot({ path: `.playwright-mcp/modal-menu-${theme}-${name}.png` })

  /** One real click: move, press, release — as separate input events. */
  const click = async (target) => {
    await target.scrollIntoViewIfNeeded().catch(() => {})
    const box = await target.boundingBox()
    if (box === null) throw new Error('alvo sem caixa')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
  }

  /** What the hit-test finds over `target`, and whether the surface is live. */
  const reach = async (surface, target) => {
    const box = await target.boundingBox()
    return page.evaluate(
      ({ surface, x, y }) => {
        const node = document.querySelector(surface)
        const hit = document.elementFromPoint(x, y)
        return {
          pointerEvents: node === null ? 'ausente' : getComputedStyle(node).pointerEvents,
          hitsOverlay:
            hit !== null && hit.closest('.hds-dialog-overlay, .hds-sheet-overlay') !== null
        }
      },
      { surface, x: box.x + box.width / 2, y: box.y + box.height / 2 }
    )
  }

  await page.reload()
  await page.waitForTimeout(1300)
  if (theme !== 'dark') {
    await page.locator('[aria-label^="Escolha do tema (atual:"]').click()
    await page.waitForTimeout(200)
    await page
      .getByRole('menuitemradio', { name: theme === 'light' ? /^Claro/ : /^Hive/ })
      .click()
    await page.waitForTimeout(400)
  }

  /**
   * One surface: open its agent menu, measure reachability, then click a
   * control of the surface and assert the surface is still there and got the
   * click.
   */
  async function exercise({ name, surface, open, field }) {
    await open()
    const panel = page.locator(surface)
    if ((await panel.count()) === 0) {
      say(false, `${name}: superfície não abriu`, surface)
      return
    }
    const pill = page.locator(`${surface} .wb-agent-pill-btn`).first()
    if ((await pill.count()) === 0) {
      say(false, `${name}: sem seletor de agentes`, 'o pool tem menos de 2 agentes?')
      return
    }

    await click(pill)
    await page.waitForTimeout(350)
    say((await page.locator('.wb-agent-menu').count()) === 1, `${name}: o menu abre`)

    const measured = await reach(surface, pill)
    say(
      measured.pointerEvents === 'auto' && !measured.hitsOverlay,
      `${name}: a superfície continua alcançável com o menu aberto`,
      `pointer-events=${measured.pointerEvents} · clique no overlay=${measured.hitsOverlay}`
    )
    await shot(`${name}-menu`)

    // The gesture that closed the dialog: a second click on the same trigger.
    await click(pill)
    await page.waitForTimeout(450)
    say(
      (await page.locator(surface).count()) === 1 &&
        (await page.locator('.wb-agent-menu').count()) === 0,
      `${name}: o segundo clique fecha o menu e só ele`,
      `superfície=${await page.locator(surface).count()} menu=${await page.locator('.wb-agent-menu').count()}`
    )

    // …and a click aimed at a control of the surface while the menu is open
    // reaches that control instead of being swallowed.
    await click(pill)
    await page.waitForTimeout(300)
    const target = page.locator(`${surface} ${field}`).first()
    if ((await target.count()) === 1) {
      await click(target)
      await page.waitForTimeout(400)
      const focused = await page.evaluate(
        ({ surface, field }) => {
          const node = document.querySelector(`${surface} ${field}`)
          return node !== null && document.activeElement === node
        },
        { surface, field }
      )
      say(
        (await page.locator(surface).count()) === 1 && focused,
        `${name}: o clique no formulário chega ao formulário`,
        `focado=${focused}`
      )
    } else {
      say(false, `${name}: campo de referência ausente`, field)
    }

    // The modal is still a modal: the guard must not have turned the overlay
    // inert. A click beside the panel still closes it. (No Escape first — that
    // would close the surface and leave this check measuring nothing, which
    // reads exactly like a pass.)
    const overlay = page.locator('.hds-dialog-overlay, .hds-sheet-overlay').first()
    if ((await page.locator(surface).count()) === 1 && (await overlay.count()) === 1) {
      const panelBox = await page.locator(surface).boundingBox()
      await page.mouse.move(Math.max(6, panelBox.x / 2), 12)
      await page.mouse.down()
      await page.mouse.up()
      await page.waitForTimeout(450)
      say(
        (await page.locator(surface).count()) === 0,
        `${name}: um clique ao lado do painel ainda fecha`
      )
    } else {
      say(false, `${name}: nada aberto para medir o clique no overlay`)
    }
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)
  }

  const toChat = async () => {
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.waitForTimeout(250)
  }

  await exercise({
    name: 'estudio',
    surface: '.wb-studio-dialog',
    field: 'textarea',
    open: async () => {
      await toChat()
      await page.locator('button[data-tour="studio"]').click()
      await page.waitForTimeout(600)
      await page
        .getByRole('button', { name: /Uma skill|Nova skill/ })
        .first()
        .click()
      await page.waitForTimeout(450)
    }
  })

  await exercise({
    name: 'ingestao',
    surface: '.wb-brain-ingest',
    field: 'textarea',
    open: async () => {
      await page.evaluate(() => window.__setVault({ rawPending: 0 }))
      await page.waitForTimeout(300)
      await page.locator('[class*="fab"]').first().click()
      await page.waitForTimeout(250)
      await page.getByRole('menuitem', { name: 'Escrever' }).click()
      await page.waitForTimeout(600)
    }
  })

  await exercise({
    name: 'perguntar',
    surface: '.wb-brain-ask-dialog',
    field: 'textarea',
    open: async () => {
      await page.keyboard.press('Control+Shift+K')
      await page.waitForTimeout(700)
    }
  })

  return `${failures.length === 0 ? 'PASS' : 'FAIL'} (${theme})\n${out.join('\n')}`
}
