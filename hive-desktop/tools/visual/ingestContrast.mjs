// Contrast probe for the ingestion sheet's redesigned surfaces (SB-R4.7/5.6/7.4).
// Companion to tools/visual/boot.mjs — run after boot, once per theme.
//
// Alpha compositing is the whole reason this is not a one-liner: almost every
// new surface here sits on a translucent tint (`--selected-bg`, `--success-bg`,
// the live frame's accent wash), and a naive `rgb()` read measures the text
// against a colour no pixel on screen actually has.
async (page) => {
  const wantLight = globalThis.HIVE_WANT_LIGHT === true
  const audioDir =
    globalThis.HIVE_AUDIO_DIR ??
    '/tmp/claude-1000/-home-gustavobgt-user-harness-hive/5ea95d98-1613-43a5-b0f4-408277aaa3a0/scratchpad'
  if (wantLight) {
    await page.locator('[aria-label="Alternar tema (atual: escuro)"]').click()
    await page.waitForTimeout(300)
  }

  await page.evaluate(() => window.__setVault({ rawPending: 0 }))
  await page.waitForTimeout(300)

  const openOn = async (source) => {
    await page.locator('[class*="fab"]').first().click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitem', { name: source }).click()
    await page.waitForTimeout(450)
  }

  const probe = async (label) =>
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
      const parse = (value) => {
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
        // `oklch(L C H)` is how a token declares a colour; `oklab(L a b)` is how
        // `color-mix(in oklab, …)` serializes. Both appear in this sheet, and a
        // parser that knows neither silently drops every tinted surface from
        // the measurement — which reads as "no findings" rather than "no data".
        const oklch = text.match(
          /^oklch\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+%?))?\)$/
        )
        if (oklch) {
          const L = oklch[1].endsWith('%') ? Number(oklch[1].slice(0, -1)) / 100 : Number(oklch[1])
          const C = Number(oklch[2])
          const h = (Number(oklch[3]) * Math.PI) / 180
          const alpha = oklch[4] === undefined
            ? 1
            : oklch[4].endsWith('%')
              ? Number(oklch[4].slice(0, -1)) / 100
              : Number(oklch[4])
          return oklabToRgb(L, C * Math.cos(h), C * Math.sin(h), alpha)
        }
        const oklab = text.match(/^oklab\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+))?\)$/)
        if (oklab) {
          // OKLab → linear sRGB → sRGB. `color-mix(in oklab, …)` serializes as
          // this in Chromium, and a parser that skips it silently drops every
          // tinted surface in the sheet from the measurement.
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
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((ch) => {
          const c = ch / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const bgOf = (el) => {
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
      for (const selector of window.__contrastTargets) {
        for (const el of document.querySelectorAll(selector)) {
          const cs = getComputedStyle(el)
          const fg = parse(cs.color)
          const bg = bgOf(el)
          if (!fg || !bg) {
            out.push(`${label} ${selector}: UNMEASURED (${cs.color})`)
            continue
          }
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          const px = parseFloat(cs.fontSize)
          const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
          const floor = large ? 3 : 4.5
          out.push(
            `${label} ${selector} ${cs.fontSize}/${cs.fontWeight} → ${ratio.toFixed(2)}:1 ${ratio >= floor ? 'PASS' : 'FAIL'}`
          )
          break // one instance per selector is enough; they share a rule
        }
      }
      return out
    }, label)

  const results = []

  await page.evaluate(() => {
    window.__contrastTargets = [
      '.wb-source-tab[data-active]',
      '.wb-source-tab:not([data-active])',
      '.wb-brain-dropzone-title',
      '.wb-brain-dropzone-action',
      '.wb-brain-dropzone-hint',
      '.wb-transcript-label',
      '.wb-transcript-hint',
      '.wb-model-strip-label',
      '.wb-model-strip-value',
      '.wb-model-strip-badge',
      '.wb-model-caption',
      '.wb-brain-ingest-block'
    ]
  })
  await openOn('Enviar áudio')
  results.push(...(await probe('audio')))

  // Staged files: the list, its totals, and the one filled action.
  const dir = audioDir
  if (dir) {
    await page.locator('input[type=file]').setInputFiles([dir + '/reuniao-de-produto.wav'])
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      window.__contrastTargets = [
        '.wb-stage-count',
        '.wb-stage-size',
        '.wb-stage-clear',
        '.wb-stage-file-name',
        '.wb-stage-file-size',
        '.wb-stage-add',
        '.wb-stage-go',
        '.wb-stage-note'
      ]
    })
    results.push(...(await probe('staged')))
  }

  // The picker's popover.
  await page.locator('.wb-model-strip').click()
  await page.waitForTimeout(350)
  await page.evaluate(() => {
    window.__contrastTargets = [
      '.wb-model-pop-title',
      '.wb-model-pop-note',
      '.wb-model-option-name',
      '.wb-model-option-tradeoff',
      '.wb-model-option-meta',
      '.wb-model-option-bundled',
      '.wb-model-pop-more'
    ]
  })
  results.push(...(await probe('picker')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // Live dictation, idle and mid-take.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    window.__hiveDictationE2E = { transcript: 'uma frase transcrita', ticks: [], levels: [] }
  })
  await openOn('Ditar ao vivo')
  await page.evaluate(() => {
    window.__contrastTargets = ['.wb-live-title', '.wb-live-hint']
  })
  results.push(...(await probe('live-idle')))

  await page.getByRole('button', { name: 'Começar a ditar' }).click()
  await page.waitForTimeout(350)
  await page.evaluate(() => {
    const h = window.__hiveDictationE2E
    const tick = (rms) => ({ rms, samples: new Float32Array(16000) })
    for (const rms of [0.001, 0.6, 0.6]) h.ticks.forEach((p) => p(tick(rms)))
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    window.__contrastTargets = ['.wb-live-title', '.wb-live-clock', '.wb-live-action']
  })
  results.push(...(await probe('live-listening')))

  // Silence long enough for the notice — a warning-toned state.
  await page.evaluate(() => {
    const h = window.__hiveDictationE2E
    const tick = (rms) => ({ rms, samples: new Float32Array(16000) })
    for (let i = 0; i < 4; i++) h.ticks.forEach((p) => p(tick(0.001)))
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    window.__contrastTargets = ['.wb-live-title', '.wb-live-hint']
  })
  results.push(...(await probe('live-silent')))

  return results
}
