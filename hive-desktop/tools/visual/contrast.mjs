// Companion to tools/visual/boot.mjs — run it after boot, in each theme.
// Measures WCAG contrast for the knowledge-base surfaces, walking through every
// state so nothing is missed: invite → setup running → guard (sheet) → ready
// banner → hand-off toast. Mirrors src/renderer/src/ui/contrast.ts, plus alpha
// compositing (the tinted banners are translucent over their surface, and the
// naive read measures against the pure hue).
async (page) => {
  const probe = async (label) =>
    await page.evaluate((label) => {
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
      const targets = [
        '.wb-brain-empty-title',
        '.wb-brain-empty-desc',
        '.wb-brain-promise',
        '.wb-brain-empty-note',
        '.wb-brain-textlink',
        '.wb-brain-ready-title',
        '.wb-brain-ready-desc',
        '.wb-brain-ready-cta',
        '.wb-brain-guard-title',
        '.wb-brain-guard-desc',
        '.wb-brain-guard-note',
        '.wb-brain-toast-title',
        '.wb-brain-toast-desc',
        '.wb-brain-toast-action'
      ]
      const out = []
      for (const selector of targets) {
        const el = document.querySelector(selector)
        if (!el) continue
        const fg = parse(getComputedStyle(el).color)
        const bg = bgOf(el)
        if (!fg || !bg) {
          out.push(`${selector}: UNMEASURED`)
          continue
        }
        const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
        const a = lum(composited)
        const b = lum(bg)
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        out.push(
          `${label} ${selector} ${getComputedStyle(el).fontSize} → ${ratio.toFixed(2)}:1 ${ratio >= 4.5 ? 'PASS' : 'FAIL'}`
        )
      }
      return out
    }, label)

  // The boot init script always lands on dark; flip once for the light pass.
  const wantLight = globalThis.HIVE_WANT_LIGHT === true
  const results = []

  // 1. Invite (no vault, nothing launched).
  await page.goto('http://localhost:8123/index.html?cb=' + Date.now())
  await page.waitForTimeout(1000)
  if (wantLight) {
    await page.locator('[aria-label="Alternar tema (atual: escuro)"]').click()
    await page.waitForTimeout(300)
  }
  results.push(...(await probe('invite')))

  // 2. Hand-off toast + setup running, over a real conversation.
  await page.locator('textarea').first().fill('Vamos revisar o PRD do checkout')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await page.getByTestId('rail').getByRole('button', { name: 'Configurar base' }).click()
  await page.waitForTimeout(400)
  results.push(...(await probe('running+toast')))

  // 3. The guard, inside the capture sheet.
  await page.locator('[aria-label="Base de conhecimento — perguntar ou capturar"]').click()
  await page.waitForTimeout(200)
  await page.getByText('Colar texto').click()
  await page.waitForTimeout(400)
  results.push(...(await probe('guard-running')))
  await page.keyboard.press('Escape')

  // 4. The vault lands → the ready banner.
  await page.evaluate(() => window.__setVault({}))
  await page.waitForTimeout(700)
  results.push(...(await probe('ready')))

  return { theme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')), results }
}
