// The Design Studio (M18) visual pass — the Bancada's four surfaces, five
// states, all three themes in one run.
//
// `browser_run_code_unsafe` gives each call its own context, so setting
// `HIVE_THEME` in one call and running a file in the next doesn't work
// (docs/visual-validation.md). This driver therefore boots once and switches
// theme through the **real** control — the "Aparência" menu in the topbar.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/design-studio.mjs
//
// Returns one entry per theme with its FAIL/UNMEASURED/MISSING lines, and
// writes `.playwright-mcp/studio-<state>-<theme>.png` for every state.
//
// What it deliberately does not show: the Preview itself. The frame's `src` is
// `hive-studio://`, a scheme only the packaged app registers, so in a served
// renderer the device is empty by construction. Everything measured here is the
// Bancada's own chrome — which is exactly the part no other harness looks at.
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
          // Anything else (oklch, color-mix) is resolved by painting it.
          const canvas = document.createElement('canvas')
          canvas.width = 1
          canvas.height = 1
          const context = canvas.getContext('2d')
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = '#000'
          context.fillStyle = value
          if (context.fillStyle === '#000' && text !== '#000000' && text !== 'black') return null
          context.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
          // NOT de-premultiplied: dividing by alpha blows a 10% tint up to
          // near-white and reports a number that looks precise and is wrong
          // (docs/visual-validation.md, third trap).
          return { rgb: [r, g, b], a: a / 255 }
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
        for (const target of targets) {
          const [selector, kind] = Array.isArray(target) ? target : [target, 'text']
          const el = document.querySelector(selector)
          if (!el) {
            out.push(`${state} ${selector} MISSING`)
            continue
          }
          const style = getComputedStyle(el)
          // A non-textual carrier (a device bezel, a state dot) is measured on
          // what actually draws its edge, and takes the 3:1 floor. The border
          // comes first on purpose: the device's fill is `--bg` over the
          // bench's `--bg-2` by design (D-DS-9's three surface layers), and
          // measuring *that* pair would report a failure for a difference the
          // hairline is what carries.
          const bordered = parseFloat(style.borderTopWidth) > 0
          const fg =
            kind === 'text'
              ? parse(style.color)
              : parse(bordered ? style.borderTopColor : style.backgroundColor)
          const bg = bgOf(el.parentElement ?? el)
          if (!fg || !bg) {
            out.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const composited =
            fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = kind !== 'text' || px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
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

  /** Opens the Studio tab through the palette — the app's own second way in. */
  async function openStudio() {
    await page.keyboard.press('Control+p')
    await page.waitForTimeout(400)
    await page.locator('[aria-label="Abrir docs/ux-spec.md no Design Studio"]').click()
    await page.waitForTimeout(900)
  }

  const TOOLBAR = [
    '.wb-dstudio-screen-count',
    '.wb-dstudio-screen-trigger',
    '.wb-dstudio-viewport [data-active="true"] .hds-seg-label',
    '.wb-dstudio-viewport .hds-seg-item:not([data-active="true"]) .hds-seg-label',
    '.wb-dstudio-toolbar-end button:not([disabled])'
  ]

  async function sweep(theme) {
    const results = []

    await page.reload()
    await page.waitForTimeout(1400)
    if (theme !== 'dark') {
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }
    await openStudio()

    // 1. The band the tab actually opens in. The viewer pane is ~44% of the
    //    window (D-DS-3), which is the narrowest band of §3.8: Telas in the
    //    toolbar, Árvore and Inspetor in drawers, and the hint that offers the
    //    way out. This is the first thing a user ever sees of the Studio.
    await page.locator('.wb-dstudio').screenshot({ path: `${shots}/studio-narrow-${theme}.png` })
    results.push(
      ...(await measure('narrow', [
        ...TOOLBAR,
        '.wb-dstudio-focus-hint',
        '.wb-dstudio-readout'
      ]))
    )

    // 2. Modo Foco gives the stage the whole window, which is the only band
    //    with all three columns — everything below is measured there.
    await page.getByRole('button', { name: 'Modo Foco' }).click()
    await page.waitForTimeout(700)
    await page.locator('.wb-dstudio').screenshot({ path: `${shots}/studio-stage-${theme}.png` })
    results.push(
      ...(await measure('stage', [
        ...TOOLBAR,
        '.wb-dstudio-pane-title',
        '.wb-dstudio-screen-title',
        '.wb-dstudio-readout',
        ['.wb-dstudio-device', 'carrier'],
        '.wb-dstudio-tree .hds-tree-label-text',
        '.wb-dstudio-empty .hds-empty-title',
        '.wb-dstudio-empty .hds-empty-description'
      ]))
    )

    // 3. A Component selected and a prop actually changed: the Inspetor's
    //    controls, and — because one edit landed — the Tela's "editada nesta
    //    sessão" mark, which is otherwise never on screen (DS-R4 AC-3).
    await page.locator('.wb-dstudio-tree .hds-tree-row').nth(2).click()
    await page.waitForTimeout(400)
    await page.locator('.wb-dstudio-prop [role="switch"]').first().click()
    await page.waitForTimeout(400)
    await page
      .locator('.wb-dstudio-side')
      .last()
      .screenshot({ path: `${shots}/studio-inspector-${theme}.png` })
    results.push(
      ...(await measure('inspector', [
        '.wb-dstudio-inspector-tag',
        '.wb-dstudio-inspector .hds-accordion-trigger',
        '.wb-dstudio-prop .hds-field-label',
        '.wb-dstudio-tree .hds-tree-item-selected .hds-tree-label-text',
        '.wb-dstudio-tree-buttons button:not([disabled])',
        ['.wb-dstudio-screen-mark[data-edited]', 'carrier']
      ]))
    )

    // 4. The Chat as a strip, expanded, with a turn in flight (DS-R2's rule:
    //    the wait is covered).
    await page.getByRole('button', { name: 'Abrir a conversa' }).click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('Escreva o que mudar…').fill('deixe o botão maior')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    await page.locator('.wb-dstudio-chat').screenshot({ path: `${shots}/studio-chat-${theme}.png` })
    results.push(
      ...(await measure('chat', [
        '.wb-dstudio-chat-title',
        '.wb-dstudio-chat-context',
        '.wb-dstudio-chat-phase',
        '.wb-dstudio-chat-working'
      ]))
    )

    // 5. The turn fails: the retryable `OperationError` where it was asked for.
    await page.evaluate(() =>
      window.__studioSkill?.({
        type: 'failed',
        error: {
          kind: 'operation',
          scope: 'agent',
          message: 'A sessão do agente expirou antes de responder.',
          retryable: true
        }
      })
    )
    await page.waitForTimeout(400)
    await page
      .locator('.wb-dstudio-chat')
      .screenshot({ path: `${shots}/studio-chat-failed-${theme}.png` })
    results.push(...(await measure('chat/failed', ['.wb-dstudio-chat-failure'])))

    // 6. The export picker and its partly-good report (T7.4, DS-R15).
    await page.getByRole('button', { name: 'Exportar' }).click()
    await page.waitForTimeout(400)
    await page
      .locator('.wb-dstudio-export-dialog')
      .screenshot({ path: `${shots}/studio-export-${theme}.png` })
    results.push(...(await measure('export', ['.wb-dstudio-export-item'])))

    await page.getByRole('button', { name: 'Escolher a pasta e exportar' }).click()
    await page.waitForTimeout(500)
    await page
      .locator('.wb-dstudio-export-dialog')
      .screenshot({ path: `${shots}/studio-export-report-${theme}.png` })
    results.push(
      ...(await measure('export/report', [
        '.wb-dstudio-export-count',
        '.wb-dstudio-export-failed-title',
        '.wb-dstudio-export-failed-reason'
      ]))
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // 7. A Tela with no Components — the stage teaches instead of blinking out.
    await page.locator('.wb-dstudio-screen-row').nth(1).click()
    await page.waitForTimeout(600)
    await page.locator('.wb-dstudio').screenshot({ path: `${shots}/studio-empty-${theme}.png` })
    results.push(
      ...(await measure('empty', [
        '.wb-dstudio-empty .hds-empty-title',
        '.wb-dstudio-empty .hds-empty-description'
      ]))
    )

    return {
      theme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
      fails: results.filter((line) => /FAIL|UNMEASURED|MISSING/.test(line)),
      results
    }
  }

  return [await sweep('dark'), await sweep('light'), await sweep('hive')]
}
