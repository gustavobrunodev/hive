// Companion to tools/visual/boot.mjs — the contrast pass for the restructured
// profile sheet and its new "Voz e transcrição" scope (voice-settings, M25).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/profile-voice-pass.mjs
//
// It boots ONCE and switches theme through the real "Aparência" menu inside
// the same file — setting `globalThis.HIVE_THEME` in one call and running the
// file in the next measures the boot default three times
// (docs/visual-validation.md, M15/M16).
//
// Five states per theme: the index, the voice scope, the voice scope with the
// download catalog open, a pinned (non-automatic) model, and the terminal
// scope — the one detail whose content this change did not author but did move.
// Screenshots land in `.playwright-mcp/m25-<state>-<theme>.png`.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const measure = async (state, targets, nonText = []) =>
    await page.evaluate(
      ({ state, targets, nonText }) => {
        // Any CSS colour → sRGB + alpha, by letting the canvas do the
        // conversion. Hand-written regexes silently report UNMEASURED for
        // `oklch()` and `oklab()` — which is most of this palette, including
        // `--accent-tint-ink` and every `color-mix()` tint on this surface.
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        function parse(value) {
          const text = String(value).trim()
          if (text === '' || text === 'transparent') return { rgb: [0, 0, 0], a: 0 }
          ctx.clearRect(0, 0, 1, 1)
          // Seed with a known colour: an unparseable value leaves `fillStyle`
          // at its previous setting rather than throwing, and this makes that
          // case observable instead of silently black.
          ctx.fillStyle = '#010203'
          ctx.fillStyle = text
          if (ctx.fillStyle === '#010203' && text !== '#010203') return null
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          const d = ctx.getImageData(0, 0, 1, 1).data
          // `getImageData` hands back UN-premultiplied RGBA, so the channels
          // are already the source colour. Dividing by alpha here is a second
          // correction that blows a 16% tint out to near-white.
          return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        /**
         * The pixel actually behind `el`. Starts at the element ITSELF, not at
         * its parent: a tinted pill measured against its grandparent's surface
         * is measured against a colour that is not on screen.
         */
        function bgOf(el, includeSelf) {
          const layers = []
          let node = includeSelf ? el : el.parentElement
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
        function ratioOf(fg, bg) {
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        }

        const failures = []
        const missing = []
        for (const selector of targets) {
          const el = document.querySelector(selector)
          if (el === null) {
            // A skipped sample and a passing sample look identical in a report
            // unless the skip is reported separately — so it is.
            missing.push(`${state} ${selector}`)
            continue
          }
          const style = getComputedStyle(el)
          const fg = parse(style.color)
          const bg = bgOf(el, true)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          if (ratio < floor) {
            failures.push(
              `${state} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor})`
            )
          }
        }
        // Non-text carriers — the radio ring, the progress fill, the chevron —
        // owe the 3:1 floor, and they carry `background`/`box-shadow` rather
        // than `color`, so they are read differently.
        for (const { selector, prop } of nonText) {
          const el = document.querySelector(selector)
          if (el === null) {
            missing.push(`${state} ${selector}`)
            continue
          }
          const style = getComputedStyle(el)
          const raw = prop === 'ring' ? style.boxShadow.match(/(oklch|oklab|rgba?|#)[^)]*\)?/)?.[0] : style[prop]
          const fg = parse(raw)
          const bg = bgOf(el, false)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          if (ratio < 3) failures.push(`${state} ${selector} [${prop}] → ${ratio.toFixed(2)}:1 (floor 3)`)
        }
        return { failures, missing }
      },
      { state, targets, nonText }
    )

  const INDEX = [
    '.wb-pnav-avatar',
    '.wb-pnav-name',
    '.wb-pnav-role',
    '.wb-pnav-label',
    '.wb-pnav-value',
    '.wb-pnav-tour-title',
    '.wb-pnav-tour-hint',
    '.wb-profile-scope-note',
    '.hds-sheet-title',
    '.hds-sheet-description'
  ]
  const INDEX_NON_TEXT = [{ selector: '.wb-pnav-chevron', prop: 'color' }]

  const VOICE = [
    '.wb-profile-back',
    '.wb-voice-lead',
    '.wb-machine-title',
    '.wb-machine-fact dt',
    '.wb-machine-fact dd',
    '.wb-machine-fact dd[data-strong]',
    '.wb-voice-title',
    '.wb-mdl-opt[data-auto] .wb-mdl-name',
    '.wb-mdl-opt:not([data-auto]) .wb-mdl-name',
    '.wb-mdl-tradeoff',
    '.wb-mdl-badge',
    '.wb-mdl-meta',
    '.wb-voice-caption',
    '.wb-voice-caption-lead',
    '.wb-cat-toggle'
  ]
  const VOICE_NON_TEXT = [{ selector: '.wb-mdl-opt[data-state="checked"] .wb-mdl-dot', prop: 'ring' }]

  const CATALOG = [...VOICE, '.wb-cat-note', '.wb-cat-name', '.wb-cat-tag', '.wb-cat-facts', '.wb-cat-btn']

  async function openSheet() {
    await page.click('[aria-label="Abrir configurações de perfil"]')
    await page.waitForTimeout(500)
  }
  async function back() {
    await page.click('[aria-label="Voltar para a lista de configurações"]')
    await page.waitForTimeout(400)
  }
  const sheet = () => page.locator('.wb-profile-sheet')

  async function sweep(theme) {
    const failures = []
    const missing = []
    const take = async (result) => {
      failures.push(...result.failures)
      missing.push(...result.missing)
    }

    await page.reload()
    await page.waitForTimeout(1200)
    if (theme !== 'dark') {
      // Driven through the app's own control. A probe that sets what the boot
      // harness also sets measures the harness default three times (M15).
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // 1. The index.
    await openSheet()
    await take(await measure('index', INDEX, INDEX_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m25-index-${theme}.png` })

    // 2. Voz e transcrição, automatic.
    await page.click('button.wb-pnav-row[data-scope="voice"]')
    await page.waitForTimeout(500)
    await take(await measure('voice', VOICE, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m25-voice-${theme}.png` })

    // 3. …with the downloadable catalog open.
    await page.click('.wb-cat-toggle')
    await page.waitForTimeout(400)
    await take(await measure('catalog', CATALOG, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m25-catalog-${theme}.png` })

    // 4. A pinned model — the caption changes, and so does which row is checked.
    await page.locator('.wb-mdl-opt[value="tiny"]').click()
    await page.waitForTimeout(400)
    await take(await measure('pinned', VOICE, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m25-pinned-${theme}.png` })

    // 5. The terminal scope — content this change moved rather than authored.
    await back()
    await page.click('button.wb-pnav-row[data-scope="shell"]')
    await page.waitForTimeout(500)
    await take(await measure('shell', ['.wb-profile-back', '.hds-sheet-title', '.hds-sheet-description']))
    await sheet().screenshot({ path: `${shots}/m25-shell-${theme}.png` })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    return { theme, failures, missing }
  }

  const results = []
  for (const theme of THEMES) results.push(await sweep(theme))
  // The verdict needs BOTH empty: a state that never rendered reports no
  // failures, which reads exactly like a state that passed.
  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
