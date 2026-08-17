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
      function parse(value) {
        const text = String(value).trim().toLowerCase()
        const srgb = text.match(
          /^color\(\s*srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*(?:\/\s*([\d.]+))?\s*\)$/
        )
        if (srgb)
          return {
            rgb: [srgb[1], srgb[2], srgb[3]].map((c) => Math.min(255, Math.max(0, Number(c) * 255))),
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
        '.wb-shell-row-name',
        '.wb-shell-row-detail',
        '.wb-shell-row-badge',
        '.wb-shell-support-title',
        '.wb-shell-support-item',
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
      // The status marks: colour IS the redundant channel here, so they owe 3:1.
      for (const selector of ['.wb-shell-support-item[data-support="native"] svg',
        '.wb-shell-support-item[data-support="launch-only"] svg']) {
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

    // 2. A picked shell — the caveats swap to the "native" wording.
    await page.locator('[aria-label="Git Bash"]').first().click()
    await page.waitForTimeout(250)
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
    await page.locator('[aria-label="Automático"]').first().click()
    await page.waitForTimeout(200)
  }

  const failures = results.filter((line) => line.includes('FAIL') || line.includes('UNMEASURED'))
  return { total: results.length, failures, sample: results.slice(0, 12) }
}
