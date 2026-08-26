// Companion to tools/visual/boot.mjs — the visual + contrast pass for M26's
// two cross-surface pieces: the model gate every recording surface passes
// through when nothing is installed, and the notices that announce a
// download's ending wherever the user happens to be.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/voice-gate-pass.mjs
//
// The catalog fixture is emptied through `window.__HIVE_MODELS` BEFORE the
// microphone is pressed, and the page is reloaded after setting it: the chat's
// `useVoiceGate` reads the preference once on mount, so mutating it afterwards
// measures a state the component never rendered.
//
// Screenshots land in `.playwright-mcp/m26-gate-<state>-<theme>.png`.
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
        // Starts at the element ITSELF: a tinted card measured against its
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
          if (ratio < 3) failures.push(`${state} ${selector} [${prop}] → ${ratio.toFixed(2)}:1 (floor 3)`)
        }
        return { failures, missing }
      },
      { state, targets, nonText }
    )

  const GATE = [
    '.wb-vgate-title',
    '.wb-vgate-desc',
    '.wb-vgate-opt .wb-vrow-name',
    '.wb-vgate-opt .wb-vrow-tradeoff',
    '.wb-vgate-opt .wb-vrow-facts',
    '.wb-vgate-opt .wb-vmeter-label',
    '.wb-vgate-why',
    '.wb-vbtn-wide',
    '.wb-vgate-foot',
    '.wb-vgate-foot .wb-vlink'
  ]
  const GATE_NON_TEXT = [{ selector: '.wb-vmeter-step[data-on]', prop: 'backgroundColor' }]
  const GATE_BUSY = [
    '.wb-vgate-title',
    '.wb-vgate-desc',
    '.wb-vdl-numbers',
    '.wb-vdl-pct',
    '.wb-vdl-meta',
    '.wb-vgate-foot'
  ]
  const GATE_BUSY_NON_TEXT = [{ selector: '.wb-vdl-fill', prop: 'backgroundColor' }]
  const NOTICE_OK = ['.wb-vnotice-title', '.wb-vnotice-text', '.wb-vnotice-actions .wb-vbtn']
  const NOTICE_FAIL = [...NOTICE_OK, '.wb-vnotice-actions .wb-vlink']

  const DONE = {
    id: 'medium',
    variant: 'fp32',
    status: 'done',
    loaded: 3205496832,
    total: 3205496832,
    file: '',
    bytesPerSecond: 0,
    failure: null,
    startedAt: 0,
    updatedAt: 0
  }

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

    // 1. The gate, opened by the composer's microphone — the real route in.
    await page.click('button.wb-mic-btn')
    await page.waitForTimeout(600)
    take(await measure('gate', GATE, GATE_NON_TEXT))
    await page.locator('.wb-vgate').screenshot({ path: `${shots}/m26-gate-idle-${theme}.png` })

    // 2. …with the download it started running inside it. The id has to be the
    // gate's SELECTED model (the probe's recommendation), not just any model:
    // the progress row belongs to the card the user chose, so a snapshot for a
    // different id renders nothing and reports every progress selector missing.
    await page.evaluate(() =>
      window.__downloads([
        {
          id: 'small',
          variant: 'fp32',
          status: 'downloading',
          loaded: 402653184,
          total: 967835648,
          file: 'onnx/encoder_model.onnx',
          bytesPerSecond: 1887436,
          failure: null,
          startedAt: 0,
          updatedAt: 0
        }
      ])
    )
    await page.waitForTimeout(400)
    take(await measure('gate-busy', GATE_BUSY, GATE_BUSY_NON_TEXT))
    await page.locator('.wb-vgate').screenshot({ path: `${shots}/m26-gate-busy-${theme}.png` })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    // 3. The ending, announced where the user is.
    await page.evaluate((d) => window.__downloadSettled(d), DONE)
    await page.waitForTimeout(500)
    take(await measure('notice-done', NOTICE_OK))
    // The CARD, not the column: the column is always mounted (it also holds
    // the update notice) and is 340×0 while empty, which Playwright refuses to
    // screenshot as "not visible".
    await page.locator('.wb-vnotice').screenshot({ path: `${shots}/m26-notice-done-${theme}.png` })

    await page.evaluate(
      (d) =>
        window.__downloadSettled({
          ...d,
          status: 'error',
          loaded: 1288490188,
          failure: { kind: 'disk', detail: 'ENOSPC' }
        }),
      DONE
    )
    await page.waitForTimeout(400)
    take(await measure('notice-fail', NOTICE_FAIL))
    await page.locator('.wb-vnotice').screenshot({ path: `${shots}/m26-notice-fail-${theme}.png` })

    return { theme, failures, missing }
  }

  // The empty catalog has to be in place BEFORE the page loads, and it has to
  // SURVIVE a reload: the chat's gate resolves the preference on mount, and a
  // fixture planted with `page.evaluate` is wiped by the next navigation. An
  // init script is the only thing that runs on every load — and it runs after
  // boot's, so `__HIVE_ALL` is already there to derive from.
  await page.addInitScript(() => {
    window.__HIVE_MODELS = (window.__HIVE_ALL ?? []).map((m) => ({
      ...m,
      downloaded: false,
      downloadedVariant: null
    }))
    window.__HIVE_PREF = { id: null, auto: true, installed: [], recommendation: window.__HIVE_HW }
  })

  const results = []
  for (const theme of THEMES) results.push(await sweep(theme))
  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
