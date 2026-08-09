// The shortcut-scopes visual pass, all three themes in one run.
//
// `browser_run_code_unsafe` gives each call its own context, so setting
// `HIVE_THEME` in one call and running a file in the next doesn't work
// (docs/visual-validation.md). This driver therefore boots once and switches
// theme through the **real** control — the "Aparência" menu in the topbar —
// which is also what the doc recommends over rewriting localStorage.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/shortcuts-pass.mjs
//
// Returns one entry per theme with its FAIL lines, and writes
// `.playwright-mcp/scopes-<state>-<theme>.png` for every state.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'

  const measure = async (state, targets) =>
    await page.evaluate(
      ({ state, targets }) => {
        function parse(value) {
          const text = String(value).trim().toLowerCase()
          const srgb = text.match(
            /^color\(\s*srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*(?:\/\s*([\d.]+))?\s*\)$/
          )
          if (srgb)
            return {
              rgb: [srgb[1], srgb[2], srgb[3]].map((c) =>
                Math.min(255, Math.max(0, Number(c) * 255))
              ),
              a: srgb[4] === undefined ? 1 : Number(srgb[4])
            }
          const rgb = text.match(
            /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/
          )
          if (rgb)
            return {
              rgb: [rgb[1], rgb[2], rgb[3]].map(Number),
              a: rgb[4] === undefined ? 1 : Number(rgb[4])
            }
          const hex = text.match(/^#([0-9a-f]{6})$/)
          if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), a: 1 }
          return null
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        /** Composites every translucent background up the tree into real pixels. */
        function bgOf(el) {
          const layers = []
          let node = el
          while (node) {
            const parsed = parse(getComputedStyle(node).backgroundColor)
            if (parsed && parsed.a > 0) layers.push(parsed)
            node = node.parentElement
          }
          if (layers.length === 0) return null
          let base = layers[layers.length - 1].rgb
          for (let i = layers.length - 2; i >= 0; i--) {
            const { rgb, a } = layers[i]
            base = base.map((channel, idx) => rgb[idx] * a + channel * (1 - a))
          }
          return base
        }
        const out = []
        for (const selector of targets) {
          const el = document.querySelector(selector)
          if (!el) {
            out.push(`${state} ${selector} MISSING`)
            continue
          }
          const style = getComputedStyle(el)
          const fg = parse(style.color)
          const bg = bgOf(el)
          if (!fg || !bg) {
            out.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const composited =
            fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          // Large text (>=24px, or >=18.66px bold) takes the 3:1 floor.
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          out.push(
            `${state} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor}) ${
              ratio >= floor ? 'PASS' : 'FAIL'
            }`
          )
        }
        return out
      },
      { state, targets }
    )

  /** One theme's full walk: picker (both scopes + empty), profile, strip. */
  async function sweep(theme) {
    const results = []

    // A fresh conversation each pass, so the hero (and its "Personalizar"
    // pill) is on screen the same way every time.
    await page.reload()
    await page.waitForTimeout(1200)
    if (theme !== 'dark') {
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      // The DS DropdownMenu exposes the theme options as `menuitemradio`.
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // 1. The picker on "Para iniciar" — the hero set over its preview.
    await page.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await page.waitForTimeout(500)
    await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/scopes-start-${theme}.png` })
    results.push(
      ...(await measure('picker/start', [
        '.wb-sc-title-main',
        '.wb-sc-desc',
        '.wb-sc-scopes [data-active="true"] .hds-seg-label',
        '.wb-sc-scopes .hds-seg-item:not([data-active="true"]) .hds-seg-label',
        '.wb-sc-scopes .hds-seg-count',
        '.wb-sc-preview-caption',
        '.wb-sc-stage .wb-pill',
        '.wb-sc-stage .wb-pill[data-persona]',
        '.wb-sc-group-head',
        '.wb-sc-group-count',
        '.wb-sc-title',
        '.wb-sc-sub',
        '.wb-sc-count'
      ]))
    )

    // 2. "Durante a conversa" — the strip set, chips docked on the composer.
    await page.getByRole('radio', { name: /Durante a conversa/ }).click()
    await page.waitForTimeout(400)
    await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/scopes-during-${theme}.png` })
    results.push(
      ...(await measure('picker/during', [
        '.wb-sc-preview-caption',
        '.wb-sc-stage .wb-shortcut-chip'
      ]))
    )

    // 3. Deselect the one default → the empty-set teaching line + the
    // per-scope "Personalizado" badge and restore action.
    // (The real DS `CommandItem` is a cmdk `role="option"`, not a button.)
    await page.locator('[aria-label="Alternar atalho: Reunir os agentes"]').click()
    await page.waitForTimeout(400)
    await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/scopes-empty-${theme}.png` })
    results.push(...(await measure('picker/empty', ['.wb-sc-stage-empty'])))
    await page.getByRole('button', { name: 'Concluído' }).click()
    await page.waitForTimeout(300)

    // 4. The profile sheet — read-only role + the two-set summary.
    await page.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await page.waitForTimeout(500)
    await page
      .locator('.wb-profile-sheet')
      .screenshot({ path: `${shots}/scopes-profile-${theme}.png` })
    results.push(
      ...(await measure('profile', [
        '.wb-profile-role-name',
        '.wb-profile-role-desc',
        '.wb-profile-shortcut-label',
        '.wb-profile-shortcut-count',
        '.wb-profile-shortcut-cta'
      ]))
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // 5. The in-conversation strip, in a real conversation.
    await page.getByPlaceholder('Escreva uma mensagem…').fill('Vamos escrever o PRD do faturamento')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    await page.locator('.wb-composer').screenshot({ path: `${shots}/scopes-strip-${theme}.png` })
    results.push(...(await measure('strip', ['.wb-shortcut-chip-label'])))

    return {
      theme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
      fails: results.filter((line) => line.includes('FAIL') || line.includes('UNMEASURED')),
      results
    }
  }

  return [await sweep('dark'), await sweep('light'), await sweep('hive')]
}
