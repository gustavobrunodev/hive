// Companion to tools/visual/boot.mjs — the terminal picker's contrast pass
// (agent-terminal, AT-R6). Run it after boot, once per theme:
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/shell-contrast.mjs
//
// It walks the three states the section actually has — automatic, a picked
// shell (the caveats swap), and a choice whose shell was uninstalled — and
// measures every text run in each. Alpha is composited up the tree: half these
// surfaces are translucent tints, and the naive read measures the pure hue
// instead of the pixel the user sees (the trap docs/visual-validation.md
// records).
async (page) => {
  const THEMES = ['dark', 'light', 'hive']

  const probe = async (label) =>
    await page.evaluate((label) => {
      // Any CSS color → sRGB + alpha, by letting the canvas do the conversion.
      // Hand-written regexes were the previous approach and they silently
      // reported UNMEASURED for every `oklch()` token — which is most of the
      // semantic palette, and exactly the runs most worth checking (the amber
      // `--warning-ink` on the re-routed agent, the accent tint on the sigil).
      // A probe that skips the interesting half reads as a pass.
      const _cv = document.createElement('canvas')
      _cv.width = _cv.height = 1
      const _ctx = _cv.getContext('2d', { willReadFrequently: true })
      function parse(value) {
        const text = String(value).trim()
        if (text === '' || text === 'transparent') return { rgb: [0, 0, 0], a: 0 }
        _ctx.clearRect(0, 0, 1, 1)
        // Seed with a known color first: an unparseable value leaves
        // `fillStyle` at its previous setting rather than throwing, and this
        // makes that case observable instead of silently black.
        _ctx.fillStyle = '#010203'
        _ctx.fillStyle = text
        if (_ctx.fillStyle === '#010203' && text !== '#010203') return null
        _ctx.clearRect(0, 0, 1, 1)
        _ctx.fillRect(0, 0, 1, 1)
        const d = _ctx.getImageData(0, 0, 1, 1).data
        // `getImageData` is specified to hand back **un-premultiplied** RGBA,
        // so the channels are already the source color. Dividing by alpha here
        // (the obvious "undo the premultiply" move) is a second correction: it
        // drove `--selected-bg`'s 16% coral to near-white and quietly turned
        // every measurement over a tint into a failure.
        return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
      }
      function lum(rgb) {
        const [r, g, b] = rgb.map((ch) => {
          const c = ch / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
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
      // Text runs. The icons (`svg`) owe the 3:1 non-text floor and are
      // measured separately below via their computed `color`.
      const targets = [
        '.wb-shell-scan-text',
        '.hds-radio-card-title',
        '.hds-radio-card-meta',
        '.wb-shell-live',
        '.wb-shell-sigil',
        '.wb-shell-outcome-title',
        '.wb-shell-route-agent',
        '.wb-shell-route-target',
        '.wb-shell-note',
        '.wb-shell-note-cta',
        '.wb-shell-command-toggle',
        '.hds-cmdline-text',
        '.hds-cmdline-copy',
        '.wb-shell-missing',
        '.wb-shell-empty'
      ]
      const out = []
      for (const selector of targets) {
        for (const el of document.querySelectorAll(selector)) {
          const style = getComputedStyle(el)
          const fg = parse(style.color)
          const bg = bgOf(el)
          if (!fg || !bg) {
            out.push(`${label} ${selector}: UNMEASURED`)
            continue
          }
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          // WCAG large text: ≥24px, or ≥18.66px bold.
          const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          out.push(
            `${label} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor}) ${
              ratio >= floor ? 'PASS' : 'FAIL'
            }`
          )
          break // one sample per selector per state is enough; they share tokens
        }
      }
      // The route marks: colour IS the redundant channel here, so they owe 3:1.
      for (const selector of [
        '.wb-shell-route[data-support="native"] .wb-shell-route-mark svg',
        '.wb-shell-route[data-support="fallback"] .wb-shell-route-mark svg',
        '.wb-shell-route[data-support="launch-only"] .wb-shell-route-mark svg'
      ]) {
        const el = document.querySelector(selector)
        if (!el) continue
        const fg = parse(getComputedStyle(el).color)
        const bg = bgOf(el)
        if (!fg || !bg) continue
        const ratio =
          (Math.max(lum(fg.rgb), lum(bg)) + 0.05) / (Math.min(lum(fg.rgb), lum(bg)) + 0.05)
        out.push(
          `${label} ${selector} icon → ${ratio.toFixed(2)}:1 (floor 3) ${ratio >= 3 ? 'PASS' : 'FAIL'}`
        )
      }
      return out
    }, label)

  const results = []
  // Idempotent: the pass may run against a session that already has the sheet
  // open (an open dialog also intercepts the avatar's own pointer events).
  const alreadyOpen = await page.evaluate(() => Boolean(document.querySelector('.wb-profile-sheet')))
  if (!alreadyOpen) {
    await page
      .locator('[data-tour="profile"], .wb-avatar-btn, [aria-label*="perfil" i]')
      .first()
      .click()
    await page.waitForTimeout(600)
  }

  for (const theme of THEMES) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(250)

    // 1. Automatic (the default, and on Windows the cmd caveat).
    results.push(...(await probe(`${theme} auto`)))

    // 2. A picked shell, with its receipt open — the routes swap to "native"
    //    and the command line is the one surface that only exists here.
    await page.getByRole('radio', { name: 'Git Bash' }).first().click()
    await page.waitForTimeout(250)
    const toggle = page.locator('.wb-shell-command-toggle[aria-expanded="false"]').first()
    if ((await toggle.count()) > 0) {
      await toggle.click()
      await page.waitForTimeout(200)
    }
    results.push(...(await probe(`${theme} picked`)))

    // 3. The choice's shell is gone (D-AT-4): the warning banner.
    await page.evaluate(() => {
      const el = document.querySelector('.wb-shell-picker')
      if (!el) return
      const p = document.createElement('p')
      p.className = 'wb-shell-missing'
      p.setAttribute('role', 'alert')
      p.textContent =
        'O terminal escolhido (Git Bash) não está mais neste computador. Enquanto isso os agentes usam o padrão.'
      el.insertBefore(p, el.children[1])
    })
    await page.waitForTimeout(150)
    results.push(...(await probe(`${theme} missing`)))
    await page.evaluate(() => document.querySelector('.wb-shell-missing')?.remove())

    // Back to automatic for the next theme's first state.
    await page.getByRole('radio', { name: 'Automático' }).first().click()
    await page.waitForTimeout(200)
  }

  const failures = results.filter((line) => line.includes('FAIL') || line.includes('UNMEASURED'))
  return { total: results.length, failures, sample: results.slice(0, 12) }
}
