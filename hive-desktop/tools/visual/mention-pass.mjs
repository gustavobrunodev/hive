// Companion to tools/visual/boot.mjs — the `@` file-mention pass (M21).
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/mention-pass.mjs
//
// Three states the menu actually has, in three themes: a truncated match set
// (the header admits it), a query that matches nothing (the empty state
// teaches the way out), and a committed reference (the composer pill, which
// is the one run of text painted *behind* live glyphs and therefore the one
// whose contrast no component test can see).
//
// Alpha is composited up the tree — the menu rows, the pill and the row
// highlight are all translucent tints over another tint, and reading the pure
// hue measures a colour nobody sees (docs/visual-validation.md).
async (page) => {
  const THEMES = ['dark', 'light', 'hive']
  const SHOTS = '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  // A workspace with enough files that the ranked page truncates, at enough
  // depths that the directory line is doing real work.
  await page.evaluate(() => {
    const files = [
      'README.md',
      'docs/prd.md',
      'docs/prd-v2.md',
      'docs/arquitetura.md',
      'docs/ux-spec.md',
      'docs/pesquisa/entrevistas.md',
      'docs/pesquisa/prd-rascunho.md',
      'docs/historias/prd-login.md',
      'src/main/index.ts',
      'src/renderer/app.tsx',
      'src/renderer/chat/prompt.tsx',
      'stories/prd-checkout.md',
      'stories/prd-onboarding.md',
      'package.json'
    ]
    window.hive.listFiles = () => Promise.resolve(files)
  })

  const composer = page.locator('textarea').first()

  const type = async (value) => {
    await composer.click()
    await composer.fill('')
    await composer.type(value, { delay: 12 })
    await page.waitForTimeout(220)
  }

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
        // The trap this pass was written to catch: the mention pill's fill is
        // `color-mix(in oklab, …)`, which Chromium computes to `oklab(L a b /
        // alpha)` — a form the regexes above don't know, so it read as
        // "no background" and the pill measured 1.00:1 against the surface it
        // was sitting on. Anything unrecognised goes through a 1x1 canvas,
        // which is the only general resolver. Channels are read as they come
        // (never divided by alpha — docs/visual-validation.md, trap 3).
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000000'
        ctx.fillStyle = text
        if (ctx.fillStyle === '#000000' && text !== '#000000' && text !== 'black') return null
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return a === 0 ? null : { rgb: [r, g, b], a: a / 255 }
      }
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((ch) => {
          const c = ch / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratioOf = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
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
      function measure(el, out, name) {
        const style = getComputedStyle(el)
        const fg = parse(style.color)
        const bg = bgOf(el)
        if (!fg || !bg) {
          out.push(`${name}: UNMEASURED`)
          return
        }
        const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
        const ratio = ratioOf(lum(composited), lum(bg))
        const px = parseFloat(style.fontSize)
        const bold = Number(style.fontWeight) >= 700
        const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
        out.push(
          `${name} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor}) ${
            ratio >= floor ? 'PASS' : 'FAIL'
          }`
        )
      }

      const out = []
      const targets = [
        '.wb-slash-item-label',
        '.wb-mention-hit',
        '.wb-mention-item-dir',
        '.wb-mention-count',
        '.wb-slash-menu-head',
        '.wb-mention-menu-foot',
        '.wb-mention-empty-line',
        '.wb-mention-empty-hint',
        // The highlighted row's runs sit on `--selected-bg`, a different
        // ground from the rows above them; measured separately.
        '.wb-mention-item[data-active] .wb-slash-item-label',
        '.wb-mention-item[data-active] .wb-mention-item-dir'
      ]
      for (const selector of targets) {
        const el = document.querySelector(selector)
        if (el) measure(el, out, `${label} ${selector}`)
      }

      // Non-text UI: the file-type icon and the commit-key glyph owe 3:1.
      // The icon is measured on `.wb-file-icon`, which is where the per-type
      // colour actually lives — the `<svg>` inside it paints `currentColor`
      // and reports no colour of its own.
      for (const selector of [
        '.wb-mention-item[data-active] .wb-file-icon',
        '.wb-mention-item[data-active] .wb-mention-enter'
      ]) {
        const el = document.querySelector(selector)
        if (!el) continue
        const fg = parse(getComputedStyle(el).color)
        const bg = bgOf(el)
        if (!fg || !bg) {
          out.push(`${label} ${selector}: UNMEASURED`)
          continue
        }
        const ratio = ratioOf(lum(fg.rgb), lum(bg))
        out.push(
          `${label} ${selector} → ${ratio.toFixed(2)}:1 (floor 3) ${ratio >= 3 ? 'PASS' : 'FAIL'}`
        )
      }

      // The composer pill. The glyphs belong to the textarea and the pill to
      // the backdrop *behind* it, so no single element carries both — the
      // textarea's own `color` is measured against the pill's composited fill.
      const pill = document.querySelector('.wb-mention-token')
      const textarea = document.querySelector('textarea')
      if (pill && textarea) {
        const fill = bgOf(pill)
        const ink = parse(getComputedStyle(textarea).color)
        if (fill && ink) {
          const ratio = ratioOf(lum(ink.rgb), lum(fill))
          out.push(
            `${label} pill ink-on-fill → ${ratio.toFixed(2)}:1 (floor 4.5) ${
              ratio >= 4.5 ? 'PASS' : 'FAIL'
            }`
          )
          // The pill must also be *visible* as a pill: its fill against the
          // composer surface it sits on. 1.5:1 is not a WCAG floor — there
          // isn't one for "a tint the user can see". It is calibrated from
          // this pass's own screenshots in the `hive` theme, which is the
          // tightest of the three: at 1.30:1 the pill read as a smudge under
          // the glyphs, at 1.60:1 it reads as a chip. Below 1.5, look again.
          const surface = bgOf(pill.parentElement)
          if (surface) {
            const seen = ratioOf(lum(fill), lum(surface))
            out.push(
              `${label} pill fill-vs-surface → ${seen.toFixed(2)}:1 (floor 1.5) ${
                seen >= 1.5 ? 'PASS' : 'FAIL'
              }`
            )
          }
        }
      }
      return out
    }, label)

  const results = []
  for (const theme of THEMES) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(200)

    // 1. Truncated match set — the header says "8 de N". An empty query
    // matches the whole workspace, which is the only way to reach it here.
    await type('revisa @')
    results.push(...(await probe(`${theme} matches`)))
    await page.screenshot({ path: `${SHOTS}/mention-${theme}-matches.png` })

    // 2. Nothing matches — the empty state.
    await type('revisa @zzzznada')
    results.push(...(await probe(`${theme} empty`)))
    await page.screenshot({ path: `${SHOTS}/mention-${theme}-empty.png` })

    // 3. A committed reference: the pill behind the composer's own glyphs.
    await type('compare @docs/prd.md com @src/main/index.ts e resuma')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    results.push(...(await probe(`${theme} pill`)))
    await page.screenshot({ path: `${SHOTS}/mention-${theme}-pill.png` })
  }

  const failures = results.filter((line) => line.includes('FAIL') || line.includes('UNMEASURED'))
  return { total: results.length, failures, sample: results.slice(0, 14) }
}
