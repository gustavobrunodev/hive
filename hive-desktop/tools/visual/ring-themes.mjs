// The ring in all three themes, sheet open: screenshots plus the contrast
// sweep from tools/visual/timing-contrast.mjs over the targets the ring
// changed. Run AFTER tools/visual/boot.mjs.
//
//   run_code_unsafe --filename tools/visual/ring-themes.mjs
//
// Why here and not in ring-pass.mjs: switching the theme goes through the real
// topbar control, and a probe that measured the previous theme's colours is
// the single most-repeated mistake in this repo's visual passes
// (docs/visual-validation.md) — so the theme is set, then settled, then read.
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  const box = page.locator('textarea').first()
  await box.click()
  await box.fill('Levanta os requisitos do módulo de faturamento')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  await page.evaluate(() =>
    window.__agentEvent({
      type: 'usage',
      final: true,
      usage: {
        inputTokens: 812,
        cacheReadTokens: 61_400,
        cacheCreationTokens: 14_300,
        outputTokens: 1_240,
        model: 'claude-opus-5'
      }
    })
  )
  await page.waitForTimeout(400)

  // Two sweeps, not one: opening the mention menu means focusing the composer,
  // and that CLOSES the context sheet (a Popover dismisses on outside
  // interaction). A single sweep measured the menu correctly and reported
  // every sheet target as "missing" — which reads exactly like "nothing to
  // fix". Two surfaces, two moments.
  const measure = (which) =>
    page.evaluate((which) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      // Colours are resolved by painting a pixel, never by regex: Chromium
      // serialises `oklch()`/`color-mix()` literally, and a digit-scraping
      // parser reads `oklch(0.7 0.17 25.3)` as a near-black RGB.
      const rgba = (css) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2], d[3] / 255]
      }
      const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]))
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((ch) => {
          const v = Math.min(255, Math.max(0, ch)) / 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
      // Every background layer up the tree, composited to opaque: the sheet,
      // the rows and the tints are all translucent over one another, and
      // reading a single hue measures a colour nobody sees.
      const bgOf = (el) => {
        const layers = []
        let node = el
        while (node) {
          const c = rgba(getComputedStyle(node).backgroundColor)
          if (c[3] > 0) layers.push(c)
          node = node.parentElement
        }
        layers.push([255, 255, 255, 1])
        let acc = layers.pop()
        while (layers.length) acc = over(layers.pop(), acc)
        return acc
      }
      const text = (selector, floor) => {
        const el = document.querySelector(selector)
        if (!el) return { selector, missing: true }
        const fg = over(rgba(getComputedStyle(el).color), bgOf(el.parentElement ?? el))
        const value = ratio(fg, bgOf(el))
        return { selector, ratio: Number(value.toFixed(2)), floor, pass: value >= floor }
      }
      // A mark, not text: the arc against the track it is drawn on. 3:1 is the
      // non-text floor, and it is the only thing keeping "38%" from being the
      // sole evidence of the reading.
      const mark = (selector, againstSelector, floor) => {
        const el = document.querySelector(selector)
        const against = document.querySelector(againstSelector)
        if (!el || !against) return { selector, missing: true }
        const fg = over(rgba(getComputedStyle(el).stroke), bgOf(el))
        const bg = over(rgba(getComputedStyle(against).stroke), bgOf(against))
        const value = ratio(fg, bg)
        return { selector, ratio: Number(value.toFixed(2)), floor, pass: value >= floor }
      }
      return which === 'sheet'
        ? [
            text('.wb-ctx-meter-value', 4.5),
            text('.wb-ctx-meter-label', 4.5),
            text('.wb-ctx-detail-title', 4.5),
            text('.wb-ctx-model', 4.5),
            text('.wb-ctx-used', 4.5),
            text('.wb-ctx-window', 4.5),
            text('.wb-ctx-ring .hds-ring-meter-value', 4.5),
            text('.wb-ctx-ring .hds-ring-meter-caption', 4.5),
            text('.wb-ctx-legend-row dt', 4.5),
            text('.wb-ctx-legend-tokens', 4.5),
            text('.wb-ctx-legend-share', 4.5),
            text('.wb-ctx-note', 4.5),
            mark('.hds-ring-meter-arc[data-seg="input"]', '.wb-ctx-ring .hds-ring-meter-track', 3),
            mark(
              '.wb-ctx-meter-ring .hds-ring-meter-arc',
              '.wb-ctx-meter-ring .hds-ring-meter-track',
              3
            )
          ]
        : [
            text('.wb-mention-count', 4.5),
            text('.wb-mention-menu-head span', 4.5),
            text('.wb-mention-item .wb-slash-item-label', 4.5),
            text('.wb-mention-item-dir', 4.5),
            text('.wb-mention-item[data-active] .wb-slash-item-label', 4.5),
            text('.wb-mention-item[data-active] .wb-mention-item-dir', 4.5),
            text('.wb-mention-menu-foot', 4.5)
          ]
    }, which)

  const out = []
  for (const theme of ['dark', 'light', 'hive']) {
    if (theme !== 'dark') {
      await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
      await page
        .getByRole('menuitemradio', { name: new RegExp(`^${theme === 'light' ? 'Claro' : 'Hive'}`) })
        .click()
      await page.waitForTimeout(400)
    }

    // --- the sheet, measured while it is the thing on screen ---------------
    await page.locator('.wb-ctx-meter').click()
    await page.waitForTimeout(450)
    const sheetTargets = await measure('sheet')
    const sheetBox = await page.locator('.wb-ctx-detail').boundingBox()
    await page.screenshot({
      path: `${OUT}/ring-sheet-${theme}.png`,
      clip: {
        x: sheetBox.x - 14,
        y: sheetBox.y - 14,
        width: sheetBox.width + 28,
        height: sheetBox.height + 28
      }
    })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    // --- then the picker ---------------------------------------------------
    await page.evaluate(() => {
      const files = ['README.md', 'package.json']
      for (let i = 0; i < 40; i += 1)
        files.push(`docs/prd-${String(i).padStart(2, '0')}-especificacao.md`)
      window.hive.listFiles = () => Promise.resolve(files)
    })
    await box.click()
    await box.fill('')
    await box.type('veja @prd', { delay: 8 })
    await page.waitForTimeout(450)
    const menuTargets = await measure('menu')
    const menuBox = await page.locator('.wb-mention-menu').boundingBox()
    await page.screenshot({ path: `${OUT}/mention-${theme}.png`, clip: menuBox })
    await page.keyboard.press('Escape')
    await box.fill('')
    await page.waitForTimeout(200)

    const targets = [...sheetTargets, ...menuTargets]
    out.push({
      theme,
      checked: targets.length,
      failures: targets.filter((t) => t.missing || !t.pass)
    })
  }
  return out
}
