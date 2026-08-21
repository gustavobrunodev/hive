// Visual + contrast pass over the four fixes, in all three themes.
//
// Run `tools/visual/boot.mjs` first; this drives the booted page.
//
// **It never reloads.** The boot harness plants the theme in an init script,
// so a reload puts the theme back to `dark` and every "light" and "hive"
// measurement silently reports the dark theme's numbers (this pass did exactly
// that on its first run — three identical contrast ratios were the tell).
// Themes are switched through the real Aparência menu instead.
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']
  const report = {}

  // Resolves any colour — oklch, color-mix, alpha — by painting it over the
  // real stack of backgrounds beneath it and reading the pixel.
  const installProbe = () =>
    page.evaluate(() => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      const px = (color, stack) => {
        ctx.clearRect(0, 0, 1, 1)
        for (const under of stack) { ctx.fillStyle = under; ctx.fillRect(0, 0, 1, 1) }
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2]]
      }
      const lum = ([r, g, b]) => {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return +((x + 0.05) / (y + 0.05)).toFixed(2)
      }
      // Start the stack at the element itself: a tinted pill measured from its
      // parent is read against the wrong ground (M22's lesson).
      const groundOf = (el) => {
        const stack = []
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') stack.unshift(bg)
        }
        return stack
      }
      window.__measure = (targets) => {
        const out = {}
        for (const [name, sel, floor] of targets) {
          const el = document.querySelector(sel)
          if (!el) { out[name] = 'MISSING'; continue }
          const ground = groundOf(el.parentElement ?? el)
          const r = ratio(px(getComputedStyle(el).color, ground), px('rgba(0,0,0,0)', ground))
          out[name] = { ratio: r, floor, pass: r >= floor }
        }
        return out
      }
    })

  const openThemeMenu = async () => {
    await page.locator('button[aria-label*="Aparência"]').first().click()
    await page.waitForTimeout(420)
  }

  for (const [index, theme] of THEMES.entries()) {
    if (index > 0) {
      await openThemeMenu()
      await page.locator('.wb-theme-menu [role="menuitemradio"]').nth(index).click()
      await page.waitForTimeout(450)
    }
    const applied = await page.evaluate(() => document.documentElement.dataset.theme)
    const themed = { applied }
    await installProbe()

    // --- 1. Explorer: "Recolher todas as pastas" --------------------------
    await page.locator('.wb-rail').first().screenshot({ path: `${OUT}/pass-${theme}-explorer-idle.png` })
    themed.collapseDisabledWhenNothingOpen = await page.locator('.wb-tree-toolbar-end').isDisabled()

    for (const name of ['_bmad', 'docs', 'src']) {
      const chev = page.locator(`.hds-tree [role="treeitem"]:has-text("${name}")`).first().locator('.hds-tree-chevron').first()
      if (await chev.count()) { await chev.click(); await page.waitForTimeout(90) }
    }
    await page.waitForTimeout(250)
    themed.rowsOpen = await page.locator('.hds-tree [role="treeitem"]').count()
    themed.collapseEnabledWhenOpen = !(await page.locator('.wb-tree-toolbar-end').isDisabled())
    await page.locator('.wb-rail').first().screenshot({ path: `${OUT}/pass-${theme}-explorer-open.png` })
    themed.contrast = await page.evaluate(() =>
      window.__measure([['collapseIcon', '.wb-tree-toolbar-end svg', 3]])
    )

    await page.locator('.wb-tree-toolbar-end').click()
    await page.waitForTimeout(350)
    themed.rowsAfterCollapse = await page.locator('.hds-tree [role="treeitem"]').count()
    themed.flash = await page.locator('.wb-tree-flash').innerText()

    // --- 2. The Aparência menu --------------------------------------------
    await openThemeMenu()
    await page.locator('.wb-theme-menu').screenshot({ path: `${OUT}/pass-${theme}-thememenu.png` })
    themed.themeRows = await page.evaluate(() => {
      const menu = document.querySelector('.wb-theme-menu').getBoundingClientRect()
      return [...document.querySelectorAll('.wb-theme-menu .hds-dropdown-menu-item')].map((it) => {
        const at = (sel) => {
          const e = it.querySelector(sel)
          return e ? Math.round(e.getBoundingClientRect().left - menu.left) : null
        }
        return { preview: at('.wb-theme-preview'), label: at('.wb-theme-option-name'), check: at('.hds-dropdown-menu-item-check') }
      })
    })
    Object.assign(themed.contrast, await page.evaluate(() =>
      window.__measure([
        ['themeOptionName', '.wb-theme-menu [data-state="checked"] .wb-theme-option-name', 4.5],
        ['themeOptionHint', '.wb-theme-menu [data-state="checked"] .wb-theme-option-hint', 4.5]
      ])
    ))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    // --- 3. The interrupt --------------------------------------------------
    await page.locator('textarea').first().click()
    await page.keyboard.type('Gera um PRD')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
    await page.evaluate(() => {
      window.__agentEvent({ type: 'session', id: 'cli-x', turnId: 'turn-1' })
      window.__agentEvent({ type: 'token', text: 'Vou levantar o contexto do produto…', turnId: 'turn-1' })
    })
    await page.waitForTimeout(500)
    const box = await page.locator('.wb-stop-btn').boundingBox()
    const clip = { x: box.x - 400, y: box.y - 20, width: 460, height: 70 }
    await page.screenshot({ path: `${OUT}/pass-${theme}-stop.png`, clip })
    Object.assign(themed.contrast, await page.evaluate(() =>
      window.__measure([['stopGlyph', '.wb-stop-btn svg', 3]])
    ))
    await page.evaluate(() => document.querySelector('.wb-stop-btn').setAttribute('data-stopping', 'true'))
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${OUT}/pass-${theme}-stop-pressed.png`, clip })
    Object.assign(themed.contrast, await page.evaluate(() =>
      window.__measure([['stopGlyphPressed', '.wb-stop-btn svg', 3]])
    ))
    await page.evaluate(() => document.querySelector('.wb-stop-btn')?.removeAttribute('data-stopping'))
    // Settle the turn so the next theme starts from a clean composer.
    await page.evaluate(() => window.__agentEvent({ type: 'interrupted', turnId: 'turn-1' }))
    await page.waitForTimeout(300)

    // --- 4. Regression: a DS menu this change did not design ---------------
    const paneMenu = page.locator('.wb-pane-move-btn').first()
    if (await paneMenu.count()) {
      await paneMenu.click({ force: true })
      await page.waitForTimeout(350)
      const content = page.locator('.hds-dropdown-menu-content').first()
      if (await content.count()) await content.screenshot({ path: `${OUT}/pass-${theme}-panemenu.png` })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }

    report[theme] = themed
  }
  return report
}
