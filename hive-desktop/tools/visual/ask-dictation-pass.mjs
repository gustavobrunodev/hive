// Companion to tools/visual/boot.mjs — the visual + contrast pass for dictation
// inside "Perguntar à base" (the ask dialog's microphone).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/ask-dictation-pass.mjs
//
// The microphone is the E2E seam (`__hiveDictationE2E`), armed in an init
// script and picked up on reload: `useWhisperDictation` reads it once, when the
// engine memo is built, so arming it on a live page changes nothing on screen.
// Ticks are pushed straight into the segmenter, exactly as e2e/voice-prompt
// does — everything above the microphone is production code.
//
// Screenshots land in `.playwright-mcp/ask-dictation-<state>-<theme>.png`.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const measure = async (state, targets, nonText = []) =>
    await page.evaluate(
      ({ state, targets, nonText }) => {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        function parse(value) {
          const text = String(value).trim()
          if (text === '' || text === 'transparent') return { rgb: [0, 0, 0], a: 0 }
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#010203'
          ctx.fillStyle = text
          if (ctx.fillStyle === '#010203' && text !== '#010203') return null
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          const d = ctx.getImageData(0, 0, 1, 1).data
          return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        // Starts at the element ITSELF: a tinted row measured against its
        // grandparent is measured against a colour that is not on screen.
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
        for (const { selector, prop } of nonText) {
          const el = document.querySelector(selector)
          if (el === null) {
            missing.push(`${state} ${selector}`)
            continue
          }
          const fg = parse(getComputedStyle(el)[prop])
          const bg = bgOf(el, false)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          if (ratio < 3) {
            failures.push(`${state} ${selector} [${prop}] → ${ratio.toFixed(2)}:1 (floor 3)`)
          }
        }
        return { failures, missing }
      },
      { state, targets, nonText }
    )

  const IDLE = [
    '.wb-brain-ask-title',
    '.wb-brain-ask-desc',
    '.wb-brain-ask-vault',
    '.wb-brain-ask-field textarea',
    '.wb-brain-ask-block-title',
    '.wb-brain-ask-chip',
    '.wb-brain-ask-hint'
  ]
  // The microphone is an icon, so it carries the 3:1 floor for non-text.
  const IDLE_NON_TEXT = [{ selector: '.wb-brain-ask-foot .wb-mic-btn', prop: 'color' }]
  const LIVE = [
    '.wb-brain-ask-foot .wb-dictation-elapsed',
    '.wb-brain-ask-foot .wb-dictation-status-line',
    '.wb-brain-ask-foot .wb-dictation-hint',
    '.wb-brain-ask-foot .wb-dictation-btn',
    '.wb-brain-ask-foot .wb-dictation-btn[data-emphasis="primary"]'
  ]
  const LIVE_NON_TEXT = [
    { selector: '.wb-brain-ask-foot .wb-dictation-dot', prop: 'backgroundColor' },
    { selector: '.wb-brain-ask-field.hds-hl-textarea', prop: 'borderColor' }
  ]

  /** Feeds the segmenter `ms` of audio at one level, through the stand-in. */
  const speak = async (ms, rms) =>
    await page.evaluate(
      ({ ms, rms }) => {
        const harness = window.__hiveDictationE2E
        for (let i = 0; i < Math.ceil(ms / 32); i += 1) {
          for (const listener of harness?.ticks ?? []) {
            listener({ rms, samples: new Float32Array(512).fill(rms) })
          }
          for (const listener of harness?.levels ?? []) {
            listener([rms * 2, rms * 1.4, rms * 2.4, rms, rms * 1.8])
          }
        }
      },
      { ms, rms }
    )

  await page.addInitScript(() => {
    window.__hiveDictationE2E = { transcript: 'como versionamos os specs do projeto' }
  })

  async function sweep(theme) {
    const failures = []
    const missing = []
    const take = (r) => {
      failures.push(...r.failures)
      missing.push(...r.missing)
    }

    await page.reload()
    await page.waitForTimeout(1400)

    if (theme !== 'dark') {
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // A base has to exist, or the dialog offers setup instead of a field.
    await page.evaluate(() => window.__setVault({ rawPending: 0 }))
    await page.waitForTimeout(400)

    // 1. The resting dialog: the microphone beside the submit hint.
    await page.keyboard.press('Control+Shift+K')
    await page.waitForTimeout(500)
    take(await measure('ask-idle', IDLE, IDLE_NON_TEXT))
    await page
      .locator('.wb-brain-ask-dialog')
      .screenshot({ path: `${shots}/ask-dictation-idle-${theme}.png` })

    // 2. A live take: the transport replaces the hint, in place.
    await page.click('.wb-brain-ask-foot .wb-mic-btn')
    await page.waitForTimeout(300)
    await speak(100, 0.002) // the room, seeding the noise floor
    await speak(1500, 0.4) // speech
    await page.waitForTimeout(400)
    take(await measure('ask-listening', LIVE, LIVE_NON_TEXT))
    await page
      .locator('.wb-brain-ask-dialog')
      .screenshot({ path: `${shots}/ask-dictation-listening-${theme}.png` })

    // 3. The phrase lands in the question field, marked as just-arrived.
    await speak(800, 0.002) // a real pause — the segment is cut
    await page.waitForTimeout(600)
    const landed = await page.evaluate(() => ({
      value: document.querySelector('.wb-brain-ask-field textarea')?.value ?? '',
      fresh: document.querySelector('.wb-brain-ask-field .wb-composer-fresh')?.textContent ?? null,
      submit: document.querySelector('.wb-brain-ask-foot .wb-btn')?.disabled ?? null
    }))
    await page
      .locator('.wb-brain-ask-dialog')
      .screenshot({ path: `${shots}/ask-dictation-landed-${theme}.png` })

    // 4. Concluir settles the take and the dialog goes back to its resting row.
    await page.click('.wb-brain-ask-foot .wb-dictation-btn[data-emphasis="primary"]')
    await page.waitForTimeout(600)
    const settled = await page.evaluate(() => ({
      transport: document.querySelector('.wb-brain-ask-foot .wb-dictation') !== null,
      mic: document.querySelector('.wb-brain-ask-foot .wb-mic-btn') !== null,
      value: document.querySelector('.wb-brain-ask-field textarea')?.value ?? ''
    }))
    await page
      .locator('.wb-brain-ask-dialog')
      .screenshot({ path: `${shots}/ask-dictation-settled-${theme}.png` })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    return { theme, failures, missing, landed, settled }
  }

  const report = []
  for (const theme of THEMES) report.push(await sweep(theme))
  return JSON.stringify(report, null, 2)
}
