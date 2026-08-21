// Companion to tools/visual/boot.mjs — the contrast sweep for the
// multi-workspace surfaces (the switcher panel and the kind gate), across all
// three themes in one run.
//
// Same machinery as tools/visual/contrast.mjs (alpha compositing up the tree,
// oklch/oklab parsing) with two additions this feature needs:
//  - it measures **every** row, not the first match, because each workspace's
//    mark is a different hue and only the worst one matters;
//  - it applies the right WCAG floor per target: 11px labels are body text and
//    owe 4.5:1, only genuinely large or purely decorative marks get 3:1.
async (page) => {
  const measure = async (label) =>
    await page.evaluate((label) => {
      /** OKLab → sRGB, shared by the oklch and oklab branches below. */
      const oklabToRgb = (L, A, B, alpha) => {
        const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
        const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
        const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
        const lin = [
          +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
        ]
        return {
          rgb: lin.map((c) => {
            const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055
            return Math.min(255, Math.max(0, v * 255))
          }),
          a: alpha
        }
      }
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
          return { rgb: [rgb[1], rgb[2], rgb[3]].map(Number), a: rgb[4] === undefined ? 1 : Number(rgb[4]) }
        // `oklch(L C H)` is how a token declares a colour; `oklab(L a b)` is
        // how `color-mix(in oklab, …)` serializes. Every workspace mark and
        // every state colour on this surface is one or the other, and the
        // first version of this probe knew neither — it reported them
        // UNMEASURED, which reads as "no findings" rather than "no data".
        const oklch = text.match(
          /^oklch\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+%?))?\)$/
        )
        if (oklch) {
          const L = oklch[1].endsWith('%') ? Number(oklch[1].slice(0, -1)) / 100 : Number(oklch[1])
          const C = Number(oklch[2])
          const h = (Number(oklch[3]) * Math.PI) / 180
          const alpha =
            oklch[4] === undefined
              ? 1
              : oklch[4].endsWith('%')
                ? Number(oklch[4].slice(0, -1)) / 100
                : Number(oklch[4])
          return oklabToRgb(L, C * Math.cos(h), C * Math.sin(h), alpha)
        }
        const oklab = text.match(
          /^oklab\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+))?\)$/
        )
        if (oklab) {
          const L = oklab[1].endsWith('%') ? Number(oklab[1].slice(0, -1)) / 100 : Number(oklab[1])
          return oklabToRgb(
            L,
            Number(oklab[2]),
            Number(oklab[3]),
            oklab[4] === undefined ? 1 : Number(oklab[4])
          )
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

      // `floor` is the WCAG minimum this target owes. 3:1 is reserved for
      // non-text marks (the state dot) — every label here is small text.
      const targets = [
        ['.wb-workspace-chip-name', 4.5],
        ['.wb-workspace-chip-light', 4.5],
        ['.wb-ws-search-input', 4.5],
        ['.wb-ws-search-kbd', 4.5],
        ['.wb-ws-group', 4.5],
        ['.wb-ws-row-name', 4.5],
        ['.wb-ws-row-active', 4.5],
        ['.wb-ws-row-time', 4.5],
        ['.wb-ws-row-state', 4.5],
        ['.wb-ws-row-path', 4.5],
        ['.wb-ws-row-jump', 4.5],
        ['.wb-ws-mark-text', 4.5],
        ['.wb-ws-add', 4.5],
        ['.wb-ws-empty', 4.5],
        ['.wb-wskind-path', 4.5],
        ['.wb-wskind-detail', 4.5],
        ['.wb-choice-card-title', 4.5],
        ['.wb-choice-card-desc', 4.5]
      ]
      const out = []
      for (const [selector, floor] of targets) {
        const nodes = [...document.querySelectorAll(selector)]
        if (nodes.length === 0) continue
        for (const el of nodes) {
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.opacity === '0') continue
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
          if (ratio < floor) {
            out.push(
              `${label} ${selector} "${el.textContent.trim().slice(0, 24)}" ${style.fontSize} → ${ratio.toFixed(2)}:1 FAIL (floor ${floor})`
            )
          }
        }
      }
      return out
    }, label)

  const results = []
  for (const theme of ['dark', 'light', 'hive']) {
    await page.goto('http://localhost:8123/index.html?cb=' + Date.now())
    await page.waitForTimeout(900)
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(120)

    // 1. The switcher panel, every row.
    await page.locator('.wb-workspace-chip').click()
    await page.waitForTimeout(250)
    results.push(...(await measure(`${theme} panel`)))

    // 2. The empty filter state.
    await page.locator('.wb-ws-search-input').fill('zzzz')
    await page.waitForTimeout(150)
    results.push(...(await measure(`${theme} empty`)))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)

    // 3. The kind gate — the boot fixture's `preview` always answers `choose`,
    //    so "Adicionar workspace…" lands straight on it.
    await page.locator('.wb-workspace-chip').click()
    await page.waitForTimeout(200)
    await page.getByText('Adicionar workspace…').click()
    await page.waitForTimeout(500)
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    results.push(...(await measure(`${theme} kind-gate`)))
    // Selected state: the accent-tinted card has its own ink pairing.
    await page.getByText('Workspace leve').click()
    await page.waitForTimeout(200)
    results.push(...(await measure(`${theme} kind-gate-selected`)))
  }
  return results.length === 0 ? 'ALL PASS' : results
}
